// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AggregatorV3Interface
 * @notice Minimal Chainlink price feed interface.
 */
interface AggregatorV3Interface {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
    function decimals() external view returns (uint8);
}

/**
 * @title DittoVault
 * @notice Multi-asset staking vault. Deposit ETH, USDC, USDT, or DAI and earn
 *         DITTO rewards proportional to the USD value deposited.
 *
 *   - Chainlink price feeds normalize all deposits to USD value
 *   - Same 4-tier system as DittoStaking (Paper Hands → Whale) for multipliers
 *   - Rewards paid in DITTO from a funded reward pool
 *   - Supports adding/removing assets by owner
 *   - ETH deposits use receive() or depositETH(); ERC20s use depositToken()
 *
 *   This vault does NOT lend or trade deposited assets. They sit idle until
 *   the user withdraws. The yield comes from DITTO rewards, not from asset
 *   deployment. This keeps the contract simple and auditable.
 */
contract DittoVault is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Types ───────────────────────────────────────────────────

    enum Tier { PaperHands, Hodler, DiamondHands, Whale }

    struct TierInfo {
        uint256 lockDuration;   // seconds
        uint256 multiplier;     // 100 = 1x, 200 = 2x, etc.
    }

    struct AssetConfig {
        bool supported;
        AggregatorV3Interface priceFeed;
        uint8 assetDecimals;     // 18 for ETH/DAI, 6 for USDC/USDT
    }

    struct Deposit {
        address asset;          // address(0) = ETH
        uint256 amount;         // in asset's native decimals
        uint256 usdValue;       // normalized to 18 decimals (for reward calc)
        uint256 startTime;
        uint256 lockEnd;
        Tier tier;
        bool withdrawn;
    }

    // ── Constants ───────────────────────────────────────────────

    address public constant ETH_ASSET = address(0);
    uint256 private constant USD_DECIMALS = 18;
    uint256 private constant REWARD_DENOMINATOR = 365 days * 10_000 * 100;
    uint256 public constant MAX_DEPOSITS_PER_USER = 50;

    // ── State ───────────────────────────────────────────────────

    IERC20 public immutable dittoToken;

    mapping(Tier => TierInfo) public tiers;
    mapping(address => AssetConfig) public assets;     // asset address → config
    address[] public supportedAssets;                   // for enumeration

    mapping(address => Deposit[]) public deposits;      // user → deposits

    uint256 public baseAprBps = 500;       // 5% base APR in DITTO value
    uint256 public rewardPool;             // DITTO available for rewards
    uint256 public totalValueLocked;       // aggregate USD value (18 decimals)
    uint256 public minDepositUSD = 10e18;  // $10 minimum (18 decimals)
    uint256 public maxStaleness = 1 hours; // max age of Chainlink price data

    // ── Events ──────────────────────────────────────────────────

    event AssetAdded(address indexed asset, address priceFeed, uint8 decimals);
    event AssetRemoved(address indexed asset);
    event Deposited(address indexed user, uint256 indexed depositIndex, address asset, uint256 amount, uint256 usdValue, Tier tier);
    event Withdrawn(address indexed user, uint256 indexed depositIndex, uint256 reward);
    event EmergencyWithdrawn(address indexed user, uint256 indexed depositIndex);
    event RewardPoolFunded(address indexed funder, uint256 amount);
    event BaseAprUpdated(uint256 newAprBps);

    constructor(address _dittoToken) Ownable(msg.sender) {
        require(_dittoToken != address(0), "Invalid token");
        dittoToken = IERC20(_dittoToken);

        // Initialize tiers (same as DittoStaking)
        tiers[Tier.PaperHands]   = TierInfo(7 days,   100);  // 1x
        tiers[Tier.Hodler]       = TierInfo(30 days,  200);  // 2x
        tiers[Tier.DiamondHands] = TierInfo(90 days,  400);  // 4x
        tiers[Tier.Whale]        = TierInfo(365 days, 800);  // 8x
    }

    // ── Owner: Asset management ─────────────────────────────────

    /**
     * @notice Add a supported asset with its Chainlink price feed.
     * @param asset Token address (address(0) for ETH)
     * @param priceFeed Chainlink AggregatorV3 address (e.g., ETH/USD)
     * @param assetDecimals Decimals of the asset (18 for ETH, 6 for USDC)
     */
    function addAsset(address asset, address priceFeed, uint8 assetDecimals) external onlyOwner {
        require(priceFeed != address(0), "Invalid price feed");
        require(!assets[asset].supported, "Already supported");

        assets[asset] = AssetConfig({
            supported: true,
            priceFeed: AggregatorV3Interface(priceFeed),
            assetDecimals: assetDecimals
        });
        supportedAssets.push(asset);

        emit AssetAdded(asset, priceFeed, assetDecimals);
    }

    /**
     * @notice Remove an asset from supported list (existing deposits unaffected).
     */
    function removeAsset(address asset) external onlyOwner {
        require(assets[asset].supported, "Not supported");
        assets[asset].supported = false;

        // Remove from supportedAssets array to keep enumeration clean
        for (uint256 i = 0; i < supportedAssets.length; i++) {
            if (supportedAssets[i] == asset) {
                supportedAssets[i] = supportedAssets[supportedAssets.length - 1];
                supportedAssets.pop();
                break;
            }
        }

        emit AssetRemoved(asset);
    }

    // ── Deposit ─────────────────────────────────────────────────

    /**
     * @notice Deposit ETH into the vault.
     */
    function depositETH(Tier tier) external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "Must send ETH");
        require(assets[ETH_ASSET].supported, "ETH not supported");

        uint256 usdValue = _getUSDValue(ETH_ASSET, msg.value);
        require(usdValue >= minDepositUSD, "Below minimum deposit");

        _createDeposit(msg.sender, ETH_ASSET, msg.value, usdValue, tier);
    }

    /**
     * @notice Deposit an ERC20 token into the vault.
     * @param asset Token address
     * @param amount Amount in the token's native decimals
     * @param tier Which tier to lock into
     */
    function depositToken(address asset, uint256 amount, Tier tier) external nonReentrant whenNotPaused {
        require(amount > 0, "Cannot deposit zero");
        require(asset != ETH_ASSET, "Use depositETH for ETH");
        require(assets[asset].supported, "Asset not supported");

        uint256 usdValue = _getUSDValue(asset, amount);
        require(usdValue >= minDepositUSD, "Below minimum deposit");

        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        _createDeposit(msg.sender, asset, amount, usdValue, tier);
    }

    function _createDeposit(
        address user,
        address asset,
        uint256 amount,
        uint256 usdValue,
        Tier tier
    ) internal {
        require(deposits[user].length < MAX_DEPOSITS_PER_USER, "Max deposits reached");

        uint256 lockEnd = block.timestamp + tiers[tier].lockDuration;

        deposits[user].push(Deposit({
            asset: asset,
            amount: amount,
            usdValue: usdValue,
            startTime: block.timestamp,
            lockEnd: lockEnd,
            tier: tier,
            withdrawn: false
        }));

        totalValueLocked += usdValue;

        emit Deposited(user, deposits[user].length - 1, asset, amount, usdValue, tier);
    }

    // ── Withdraw ────────────────────────────────────────────────

    /**
     * @notice Withdraw after lock period. Returns deposited asset + DITTO rewards.
     */
    function withdraw(uint256 depositIndex) external nonReentrant {
        require(depositIndex < deposits[msg.sender].length, "Invalid index");
        Deposit storage d = deposits[msg.sender][depositIndex];
        require(!d.withdrawn, "Already withdrawn");
        require(block.timestamp >= d.lockEnd, "Still locked");

        uint256 reward = calculateReward(msg.sender, depositIndex);

        d.withdrawn = true;
        totalValueLocked -= d.usdValue;

        // Cap reward to available pool
        if (reward > rewardPool) {
            reward = rewardPool;
        }
        rewardPool -= reward;

        // Return deposited asset
        if (d.asset == ETH_ASSET) {
            (bool sent, ) = msg.sender.call{value: d.amount}("");
            require(sent, "ETH transfer failed");
        } else {
            IERC20(d.asset).safeTransfer(msg.sender, d.amount);
        }

        // Send DITTO reward
        if (reward > 0) {
            dittoToken.safeTransfer(msg.sender, reward);
        }

        emit Withdrawn(msg.sender, depositIndex, reward);
    }

    /**
     * @notice Emergency withdraw before lock ends. Returns asset only, no rewards.
     */
    function emergencyWithdraw(uint256 depositIndex) external nonReentrant {
        require(depositIndex < deposits[msg.sender].length, "Invalid index");
        Deposit storage d = deposits[msg.sender][depositIndex];
        require(!d.withdrawn, "Already withdrawn");

        d.withdrawn = true;
        totalValueLocked -= d.usdValue;

        if (d.asset == ETH_ASSET) {
            (bool sent, ) = msg.sender.call{value: d.amount}("");
            require(sent, "ETH transfer failed");
        } else {
            IERC20(d.asset).safeTransfer(msg.sender, d.amount);
        }

        emit EmergencyWithdrawn(msg.sender, depositIndex);
    }

    // ── Reward calculation ──────────────────────────────────────

    /**
     * @notice Calculate pending DITTO reward for a deposit.
     *         reward = usdValue × baseAPR × tierMultiplier × elapsed / DENOMINATOR
     *
     *         This gives DITTO amount assuming 1 DITTO ≈ $1 of reward value.
     *         In practice, the base APR should be tuned to the actual DITTO price.
     */
    function calculateReward(address user, uint256 depositIndex) public view returns (uint256) {
        Deposit storage d = deposits[user][depositIndex];
        if (d.withdrawn) return 0;

        uint256 elapsed = block.timestamp - d.startTime;
        uint256 multiplier = tiers[d.tier].multiplier;

        return (d.usdValue * baseAprBps * multiplier * elapsed) / REWARD_DENOMINATOR;
    }

    // ── Price feed ──────────────────────────────────────────────

    /**
     * @notice Get USD value of an asset amount using Chainlink.
     * @return USD value normalized to 18 decimals
     */
    function _getUSDValue(address asset, uint256 amount) internal view returns (uint256) {
        AssetConfig storage cfg = assets[asset];
        require(cfg.supported, "Asset not supported");

        (
            ,
            int256 price,
            ,
            uint256 updatedAt,
        ) = cfg.priceFeed.latestRoundData();

        require(price > 0, "Invalid price");
        require(block.timestamp - updatedAt <= maxStaleness, "Stale price data");

        uint8 feedDecimals = cfg.priceFeed.decimals();

        // Normalize: (amount / 10^assetDecimals) * (price / 10^feedDecimals) * 10^18
        // = amount * price * 10^18 / (10^assetDecimals * 10^feedDecimals)
        return (amount * uint256(price) * (10 ** USD_DECIMALS))
            / (10 ** uint256(cfg.assetDecimals) * 10 ** uint256(feedDecimals));
    }

    /**
     * @notice Public price query for frontend display.
     */
    function getUSDValue(address asset, uint256 amount) external view returns (uint256) {
        return _getUSDValue(asset, amount);
    }

    // ── Owner / funding ─────────────────────────────────────────

    function fundRewardPool(uint256 amount) external {
        require(amount > 0, "Cannot fund zero");
        dittoToken.safeTransferFrom(msg.sender, address(this), amount);
        rewardPool += amount;
        emit RewardPoolFunded(msg.sender, amount);
    }

    function setBaseApr(uint256 _baseAprBps) external onlyOwner {
        require(_baseAprBps <= 5000, "APR cannot exceed 50%");
        baseAprBps = _baseAprBps;
        emit BaseAprUpdated(_baseAprBps);
    }

    function setMinDeposit(uint256 _minUSD) external onlyOwner {
        minDepositUSD = _minUSD;
    }

    function setMaxStaleness(uint256 _seconds) external onlyOwner {
        require(_seconds >= 60, "Too short");
        maxStaleness = _seconds;
    }

    function withdrawRewardPool(uint256 amount) external onlyOwner {
        require(amount <= rewardPool, "Exceeds pool");
        rewardPool -= amount;
        dittoToken.safeTransfer(msg.sender, amount);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ── View helpers ────────────────────────────────────────────

    function getDeposits(address user) external view returns (Deposit[] memory) {
        return deposits[user];
    }

    function getDepositCount(address user) external view returns (uint256) {
        return deposits[user].length;
    }

    function getSupportedAssets() external view returns (address[] memory) {
        return supportedAssets;
    }

    receive() external payable {
        revert("Use depositETH()");
    }
}
