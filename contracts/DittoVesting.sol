// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title DittoVesting
 * @notice Holds presale-purchased DITTO and releases them on a schedule.
 *
 *   Each beneficiary has a vesting schedule defined by:
 *   - totalAmount: total DITTO they purchased (including referral bonus)
 *   - tgePercent: % released immediately at TGE (25%, 50%, or 100%)
 *   - vestingDuration: how long the remaining % vests linearly (0, 60, or 90 days)
 *
 *   The TGE timestamp is set by the owner when liquidity goes live.
 *   Before TGE, nothing is claimable. After TGE, claims follow the schedule.
 *
 *   Only the presale contract (or owner) can register vesting schedules.
 */
contract DittoVesting is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Types ───────────────────────────────────────────────────

    struct VestingSchedule {
        uint256 totalAmount;       // total tokens vesting
        uint256 tgePercent;        // percentage released at TGE (e.g., 25 = 25%)
        uint256 vestingDuration;   // seconds over which remaining tokens vest linearly
        uint256 claimed;           // tokens already claimed
    }

    // ── State ───────────────────────────────────────────────────

    IERC20 public immutable dittoToken;

    uint256 public tgeTimestamp;           // 0 = TGE not happened yet
    address public presaleContract;        // authorized to register schedules

    mapping(address => VestingSchedule) public schedules;

    // ── Events ──────────────────────────────────────────────────

    event ScheduleRegistered(address indexed beneficiary, uint256 totalAmount, uint256 tgePercent, uint256 vestingDuration);
    event ScheduleIncreased(address indexed beneficiary, uint256 addedAmount, uint256 newTotal);
    event TokensClaimed(address indexed beneficiary, uint256 amount);
    event TGESet(uint256 timestamp);
    event PresaleContractSet(address indexed presale);

    constructor(address _dittoToken) Ownable(msg.sender) {
        require(_dittoToken != address(0), "Invalid token");
        dittoToken = IERC20(_dittoToken);
    }

    // ── Owner configuration ─────────────────────────────────────

    /**
     * @notice Set the TGE timestamp. Enables claiming. Can only be set once.
     * @param _timestamp Unix timestamp of TGE (must be in the future or now)
     */
    function setTGE(uint256 _timestamp) external onlyOwner {
        require(tgeTimestamp == 0, "TGE already set");
        require(_timestamp > 0, "Invalid timestamp");
        tgeTimestamp = _timestamp;
        emit TGESet(_timestamp);
    }

    /**
     * @notice Set the presale contract address (authorized to register schedules).
     */
    function setPresaleContract(address _presale) external onlyOwner {
        require(_presale != address(0), "Invalid address");
        presaleContract = _presale;
        emit PresaleContractSet(_presale);
    }

    // ── Schedule registration (presale or owner) ────────────────

    modifier onlyAuthorized() {
        require(msg.sender == owner() || msg.sender == presaleContract, "Not authorized");
        _;
    }

    /**
     * @notice Register a vesting schedule for a beneficiary.
     *         If schedule already exists, adds to the total (same vesting terms).
     * @param beneficiary Address receiving the tokens
     * @param amount Number of tokens to vest
     * @param tgePercent Percentage released at TGE (0-100)
     * @param vestingDuration Seconds for linear vesting of remaining tokens
     */
    function registerSchedule(
        address beneficiary,
        uint256 amount,
        uint256 tgePercent,
        uint256 vestingDuration
    ) external onlyAuthorized {
        require(beneficiary != address(0), "Invalid beneficiary");
        require(amount > 0, "Amount must be > 0");
        require(tgePercent <= 100, "TGE percent > 100");

        VestingSchedule storage s = schedules[beneficiary];

        if (s.totalAmount == 0) {
            // New schedule
            s.totalAmount = amount;
            s.tgePercent = tgePercent;
            s.vestingDuration = vestingDuration;
            emit ScheduleRegistered(beneficiary, amount, tgePercent, vestingDuration);
        } else {
            // Add to existing (same terms assumed — presale registers per-round)
            s.totalAmount += amount;
            emit ScheduleIncreased(beneficiary, amount, s.totalAmount);
        }
    }

    /**
     * @notice Batch register schedules (gas-efficient for owner migration).
     */
    function batchRegister(
        address[] calldata beneficiaries,
        uint256[] calldata amounts,
        uint256 tgePercent,
        uint256 vestingDuration
    ) external onlyAuthorized {
        require(beneficiaries.length == amounts.length, "Length mismatch");
        for (uint256 i = 0; i < beneficiaries.length; i++) {
            VestingSchedule storage s = schedules[beneficiaries[i]];
            if (s.totalAmount == 0) {
                s.totalAmount = amounts[i];
                s.tgePercent = tgePercent;
                s.vestingDuration = vestingDuration;
                emit ScheduleRegistered(beneficiaries[i], amounts[i], tgePercent, vestingDuration);
            } else {
                s.totalAmount += amounts[i];
                emit ScheduleIncreased(beneficiaries[i], amounts[i], s.totalAmount);
            }
        }
    }

    // ── Claiming ────────────────────────────────────────────────

    /**
     * @notice Claim all available vested tokens.
     */
    function claim() external nonReentrant {
        require(tgeTimestamp > 0, "TGE not set");
        require(block.timestamp >= tgeTimestamp, "Before TGE");

        VestingSchedule storage s = schedules[msg.sender];
        require(s.totalAmount > 0, "No vesting schedule");

        uint256 vested = _vestedAmount(s);
        uint256 claimable = vested - s.claimed;
        require(claimable > 0, "Nothing to claim");

        s.claimed += claimable;
        dittoToken.safeTransfer(msg.sender, claimable);

        emit TokensClaimed(msg.sender, claimable);
    }

    // ── View helpers ────────────────────────────────────────────

    /**
     * @notice Calculate total vested amount for a schedule at current time.
     */
    function _vestedAmount(VestingSchedule storage s) internal view returns (uint256) {
        if (tgeTimestamp == 0 || block.timestamp < tgeTimestamp) {
            return 0;
        }

        // TGE release
        uint256 tgeAmount = (s.totalAmount * s.tgePercent) / 100;
        uint256 vestingAmount = s.totalAmount - tgeAmount;

        // If no linear vesting (Public round = 100% at TGE)
        if (s.vestingDuration == 0 || vestingAmount == 0) {
            return s.totalAmount;
        }

        // Linear vesting of remaining portion
        uint256 elapsed = block.timestamp - tgeTimestamp;
        if (elapsed >= s.vestingDuration) {
            return s.totalAmount; // fully vested
        }

        uint256 linearVested = (vestingAmount * elapsed) / s.vestingDuration;
        return tgeAmount + linearVested;
    }

    /**
     * @notice Get claimable amount for an address right now.
     */
    function claimable(address beneficiary) external view returns (uint256) {
        VestingSchedule storage s = schedules[beneficiary];
        if (s.totalAmount == 0) return 0;
        uint256 vested = _vestedAmount(s);
        return vested > s.claimed ? vested - s.claimed : 0;
    }

    /**
     * @notice Get full vesting info for an address.
     */
    function getSchedule(address beneficiary) external view returns (
        uint256 totalAmount,
        uint256 tgePercent,
        uint256 vestingDuration,
        uint256 claimed,
        uint256 currentlyClaimable
    ) {
        VestingSchedule storage s = schedules[beneficiary];
        uint256 vested = s.totalAmount > 0 ? _vestedAmount(s) : 0;
        uint256 avail = vested > s.claimed ? vested - s.claimed : 0;
        return (s.totalAmount, s.tgePercent, s.vestingDuration, s.claimed, avail);
    }

    // ── Emergency: recover stuck tokens (non-DITTO only) ────────

    function recoverToken(address token, uint256 amount) external onlyOwner {
        require(token != address(dittoToken), "Cannot recover DITTO");
        IERC20(token).safeTransfer(msg.sender, amount);
    }
}
