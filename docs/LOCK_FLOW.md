# Bond Lock Flow

## Purpose

`npm run bond:lock` builds the first real bond-lock transaction path for the local TN12 proof harness.

It does this:
- loads the compiled covenant artifact from `artifacts/minimum-bond.json`
- derives the covenant P2SH address
- connects to TN12 wRPC
- loads UTXOs for `TN12_PRIVATE_KEY`
- builds a transaction that sends `BOND_AMOUNT_SOMPI` to the covenant address
- signs the transaction
- either prints the transaction in dry-run mode or broadcasts it

## Required env

- `TN12_PRIVATE_KEY`
- `TN12_WRPC_URL`
- `TN12_NETWORK`
- `BOND_AMOUNT_SOMPI`
- `DRY_RUN`

## Safe first use

Run this first:

```bash
cd /home/void/.openclaw/workspace2/bonds
npm run compile:covenant
npm run check:rpc
npm run wallet:info
npm run bond:lock
```

With `DRY_RUN=1`, the script will:
- not broadcast
- print the fully built transaction payload for inspection

Current observed dry-run result in this workspace:
- funding address: `kaspatest:qp8n2k7uklxq4aegau7vawtptkgxsja4kt99lpv6krctwpq8tpc655cyvcmd3`
- covenant address: `kaspatest:pznzz7fsvt6veem736gytdflc87jg393ugwpxch8ac23hhae565mgw7t7k043`
- target amount: `10 KAS`
- dry-run txid: `0744f8899e914fedc60fe4041319ca200e6e2b9d36ee33f9e4289aa22244e63d`

## Live use

After the wallet is funded and the transaction looks correct:

```bash
DRY_RUN=0 npm run bond:lock
```

## What this script does not do yet

- it does not build the release-path spend transaction
- it does not build the slash-path spend transaction
- it does not write tx hashes automatically into a verification log file yet
- it still depends on a hardcoded proof contract instead of parameterized covenant args

## Next required work

1. `release-proof.mjs`
2. `slash-proof.mjs`
3. tx hash recorder for Phase 1 evidence
4. parameterized covenant constructor flow
