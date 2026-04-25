// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Helper contract that always rejects incoming Ether (for testing).
contract Rejecter {
    receive() external payable {
        revert("I reject everything");
    }
}
