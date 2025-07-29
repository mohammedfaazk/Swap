// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IResolver
 * @dev Interface for resolver management system
 */
interface IResolver {
    struct ResolverInfo {
        uint256 stake;
        uint256 reputation;
        uint256 totalVolume;
        uint256 successRate;
        uint256 avgResponseTime;
        bool active;
        uint256 registrationTime;
    }

    event ResolverRegistered(address indexed resolver, uint256 stake, uint256 reputation);
    event ResolverSlashed(address indexed resolver, uint256 amount, string reason);
    event ReputationUpdated(address indexed resolver, uint256 oldReputation, uint256 newReputation);

    function registerResolver(uint256 minStake) external payable;
    function updateReputation(address resolver, bool success, uint256 responseTime) external;
    function slashResolver(address resolver, uint256 amount, string calldata reason) external;
    function getResolverInfo(address resolver) external view returns (ResolverInfo memory);
    function getTopResolvers(uint256 count) external view returns (address[] memory);
    function isActiveResolver(address resolver) external view returns (bool);
}
