# Kaspa Service Bond Protocol (KSB)
## Universal SLA Bond Primitive for the Kaspa Ecosystem
## Implementation Framework

---

## Context for the agent

You are building **Kaspa Service Bonds (KSB)**, a universal SLA bond primitive that any project, agent, marketplace, or service provider in the Kaspa ecosystem can use. This is not a single product. It is open infrastructure built around Kaspa covenants that enables trustless commitment between any two parties on Kaspa.

**The primitive in one sentence:**
Any party, the provider, can stake KAS as a bond against a promise. If automated verification confirms the promise was kept by the deadline, the bond returns to the provider plus payment. If verification fails or the deadline passes, the bond is slashed. A portion compensates the counterparty, a portion is burned, and a portion goes to the verifier as fee.

**Why this exists:**
Kaspa's covenant primitive shipping with Toccata enables on-chain conditional escrow without smart contracts. Right now every project building on Kaspa that needs commitment enforcement has to roll its own implementation. KSB is the reference primitive, a shared, audited, standardized lock, verify, release, or slash flow that everyone in the ecosystem can use through a simple SDK.

**The vision:**
KSB should fill the same role for Kaspa service commitments that Uniswap V2 filled for AMMs on Ethereum. It should become the default primitive other projects integrate instead of rebuilding.

---

## Strategic context

**Toccata launch window:**
- Code freeze: April 15, 2026
- Testnet 12 has KIP-17 covenants live
- Mainnet activation: June 5 to June 20, 2026
- Build target: feature-complete on testnet by June 1, mainnet launch June 5 to June 7

**Standards alignment:**
KSB is the Kaspa-native implementation of the ERC-8004 Validation Registry pattern, specifically stake-secured re-execution.
Spec reference: https://eips.ethereum.org/EIPS/eip-8004
Agent profiles emitted by KSB must be ERC-8004 compatible for cross-chain reputation portability.

**Positioning:**
KSB is not a product. It is a public good. It should be MIT licensed, open source from day one, optimized for ecosystem adoption, and funded by a minimal 0.5% protocol fee that supports security audits and reference implementations.

---

## Use cases

KSB is intentionally use-case agnostic. The same primitive should serve:

1. Agent-to-agent SLA bonds
2. Freelance and gig work
3. Bug bounty escrow
4. DAO milestone funding
5. API uptime SLA bonds
6. Prediction market resolution bonds
7. Subscription or pay-on-delivery agreements
8. Personal commitment devices
9. Content authenticity bonds
10. Supply chain delivery bonds

The verifier rules vary by use case. The primitive stays the same.

---

## Hard constraints

- Raw SQL only via `(db as any).$client.execute()` for any reference web app
- Every API route exports `export const dynamic = 'force-dynamic'`
- BigInt converted with `Number(val)` before serialization
- Deploy via `vercel --prod --force` then `vercel alias set <url> <domain>`
- All on-chain code in SilverScript, open source, formally documented
- SDK published as `@ksb/sdk` on npm under a public scope
- All slashing economics defined as protocol constants, not hardcoded values
- 0.5% protocol fee
- No em dashes anywhere in code, docs, comments, or copy
- Build on testnet 12 first, mainnet launch only after Toccata activation is confirmed

---

## Architecture overview

```text
+----------------------------------+
| Application Layer                |
| agents, marketplaces, DAOs,      |
| bounty platforms, anything       |
+----------------------------------+
                |
                v
+----------------------------------+
| KSB SDK (TypeScript)             |
| createBond()                     |
| submitProof()                    |
| resolveExpired()                 |
| getStatus()                      |
+----------------------------------+
                |
                v
+----------------------------------+
| KSB Protocol Layer               |
| Bond manager API                 |
| Pluggable verifier framework     |
| Slasher cron                     |
| Reputation aggregator            |
+----------------------------------+
                |
                v
+----------------------------------+
| Kaspa L1 (Toccata)               |
| Covenant UTXOs                   |
| Lock, release, slash txs         |
| SilverScript scripts             |
+----------------------------------+
```

### Three core layers

1. **Covenant Layer**
   - SilverScript covenant scripts
   - audited, versioned, open source
   - enforce lock, verify, release, or slash at protocol level

2. **Protocol Layer**
   - lifecycle orchestration
   - verifier dispatching
   - on-chain transaction construction
   - self-hostable reference implementation

3. **SDK Layer**
   - TypeScript developer surface
   - `createBond`, `submitProof`, `resolveExpired`

---

## Bond lifecycle

```text
proposed -> committed -> active -> {verified | failed | timed_out}
   ^                                    |
   |                                    v
   +----------- contested --------------+
                    |
                    v
               arbitration
                    |
                    v
          {released | slashed}
```

State definitions are universal. The verifier interface is what varies.

---

## Phase 1 - Toccata testnet proof of concept

### Task 1.1 - Establish testnet 12 connection
- confirm KIP-17 covenants are available on TN12
- document the exact RPC endpoint for TN12
- set up a test wallet with TN12 KAS

### Task 1.2 - Reference covenant
Write a SilverScript covenant that:
- locks N KAS
- is spendable by verifier signature A before deadline T
- is spendable by slasher signature B after deadline T
- routes both spend paths to configurable addresses

### Task 1.3 - End-to-end TN12 test
1. create the bond covenant and lock 10 TKAS
2. sign as verifier and release to provider address, then confirm on TN12
3. repeat with timeout path, sign as slasher, route to slash destinations, then confirm on TN12

### Task 1.4 - Reference documentation
Write `COVENANT_SPEC.md` documenting:
- the exact SilverScript
- covenant invariants
- addresses involved in each spend path

**Output of Phase 1:**
Two confirmed TN12 transactions and a documented covenant spec. Stop here and confirm before proceeding.

If Toccata is delayed past June 20, fall back to a multisig plus timelock pattern and document `COVENANT_FALLBACK.md`.

---

## Phase 2 - Data layer

### Task 2.1 - Schema
Reference implementation schema should include:
- `bonds`
- `verifications`
- `slashing_events`
- `party_history`
- `verifier_rules`
- `registered_apps`

The canonical schema definition is the KSB schema from the product brief and should be executed only through raw SQL via `$client.execute()`.

### Task 2.2 - Slash distribution JSON
Apps define slash distribution per bond, for example:

```json
{
  "counterparty_compensation": 0.50,
  "burn": 0.45,
  "protocol_fee": 0.005,
  "verifier_fee": 0.045
}
```

Distribution must sum to `1.0`. Protocol fee is fixed at `0.005`.

**Output of Phase 2:**
Schema deployed and configuration system live.

---

## Phase 3 - Protocol layer API

All routes export `export const dynamic = 'force-dynamic'` and include `X-KSB-Protocol-Version` response headers.

Target API surface:
- `POST /api/v1/bonds`
- `GET /api/v1/bonds/[id]`
- `POST /api/v1/bonds/[id]/submit`
- `GET /api/v1/bonds/[id]/status`
- `POST /api/v1/bonds/[id]/contest`
- `GET /api/v1/parties/[addr]`
- `GET /api/v1/parties/[addr]/score`
- `POST /api/v1/cron/resolve-expired`
- `POST /api/v1/cron/auto-verify`
- `POST /api/v1/apps/register`
- `GET /api/v1/verifier-rules`

### Task 3.1 - App registration
- register apps with `app_id` and API key
- record use case template or `custom`
- require API key on bond creation

### Task 3.2 - Bond creation
- validate provider balance
- construct covenant tx through Kaspa SDK
- return unsigned tx for signing
- persist bond and watch on-chain confirmation after signed tx receipt

### Task 3.3 - Submission and contest
- dispatch verifiers from `verifier_config`
- support optional app-defined contest windows
- keep routes idempotent

### Task 3.4 - BigInt safety
Test 10 KAS, 1000 KAS, and 1,000,000 KAS values to confirm safe serialization through `Number(val)`.

**Output of Phase 3:**
Versioned API complete and OpenAPI spec published.

---

## Phase 4 - Verifier hub

### Task 4.1 - Built-in rule library
Built-in rules should cover:
- HTTP checks
- content checks
- time checks
- signature checks
- external oracle checks

### Task 4.2 - Custom verifier registration
- apps can register custom verifier webhooks
- KSB expects signed pass or fail responses within timeout

### Task 4.3 - Composable rule sets
Support structured AND or OR rule composition with configurable parameters.

### Task 4.4 - Verifier oracle
- single oracle key signs release txs initially
- quarterly rotation
- documented migration path to multisig or TEE-backed oracle

**Output of Phase 4:**
Built-in rules, custom verifier registration, and oracle signing flow tested.

---

## Phase 5 - Slasher cron

### Task 5.1 - Expired bond resolver
Run every 60 seconds:
- find expired active or committed bonds
- slash with reason `timeout`
- split per `slash_distribution`
- update bond status

### Task 5.2 - Failed verification resolver
- auto-trigger on rule failure
- slash with reason `verification_failed`

### Task 5.3 - Released bond resolver
- when all rules pass and contest window closes
- release bond and route payment if applicable

### Task 5.4 - Idempotency
All cron jobs must be idempotent with status guards preventing double execution.

**Output of Phase 5:**
Three idempotent resolvers running and load-tested.

---

## Phase 6 - SDK

### Task 6.1 - Package structure
`@ksb/sdk` should expose:
- `createBond(config)`
- `submitProof(bondId, proof)`
- `resolveExpired(bondId)`
- `getStatus(bondId)`
- `getPartyScore(address)`
- `verifierRules()`

### Task 6.2 - Quick start example
A complete hello-world bond flow should fit in under 20 lines of code.

### Task 6.3 - Publishing
- publish `@ksb/sdk`
- include types
- semantic versioning
- README and examples directory

**Output of Phase 6:**
SDK live on npm with working quickstart.

---

## Phase 7 - Reputation layer

### Task 7.1 - Party scoring
Track:
- overall release ratio
- slash value ratio
- active risk indicator
- per-app sub-scores

### Task 7.2 - ERC-8004 compatibility
Emit reputation payloads compatible with ERC-8004.

### Task 7.3 - Public reputation API
Allow public score and history lookup for any party.

**Output of Phase 7:**
Reputation system live with ERC-8004 compatible output.

---

## Phase 8 - Reference integrations

Build three MIT-licensed reference apps:
1. agent SLA reference
2. bug bounty reference
3. personal commitment reference

Each should be small, readable, and built on the SDK to prove adoption paths.

**Output of Phase 8:**
Three reference apps live on testnet with forkable docs.

---

## Phase 9 - Toccata testnet end to end

Required TN12 test cases:
1. bond created, verified, released
2. bond created, deadline missed, slashed per default distribution
3. bond created, verification failed, slashed
4. bond created, contested, moved to arbitration
5. custom verifier webhook end-to-end
6. multisig verifier end-to-end
7. custom slash distribution executes correctly
8. cron downtime recovery without duplicate txs
9. reputation updates after each resolution
10. each reference app completes a bond on TN12

**Output of Phase 9:**
All 10 tests pass on TN12 and transaction hashes are documented in `TESTNET_VERIFICATION.md`.

---

## Phase 10 - Mainnet launch

### Task 10.1 - Audit completion
- external security audit complete
- critical and high issues resolved
- report published

### Task 10.2 - Mainnet deployment
- deploy covenant primitives on activation
- run 1 KAS release-path test
- run 1 KAS slash-path test
- confirm both work

### Task 10.3 - Public launch
- production SDK published
- public instance live at `ksb.kaspa.org`
- docs live
- three reference apps live on mainnet

### Task 10.4 - Ecosystem outreach
- submit PR to awesome-kaspa
- coordinate with Kaspa core devs
- contact ecosystem builders for integration
- publish technical blog post
- publish activation-day X thread

**Output of Phase 10:**
Mainnet live, reference apps live, outreach complete.

---

## Status reporting format

After each phase:

```text
PHASE_N_STATUS: COMPLETE | BLOCKED | IN_PROGRESS
TESTNET_TXS: <list of TN12 transaction hashes>
FILES_CREATED: <count>
TESTS_PASSING: <count>/<total>
BLOCKERS: <any, or NONE>
NEXT_PHASE: <phase>
```

At the end of each successful run:

```text
TASK_STATUS: COMPLETE
COMMIT: <hash>
DEPLOYED: <url or N/A>
ACTIVATION_READY: YES | NO
```

---

## Rules of engagement

1. Phase 1 is a hard gate. If Toccata is not viable by June 20, stop and report.
2. This is infrastructure, not a product. Favor adoption over revenue capture.
3. Open source from day zero.
4. Treat the verifier oracle as the most security-critical key in the system.
5. Make every cron-triggered action idempotent.
6. Race the Toccata launch window.
7. Reference apps are mandatory.
