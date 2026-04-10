// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title DittoStaking
 * @notice Gamified staking with four tiers. Lock DITTO, earn rewards based on
 *         how long you commit. Longer lock = higher multiplier.
 *
 *   Tier             Lock period    APR multiplier
 *   ─────────────    ───────────    ──────────────
 *   Paper Hands      7 days         1x   (base)
 *   Hodler           30 days        2x
 *   Diamond Hands    90 days        4x
 *   Whale            365 days       8x
 *
 *   Base APR is set by the owner (default 10%). Rewards come from a reward
 *   pool that the owner funds. Simple, transparent, no rebasing magic.
 */
contract DittoStaking is Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable dittoToken;

    // ── Tier definitions ────────────────────────────────────────

    enum Tier { PaperHands, Hodler, DiamondHands, Whale }

    struct TierInfo {
        string name;
        uint256 lockDuration;   // seconds
        uint256 multiplier;     // 1x = 100
    }

    mapping(Tier => TierInfo) public tiers;

    // ── Staking state ───────────────────────────────────────────

    struct Stake {
        uint256 amount;
        uint256 startTime;
        uint256 lockEnd;
        Tier tier;
        bool withdrawn;
    }

    // user → array of their stakes (supports multiple positions)
    mapping(address => Stake[]) public stakes;

    // ── Reward pool & config ────────────────────────────────────

    uint256 public baseAprBps = 1000; // 10% APR in basis points
    uint256 public totalStaked;
    uint256 public rewardPool;
    uint256 public minStakeAmount = 1000 * 10 ** 18; // 1000 DITTO minimum
    uint256 public constant MAX_STAKES_PER_USER = 50;
    uint256 private constant REWARD_DENOMINATOR = 365 days * 10_000 * 100;

    // ── Events ──────────────────────────────────────────────────

    event Staked(address indexed user, uint256 indexed stakeIndex, uint256 amount, Tier tier);
    event Unstaked(address indexed user, uint256 indexed stakeIndex, uint256 principal, uint256 reward);
    event EmergencyUnstaked(address indexed user, uint256 indexed stakeIndex, uint256 amount);
    event RewardPoolFunded(address indexed funder, uint256 amount);
    event BaseAprUpdated(uint256 newAprBps);

    constructor(address _dittoToken) Ownable(msg.sender) {
        require(_dittoToken != address(0), "Invalid token address");
        dittoToken = IERC20(_dittoToken);

        // Initialize tiers
        tiers[Tier.PaperHands]   = TierInfo("Paper Hands",   7 days,   100);  // 1x
        tiers[Tier.Hodler]       = TierInfo("Hodler",        30 days,  200);  // 2x
        tiers[Tier.DiamondHands] = TierInfo("Diamond Hands", 90 days,  400);  // 4x
        tiers[Tier.Whale]        = TierInfo("Whale",         365 days, 800);  // 8x
    }

    // ── Staking ─────────────────────────────────────────────────

    /**
     * @notice Stake DITTO into a tier. Tokens are locked until lockEnd.
     * @param amount Number of tokens to stake (must have approved this contract)
     * @param tier Which tier to lock into
     */
    function stake(uint256 amount, Tier tier) external nonReentrant whenNotPaused {
        require(amount > 0, "Cannot stake zero");
        require(amount >= minStakeAmount, "Below minimum stake");
        require(stakes[msg.sender].length < MAX_STAKES_PER_USER, "Max stakes reached");

        dittoToken.safeTransferFrom(msg.sender, address(this), amount);

        uint256 lockEnd = block.timestamp + tiers[tier].lockDuration;

        stakes[msg.sender].push(Stake({
            amount: amount,
            startTime: block.timestamp,
            lockEnd: lockEnd,
            tier: tier,
            withdrawn: false
        }));

        totalStaked += amount;

        emit Staked(msg.sender, stakes[msg.sender].length - 1, amount, tier);
    }

    /**
     * @notice Unstake after lock period ends. Returns principal + earned rewards.
     * @param stakeIndex Index of the stake in the user's stakes array
     */
    function unstake(uint256 stakeIndex) external nonReentrant {
        require(stakeIndex < stakes[msg.sender].length, "Invalid stake index");
        Stake storage s = stakes[msg.sender][stakeIndex];
        require(!s.withdrawn, "Already withdrawn");
        require(block.timestamp >= s.lockEnd, "Still locked");

        // IMPORTANT: calculate reward BEFORE marking as withdrawn
        // (calculateReward returns 0 for withdrawn stakes)
        uint256 reward = calculateReward(msg.sender, stakeIndex);

        s.withdrawn = true;
        totalStaked -= s.amount;

        // Cap reward to available pool
        if (reward > rewardPool) {
            reward = rewardPool;
        }
        rewardPool -= reward;

        uint256 total = s.amount + reward;
        dittoToken.safeTransfer(msg.sender, total);

        emit Unstaked(msg.sender, stakeIndex, s.amount, reward);
    }

    /**
     * @notice Emergency withdraw before lock ends — returns principal only, no rewards.
     */
    function emergencyUnstake(uint256 stakeIndex) external nonReentrant {
        require(stakeIndex < stakes[msg.sender].length, "Invalid stake index");
        Stake storage s = stakes[msg.sender][stakeIndex];
        require(!s.withdrawn, "Already withdrawn");

        s.withdrawn = true;
        totalStaked -= s.amount;

        dittoToken.safeTransfer(msg.sender, s.amount);

        emit EmergencyUnstaked(msg.sender, stakeIndex, s.amount);
    }

    // ── Reward calculation ──────────────────────────────────────

    /**
     * @notice Calculate pending reward for a stake.
     *         reward = amount × baseAPR × multiplier × timeStaked / (365 days × 10000 × 100)
     */
    function calculateReward(address user, uint256 stakeIndex) public view returns (uint256) {
        Stake storage s = stakes[user][stakeIndex];
        if (s.withdrawn) return 0;

        uint256 elapsed = block.timestamp - s.startTime;
        uint256 multiplier = tiers[s.tier].multiplier;

        // amount * aprBps * multiplier * elapsed / REWARD_DENOMINATOR
        uint256 reward = (s.amount * baseAprBps * multiplier * elapsed) / REWARD_DENOMINATOR;
        return reward;
    }

    // ── View helpers ────────────────────────────────────────────

    /// @notice Get all stakes for a user
    function getStakes(address user) external view returns (Stake[] memory) {
        return stakes[user];
    }

    /// @notice Get number of stakes for a user
    function getStakeCount(address user) external view returns (uint256) {
        return stakes[user].length;
    }

    /// @notice Get tier details
    function getTierInfo(Tier tier) external view returns (string memory name, uint256 lockDuration, uint256 multiplier) {
        TierInfo storage t = tiers[tier];
        return (t.name, t.lockDuration, t.multiplier);
    }

    // ── Pause mechanism ────────────────────────────────────────

    /// @notice Pause staking (owner only)
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause staking (owner only)
    function unpause() external onlyOwner {
        _unpause();
    }

    // ── Owner / funding ─────────────────────────────────────────

    /// @notice Fund the reward pool (anyone can call this)
    function fundRewardPool(uint256 amount) external {
        require(amount > 0, "Cannot fund zero");
        dittoToken.safeTransferFrom(msg.sender, address(this), amount);
        rewardPool += amount;
        emit RewardPoolFunded(msg.sender, amount);
    }

    /// @notice Update base APR (owner only)
    function setBaseApr(uint256 _baseAprBps) external onlyOwner {
        require(_baseAprBps <= 5000, "APR cannot exceed 50%");
        baseAprBps = _baseAprBps;
        emit BaseAprUpdated(_baseAprBps);
    }

    /// @notice Set minimum stake amount (owner only)
    function setMinStake(uint256 _min) external onlyOwner {
        minStakeAmount = _min;
    }

    /// @notice Withdraw unused rewards from the pool (owner only)
    function withdrawRewardPool(uint256 amount) external onlyOwner {
        require(amount <= rewardPool, "Exceeds reward pool");
        rewardPool -= amount;
        dittoToken.safeTransfer(msg.sender, amount);
    }
}
