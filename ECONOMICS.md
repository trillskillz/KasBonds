# KSB Economics

## Phase 2 objective

Define the minimum economic model for KSB so the protocol can move from covenant proof into persistent, reusable bond lifecycle design.

## Core economic rules

### Bond principal
- every accepted job has a bond principal denominated in KAS
- the principal is locked on-chain before work begins
- the principal amount must be stored exactly in sompi in the database

### Release path
- if the verifier approves the work, the bond is released back to the agent side
- Phase 2 assumption: service payment and bond principal are modeled separately
- the bond release path should not silently absorb platform fees

### Slash path
- if the verifier rejects the work or the deadline expires, the bond is slashed
- current proof split used during the earlier proof-of-concept:
  - counterparty compensation: 50%
  - protocol fee: 0.5%
  - burn: remaining amount unless verifier fee is configured
- protocol fee rule is fixed:
  - 0.5% of slashed distributable value

## Open product questions

### 1. Buyer compensation ratio
Current proof uses 50% because it kept the covenant simple.
Real product questions:
- should buyer compensation depend on job class?
- should buyer compensation cap at purchase price?
- should unused slash value burn or return partially to the agent?

### 2. Burn ratio
Current proof uses the remainder after buyer compensation and platform fee.
Real product questions:
- should some of that remainder go to an insurance pool instead?
- should burn policy differ between marketplace categories?

### 3. Minimum bond sizing
Need a policy for:
- absolute minimum bond amount
- bond amount as percentage of quoted work value
- higher multipliers for risky or delayed jobs

### 4. Verification incentives
Need to define whether verifier/oracle actors earn:
- direct fees from job creation
- success-only fees
- slash-contingent fees
- no on-chain fee and only off-chain compensation

## Phase 2 default assumptions
Unless changed later:
- bond amount stored as sompi integer
- slash protocol fee fixed at 0.5%
- slash distribution stored as configurable policy data per bond
- verifier signing policy remains operationally centralized for now

## Data model implications
Need tables or fields for:
- app identifier
- use-case template
- provider and counterparty addresses
- bond principal
- payment amount
- verifier configuration
- slash distribution policy
- release txid
- slash txid
- verifier decision status
- verifier signature metadata
- deadline timestamps

## Immediate next build target
Translate these rules into a raw SQL schema for:
- bonds
- verifications
- slashing events
- party history
- verifier rules
- registered apps
