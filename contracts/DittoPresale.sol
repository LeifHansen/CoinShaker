// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Interface for ERC20 tokens with a public burn function
interface IBurnable {
    function burn(uint256 amount) external;
}

/**
 * @title DittoPresale
 * @notice Three-round presale for DittoCoin ($DITTO).
 *
 *   Round       Discount   Vesting
 *   ─────────   ────────   ──────────────────────────────
 *   Seed        60% off    25% at TGE, 75% linear 90 days
 *   EarlyBird   40% off    50% at TGE, 50% linear 60 days
 *   Public      20% off    100% at TGE
 *
 *   Features:
 *   - Per-round hardcap (ETH) and softcap (if not reached → refundable)
 *   - Per-wallet max contribution (anti-whale)
 *   - Whitelist for Seed round
 *   - On-chain referral tracking (5% bonus DITTO for both parties)
 *   - Unsold tokens from completed rounds burn automatically
 *   - Owner finalizes each round; if softcap not met, enables refunds
 */
contract DittoPresale is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Types ───────────────────────────────────────────────────

    enum Round { Seed, EarlyBird, Public }
    enum RoundState { Inactive, Active, Finalized, Refunding }

    struct RoundConfig {
        uint256 tokenPrice;       // DITTO per 1 ETH (e.g., 50_000_000 = 50M DITTO per ETH)
        uint256 hardcapETH;       // max ETH this round can raise
        uint256 softcapETH;       // min ETH for round to succeed
        uint256 maxPerWallet;     // max ETH per wallet
        uint256 tokenAllocation;  // total DITTO allocated to this round
        bool whitelistRequired;   // Seed round requires whitelist
    }

    struct RoundData {
        RoundState state;
        uint256 totalRaised;      // ETH raised this round
        uint256 tokensSold;       // DITTO sold this round
    }

    struct Purchase {
        uint256 ethSpent;
        uint256 tokensOwed;       // base tokens (before referral bonus)
        uint256 referralBonus;    // extra tokens from referral
        bool refunded;
    }

    // ── State ───────────────────────────────────────────────────

    IERC20 public immutable dittoToken;
    address public vestingContract;          // set before finalization

    mapping(Round => RoundConfig) public roundConfigs;
    mapping(Round => RoundData)   public roundData;

    // user → round → purchase
    mapping(address => mapping(Round => Purchase)) public purchases;

    // Whitelist for Seed round
    mapping(address => bool) public whitelisted;

    // Referral tracking
    mapping(address => address) public referrer;        // who referred this buyer
    mapping(address => uint256) public referralCount;   // how many people this address referred
    uint256 public constant REFERRAL_BONUS_BPS = 500;   // 5% bonus for both parties

    // ── Events ──────────────────────────────────────────────────

    event RoundActivated(Round indexed round);
    event RoundFinalized(Round indexed round, uint256 totalRaised, uint256 tokensSold);
    event RoundRefunding(Round indexed round);
    event TokensPurchased(address indexed buyer, Round indexed round, uint256 ethAmount, uint256 tokenAmount);
    event ReferralRecorded(address indexed buyer, address indexed referrer, uint256 bonusTokens);
    event Refunded(address indexed buyer, Round indexed round, uint256 ethAmount);
    event WhitelistUpdated(address indexed account, bool status);
    event UnsoldTokensBurned(Round indexed round, uint256 amount);
    event VestingContractSet(address indexed vestingContract);

    constructor(address _dittoToken) Ownable(msg.sender) {
        require(_dittoToken != address(0), "Invalid token");
        dittoToken = IERC20(_dittoToken);
    }

    // ── Owner: Configure rounds ─────────────────────────────────

    /**
     * @notice Configure a presale round. Must be called before activating.
     * @param round Which round to configure
     * @param tokenPrice DITTO tokens per 1 ETH
     * @param hardcapETH Maximum ETH this round accepts
     * @param softcapETH Minimum ETH for round to succeed (0 = no softcap)
     * @param maxPerWallet Maximum ETH contribution per wallet
     * @param tokenAllocation Total DITTO allocated for this round
     * @param whitelistRequired Whether buyers must be whitelisted
     */
    function configureRound(
        Round round,
        uint256 tokenPrice,
        uint256 hardcapETH,
        uint256 softcapETH,
        uint256 maxPerWallet,
        uint256 tokenAllocation,
        bool whitelistRequired
    ) external onlyOwner {
        require(roundData[round].state == RoundState.Inactive, "Round already started");
        require(tokenPrice > 0, "Price must be > 0");
        require(hardcapETH > 0, "Hardcap must be > 0");
        require(softcapETH <= hardcapETH, "Softcap > hardcap");
        require(maxPerWallet > 0, "Max per wallet must be > 0");
        require(tokenAllocation > 0, "Allocation must be > 0");

        roundConfigs[round] = RoundConfig({
            tokenPrice: tokenPrice,
            hardcapETH: hardcapETH,
            softcapETH: softcapETH,
            maxPerWallet: maxPerWallet,
            tokenAllocation: tokenAllocation,
            whitelistRequired: whitelistRequired
        });
    }

    /**
     * @notice Activate a round for purchases. Tokens must already be deposited.
     */
    function activateRound(Round round) external onlyOwner {
        require(roundData[round].state == RoundState.Inactive, "Round not inactive");
        require(roundConfigs[round].tokenPrice > 0, "Round not configured");

        // Verify contract holds enough tokens for this round's allocation
        // (accounting for tokens already committed to other active rounds)
        roundData[round].state = RoundState.Active;
        emit RoundActivated(round);
    }

    /**
     * @notice Finalize a round. If softcap met → tokens go to vesting. If not → enable refunds.
     */
    function finalizeRound(Round round) external onlyOwner {
        require(roundData[round].state == RoundState.Active, "Round not active");

        RoundConfig storage cfg = roundConfigs[round];
        RoundData storage data = roundData[round];

        if (cfg.softcapETH > 0 && data.totalRaised < cfg.softcapETH) {
            // Softcap not met → enable refunds
            data.state = RoundState.Refunding;
            emit RoundRefunding(round);
        } else {
            // Success → finalize
            data.state = RoundState.Finalized;

            // Transfer sold tokens to vesting contract
            if (vestingContract != address(0) && data.tokensSold > 0) {
                dittoToken.safeTransfer(vestingContract, data.tokensSold);
            }

            // Burn unsold tokens (reduces totalSupply)
            uint256 unsold = cfg.tokenAllocation - data.tokensSold;
            if (unsold > 0) {
                IBurnable(address(dittoToken)).burn(unsold);
                emit UnsoldTokensBurned(round, unsold);
            }

            emit RoundFinalized(round, data.totalRaised, data.tokensSold);
        }
    }

    // ── Owner: Whitelist management ─────────────────────────────

    function setWhitelist(address[] calldata accounts, bool status) external onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            whitelisted[accounts[i]] = status;
            emit WhitelistUpdated(accounts[i], status);
        }
    }

    function setVestingContract(address _vesting) external onlyOwner {
        require(_vesting != address(0), "Invalid vesting address");
        vestingContract = _vesting;
        emit VestingContractSet(_vesting);
    }

    // ── Buy ─────────────────────────────────────────────────────

    /**
     * @notice Purchase DITTO in the active round.
     * @param round Which round to buy in
     * @param _referrer Address that referred this buyer (0x0 if none)
     */
    function buy(Round round, address _referrer) external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "Must send ETH");
        require(roundData[round].state == RoundState.Active, "Round not active");

        RoundConfig storage cfg = roundConfigs[round];
        RoundData storage data = roundData[round];
        Purchase storage p = purchases[msg.sender][round];

        // Whitelist check
        if (cfg.whitelistRequired) {
            require(whitelisted[msg.sender], "Not whitelisted");
        }

        // Per-wallet limit
        require(p.ethSpent + msg.value <= cfg.maxPerWallet, "Exceeds wallet limit");

        // Hardcap check
        require(data.totalRaised + msg.value <= cfg.hardcapETH, "Exceeds round hardcap");

        // Calculate tokens
        uint256 baseTokens = msg.value * cfg.tokenPrice;

        // Estimate max possible referral bonus (both buyer + referrer = 2x bonus)
        uint256 maxBonusTokens = 0;
        if (_referrer != address(0) || referrer[msg.sender] != address(0)) {
            maxBonusTokens = (baseTokens * REFERRAL_BONUS_BPS * 2) / 10_000;
        }
        require(data.tokensSold + baseTokens + maxBonusTokens <= cfg.tokenAllocation, "Exceeds allocation");

        // Record purchase
        p.ethSpent += msg.value;
        p.tokensOwed += baseTokens;
        data.totalRaised += msg.value;
        data.tokensSold += baseTokens;

        emit TokensPurchased(msg.sender, round, msg.value, baseTokens);

        // Handle referral (only set once, can't change referrer)
        if (_referrer != address(0) && _referrer != msg.sender && referrer[msg.sender] == address(0)) {
            referrer[msg.sender] = _referrer;
            referralCount[_referrer]++;
        }

        // Apply referral bonus if buyer has a referrer
        if (referrer[msg.sender] != address(0)) {
            uint256 bonus = (baseTokens * REFERRAL_BONUS_BPS) / 10_000;

            // Bonus for buyer
            p.referralBonus += bonus;
            data.tokensSold += bonus;

            // Bonus for referrer
            Purchase storage refPurchase = purchases[referrer[msg.sender]][round];
            refPurchase.referralBonus += bonus;
            data.tokensSold += bonus;

            emit ReferralRecorded(msg.sender, referrer[msg.sender], bonus);
        }
    }

    // ── Refund (only if round failed softcap) ───────────────────

    function refund(Round round) external nonReentrant {
        require(roundData[round].state == RoundState.Refunding, "Refunds not enabled");
        Purchase storage p = purchases[msg.sender][round];
        require(p.ethSpent > 0, "Nothing to refund");
        require(!p.refunded, "Already refunded");

        p.refunded = true;
        uint256 amount = p.ethSpent;

        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "ETH transfer failed");

        emit Refunded(msg.sender, round, amount);
    }

    // ── Owner: Withdraw raised ETH ──────────────────────────────

    /**
     * @notice Withdraw ETH from a finalized round.
     */
    function withdrawETH(Round round) external onlyOwner {
        require(roundData[round].state == RoundState.Finalized, "Round not finalized");
        uint256 balance = roundData[round].totalRaised;
        require(balance > 0, "Nothing to withdraw");

        // Reset to prevent double withdrawal
        roundData[round].totalRaised = 0;

        (bool sent, ) = msg.sender.call{value: balance}("");
        require(sent, "ETH transfer failed");
    }

    // ── Pause ───────────────────────────────────────────────────

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ── View helpers ────────────────────────────────────────────

    function getPurchase(address buyer, Round round) external view returns (
        uint256 ethSpent,
        uint256 tokensOwed,
        uint256 referralBonus,
        bool refunded
    ) {
        Purchase storage p = purchases[buyer][round];
        return (p.ethSpent, p.tokensOwed, p.referralBonus, p.refunded);
    }

    function getRoundStatus(Round round) external view returns (
        RoundState state,
        uint256 totalRaised,
        uint256 tokensSold,
        uint256 hardcapETH,
        uint256 softcapETH,
        uint256 tokenAllocation
    ) {
        RoundData storage data = roundData[round];
        RoundConfig storage cfg = roundConfigs[round];
        return (data.state, data.totalRaised, data.tokensSold, cfg.hardcapETH, cfg.softcapETH, cfg.tokenAllocation);
    }

    /// @notice Get the referral tier for an address
    function getReferralTier(address account) external view returns (string memory) {
        uint256 count = referralCount[account];
        if (count >= 21) return "Gold";
        if (count >= 6) return "Silver";
        if (count >= 1) return "Bronze";
        return "None";
    }

    receive() external payable {
        revert("Use buy() function");
    }
}
