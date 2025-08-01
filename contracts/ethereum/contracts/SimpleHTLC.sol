// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title SimpleHTLC
 * @dev Simple Hash Time Lock Contract for atomic swaps
 */
contract SimpleHTLC is ReentrancyGuard {
    
    struct HTLCSwap {
        address payable sender;
        address payable receiver;
        uint256 amount;
        bytes32 hashlock;
        uint256 timelock;
        bool withdrawn;
        bool refunded;
        bytes32 preimage;
    }
    
    mapping(bytes32 => HTLCSwap) public swaps;
    
    event SwapInitiated(
        bytes32 indexed swapId,
        address indexed sender,
        address indexed receiver,
        uint256 amount,
        bytes32 hashlock,
        uint256 timelock
    );
    
    event SwapWithdrawn(bytes32 indexed swapId, bytes32 preimage);
    event SwapRefunded(bytes32 indexed swapId);
    
    modifier swapExists(bytes32 _swapId) {
        require(haveSwap(_swapId), "Swap does not exist");
        _;
    }
    
    modifier hashlockMatches(bytes32 _swapId, bytes32 _preimage) {
        require(
            swaps[_swapId].hashlock == keccak256(abi.encodePacked(_preimage)),
            "Hashlock does not match"
        );
        _;
    }
    
    modifier withdrawable(bytes32 _swapId) {
        require(swaps[_swapId].receiver == msg.sender, "Not the receiver");
        require(swaps[_swapId].withdrawn == false, "Already withdrawn");
        require(swaps[_swapId].timelock > block.timestamp, "Timelock has expired");
        _;
    }
    
    modifier refundable(bytes32 _swapId) {
        require(swaps[_swapId].sender == msg.sender, "Not the sender");
        require(swaps[_swapId].refunded == false, "Already refunded");
        require(swaps[_swapId].withdrawn == false, "Already withdrawn");
        require(swaps[_swapId].timelock <= block.timestamp, "Timelock has not expired");
        _;
    }
    
    /**
     * @dev Initiate a new HTLC swap
     * @param _receiver The address that can withdraw the funds
     * @param _hashlock The hash of the secret
     * @param _timelock The timestamp when the funds can be refunded
     */
    function newSwap(
        address payable _receiver,
        bytes32 _hashlock,
        uint256 _timelock
    ) external payable returns (bytes32 swapId) {
        require(msg.value > 0, "Must send ETH");
        require(_timelock > block.timestamp, "Timelock must be in the future");
        require(_receiver != address(0), "Invalid receiver address");
        require(_hashlock != bytes32(0), "Invalid hashlock");
        
        swapId = keccak256(
            abi.encodePacked(
                msg.sender,
                _receiver,
                msg.value,
                _hashlock,
                _timelock,
                block.timestamp
            )
        );
        
        require(!haveSwap(swapId), "Swap already exists");
        
        swaps[swapId] = HTLCSwap(
            payable(msg.sender),
            _receiver,
            msg.value,
            _hashlock,
            _timelock,
            false,
            false,
            bytes32(0)
        );
        
        emit SwapInitiated(
            swapId,
            msg.sender,
            _receiver,
            msg.value,
            _hashlock,
            _timelock
        );
        
        return swapId;
    }
    
    /**
     * @dev Withdraw funds by revealing the preimage
     * @param _swapId The swap ID
     * @param _preimage The secret that hashes to the hashlock
     */
    function withdraw(bytes32 _swapId, bytes32 _preimage)
        external
        swapExists(_swapId)
        hashlockMatches(_swapId, _preimage)
        withdrawable(_swapId)
        nonReentrant
    {
        HTLCSwap storage swap = swaps[_swapId];
        swap.preimage = _preimage;
        swap.withdrawn = true;
        
        swap.receiver.transfer(swap.amount);
        
        emit SwapWithdrawn(_swapId, _preimage);
    }
    
    /**
     * @dev Refund the swap after timelock expires
     * @param _swapId The swap ID
     */
    function refund(bytes32 _swapId)
        external
        swapExists(_swapId)
        refundable(_swapId)
        nonReentrant
    {
        HTLCSwap storage swap = swaps[_swapId];
        swap.refunded = true;
        
        swap.sender.transfer(swap.amount);
        
        emit SwapRefunded(_swapId);
    }
    
    /**
     * @dev Get swap details
     */
    function getSwap(bytes32 _swapId)
        external
        view
        returns (
            address sender,
            address receiver,
            uint256 amount,
            bytes32 hashlock,
            uint256 timelock,
            bool withdrawn,
            bool refunded,
            bytes32 preimage
        )
    {
        if (haveSwap(_swapId)) {
            HTLCSwap storage swap = swaps[_swapId];
            return (
                swap.sender,
                swap.receiver,
                swap.amount,
                swap.hashlock,
                swap.timelock,
                swap.withdrawn,
                swap.refunded,
                swap.preimage
            );
        }
        return (address(0), address(0), 0, bytes32(0), 0, false, false, bytes32(0));
    }
    
    /**
     * @dev Check if a swap exists
     */
    function haveSwap(bytes32 _swapId) public view returns (bool exists) {
        exists = (swaps[_swapId].sender != address(0));
    }
}