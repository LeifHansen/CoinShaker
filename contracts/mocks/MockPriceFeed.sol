// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockPriceFeed
 * @notice Minimal mock of Chainlink's AggregatorV3Interface for testing.
 */
contract MockPriceFeed {
    int256 public price;
    uint8 public _decimals;
    uint256 public updatedAt;

    constructor(int256 _price, uint8 _dec) {
        price = _price;
        _decimals = _dec;
        updatedAt = block.timestamp;
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }

    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 _updatedAt,
        uint80 answeredInRound
    ) {
        return (1, price, block.timestamp, updatedAt, 1);
    }

    // Test helpers
    function setPrice(int256 _price) external {
        price = _price;
        updatedAt = block.timestamp;
    }

    function setUpdatedAt(uint256 _ts) external {
        updatedAt = _ts;
    }
}
