// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./interfaces/IResolver.sol";

/**
 * @title ResolverRegistry
 * @dev Advanced resolver management with reputation and slashing
 */
contract ResolverRegistry is IResolver, Ownable, ReentrancyGuard, Pausable {
    
    mapping(address => ResolverInfo) public resolvers;
    mapping(address => uint256) public resolverStakes;
    mapping(address => uint256) public resolverSlashings;
    
    address[] public activeResolvers;
    mapping(address => uint256) private resolverIndex;
    
    uint256 public constant MIN_STAKE = 1 ether;
    uint256 public constant MAX_SLASHING = 0.5 ether; // 50% max slash
    uint256 public constant REPUTATION_DECAY_PERIOD = 30 days;
    
    uint256 public totalStaked;
    uint256 public totalSlashed;
    
    modifier onlyActiveResolver() {
        require(isActiveResolver(msg.sender), "Not an active resolver");
        _;
    }

    /**
     * @dev Register as a resolver with minimum stake
     */
    function registerResolver(uint256 minStake) external payable nonReentrant whenNotPaused {
        require(msg.value >= MIN_STAKE, "Insufficient stake");
        require(msg.value >= minStake, "Below minimum stake");
        require(!resolvers[msg.sender].active, "Already registered");

        resolvers[msg.sender] = ResolverInfo({
            stake: msg.value,
            reputation: 1000, // Starting reputation
            totalVolume: 0,
            successRate: 10000, // 100% in basis points
            avgResponseTime: 0,
            active: true,
            registrationTime: block.timestamp
        });

        resolverStakes[msg.sender] = msg.value;
        totalStaked += msg.value;

        // Add to active resolvers array
        activeResolvers.push(msg.sender);
        resolverIndex[msg.sender] = activeResolvers.length - 1;

        emit ResolverRegistered(msg.sender, msg.value, 1000);
    }

    /**
     * @dev Update resolver reputation based on performance
     */
    function updateReputation(
        address resolver,
        bool success,
        uint256 responseTime
    ) external onlyOwner {
        ResolverInfo storage info = resolvers[resolver];
        require(info.active, "Resolver not active");

        uint256 oldReputation = info.reputation;

        if (success) {
            // Increase reputation for successful swaps
            info.reputation += 10;
            if (info.reputation > 10000) info.reputation = 10000; // Cap at 10000
        } else {
            // Decrease reputation for failures
            if (info.reputation > 20) {
                info.reputation -= 20;
            } else {
                info.reputation = 1;
            }
        }

        // Update average response time
        if (info.avgResponseTime == 0) {
            info.avgResponseTime = responseTime;
        } else {
            info.avgResponseTime = (info.avgResponseTime * 9 + responseTime) / 10;
        }

        emit ReputationUpdated(resolver, oldReputation, info.reputation);
    }

    /**
     * @dev Slash resolver for malicious behavior
     */
    function slashResolver(
        address resolver,
        uint256 amount,
        string calldata reason
    ) external onlyOwner nonReentrant {
        require(resolvers[resolver].active, "Resolver not active");
        require(amount <= MAX_SLASHING, "Slash amount too high");
        require(resolverStakes[resolver] >= amount, "Insufficient stake");

        resolverStakes[resolver] -= amount;
        resolverSlashings[resolver] += amount;
        totalSlashed += amount;

        // Remove from active list if stake too low
        if (resolverStakes[resolver] < MIN_STAKE) {
            _deactivateResolver(resolver);
        }

        // Transfer slashed amount to treasury
        payable(owner()).transfer(amount);

        emit ResolverSlashed(resolver, amount, reason);
    }

    /**
     * @dev Get resolver information
     */
    function getResolverInfo(address resolver) external view returns (ResolverInfo memory) {
        return resolvers[resolver];
    }

    /**
     * @dev Get top resolvers by reputation
     */
    function getTopResolvers(uint256 count) external view returns (address[] memory) {
        if (count > activeResolvers.length) {
            count = activeResolvers.length;
        }

        address[] memory top = new address[](count);
        address[] memory sorted = _sortResolversByReputation();

        for (uint256 i = 0; i < count; i++) {
            top[i] = sorted[i];
        }

        return top;
    }

    /**
     * @dev Check if resolver is active
     */
    function isActiveResolver(address resolver) public view returns (bool) {
        return resolvers[resolver].active && 
               resolverStakes[resolver] >= MIN_STAKE;
    }

    /**
     * @dev Get total number of active resolvers
     */
    function getActiveResolverCount() external view returns (uint256) {
        return activeResolvers.length;
    }

    /**
     * @dev Withdraw stake (with conditions)
     */
    function withdrawStake(uint256 amount) external nonReentrant {
        require(resolverStakes[msg.sender] >= amount, "Insufficient stake");
        require(resolverStakes[msg.sender] - amount >= MIN_STAKE || amount == resolverStakes[msg.sender], 
                "Must maintain minimum stake or withdraw all");

        resolverStakes[msg.sender] -= amount;
        totalStaked -= amount;

        if (resolverStakes[msg.sender] < MIN_STAKE) {
            _deactivateResolver(msg.sender);
        }

        payable(msg.sender).transfer(amount);
    }

    /**
     * @dev Internal function to deactivate resolver
     */
    function _deactivateResolver(address resolver) internal {
        resolvers[resolver].active = false;

        // Remove from active array
        uint256 index = resolverIndex[resolver];
        uint256 lastIndex = activeResolvers.length - 1;

        if (index != lastIndex) {
            address lastResolver = activeResolvers[lastIndex];
            activeResolvers[index] = lastResolver;
            resolverIndex[lastResolver] = index;
        }

        activeResolvers.pop();
        delete resolverIndex[resolver];
    }

    /**
     * @dev Sort resolvers by reputation (simple bubble sort for demo)
     */
    function _sortResolversByReputation() internal view returns (address[] memory) {
        address[] memory sorted = new address[](activeResolvers.length);
        
        for (uint256 i = 0; i < activeResolvers.length; i++) {
            sorted[i] = activeResolvers[i];
        }

        // Simple bubble sort by reputation
        for (uint256 i = 0; i < sorted.length; i++) {
            for (uint256 j = 0; j < sorted.length - 1 - i; j++) {
                if (resolvers[sorted[j]].reputation < resolvers[sorted[j + 1]].reputation) {
                    address temp = sorted[j];
                    sorted[j] = sorted[j + 1];
                    sorted[j + 1] = temp;
                }
            }
        }

        return sorted;
    }

    /**
     * @dev Emergency functions
     */
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Receive function for additional stakes
     */
    receive() external payable {
        if (resolvers[msg.sender].active) {
            resolverStakes[msg.sender] += msg.value;
            totalStaked += msg.value;
        }
    }
}
