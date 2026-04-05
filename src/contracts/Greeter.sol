// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract Greeter {
    string private greeting;
    string private name;

    constructor(string memory _name) {
        name = _name;
        greeting = string(abi.encodePacked("Hello, ", _name, "!"));
    }

    function greet() public view returns (string memory) {
        return greeting;
    }

    function getName() public view returns (string memory) {
        return name;
    }

    function setGreeting(string memory _name) public {
        name = _name;
        greeting = string(abi.encodePacked("Hello, ", _name, "!"));
    }

    event GreetingCalled(string message, address caller);

    function callGreeting() public {
        emit GreetingCalled(greeting, msg.sender);
    }
}
