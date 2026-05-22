# Bond Release Flow

## Purpose

`npm run proof:release` builds the release-path spend transaction for the current bond covenant skeleton.

It does this:
- derives the covenant address from `artifacts/minimum-bond.json`
- loads the covenant UTXO from TN12
- builds a one-input transaction returning funds to `TN12_AGENT_ADDRESS`
- signs the spend with `TN12_ORACLE_PRIVATE_KEY`
- assembles the `release` entrypoint sigscript
- either prints the transaction in dry-run mode or broadcasts it

## Required env

- `TN12_WRPC_URL`
- `TN12_NETWORK`
- `TN12_AGENT_ADDRESS`
- `TN12_ORACLE_PRIVATE_KEY`
- optional `BOND_LOCK_TXID`
- optional `BOND_LOCK_VOUT`
- `DRY_RUN`

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
DRY_RUN=1 npm run proof:release
```

## What this proves

Once broadcast successfully on TN12, this will prove:
- the lock output can be spent by the release branch
- the oracle signature path works with the compiled covenant artifact
- the covenant UTXO can return funds to the agent destination
- the covenant enforces the release destination and full-value-minus-fee amount

## What this does not prove yet

- exact pre-deadline enforcement on the release branch
- slash-path routing
- buyer compensation split
- platform fee split
- burn routing

Those are the next steps.
