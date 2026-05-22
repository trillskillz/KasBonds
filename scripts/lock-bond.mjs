import fs from 'node:fs';
import * as kaspa from '../vendor/x402-KAS/packages/kaspa-wasm/kaspa.js';

const privateKeyHex = process.env.TN12_PRIVATE_KEY || '1111111111111111111111111111111111111111111111111111111111111111';
const rpcUrl = process.env.TN12_WRPC_URL || 'ws://tn12-node.kaspa.com:17210';
const rawNetworkId = process.env.TN12_NETWORK || 'testnet-12';
const networkId = rawNetworkId.replace(/^kaspa:/, '');
const amountSompi = BigInt(process.env.BOND_AMOUNT_SOMPI || '1000000000');
const priorityFeeSompi = BigInt(process.env.BOND_PRIORITY_FEE_SOMPI || '300000');
const dryRun = process.env.DRY_RUN === '1';

const artifactPath = process.env.BOND_ARTIFACT_PATH
  ? new URL(process.env.BOND_ARTIFACT_PATH, import.meta.url)
  : new URL('../artifacts/minimum-bond-parameterized.json', import.meta.url);
const compiled = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
const scriptBytes = Uint8Array.from(compiled.script);
const scriptPublicKey = kaspa.payToScriptHashScript(scriptBytes);
const covenantAddress = kaspa.addressFromScriptPublicKey(scriptPublicKey, networkId)?.toString();

if (!covenantAddress) {
  throw new Error('Failed to derive covenant address from compiled artifact');
}

const privateKey = new kaspa.PrivateKey(privateKeyHex);
const senderAddress = privateKey.toAddress(networkId).toString();

const rpc = new kaspa.RpcClient({
  url: rpcUrl,
  encoding: kaspa.Encoding.Borsh,
  networkId,
});

try {
  await rpc.connect();
  const utxos = await rpc.getUtxosByAddresses([senderAddress]);
  const entries = utxos.entries;
  const totalSompi = entries.reduce((sum, entry) => sum + BigInt(entry.amount), 0n);

  if (entries.length === 0) {
    throw new Error(`No spendable UTXOs found for ${senderAddress}`);
  }

  if (totalSompi < amountSompi) {
    throw new Error(`Insufficient balance. Need ${amountSompi} sompi, have ${totalSompi} sompi`);
  }

  const created = await kaspa.createTransactions({
    entries,
    outputs: [{ address: covenantAddress, amount: amountSompi }],
    changeAddress: senderAddress,
    priorityFee: priorityFeeSompi,
    networkId,
  });

  const pending = created.transactions[created.transactions.length - 1];
  pending.sign([privateKey]);

  const summary = {
    senderAddress,
    covenantAddress,
    amountSompi: amountSompi.toString(),
    amountKas: Number(amountSompi) / 100000000,
    availableSompi: totalSompi.toString(),
    availableKas: Number(totalSompi) / 100000000,
    finalTransactionId: created.summary.finalTransactionId,
    transactionCount: created.transactions.length,
    priorityFeeSompi: priorityFeeSompi.toString(),
    dryRun,
  };

  if (dryRun) {
    console.log(JSON.stringify({
      ok: true,
      mode: 'dry-run',
      ...summary,
      transaction: pending.transaction.serializeToSafeJSON(),
    }, null, 2));
    process.exit(0);
  }

  let txid = null;
  for (const tx of created.transactions) {
    tx.sign([privateKey]);
    txid = await tx.submit(rpc);
  }

  console.log(JSON.stringify({
    ok: true,
    mode: 'broadcast',
    ...summary,
    txid,
  }, null, 2));
} finally {
  await rpc.disconnect().catch(() => {});
}
