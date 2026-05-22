# BondClaw TN12 Operator Workflow

## Default mode

The normal runtime path is now the parameterized contract.
You do not need to set `BOND_ARTIFACT_PATH` for standard runs.

## Release proof flow

```bash
cd /home/void/.openclaw/workspace2/bonds
npm run compile:covenant:release
npm run bond:lock
BOND_LOCK_TXID=<lock-txid> BOND_LOCK_VOUT=0 npm run proof:release
```

Behavior:
- compiles a parameterized contract with `BOND_RELEASE_DEADLINE` or default `1700000000`
- lock funds into the releaseable covenant address
- spend them back to the agent address through the release branch

## Slash proof flow

```bash
cd /home/void/.openclaw/workspace2/bonds
npm run compile:covenant:slash
npm run bond:lock
BOND_LOCK_TXID=<lock-txid> BOND_LOCK_VOUT=0 npm run proof:slash
```

Behavior:
- compiles a parameterized contract with `BOND_SLASH_DEADLINE` or default `1`
- lock funds into the slash-ready covenant address
- spend them through the slash branch

## Useful env vars

Core:
- `TN12_WRPC_URL`
- `TN12_NETWORK`
- `TN12_PRIVATE_KEY`
- `TN12_ORACLE_PRIVATE_KEY`
- `TN12_SLASH_PRIVATE_KEY`

Destinations:
- `TN12_AGENT_ADDRESS`
- `TN12_BUYER_ADDRESS`
- `TN12_PLATFORM_FEE_ADDRESS`
- `TN12_BURN_ADDRESS`

Amounts and policy:
- `BOND_AMOUNT_SOMPI`
- `BOND_PRIORITY_FEE_SOMPI`
- `BOND_MINER_FEE_SOMPI`
- `BOND_RELEASE_DEADLINE`
- `BOND_SLASH_DEADLINE`

Dry run:
- `DRY_RUN=1`

## Legacy path

The hardcoded proof contract remains available only for historical/debug use:

```bash
npm run debug:compile:legacy
BOND_ARTIFACT_PATH=../artifacts/minimum-bond.json npm run covenant:address
```

Warnings:
- this path is obsolete
- one old low-fee lock is stranded there already
- do not use this path for normal operation
