console.warn('LEGACY_DEBUG_ONLY: compiling the obsolete hardcoded proof contract.');
console.warn('Use npm run compile:covenant, compile:covenant:release, or compile:covenant:slash for normal operation.');

const { spawnSync } = await import('node:child_process');

const result = spawnSync('./vendor/silverscript/target/debug/silverc', [
  'contracts/minimum-bond.sil',
  '-o',
  'artifacts/minimum-bond.json',
], {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: process.env,
});

process.exit(result.status ?? 1);
