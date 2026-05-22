# KSB reference: personal commitment bond

A small, forkable reference integration built on [`ksb-sdk`](https://www.npmjs.com/package/ksb-sdk).

It demonstrates KSB as a **personal commitment device**: a person stakes a
bond on a goal with a deadline. The bond is verified by the built-in
`deadline_time_check` rule - the goal must be completed on or before the
deadline.

`deadline_time_check` needs a runtime input (the claimed completion time)
that is not known when the bond is created, so this reference shows how to
pass `inputs` when dispatching the verifier hub.

## Flow

1. Register an app (or reuse one via `KSB_APP_API_KEY`)
2. Stake the commitment bond with a `deadline_time_check` rule
3. Dispatch the verifier hub, passing the completion time as a runtime input
4. Read the resolved bond status

The entire integration is the `runPersonalCommitmentBond` function in
`src/index.ts`.

## Configure

```bash
cp .env.example .env
```

| Variable | Purpose |
| --- | --- |
| `KSB_BASE_URL` | KSB instance to integrate against |
| `KSB_OPERATOR_API_KEY` | registers the app and dispatches the verifier hub |
| `KSB_APP_API_KEY` | optional: reuse an existing app |
| `COMMITTER_ADDRESS` / `ACCOUNTABILITY_ADDRESS` | bond parties (Kaspa addresses) |
| `DEADLINE_UNIX` / `COMPLETED_AT_UNIX` | optional goal deadline and claimed completion time |

With the defaults the completion time is now and the deadline is 7 days
out, so the demo run resolves to a pass. Set `COMPLETED_AT_UNIX` after
`DEADLINE_UNIX` to see a missed-deadline fail.

## Run

```bash
npm install
node --env-file=.env --experimental-strip-types src/index.ts
```

Or `npm run typecheck` to compile-check without running.

## Fork this

`deadline_time_check` proves the runtime-input pattern. To make a commitment
provable rather than self-reported, add an `http_content_check` or a custom
webhook verifier rule so completion is checked, not just claimed, and
combine the rules with a composed `AND` rule set.

MIT licensed.
