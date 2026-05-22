const steps = [
  'Load TN12 environment from .env.local or exported shell variables',
  'Compile contracts/minimum-bond.sil into a TN12-compatible artifact',
  'Fund the source wallet from a TN12 faucet',
  'Create bond covenant lock transaction for 10 TKAS',
  'Broadcast and wait for confirmation',
  'Construct release-path transaction signed by oracle key before deadline',
  'Broadcast release transaction and record tx hash in TESTNET_TXS.md',
  'Repeat with a fresh bond covenant after deadline for slash path',
  'Construct slash-path transaction signed by slash key and route outputs to buyer, fee, and burn',
  'Broadcast slash transaction and record tx hash in TESTNET_TXS.md'
];

for (const [index, step] of steps.entries()) {
  console.log(`${index + 1}. ${step}`);
}
