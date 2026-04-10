// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title DittoPresale
 * @notice Three-round presale for DittoCoin (DITTO).
 *   Round       Discount   Vesting
 *   Seed        60% off    25% at TGE, 75% linear 90 days
 *   EarlyBird   40% off    50% at TGE, 50% linear 60 days
 *   Public      20% off    100% at TGE
 */
contract DittoPresale is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Round { Seed, EarlyBird, Public }
    enum RoundState { Inactive, Active, Finalized, Refunding }

    struct RoundConfig {
        uint256 tokenPrice;
        uint256 hardcapETH;
        uint256 softcapETH;
        uint256 maxPerWallet;
        uint256 tokenAllocation;
        bool whitelistRequired;
    }

    struct RoundData {
        RoundState state;
        uint256 totalRaised;
        uint256 tokensSold;
    }

    struct Purchase {
        uint256 ethSpent;
        uint256 tokensOwed;
        uint256 referralBonus;
        bool refunded;
    }

    IERC20 public immutable dittoToken;
    address public vestingContract;

    mapping(Round => RoundConfig) public roundConfigs;
    mapping(Round => RoundData) public roundData;
    mapping(address => mapping(Round => Purchase)) public purchases;
    mapping(address => bool) public whitelisted;
    mapping(address => address) public referrer;
    mapping(address => uint256) public referralCount;
    uint256 public constant REFERRAL_BONUS_BPS = 500;

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

    function activateRound(Round round) external onlyOwner {
        require(roundData[round].state == RoundState.Inactive, "Round not inactive");
        require(roundConfigs[round].tokenPrice > 0, "Round not configured");
        roundData[round].state = RoundState.Active;
        emit RoundActivated(round);
    }

    function finalizeRound(Round round) external onlyOwner {
        require(roundData[round].state == RoundState.Active, "Round not active");
        RoundConfig storage cfg = roundConfigs[round];
        RoundData storage data = roundData[round];

        if (cfg.softcapETH > 0 && data.totalRaised < cfg.softcapETH) {
            data.state = RoundState.Refunding;
            emit RoundRefunding(round);
        } else {
            data.state = RoundState.Finalized;
            if (vestingContract != address(0) && data.tokensSold > 0) {
                dittoToken.safeTransfer(vestingContract, data.tokensSold);
            }
            uint256 unsold = cfg.tokenAllocation - data.tokensSold;
            if (unsold > 0) {
                dittoToken.safeTransfer(address(0xdead), unsold);
                emit UnsoldTokensBurned(round, unsold);
            }
            emit RoundFinalized(round, data.totalRaised, data.tokensSold);
        }
    }

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

    function buy(Round round, address _referrer) external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "Must send ETH");
        require(roundData[round].state == RoundState.Active, "Round not active");

        RoundConfig storage cfg = roundConfigs[round];
        RoundData storage data = roundData[round];
        Purchase storage p = purchases[msg.sender][round];

        if (cfg.whitelistRequired) {
            require(whitelisted[msg.sender], "Not whitelisted");
        }
        require(p.ethSpent + msg.value <= cfg.maxPerWallet, "Exceeds wallet limit");
        require(data.totalRaised + msg.value <= cfg.hardcapETH, "Exceeds round hardcap");

        uint256 baseTokens = msg.value * cfg.tokenPrice;
        require(data.tokensSold + baseTokens <= cfg.tokenAllocation, "Exceeds allocation");

        p.ethSpent += msg.value;
        p.tokensOwed += baseTokens;
        data.totalRaised += msg.value;
        data.tokensSold += baseTokens;

        emit TokensPurchased(msg.sender, round, msg.value, baseTokens);

        if (_referrer != address(0) && _referrer != msg.sender && referrer[msg.sender] == address(0)) {
            referrer[msg.sender] = _referrer;
            referralCount[_referrer]++;
        }

        if (referrer[msg.sender] != address(0)) {
            uint256 bonus = (baseTokens * REFERRAL_BONUS_BPS) / 10_000;
            p.referralBonus += bonus;
            data.tokensSold += bonus;
            Purchase storage refPurchase = purchases[referrer[msg.sender]][round];
            refPurchase.referralBonus += bonus;
            data.tokensSold += bonus;
            emit ReferralRecorded(msg.sender, referrer[msg.sender], bonus);
        }
    }

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

    function withdrawETH(Round round) external onlyOwner {
        require(roundData[round].state == RoundState.Finalized, "Round not finalized");
        uint256 balance = roundData[round].totalRaised;
        require(balance > 0, "Nothing to withdraw");
        roundData[round].totalRaised = 0;
        (bool sent, ) = msg.sender.call{value: balance}("");
        require(sent, "ETH transfer failed");
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function getPurchase(address buyer, Round round) external view returns (
        uint256 ethSpent, uint256 tokensOwed, uint256 referralBonus, bool refunded
    ) {
        Purchase storage p = purchases[buyer][round];
        return (p.ethSpent, p.tokensOwed, p.referralBonus, p.refunded);
    }

    function getRoundStatus(Round round) external view returns (
        RoundState state, uint256 totalRaised, uint256 tokensSold,
        uint256 hardcapETH, uint256 softcapETH, uint256 tokenAllocation
    ) {
        RoundData storage data = roundData[round];
        RoundConfig storage cfg = roundConfigs[round];
        return (data.state, data.totalRaised, data.tokensSold, cfg.hardcapETH, cfg.softcapETH, cfg.tokenAllocation);
    }

    function getReferralTier(address account) external view returns (string memory) {
        uint256 count = referralCount[account];
        if (count >= 21) return "Gold";
        if (count >= 6) return "Silver";
        if (count >= 1) return "Bronze";
        return "None";
    }

    receive() external payable { revert("Use buy() function"); }
}
