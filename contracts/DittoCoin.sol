// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title DittoCoin (DITTO)
 * @notice A community-driven memecoin on Ethereum with built-in tokenomics:
 *
 *   - Halving burn: starts at 2%, halves every 180 days
 *     Era 0: 2% -> Era 1: 1% -> Era 2: 0.5% -> Era 3: 0.25% -> ...
 *     Floor: 0.01% (1 bps) - burn never reaches zero
 *   - 1% to community treasury    -> self-funding growth
 *   - Anti-whale: max 1% of supply per wallet, 0.5% per tx
 *
 *   420 billion tokens minted at deploy. No mint function.
 */
contract DittoCoin is ERC20, Ownable2Step, Pausable {
    uint256 public constant INITIAL_SUPPLY = 420_000_000_000 * 10 ** 18;

    // Halving burn configuration
    uint256 public constant INITIAL_BURN_BPS = 200;      // 2% starting burn
    uint256 public constant MIN_BURN_BPS = 1;             // 0.01% floor
    uint256 public constant HALVING_INTERVAL = 180 days;  // ~6 months per era
    uint256 public immutable deployTimestamp;

    // Fee configuration (basis points, 100 = 1%)
    uint256 public treasuryFeeBps = 100;  // 1%

    // Anti-whale limits
    uint256 public maxWalletBps = 100;    // 1% of initial supply
    uint256 public maxTxBps = 50;         // 0.5% of initial supply

    address public treasury;

    mapping(address => bool) public isExempt;

    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event ExemptUpdated(address indexed account, bool exempt);
    event FeesUpdated(uint256 treasuryFeeBps);
    event LimitsUpdated(uint256 maxWalletBps, uint256 maxTxBps);

    constructor(address _treasury) ERC20("DittoCoin", "DITTO") Ownable(msg.sender) {
        require(_treasury != address(0), "Treasury cannot be zero address");
        treasury = _treasury;
        deployTimestamp = block.timestamp;

        isExempt[msg.sender] = true;
        isExempt[_treasury] = true;

        _mint(msg.sender, INITIAL_SUPPLY);
    }

    function _update(address from, address to, uint256 amount) internal override whenNotPaused {
        if (from == address(0) || to == address(0)) {
            super._update(from, to, amount);
            return;
        }

        require(to != address(this), "Cannot transfer to token contract");

        bool exempt = isExempt[from] || isExempt[to];

        if (exempt) {
            super._update(from, to, amount);
        } else {
            uint256 maxTx = (INITIAL_SUPPLY * maxTxBps) / 10_000;
            require(amount <= maxTx, "Exceeds max transaction");

            uint256 currentBurn = currentBurnBps();
            uint256 burnAmount = (amount * currentBurn) / 10_000;
            uint256 treasuryAmount = (amount * treasuryFeeBps) / 10_000;
            uint256 transferAmount = amount - burnAmount - treasuryAmount;

            uint256 maxWallet = (INITIAL_SUPPLY * maxWalletBps) / 10_000;
            require(balanceOf(to) + transferAmount <= maxWallet, "Exceeds max wallet");

            if (burnAmount > 0) {
                super._update(from, address(0), burnAmount);
            }
            if (treasuryAmount > 0) {
                super._update(from, treasury, treasuryAmount);
            }
            super._update(from, to, transferAmount);
        }
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Treasury cannot be zero address");
        emit TreasuryUpdated(treasury, _treasury);
        isExempt[treasury] = false;
        treasury = _treasury;
        isExempt[_treasury] = true;
    }

    function setExempt(address account, bool exempt) external onlyOwner {
        isExempt[account] = exempt;
        emit ExemptUpdated(account, exempt);
    }

    function setTreasuryFee(uint256 _treasuryFeeBps) external onlyOwner {
        require(_treasuryFeeBps <= 500, "Treasury fee cannot exceed 5%");
        treasuryFeeBps = _treasuryFeeBps;
        emit FeesUpdated(_treasuryFeeBps);
    }

    function setLimits(uint256 _maxWalletBps, uint256 _maxTxBps) external onlyOwner {
        require(_maxWalletBps >= 50, "Max wallet must be >= 0.5%");
        require(_maxTxBps >= 10, "Max tx must be >= 0.1%");
        maxWalletBps = _maxWalletBps;
        maxTxBps = _maxTxBps;
        emit LimitsUpdated(_maxWalletBps, _maxTxBps);
    }

    /// @notice Remove all limits - call this once trading is established
    function removeLimits() external onlyOwner {
        maxWalletBps = 10_000;
        maxTxBps = 10_000;
        emit LimitsUpdated(10_000, 10_000);
    }

    /// @notice Remove treasury fee - call this if community votes to go fee-free
    function removeTreasuryFee() external onlyOwner {
        treasuryFeeBps = 0;
        emit FeesUpdated(0);
    }

    /// @notice Pause all token transfers (owner only)
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause all token transfers (owner only)
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Returns the current halving era
    function currentEra() public view returns (uint256) {
        return (block.timestamp - deployTimestamp) / HALVING_INTERVAL;
    }

    /// @notice Returns the current burn rate in basis points
    function currentBurnBps() public view returns (uint256) {
        uint256 era = currentEra();
        if (era >= 7) return MIN_BURN_BPS;
        uint256 rate = INITIAL_BURN_BPS >> era;
        return rate < MIN_BURN_BPS ? MIN_BURN_BPS : rate;
    }

    /// @notice Returns seconds until the next halving
    function timeUntilNextHalving() external view returns (uint256) {
        uint256 nextHalvingTime = deployTimestamp + ((currentEra() + 1) * HALVING_INTERVAL);
        if (block.timestamp >= nextHalvingTime) return 0;
        return nextHalvingTime - block.timestamp;
    }

    /// @notice Returns how many tokens have been burned so far
    function totalBurned() external view returns (uint256) {
        return INITIAL_SUPPLY - totalSupply();
    }
}
