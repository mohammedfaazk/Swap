// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

library HTLCUtils {
    function validateSecret(bytes32 secret, bytes32 hash) internal pure returns (bool) {
        return keccak256(abi.encodePacked(secret)) == hash;
    }
}
