# Multi-Signature Wallet — Solidity Smart Contract

## Table of Contents

1. [Overview](#overview)  
2. [What Is a Multi-Sig Wallet?](#what-is-a-multi-sig-wallet)  
3. [Contract Design](#contract-design)  
4. [Requirements Specification](#requirements-specification)  
5. [Functions Reference](#functions-reference)  
6. [How to Deploy & Interact](#how-to-deploy--interact)  
7. [Testing](#testing)  
8. [Security Considerations](#security-considerations)  
9. [Role of Multi-Sig Wallets in DeFi](#role-of-multi-sig-wallets-in-defi)  

---

## Overview

This project implements a **multi-signature (multi-sig) wallet** smart contract in Solidity `^0.8.24`. The wallet requires a minimum number of owner confirmations before any on-chain transaction can be executed, significantly reducing single-point-of-failure risk.

The implementation is inspired by open-source reference contracts such as:

- **Gnosis Safe** — the most widely used multi-sig in production DeFi  
- **ConsenSys MultiSigWallet** — a simpler, well-audited reference implementation  

The project uses **Hardhat** as the development framework with comprehensive unit tests written in JavaScript using **Mocha/Chai** and `@nomicfoundation/hardhat-toolbox`.

---

## What Is a Multi-Sig Wallet?

A multi-signature wallet is a smart contract that holds funds and only allows transactions to be executed when a pre-defined number of authorised owners approve (confirm) the action.

**Example:** In a 2-of-3 multi-sig, there are 3 owners and any transaction needs at least 2 of them to confirm before it can be executed.

### Why it matters

| Problem | How Multi-Sig Solves It |
|---|---|
| Private key theft or loss | No single key can move funds alone |
| Malicious insider | Collusion of multiple parties is required |
| Governance of DAOs/treasuries | On-chain voting through confirmations |
| Smart contract upgrades | Multiple parties must agree to changes |

---

## Contract Design

### Data Structures

```
owners          : address[]                            — ordered list of owner addresses
isOwner         : mapping(address => bool)             — O(1) ownership check
transactions    : Transaction[]                        — append-only list of proposed txs
isConfirmed     : mapping(uint => mapping(address => bool)) — tracks who confirmed what
numConfirmationsRequired : uint256                     — threshold (e.g. 2)
```

Each `Transaction` struct stores:

| Field | Type | Description |
|---|---|---|
| `to` | `address` | Destination address |
| `value` | `uint256` | Amount of Ether (wei) to send |
| `data` | `bytes` | Calldata for contract interactions |
| `executed` | `bool` | Whether the tx has been executed |
| `numConfirmations` | `uint256` | Current confirmation count |

### Transaction Lifecycle

```
Submit  →  Confirm (×N)  →  Execute
              ↕
          Revoke (before execution)
```

1. **Submit** — An owner proposes a transaction (destination, value, calldata).  
2. **Confirm** — Other owners review and confirm. Each owner can confirm at most once.  
3. **Execute** — Once `numConfirmations >= numConfirmationsRequired`, any owner can trigger execution.  
4. **Revoke** — Before execution, an owner can withdraw their confirmation.  

### Access Control

- All core functions (`submitTransaction`, `confirmTransaction`, `executeTransaction`, `revokeConfirmation`) are restricted via the `onlyOwner` modifier.  
- Owner management functions (`addOwner`, `removeOwner`, `changeRequirement`) can only be called by the wallet itself (i.e., through a confirmed multi-sig transaction).

---

## Requirements Specification

| Parameter | Value |
|---|---|
| Owners | 3 addresses (configurable at deploy) |
| Required confirmations | 2 (configurable at deploy) |
| Features | Submit, Confirm, Revoke, Execute transactions |
| Dynamic ownership | Add/Remove owners via multi-sig |
| Constraints | Only owners interact; tx executes only once; no duplicate confirmations |

---

## Functions Reference

### Core Functions

| Function | Access | Description |
|---|---|---|
| `submitTransaction(to, value, data)` | Owner | Propose a new transaction |
| `confirmTransaction(txIndex)` | Owner | Confirm a pending transaction |
| `executeTransaction(txIndex)` | Owner | Execute once threshold is met |
| `revokeConfirmation(txIndex)` | Owner | Withdraw confirmation before execution |

### Owner Management (via multi-sig)

| Function | Access | Description |
|---|---|---|
| `addOwner(address)` | Wallet (self-call) | Add a new owner |
| `removeOwner(address)` | Wallet (self-call) | Remove an owner (auto-adjusts threshold) |
| `changeRequirement(uint256)` | Wallet (self-call) | Change the confirmation threshold |

### View Functions

| Function | Returns |
|---|---|
| `getOwners()` | `address[]` — list of all owners |
| `getTransactionCount()` | `uint256` — total number of submitted transactions |
| `getTransaction(txIndex)` | `(to, value, data, executed, numConfirmations)` |
| `owners(index)` | `address` — owner at a given index |
| `isOwner(address)` | `bool` |
| `isConfirmed(txIndex, owner)` | `bool` |

### Events

| Event | Emitted When |
|---|---|
| `Deposit(sender, amount, balance)` | Ether is received |
| `SubmitTransaction(owner, txIndex, to, value, data)` | A transaction is proposed |
| `ConfirmTransaction(owner, txIndex)` | An owner confirms |
| `RevokeConfirmation(owner, txIndex)` | An owner revokes |
| `ExecuteTransaction(owner, txIndex)` | A transaction is executed |
| `OwnerAdded(owner)` | A new owner is added |
| `OwnerRemoved(owner)` | An owner is removed |
| `RequirementChanged(required)` | Threshold is changed |

---

## How to Deploy & Interact

### Prerequisites

- Node.js ≥ 18  
- npm  

### Install

```bash
npm install
```

### NPM Scripts

The project includes convenient npm scripts for all common tasks:

| Command | Description |
|---|---|
| `npm run compile` | Compile Solidity contracts |
| `npm test` | Run all unit tests |
| `npm run test:verbose` | Run tests with verbose output |
| `npm run clean` | Remove compiled artifacts and cache |
| `npm run deploy:local` | Deploy to the built-in Hardhat network |
| `npm run node` | Start a persistent local Hardhat node |
| `npm run deploy:node` | Deploy to a running local Hardhat node |

### Compile

```bash
npm run compile
```

### Run Tests

```bash
npm test
```

### Deploy Locally

Start a local Hardhat node in one terminal, then deploy in another:

```bash
# Terminal 1 — start local node
npm run node

# Terminal 2 — deploy to local node
npm run deploy:node
```

Or deploy to the built-in ephemeral Hardhat network:

```bash
npm run deploy:local
```

## Testing

The test suite contains **40 tests** organized into 8 describe blocks:

| Category | Tests | What's Verified |
|---|---|---|
| Deployment | 8 | Owners, threshold, edge cases (0 owners, duplicates, zero address) |
| Receive Ether | 1 | Deposit event emission |
| submitTransaction | 3 | Submit by owner, reject non-owner, multiple txs |
| confirmTransaction | 6 | Confirm, multi-confirm, duplicate prevention, access control |
| executeTransaction | 6 | Threshold enforcement, balance transfer, double-exec prevention, failed call |
| revokeConfirmation | 6 | Revoke flow, prevent exec after revoke, access control |
| Owner management | 6 | Add/remove owners via multisig, auto-adjust threshold |
| View functions | 3 | Getters return correct data |
| Calldata execution | 1 | Calling another contract (Counter.increment) through multi-sig |

All tests verify both **state changes** and **emitted events**.

---

## Security Considerations

### Patterns Applied

1. **Checks-Effects-Interactions (CEI)**  
   In `executeTransaction`, the `executed` flag is set *before* the external call. This prevents reentrancy — even if the target contract calls back into the wallet, the transaction is already marked as executed.

2. **Access Control via Modifiers**  
   `onlyOwner`, `txExists`, `notExecuted`, `notConfirmed` — each modifier performs a single, focused check. They compose cleanly on functions.

3. **Duplicate Confirmation Prevention**  
   The `isConfirmed` mapping ensures each owner can confirm a transaction exactly once. The `notConfirmed` modifier enforces this.

4. **Single Execution Guarantee**  
   The `notExecuted` modifier and the `executed` flag prevent double-execution of any transaction.

5. **Self-call Pattern for Owner Management**  
   `addOwner`, `removeOwner`, and `changeRequirement` require `msg.sender == address(this)`, meaning they can only be invoked through a fully confirmed multi-sig transaction. This ensures no single owner can unilaterally change the wallet's governance.

6. **Automatic Threshold Adjustment**  
   When removing an owner would make the threshold unreachable (e.g., 3-of-3 → remove one owner → now 2 owners but threshold was 3), the contract automatically lowers the threshold.

### Known Limitations & Potential Vulnerabilities

| Issue | Mitigation |
|---|---|
| **No transaction expiry** | Transactions remain confirmable forever. A time-lock could be added. |
| **No nonce / replay protection across chains** | Contract lives on one chain; cross-chain replay is not applicable. |
| **Owner array iteration in `removeOwner`** | O(n) loop; acceptable for small owner sets (< 50). |
| **Low-level `.call`** | Required for arbitrary calldata; return value is checked (`require(success)`). |
| **No ERC-20 token support built-in** | Token transfers can be performed by encoding `transfer()` in `data`. |

---

## Role of Multi-Sig Wallets in DeFi

Multi-signature wallets are a **cornerstone of security** in decentralized applications:

- **Treasury management** — DAOs like Uniswap, Aave, and Compound use multi-sig wallets to govern protocol treasuries worth billions of dollars.  
- **Smart contract administration** — Upgradeable proxy contracts often have their admin keys held in a multi-sig, preventing unilateral upgrades.  
- **Team fund custody** — Startup teams use multi-sigs so that no single co-founder can drain company funds.  
- **Cross-organization governance** — Multiple independent entities can jointly control shared infrastructure.  

By requiring consensus among multiple independent key-holders, multi-sig wallets eliminate the catastrophic risk of a single compromised private key — the most common attack vector in blockchain security breaches.

The concept extends naturally to **threshold signatures** (e.g., Shamir's Secret Sharing, MPC wallets) and **social recovery wallets**, which represent the next evolution of this security paradigm.

---

## Project Structure

```
├── contracts/
│   ├── MultiSigWallet.sol       — Main multi-sig wallet contract
│   └── test/
│       ├── Counter.sol           — Helper for calldata execution tests
│       └── Rejecter.sol          — Helper that rejects Ether (failure tests)
├── test/
│   └── MultiSigWallet.test.js   — 40 unit tests
├── hardhat.config.js             — Hardhat configuration
├── package.json
└── README.md                     — This file
```
