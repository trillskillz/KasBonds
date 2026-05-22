import { createClient } from '@libsql/client';

const databaseUrl = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

export function getDb() {
  if (!databaseUrl) {
    throw new Error('TURSO_DATABASE_URL is not set');
  }

  const client = createClient({
    url: databaseUrl,
    authToken,
  });

  return {
    $client: client,
  };
}
