// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IPartialFill
 * @dev Interface for revolutionary partial fill functionality
 */
interface IPartialFill {
    struct FillOrder {
        bytes32 swapId;
        address resolver;
        uint256 amount;
        uint256 bidPrice;
        uint256 timestamp;
        bytes32 merkleRoot;
        bool executed;
    }

    struct DutchAuction {
        uint256 startPrice;
        uint256 reservePrice;
        uint256 startTime;
        uint256 duration;
        uint256 currentPrice;
        bool active;
    }

    event AuctionStarted(bytes32 indexed swapId, uint256 startPrice, uint256 reservePrice);
    event BidPlaced(bytes32 indexed swapId, address indexed resolver, uint256 bidPrice);
    event FillOrderExecuted(bytes32 indexed swapId, address indexed resolver, uint256 amount);

    function startAuction(bytes32 swapId, uint256 startPrice, uint256 reservePrice) external;
    function placeBid(bytes32 swapId, uint256 bidPrice, uint256 fillAmount, bytes32[] calldata merkleProof) external;
    function getCurrentPrice(bytes32 swapId) external view returns (uint256);
    function executeFillOrders(bytes32 swapId) external;
    function getFillOrders(bytes32 swapId) external view returns (FillOrder[] memory);
}
