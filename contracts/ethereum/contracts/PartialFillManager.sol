// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "./interfaces/IPartialFill.sol";

/**
 * @title PartialFillManager
 * @dev Advanced partial fill management with Dutch auction mechanics
 */
contract PartialFillManager is IPartialFill {
    
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

    mapping(bytes32 => FillOrder[]) public fillOrders;
    mapping(bytes32 => DutchAuction) public auctions;
    mapping(bytes32 => mapping(address => bool)) public resolverBids;

    uint256 public constant AUCTION_DURATION = 300; // 5 minutes
    uint256 public constant MIN_BID_INCREMENT = 100; // 1%

    event AuctionStarted(bytes32 indexed swapId, uint256 startPrice, uint256 reservePrice);
    event BidPlaced(bytes32 indexed swapId, address indexed resolver, uint256 bidPrice);
    event FillOrderExecuted(bytes32 indexed swapId, address indexed resolver, uint256 amount);

    /**
     * @dev Start Dutch auction for partial fill
     */
    function startAuction(
        bytes32 swapId,
        uint256 startPrice,
        uint256 reservePrice
    ) external {
        require(auctions[swapId].active == false, "Auction already active");
        
        auctions[swapId] = DutchAuction({
            startPrice: startPrice,
            reservePrice: reservePrice,
            startTime: block.timestamp,
            duration: AUCTION_DURATION,
            currentPrice: startPrice,
            active: true
        });

        emit AuctionStarted(swapId, startPrice, reservePrice);
    }

    /**
     * @dev Place bid in Dutch auction
     */
    function placeBid(
        bytes32 swapId,
        uint256 bidPrice,
        uint256 fillAmount,
        bytes32[] calldata merkleProof
    ) external {
        DutchAuction storage auction = auctions[swapId];
        require(auction.active, "No active auction");
        require(block.timestamp < auction.startTime + auction.duration, "Auction expired");
        require(bidPrice >= getCurrentPrice(swapId), "Bid below current price");
        require(!resolverBids[swapId][msg.sender], "Already bid");

        // Verify resolver eligibility via Merkle proof
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, fillAmount));
        require(MerkleProof.verify(merkleProof, auction.startPrice, leaf), "Invalid proof");

        resolverBids[swapId][msg.sender] = true;

        fillOrders[swapId].push(FillOrder({
            swapId: swapId,
            resolver: msg.sender,
            amount: fillAmount,
            bidPrice: bidPrice,
            timestamp: block.timestamp,
            merkleRoot: bytes32(0),
            executed: false
        }));

        emit BidPlaced(swapId, msg.sender, bidPrice);
    }

    /**
     * @dev Get current Dutch auction price
     */
    function getCurrentPrice(bytes32 swapId) public view returns (uint256) {
        DutchAuction storage auction = auctions[swapId];
        if (!auction.active) return 0;

        uint256 elapsed = block.timestamp - auction.startTime;
        if (elapsed >= auction.duration) {
            return auction.reservePrice;
        }

        uint256 priceDecay = ((auction.startPrice - auction.reservePrice) * elapsed) / auction.duration;
        return auction.startPrice - priceDecay;
    }

    /**
     * @dev Execute winning fill orders
     */
    function executeFillOrders(bytes32 swapId) external {
        DutchAuction storage auction = auctions[swapId];
        require(auction.active, "No active auction");
        require(block.timestamp >= auction.startTime + auction.duration, "Auction still active");

        // Sort orders by best price and execute
        FillOrder[] storage orders = fillOrders[swapId];
        
        // Simple execution for demo - would implement sophisticated matching
        for (uint i = 0; i < orders.length && i < 10; i++) {
            if (!orders[i].executed && orders[i].bidPrice >= auction.reservePrice) {
                orders[i].executed = true;
                emit FillOrderExecuted(swapId, orders[i].resolver, orders[i].amount);
            }
        }

        auction.active = false;
    }

    /**
     * @dev Get fill orders for swap
     */
    function getFillOrders(bytes32 swapId) external view returns (FillOrder[] memory) {
        return fillOrders[swapId];
    }
}
