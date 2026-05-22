# Bond Slash Flow

## Purpose

`npm run proof:slash` builds the slash-path spend transaction for the current bond covenant skeleton.

It does this:
- derives the covenant address from `artifacts/minimum-bond.json`
- loads the covenant UTXO from TN12
- sets transaction lock time to the covenant `DEADLINE`
- computes slash outputs with a fixed 5 percent platform fee
- routes the remainder to the buyer, with optional burn routing
- signs the spend with `TN12_SLASH_PRIVATE_KEY`
- assembles the `slash` entrypoint sigscript
- either prints the transaction in dry-run mode or broadcasts it

## Required env

- `TN12_WRPC_URL`
- `TN12_NETWORK`
- `TN12_BUYER_ADDRESS`
- `TN12_PLATFORM_FEE_ADDRESS`
- `TN12_SLASH_PRIVATE_KEY`
- `TN12_BURN_ADDRESS`
- optional `BOND_LOCK_TXID`
- optional `BOND_LOCK_VOUT`
- `DRY_RUN`

## Slash split

The script now mirrors the covenant-enforced split:
- miner fee: `5000` sompi
- buyer compensation: `50%` of post-fee distributable value
- platform fee: `5%` of post-fee distributable value
- burn: remaining `45%`

This matches the current hardcoded Phase 1 proof contract.

## UTXO selection rules

The script will use:
- the explicitly provided outpoint if `BOND_LOCK_TXID` and `BOND_LOCK_VOUT` are set
- otherwise, the single covenant UTXO if exactly one exists at the covenant address

If multiple UTXOs exist and no outpoint is specified, the script stops instead of guessing.

## Safe first use

```bash
cd /home/void/.openclaw/workspace2/bonds
npm run compile:covenant
npm run check:rpc
npm run covenant:address
DRY_RUN=1 npm run proof:slash
```

## Current limitation

The covenant now enforces the slash split on-chain, which is a big step forward.
The remaining limitation is flexibility: the split and destinations are still hardcoded for the Phase 1 proof harness.

## What this proves once broadcast

- the slash signature path works with the compiled covenant artifact
- the post-deadline spend branch is reachable
- the local harness can build the intended slash output layout
