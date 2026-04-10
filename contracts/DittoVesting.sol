// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title DittoVesting
 * @notice Holds presale-purchased DITTO and releases them on a schedule.
 */
contract DittoVesting is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct VestingSchedule {
        uint256 totalAmount;
        uint256 tgePercent;
        uint256 vestingDuration;
        uint256 claimed;
    }

    IERC20 public immutable dittoToken;

    uint256 public tgeTimestamp;
    address public presaleContract;

    mapping(address => VestingSchedule) public schedules;

    event ScheduleRegistered(address indexed beneficiary, uint256 totalAmount, uint256 tgePercent, uint256 vestingDuration);
    event ScheduleIncreased(address indexed beneficiary, uint256 addedAmount, uint256 newTotal);
    event TokensClaimed(address indexed beneficiary, uint256 amount);
    event TGESet(uint256 timestamp);
    event PresaleContractSet(address indexed presale);

    constructor(address _dittoToken) Ownable(msg.sender) {
        require(_dittoToken != address(0), "Invalid token");
        dittoToken = IERC20(_dittoToken);
    }

    function setTGE(uint256 _timestamp) external onlyOwner {
        require(tgeTimestamp == 0, "TGE already set");
        require(_timestamp > 0, "Invalid timestamp");
        tgeTimestamp = _timestamp;
        emit TGESet(_timestamp);
    }

    function setPresaleContract(address _presale) external onlyOwner {
        require(_presale != address(0), "Invalid address");
        presaleContract = _presale;
        emit PresaleContractSet(_presale);
    }

    modifier onlyAuthorized() {
        require(msg.sender == owner() || msg.sender == presaleContract, "Not authorized");
        _;
    }

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
            s.totalAmount = amount;
            s.tgePercent = tgePercent;
            s.vestingDuration = vestingDuration;
            emit ScheduleRegistered(beneficiary, amount, tgePercent, vestingDuration);
        } else {
            s.totalAmount += amount;
            emit ScheduleIncreased(beneficiary, amount, s.totalAmount);
        }
    }

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

    function claim() external nonReentrant {
        require(tgeTimestamp > 0, "TGE not set");
        require(block.timestamp >= tgeTimestamp, "Before TGE");

        VestingSchedule storage s = schedules[msg.sender];
        require(s.totalAmount > 0, "No vesting schedule");

        uint256 vested = _vestedAmount(s);
        uint256 claimableAmt = vested - s.claimed;
        require(claimableAmt > 0, "Nothing to claim");

        s.claimed += claimableAmt;
        dittoToken.safeTransfer(msg.sender, claimableAmt);

        emit TokensClaimed(msg.sender, claimableAmt);
    }

    function _vestedAmount(VestingSchedule storage s) internal view returns (uint256) {
        if (tgeTimestamp == 0 || block.timestamp < tgeTimestamp) return 0;

        uint256 tgeAmount = (s.totalAmount * s.tgePercent) / 100;
        uint256 vestingAmount = s.totalAmount - tgeAmount;

        if (s.vestingDuration == 0 || vestingAmount == 0) return s.totalAmount;

        uint256 elapsed = block.timestamp - tgeTimestamp;
        if (elapsed >= s.vestingDuration) return s.totalAmount;

        uint256 linearVested = (vestingAmount * elapsed) / s.vestingDuration;
        return tgeAmount + linearVested;
    }

    function claimable(address beneficiary) external view returns (uint256) {
        VestingSchedule storage s = schedules[beneficiary];
        if (s.totalAmount == 0) return 0;
        uint256 vested = _vestedAmount(s);
        return vested > s.claimed ? vested - s.claimed : 0;
    }

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

    function recoverToken(address token, uint256 amount) external onlyOwner {
        require(token != address(dittoToken), "Cannot recover DITTO");
        IERC20(token).safeTransfer(msg.sender, amount);
    }
}
