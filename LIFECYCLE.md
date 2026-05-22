# BondClaw Bond Lifecycle

## Purpose

Define the minimum application-side state machine that sits above the proven TN12 release/slash covenant flows.

## Core entities

- buyer
- agent
- verifier
- bond
- verifier decision
- on-chain execution event

## Minimum state machine

### 1. draft
Bond terms are being assembled but not yet accepted.

Required fields:
- buyer identity
- agent identity
- job reference
- bond principal sompi
- release policy
- slash policy
- verifier policy
- deadline timestamp

### 2. offered
Buyer has issued the bond offer and terms are frozen pending agent acceptance.

### 3. accepted
Agent has accepted terms but on-chain funds are not yet locked.

### 4. funding_pending
The system expects the bond lock transaction to be broadcast.

### 5. active
The lock transaction is visible and the bond covenant UTXO exists on-chain.

Required on-chain fields:
- lock txid
- lock vout
- covenant address
- artifact identifier
- constructor args snapshot

### 6. verification_pending
The agent claims completion and the verifier must decide.

### 7a. approved
Verifier approves the work.
Expected next action:
- release transaction broadcast

### 7b. rejected
Verifier rejects the work.
Expected next action:
- slash transaction broadcast

### 7c. expired
Deadline passed without acceptable completion.
Expected next action:
- slash transaction broadcast

### 8a. released
Release transaction succeeded on-chain.
Terminal success state.

### 8b. slashed
Slash transaction succeeded on-chain.
Terminal failure state.

### 8c. failed_execution
Expected on-chain action failed and needs operator or retry logic.

## Transition rules

- `draft -> offered`
- `offered -> accepted`
- `accepted -> funding_pending`
- `funding_pending -> active`
- `active -> verification_pending`
- `verification_pending -> approved | rejected | expired`
- `approved -> released | failed_execution`
- `rejected -> slashed | failed_execution`
- `expired -> slashed | failed_execution`

## Phase 2 implementation target

The first database-backed product slice should support:
- creating a bond draft
- accepting a bond
- recording the lock transaction
- recording a verifier decision
- recording release or slash execution
- rendering current state from durable rows

## Phase 2 non-goals

- full dispute resolution
- multi-verifier consensus
- automatic retries across many wallets
- dynamic economic policy marketplace
