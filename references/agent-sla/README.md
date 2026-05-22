# KSB reference: agent-to-agent SLA bond

A small, forkable reference integration built on [`ksb-sdk`](https://www.npmjs.com/package/ksb-sdk).

It demonstrates one KSB adoption path: a provider agent stakes a bond
promising that one of its endpoints stays reachable. The bond is verified by
the built-in `http_status_check` rule, so the KSB verifier hub does the
checking - no self-reported result is trusted.

## Flow

1. Register an app (or reuse one via `KSB_APP_API_KEY`)
2. Create an SLA bond whose verifier config references `http_status_check`
3. The operator dispatches the verifier hub, which fetches the endpoint
4. Read the resolved bond status

The entire integration is the `runAgentSlaBond` function in `src/index.ts`.

## Configure

```bash
cp .env.example .env
```

| Variable | Purpose |
| --- | --- |
| `KSB_BASE_URL` | KSB instance to integrate against |
| `KSB_OPERATOR_API_KEY` | registers the app and dispatches the verifier hub |
| `KSB_APP_API_KEY` | optional: reuse an existing app instead of registering one |
| `AGENT_HEALTH_URL` | the endpoint the SLA bond promises to keep reachable |
| `PROVIDER_ADDRESS` / `COUNTERPARTY_ADDRESS` | bond parties (Kaspa addresses) |

## Run

```bash
npm install
node --env-file=.env --experimental-strip-types src/index.ts
```

Or `npm run typecheck` to compile-check without running.

## Fork this

To adapt it to your own use case, change the verifier config in
`createBond`: swap `http_status_check` for another built-in rule
(`http_content_check`, `deadline_time_check`, `signature_check`,
`external_oracle_check`) or a custom registered webhook verifier, and adjust
the slash distribution. The rest of the flow stays the same.

MIT licensed.
