const required = [
  'TN12_WRPC_URL',
  'TN12_NETWORK',
  'TN12_PRIVATE_KEY',
  'TN12_AGENT_ADDRESS',
  'TN12_BUYER_ADDRESS',
  'TN12_PLATFORM_FEE_ADDRESS',
  'TN12_BURN_ADDRESS',
  'TN12_ORACLE_PRIVATE_KEY',
  'TN12_SLASH_PRIVATE_KEY',
];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error('Missing required environment variables:');
  for (const key of missing) {
    console.error(`- ${key}`);
  }
  process.exit(1);
}

console.log('TN12 harness environment looks complete.');
