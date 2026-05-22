# KSB reference: bug bounty escrow bond

A small, forkable reference integration built on [`ksb-sdk`](https://www.npmjs.com/package/ksb-sdk).

It demonstrates a KSB adoption path with a **composed verifier rule set** and
the **dispute path**: a sponsor escrows a bounty as a bond; a researcher
submits a finding; verification requires a published write-up AND either a
signed disclosure OR a triage oracle verdict.

## Flow

1. Register an app (or reuse one via `KSB_APP_API_KEY`)
2. Escrow the bounty as a bond with a composed `AND` / `OR` rule set
3. The researcher submits proof of the finding
4. The sponsor contests the outcome into arbitration

The entire integration is the `runBugBountyBond` function in `src/index.ts`.

## Configure

```bash
cp .env.example .env
```

| Variable | Purpose |
| --- | --- |
| `KSB_BASE_URL` | KSB instance to integrate against |
| `KSB_OPERATOR_API_KEY` | registers the app |
| `KSB_APP_API_KEY` | optional: reuse an existing app |
| `REPORT_URL` | where the disclosure write-up is published |
| `SPONSOR_ADDRESS` / `RESEARCHER_ADDRESS` | bond parties (Kaspa addresses) |

## Run

```bash
npm install
node --env-file=.env --experimental-strip-types src/index.ts
```

Or `npm run typecheck` to compile-check without running.

## Fork this

The composed rule set in `createBond` is the part to adapt. An `AND` group
requires every child; an `OR` group requires any child. Swap rules, nest
groups, or point the OR branch at a custom registered webhook verifier to
match your bounty program's review policy.

MIT licensed.
