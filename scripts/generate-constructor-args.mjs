import fs from 'node:fs';
import * as kaspa from '../vendor/x402-KAS/packages/kaspa-wasm/kaspa.js';

const oraclePrivateKeyHex = process.env.TN12_ORACLE_PRIVATE_KEY || '2222222222222222222222222222222222222222222222222222222222222222';
const slashPrivateKeyHex = process.env.TN12_SLASH_PRIVATE_KEY || '3333333333333333333333333333333333333333333333333333333333333333';
const agentAddress = process.env.TN12_AGENT_ADDRESS || 'kaspatest:qqkqkl8e2vj2qlg98x9jgqt5msxzhezym943tx4xclmmrengdqyeznn0pna8v';
const buyerAddress = process.env.TN12_BUYER_ADDRESS || 'kaspatest:qzdvyqe4avu8drfq22lpmw7rermp0pq8gk89re454530rkghtzy4kz298lu48';
const platformFeeAddress = process.env.TN12_PLATFORM_FEE_ADDRESS || 'kaspatest:qpdtg6y7gq9y59sv7qwdg3ess3d9ga5dlp28mn0sw0vkfugf7xxrqpuexv6mu';
const burnAddress = process.env.TN12_BURN_ADDRESS || 'kaspatest:qpuk94zm8r5te7p04rh6sse2q8eqexjnufx860c3muvhew88pynd56n845dz8';
const mode = process.env.BOND_MODE || 'release';
const deadline = Number(
  process.env.BOND_DEADLINE ||
  (mode === 'slash' ? process.env.BOND_SLASH_DEADLINE : process.env.BOND_RELEASE_DEADLINE) ||
  (mode === 'slash' ? '1' : '1700000000'),
);
const minerFee = Number(process.env.BOND_MINER_FEE_SOMPI || '300000');
const outPath = process.env.BOND_CONSTRUCTOR_ARGS_PATH || new URL('../artifacts/minimum-bond-parameterized.constructor-args.json', import.meta.url);

function xOnlyBytesFromPrivateKey(hex) {
  const pubHex = new kaspa.PrivateKey(hex).toPublicKey().toString();
  return pubHex.slice(2);
}

function xOnlyBytesFromAddress(address) {
  return kaspa.XOnlyPublicKey.fromAddress(new kaspa.Address(address)).toString();
}

function hexToArg(hex) {
  const normalized = hex.trim().replace(/^0x/i, '').toLowerCase();
  if (normalized.length !== 64) {
    throw new Error(`Expected 32-byte x-only pubkey, got ${normalized.length / 2} bytes`);
  }
  const data = [];
  for (let i = 0; i < normalized.length; i += 2) {
    data.push({ kind: 'byte', data: Number.parseInt(normalized.slice(i, i + 2), 16) });
  }
  return { kind: 'array', data };
}

const args = [
  hexToArg(xOnlyBytesFromPrivateKey(oraclePrivateKeyHex)),
  hexToArg(xOnlyBytesFromPrivateKey(slashPrivateKeyHex)),
  hexToArg(xOnlyBytesFromAddress(agentAddress)),
  hexToArg(xOnlyBytesFromAddress(buyerAddress)),
  hexToArg(xOnlyBytesFromAddress(platformFeeAddress)),
  hexToArg(xOnlyBytesFromAddress(burnAddress)),
  { kind: 'int', data: deadline },
  { kind: 'int', data: minerFee },
];

fs.writeFileSync(outPath, JSON.stringify(args, null, 2));

console.log(JSON.stringify({
  ok: true,
  outPath: outPath instanceof URL ? outPath.pathname : outPath,
  mode,
  deadline,
  minerFee,
  agentAddress,
  buyerAddress,
  platformFeeAddress,
  burnAddress,
}, null, 2));
