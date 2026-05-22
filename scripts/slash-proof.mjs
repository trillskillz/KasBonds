import fs from 'node:fs';
import * as kaspa from '../vendor/x402-KAS/packages/kaspa-wasm/kaspa.js';

const rpcUrl = process.env.TN12_WRPC_URL || 'ws://tn12-node.kaspa.com:17210';
const rawNetworkId = process.env.TN12_NETWORK || 'testnet-12';
const networkId = rawNetworkId.replace(/^kaspa:/, '');
const buyerAddress = process.env.TN12_BUYER_ADDRESS || 'kaspatest:qzdvyqe4avu8drfq22lpmw7rermp0pq8gk89re454530rkghtzy4kz298lu48';
const platformFeeAddress = process.env.TN12_PLATFORM_FEE_ADDRESS || 'kaspatest:qpdtg6y7gq9y59sv7qwdg3ess3d9ga5dlp28mn0sw0vkfugf7xxrqpuexv6mu';
const burnAddress = process.env.TN12_BURN_ADDRESS || 'kaspatest:qpuk94zm8r5te7p04rh6sse2q8eqexjnufx860c3muvhew88pynd56n845dz8';
const slashPrivateKeyHex = process.env.TN12_SLASH_PRIVATE_KEY || '3333333333333333333333333333333333333333333333333333333333333333';
const dryRun = process.env.DRY_RUN === '1';
const providedTxid = process.env.BOND_LOCK_TXID || null;
const providedVout = process.env.BOND_LOCK_VOUT ? Number(process.env.BOND_LOCK_VOUT) : null;
const platformFeeBps = 500n;
const bpsDenominator = 10000n;

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

const deadlineConstant = Array.isArray(compiled?.ast?.constants)
  ? compiled.ast.constants.find((constant) => constant?.name === 'DEADLINE')
  : null;
const minerFeeConstant = Array.isArray(compiled?.ast?.constants)
  ? compiled.ast.constants.find((constant) => constant?.name === 'MINER_FEE')
  : null;
const deadline = BigInt(deadlineConstant?.expr?.data ?? process.env.BOND_DEADLINE ?? '1700000000');
const minerFeeSompi = BigInt(minerFeeConstant?.expr?.data ?? process.env.BOND_MINER_FEE_SOMPI ?? '300000');

const rpc = new kaspa.RpcClient({
  url: rpcUrl,
  encoding: kaspa.Encoding.Borsh,
  networkId,
});

function buildSigScript(compiledContract, functionName, functionArgs) {
  const abiEntry = compiledContract.abi.find((entry) => entry.name === functionName);
  if (!abiEntry) {
    throw new Error(`Function ${functionName} not found in ABI`);
  }

  if (abiEntry.inputs.length !== functionArgs.length) {
    throw new Error(`Function ${functionName} expects ${abiEntry.inputs.length} args, got ${functionArgs.length}`);
  }

  const builder = new kaspa.ScriptBuilder();
  for (let i = 0; i < abiEntry.inputs.length; i += 1) {
    builder.addData(functionArgs[i]);
  }

  if (!compiledContract.without_selector) {
    const selector = compiledContract.abi.findIndex((entry) => entry.name === functionName);
    builder.addI64(BigInt(selector));
  }

  return builder.drain();
}

function buildUnsignedCovenantTx(entry, outputs, sigOpCount = 1, lockTime = 0n) {
  return new kaspa.Transaction({
    version: 0,
    lockTime,
    inputs: [
      {
        previousOutpoint: entry.outpoint,
        utxo: entry,
        sequence: 0n,
        sigOpCount,
      },
    ],
    outputs: outputs.map((output) => ({
      scriptPublicKey: kaspa.payToAddressScript(output.address),
      value: output.amount,
    })),
    subnetworkId: '0000000000000000000000000000000000000000',
    gas: 0n,
    payload: '',
  });
}

function hexToBytes(hex) {
  const normalized = hex.trim().replace(/^0x/i, '');
  const out = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    out[i / 2] = Number.parseInt(normalized.slice(i, i + 2), 16);
  }
  return out;
}

function signInput(tx, inputIndex, privateKey) {
  const sigHex = kaspa.createInputSignature(tx, inputIndex, privateKey, kaspa.SighashType.All);
  const rawBytes = hexToBytes(sigHex);
  if (rawBytes.length === 66 && rawBytes[0] === 0x41) {
    return rawBytes.slice(1);
  }
  return rawBytes;
}

function attachSigScript(tx, inputIndex, compiledContract, sigPrefix) {
  tx.inputs[inputIndex].signatureScript = kaspa.ScriptBuilder.fromScript(Uint8Array.from(compiledContract.script)).encodePayToScriptHashSignatureScript(sigPrefix);
}

try {
  await rpc.connect();
  const utxos = await rpc.getUtxosByAddresses([covenantAddress]);
  const entries = utxos.entries;
  let entry = null;

  if (providedTxid !== null && providedVout !== null) {
    entry = entries.find((candidate) => candidate.outpoint.transactionId === providedTxid && candidate.outpoint.index === providedVout) || null;
  } else if (entries.length === 1) {
    entry = entries[0];
  }

  if (!entry) {
    throw new Error('Could not resolve covenant UTXO. Set BOND_LOCK_TXID and BOND_LOCK_VOUT or ensure exactly one UTXO exists at the covenant address.');
  }

  const inputAmountSompi = BigInt(entry.amount);
  if (inputAmountSompi <= minerFeeSompi) {
    throw new Error(`Covenant UTXO too small to slash after fee: ${inputAmountSompi}`);
  }

  const distributableSompi = inputAmountSompi - minerFeeSompi;
  const buyerCompensationSompi = (distributableSompi * 50n) / 100n;
  const platformFeeSompi = (distributableSompi * platformFeeBps) / bpsDenominator;
  const burnSompi = distributableSompi - buyerCompensationSompi - platformFeeSompi;

  const outputs = [
    { address: buyerAddress, amount: buyerCompensationSompi },
    { address: platformFeeAddress, amount: platformFeeSompi },
    { address: burnAddress, amount: burnSompi },
  ];

  const unsignedTx = buildUnsignedCovenantTx(entry, outputs, 1, deadline);
  const slashKey = new kaspa.PrivateKey(slashPrivateKeyHex);
  const slashSig = signInput(unsignedTx, 0, slashKey);
  const sigPrefix = buildSigScript(compiled, 'slash', [slashSig]);
  attachSigScript(unsignedTx, 0, compiled, sigPrefix);

  const summary = {
    covenantAddress,
    deadline: deadline.toString(),
    inputOutpoint: {
      txid: entry.outpoint.transactionId,
      vout: entry.outpoint.index,
    },
    inputAmountSompi: inputAmountSompi.toString(),
    distributableSompi: distributableSompi.toString(),
    buyerCompensationSompi: buyerCompensationSompi.toString(),
    platformFeeSompi: platformFeeSompi.toString(),
    burnSompi: burnSompi.toString(),
    minerFeeSompi: minerFeeSompi.toString(),
    platformFeeBps: platformFeeBps.toString(),
    buyerAddress,
    platformFeeAddress,
    burnAddress,
    dryRun,
  };

  if (dryRun) {
    console.log(JSON.stringify({
      ok: true,
      mode: 'dry-run',
      covenantEnforcesOutputs: true,
      ...summary,
      transaction: unsignedTx.serializeToSafeJSON(),
    }, null, 2));
    process.exit(0);
  }

  const result = await rpc.submitTransaction({
    transaction: unsignedTx,
    allowOrphan: false,
  });

  console.log(JSON.stringify({
    ok: true,
    mode: 'broadcast',
    covenantEnforcesOutputs: true,
    ...summary,
    txid: result.transactionId,
  }, null, 2));
} finally {
  await rpc.disconnect().catch(() => {});
}
