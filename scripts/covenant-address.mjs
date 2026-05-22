import fs from 'node:fs';
import * as kaspa from '../vendor/x402-KAS/packages/kaspa-wasm/kaspa.js';

const artifactPath = process.env.BOND_ARTIFACT_PATH
  ? new URL(process.env.BOND_ARTIFACT_PATH, import.meta.url)
  : new URL('../artifacts/minimum-bond-parameterized.json', import.meta.url);
const rawNetworkId = process.env.TN12_NETWORK || 'testnet-12';
const networkId = rawNetworkId.replace(/^kaspa:/, '');

const compiled = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
const scriptBytes = Uint8Array.from(compiled.script);
const scriptPublicKey = kaspa.payToScriptHashScript(scriptBytes);
const address = kaspa.addressFromScriptPublicKey(scriptPublicKey, networkId);

console.log(JSON.stringify({
  contractName: compiled.contract_name,
  networkId,
  covenantAddress: address?.toString() || null,
}, null, 2));
