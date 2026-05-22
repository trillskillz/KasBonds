import * as kaspa from '../vendor/x402-KAS/packages/kaspa-wasm/kaspa.js';

const privateKeyHex = process.env.TN12_PRIVATE_KEY || '1111111111111111111111111111111111111111111111111111111111111111';
const rawNetworkId = process.env.TN12_NETWORK || 'testnet-12';
const networkId = rawNetworkId.replace(/^kaspa:/, '');
const url = process.env.TN12_WRPC_URL || 'ws://tn12-node.kaspa.com:17210';

const privateKey = new kaspa.PrivateKey(privateKeyHex);
const address = privateKey.toAddress(networkId).toString();

const rpc = new kaspa.RpcClient({
  url,
  encoding: kaspa.Encoding.Borsh,
  networkId,
});

try {
  await rpc.connect();
  const utxos = await rpc.getUtxosByAddresses([address]);
  const totalSompi = utxos.entries.reduce((sum, entry) => sum + BigInt(entry.amount), 0n);
  console.log(JSON.stringify({
    address,
    utxoCount: utxos.entries.length,
    totalSompi: totalSompi.toString(),
    totalKas: Number(totalSompi) / 100000000,
  }, null, 2));
} finally {
  await rpc.disconnect().catch(() => {});
}
