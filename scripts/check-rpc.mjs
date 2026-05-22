import * as kaspa from '../vendor/x402-KAS/packages/kaspa-wasm/kaspa.js';

const url = process.env.TN12_WRPC_URL || 'ws://tn12-node.kaspa.com:17210';
const rawNetworkId = process.env.TN12_NETWORK || 'testnet-12';
const networkId = rawNetworkId.replace(/^kaspa:/, '');

const rpc = new kaspa.RpcClient({
  url,
  encoding: kaspa.Encoding.Borsh,
  networkId,
});

try {
  await rpc.connect();
  const info = await rpc.getServerInfo();
  console.log(JSON.stringify({
    ok: true,
    url,
    networkId,
    serverVersion: info.serverVersion,
    networkSuffix: info.networkSuffix,
    isSynced: info.isSynced,
  }, null, 2));
} finally {
  await rpc.disconnect().catch(() => {});
}
