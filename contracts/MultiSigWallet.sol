// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MultiSigWallet
 * @notice A multi-signature wallet that requires a minimum number of owner
 *         confirmations before a transaction can be executed.
 *
 * Design rationale
 * ────────────────
 * • Inspired by Gnosis Safe & ConsenSys MultiSigWallet patterns.
 * • Follows the Checks-Effects-Interactions pattern throughout.
 * • Events are emitted for every state-changing action so off-chain
 *   indexers / UIs can track the wallet in real time.
 * • Owners are stored both in a mapping (O(1) lookup) and in an array
 *   (enumeration / iteration).
 */
contract MultiSigWallet {
    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event Deposit(address indexed sender, uint256 amount, uint256 balance);
    event SubmitTransaction(
        address indexed owner,
        uint256 indexed txIndex,
        address indexed to,
        uint256 value,
        bytes data
    );
    event ConfirmTransaction(address indexed owner, uint256 indexed txIndex);
    event RevokeConfirmation(address indexed owner, uint256 indexed txIndex);
    event ExecuteTransaction(address indexed owner, uint256 indexed txIndex);
    event OwnerAdded(address indexed owner);
    event OwnerRemoved(address indexed owner);
    event RequirementChanged(uint256 required);

    // ──────────────────────────────────────────────
    //  State variables
    // ──────────────────────────────────────────────

    address[] public owners;
    mapping(address => bool) public isOwner;
    uint256 public numConfirmationsRequired;

    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        uint256 numConfirmations;
    }

    // txIndex => owner => confirmed
    mapping(uint256 => mapping(address => bool)) public isConfirmed;

    Transaction[] public transactions;

    // ──────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────

    modifier onlyOwner() {
        require(isOwner[msg.sender], "not owner");
        _;
    }

    modifier txExists(uint256 _txIndex) {
        require(_txIndex < transactions.length, "tx does not exist");
        _;
    }

    modifier notExecuted(uint256 _txIndex) {
        require(!transactions[_txIndex].executed, "tx already executed");
        _;
    }

    modifier notConfirmed(uint256 _txIndex) {
        require(!isConfirmed[_txIndex][msg.sender], "tx already confirmed");
        _;
    }

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    /**
     * @param _owners                Array of initial owner addresses.
     * @param _numConfirmationsRequired  Minimum confirmations to execute a tx.
     */
    constructor(address[] memory _owners, uint256 _numConfirmationsRequired) {
        require(_owners.length > 0, "owners required");
        require(
            _numConfirmationsRequired > 0 &&
                _numConfirmationsRequired <= _owners.length,
            "invalid number of required confirmations"
        );

        for (uint256 i = 0; i < _owners.length; i++) {
            address owner = _owners[i];

            require(owner != address(0), "invalid owner");
            require(!isOwner[owner], "owner not unique");

            isOwner[owner] = true;
            owners.push(owner);
        }

        numConfirmationsRequired = _numConfirmationsRequired;
    }

    // ──────────────────────────────────────────────
    //  Receive Ether
    // ──────────────────────────────────────────────

    receive() external payable {
        emit Deposit(msg.sender, msg.value, address(this).balance);
    }

    // ──────────────────────────────────────────────
    //  Core functions
    // ──────────────────────────────────────────────

    /**
     * @notice Propose a new transaction. Only owners can submit.
     * @param _to    Destination address.
     * @param _value Amount of Ether (in wei) to send.
     * @param _data  Calldata payload (use "" for plain Ether transfers).
     */
    function submitTransaction(
        address _to,
        uint256 _value,
        bytes memory _data
    ) public onlyOwner {
        uint256 txIndex = transactions.length;

        transactions.push(
            Transaction({
                to: _to,
                value: _value,
                data: _data,
                executed: false,
                numConfirmations: 0
            })
        );

        emit SubmitTransaction(msg.sender, txIndex, _to, _value, _data);
    }

    /**
     * @notice Confirm an existing transaction. Each owner may confirm once.
     * @param _txIndex Index of the transaction to confirm.
     */
    function confirmTransaction(
        uint256 _txIndex
    )
        public
        onlyOwner
        txExists(_txIndex)
        notExecuted(_txIndex)
        notConfirmed(_txIndex)
    {
        Transaction storage transaction = transactions[_txIndex];
        transaction.numConfirmations += 1;
        isConfirmed[_txIndex][msg.sender] = true;

        emit ConfirmTransaction(msg.sender, _txIndex);
    }

    /**
     * @notice Execute a transaction once the confirmation threshold is met.
     * @dev    Uses Checks-Effects-Interactions:
     *         1. Check threshold  2. Mark executed  3. External call
     * @param _txIndex Index of the transaction to execute.
     */
    function executeTransaction(
        uint256 _txIndex
    ) public onlyOwner txExists(_txIndex) notExecuted(_txIndex) {
        Transaction storage transaction = transactions[_txIndex];

        require(
            transaction.numConfirmations >= numConfirmationsRequired,
            "cannot execute tx"
        );

        // Effects before interactions (CEI pattern)
        transaction.executed = true;

        // Interaction
        (bool success, ) = transaction.to.call{value: transaction.value}(
            transaction.data
        );
        require(success, "tx failed");

        emit ExecuteTransaction(msg.sender, _txIndex);
    }

    /**
     * @notice Revoke a previously given confirmation. Only before execution.
     * @param _txIndex Index of the transaction to revoke confirmation for.
     */
    function revokeConfirmation(
        uint256 _txIndex
    ) public onlyOwner txExists(_txIndex) notExecuted(_txIndex) {
        require(isConfirmed[_txIndex][msg.sender], "tx not confirmed");

        Transaction storage transaction = transactions[_txIndex];
        transaction.numConfirmations -= 1;
        isConfirmed[_txIndex][msg.sender] = false;

        emit RevokeConfirmation(msg.sender, _txIndex);
    }

    // ──────────────────────────────────────────────
    //  Owner management (multisig-guarded)
    // ──────────────────────────────────────────────

    /**
     * @notice Add a new owner. Must be called via a multisig transaction
     *         (i.e., the wallet calls itself).
     */
    function addOwner(address _owner) public {
        require(msg.sender == address(this), "must be called via multisig tx");
        require(_owner != address(0), "invalid owner");
        require(!isOwner[_owner], "owner already exists");

        isOwner[_owner] = true;
        owners.push(_owner);

        emit OwnerAdded(_owner);
    }

    /**
     * @notice Remove an existing owner. Must be called via a multisig tx.
     *         If the required confirmations exceed the new owner count,
     *         the requirement is automatically lowered.
     */
    function removeOwner(address _owner) public {
        require(msg.sender == address(this), "must be called via multisig tx");
        require(isOwner[_owner], "not an owner");
        require(owners.length - 1 > 0, "cannot remove last owner");

        isOwner[_owner] = false;

        // Remove from array (swap-and-pop)
        for (uint256 i = 0; i < owners.length; i++) {
            if (owners[i] == _owner) {
                owners[i] = owners[owners.length - 1];
                owners.pop();
                break;
            }
        }

        // Auto-adjust threshold if needed
        if (numConfirmationsRequired > owners.length) {
            numConfirmationsRequired = owners.length;
            emit RequirementChanged(numConfirmationsRequired);
        }

        emit OwnerRemoved(_owner);
    }

    /**
     * @notice Change the number of required confirmations.
     *         Must be called via a multisig transaction.
     */
    function changeRequirement(uint256 _required) public {
        require(msg.sender == address(this), "must be called via multisig tx");
        require(
            _required > 0 && _required <= owners.length,
            "invalid requirement"
        );
        numConfirmationsRequired = _required;
        emit RequirementChanged(_required);
    }

    // ──────────────────────────────────────────────
    //  View / helper functions
    // ──────────────────────────────────────────────

    function getOwners() public view returns (address[] memory) {
        return owners;
    }

    function getTransactionCount() public view returns (uint256) {
        return transactions.length;
    }

    function getTransaction(
        uint256 _txIndex
    )
        public
        view
        returns (
            address to,
            uint256 value,
            bytes memory data,
            bool executed,
            uint256 numConfirmations
        )
    {
        Transaction storage transaction = transactions[_txIndex];
        return (
            transaction.to,
            transaction.value,
            transaction.data,
            transaction.executed,
            transaction.numConfirmations
        );
    }
}
