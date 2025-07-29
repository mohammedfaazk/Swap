// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title SafeTransfer
 * @dev Ultra-safe token transfer library with gas optimization
 */
library SafeTransfer {
    error TransferFailed();
    error InsufficientBalance();
    error InvalidToken();

    /**
     * @dev Safe transfer that handles both standard and non-standard ERC20 tokens
     */
    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
        if (amount == 0) return;
        
        uint256 balanceBefore = token.balanceOf(address(this));
        if (balanceBefore < amount) revert InsufficientBalance();

        bytes memory data = abi.encodeWithSelector(token.transfer.selector, to, amount);
        _callOptionalReturn(address(token), data);

        uint256 balanceAfter = token.balanceOf(address(this));
        if (balanceAfter != balanceBefore - amount) revert TransferFailed();
    }

    /**
     * @dev Safe transferFrom with comprehensive checks
     */
    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
        if (amount == 0) return;

        uint256 balanceBefore = token.balanceOf(to);
        
        bytes memory data = abi.encodeWithSelector(token.transferFrom.selector, from, to, amount);
        _callOptionalReturn(address(token), data);

        uint256 balanceAfter = token.balanceOf(to);
        if (balanceAfter != balanceBefore + amount) revert TransferFailed();
    }

    /**
     * @dev Internal function to handle tokens that don't return a boolean
     */
    function _callOptionalReturn(address token, bytes memory data) private {
        bytes memory returndata = _functionCall(token, data, "SafeTransfer: low-level call failed");
        
        if (returndata.length > 0) {
            if (!abi.decode(returndata, (bool))) revert TransferFailed();
        }
    }

    /**
     * @dev Low-level function call with error handling
     */
    function _functionCall(
        address target,
        bytes memory data,
        string memory errorMessage
    ) private returns (bytes memory) {
        if (target.code.length == 0) revert InvalidToken();

        (bool success, bytes memory returndata) = target.call(data);
        if (success) {
            return returndata;
        } else {
            if (returndata.length > 0) {
                assembly {
                    let returndata_size := mload(returndata)
                    revert(add(32, returndata), returndata_size)
                }
            } else {
                revert(errorMessage);
            }
        }
    }

    /**
     * @dev Batch transfer for gas efficiency
     */
    function batchTransfer(
        IERC20 token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) internal {
        require(recipients.length == amounts.length, "Array length mismatch");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            safeTransfer(token, recipients[i], amounts[i]);
        }
    }
}
