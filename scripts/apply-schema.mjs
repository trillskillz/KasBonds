import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error('TURSO_DATABASE_URL is required');
  process.exit(1);
}

const schemaDir = new URL('../schema/', import.meta.url);
const schemaDirPath = path.resolve(schemaDir.pathname);
const schemaFiles = fs
  .readdirSync(schemaDirPath)
  .filter((file) => /^\d+.*\.sql$/i.test(file))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

if (schemaFiles.length === 0) {
  console.error('No schema SQL files found');
  process.exit(1);
}

function splitStatements(input) {
  const lines = input.split(/\r?\n/);
  const statements = [];
  let buffer = [];
  let inTrigger = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed && buffer.length === 0) {
      continue;
    }

    if (/^CREATE\s+TRIGGER/i.test(trimmed)) {
      inTrigger = true;
    }

    buffer.push(line);

    if (inTrigger) {
      if (/^END;$/i.test(trimmed)) {
        statements.push(buffer.join('\n').trim());
        buffer = [];
        inTrigger = false;
      }
      continue;
    }

    if (trimmed.endsWith(';')) {
      statements.push(buffer.join('\n').trim());
      buffer = [];
    }
  }

  if (buffer.length > 0) {
    statements.push(buffer.join('\n').trim());
  }

  return statements.filter(Boolean);
}

const client = createClient({ url, authToken });
let statementsApplied = 0;

for (const schemaFile of schemaFiles) {
  const sql = fs.readFileSync(path.join(schemaDirPath, schemaFile), 'utf8');
  const statements = splitStatements(sql);

  for (const statement of statements) {
    await client.execute(statement);
    statementsApplied += 1;
  }
}

console.log(JSON.stringify({ ok: true, schemaFiles, statementsApplied }, null, 2));
