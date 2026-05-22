# TN12 Proof Evidence

## Summary

BondClaw Phase 1 TN12 proof has been demonstrated with live broadcast transactions for both spend branches:
- release branch
- slash branch

## Deterministic proof keyset

Funding wallet:
- private key: `1111111111111111111111111111111111111111111111111111111111111111`
- address: `kaspatest:qp8n2k7uklxq4aegau7vawtptkgxsja4kt99lpv6krctwpq8tpc655cyvcmd3`

Release branch keys and destination:
- oracle private key: `2222222222222222222222222222222222222222222222222222222222222222`
- agent address: `kaspatest:qqkqkl8e2vj2qlg98x9jgqt5msxzhezym943tx4xclmmrengdqyeznn0pna8v`

Slash branch keys and destinations:
- slash private key: `3333333333333333333333333333333333333333333333333333333333333333`
- buyer address: `kaspatest:qzdvyqe4avu8drfq22lpmw7rermp0pq8gk89re454530rkghtzy4kz298lu48`
- platform fee address: `kaspatest:qpdtg6y7gq9y59sv7qwdg3ess3d9ga5dlp28mn0sw0vkfugf7xxrqpuexv6mu`
- burn address: `kaspatest:qpuk94zm8r5te7p04rh6sse2q8eqexjnufx860c3muvhew88pynd56n845dz8`

## Live proof transactions

### Release proof

Contract variant:
- relay-safe miner fee: `300000` sompi
- releaseable deadline variant address: `kaspatest:ppcwt3du0v7480zdvva9m3ztdd64jphjzlgllgxj5eze9ulk843723n7lcwvz`

Transactions:
- lock tx: `9cf239cbe6b26763da7b38585b4aecb540e5f66b71aeefaa2d943f5a875bb24f`
- release tx: `684baf6713017a8d2c25779244d8ab91f7c6fb55cf452c999d5c0402d5e212f6`

Observed release output:
- agent output value: `999700000` sompi

### Slash proof

Contract variant:
- relay-safe miner fee: `300000` sompi
- already-final slash deadline variant address: `kaspatest:pzqdlrtdwpqdc3a25a2ruxusj8gnk87pcyp0npfd7t8g7nmdhuj85x7pa4f0l`

Transactions:
- lock tx: `d9c2d49b413cfb040b6500147c0eb58b525425834730f4e20bb9e485aa05d925`
- slash tx: `f8b6bb653e9007f5f35cd8ce1613ff678a42783708aa47401d0a86ff5c1484c5`

Observed slash outputs:
- buyer output: `499850000` sompi
- platform fee output: `49985000` sompi
- burn output: `449865000` sompi

## Cleanup

Recovered extra parked releaseable test lock:
- extra lock tx: `e14de6d9aacdcb987fc18efa73b15fe4c961b91cb408b1f4f91e28cacb8d99d6`
- recovery release tx: `3b332d2caa2e8e8eaf858fd7ee9e4f4e2b49f3973f1738f0f0226e6cd2e78ec3`

## Known caveats

### 1. Obsolete stranded lock remains

An early low-fee test lock remains stranded under the obsolete contract variant:
- contract address: `kaspatest:pznzz7fsvt6veem736gytdflc87jg393ugwpxch8ac23hhae565mgw7t7k043`
- UTXO: `400d001707498f23d7ac07563ac7fa218f4749a3aa51ca62c5d709b15a0162b0:0`
- amount: `1000000000` sompi

This happened because the original contract hardcoded `MINER_FEE = 5000`, which was below TN12 standard relay policy for the covenant spend mass.

### 2. Proof contract is not production-ready

The working proof flow still relies on hardcoded constants for:
- oracle key
- slash key
- agent destination
- buyer destination
- platform fee destination
- burn destination
- deadline
- miner fee

### 3. Parameterized constructor flow is partially resolved

A full constructor-driven compile path now works locally:
- contract: `contracts/minimum-bond-parameterized.sil`
- args generator: `scripts/generate-constructor-args.mjs`
- args output: `artifacts/minimum-bond-parameterized.constructor-args.json`
- compile command: `npm run compile:covenant:param`

Runtime scripts also now accept:
- `BOND_ARTIFACT_PATH=../artifacts/minimum-bond-parameterized.json`

Follow-up progress:
- the parameterized artifact is now the default runtime path
- a fresh 1 KAS parameterized release flow was rebroadcast successfully:
  - lock: `7a0924cdd08faefaf185b2aae66d0d7fb0a072ba8228ac145d7470dcd619413e`
  - release: `40e175cab03bd8ce25d47716bdb1574f5cd39e8f75c239eb0907732e0889393f`
- a fresh 1 KAS parameterized slash flow was also broadcast successfully after fixing runtime fallback for parameterized `deadline` and `minerFee` values:
  - lock: `edbf7d3fe90d5e384ce70a3c081873d9a75cfe06add42fa88949689234ab6177`
  - slash: `9a3846fbfc0555fb013e14f8a8aa7c35439cad7c658cf0ee482ede2fc8136408`

Root cause of the earlier parameterized slash failure:
- the runtime script tried to read `DEADLINE` and `MINER_FEE` from compiled constants
- the parameterized artifact has no such constants because they are constructor inputs
- the script therefore fell back to stale default values until fixed to use `BOND_DEADLINE` and `BOND_MINER_FEE_SOMPI`

Remaining work:
- fully retire the legacy hardcoded proof path from normal use
- optionally add more automation around lock tx selection if future operators need it
