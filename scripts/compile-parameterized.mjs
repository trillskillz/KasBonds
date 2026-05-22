import { spawnSync } from 'node:child_process';

const mode = process.argv[2] || process.env.BOND_MODE || 'release';
const normalizedMode = mode === 'slash' ? 'slash' : 'release';

const env = {
  ...process.env,
  BOND_MODE: normalizedMode,
  BOND_DEADLINE: normalizedMode === 'slash'
    ? (process.env.BOND_SLASH_DEADLINE || '1')
    : (process.env.BOND_RELEASE_DEADLINE || '1700000000'),
};

const ctor = spawnSync('node', ['scripts/generate-constructor-args.mjs'], {
  stdio: 'inherit',
  env,
  cwd: process.cwd(),
});

if (ctor.status !== 0) {
  process.exit(ctor.status ?? 1);
}

const compile = spawnSync('./vendor/silverscript/target/debug/silverc', [
  'contracts/minimum-bond-parameterized.sil',
  '--constructor-args',
  'artifacts/minimum-bond-parameterized.constructor-args.json',
  '-o',
  'artifacts/minimum-bond-parameterized.json',
], {
  stdio: 'inherit',
  env,
  cwd: process.cwd(),
});

process.exit(compile.status ?? 1);
