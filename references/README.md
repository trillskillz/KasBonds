# KSB reference integrations

Small, forkable, MIT-licensed apps that show how to build on the Kaspa
Service Bond Protocol with [`ksb-sdk`](https://www.npmjs.com/package/ksb-sdk).

Each reference is a standalone project: its own `package.json`, a single
readable integration function, and forkable docs. They prove distinct
adoption paths for the same primitive.

| Reference | Path | Adoption path |
| --- | --- | --- |
| Agent SLA bond | `agent-sla/` | a provider stakes that an endpoint stays reachable, verified by `http_status_check` |
| Bug bounty escrow | `bug-bounty/` | a sponsor escrows a bounty, verified by a composed `AND` / `OR` rule set, with a dispute path |
| Personal commitment | `personal-commitment/` | a person stakes a goal with a deadline, verified by `deadline_time_check` with a runtime input |

Reference integrations are part of KSB Phase 8. The SDK itself also ships
short illustrative snippets under `sdk/examples/`; the references here are
fuller standalone projects meant to be cloned and adapted.
