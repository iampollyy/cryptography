// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Simple counter contract used to test calldata execution via MultiSig.
contract Counter {
    uint256 public count;

    function increment() external {
        count += 1;
    }
}
