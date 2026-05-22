import { getDb } from '../../../../lib/db/client';
import { ksbJson } from '../../../../lib/ksb/protocol';
import { authenticateAppApiKey, listKsbVerifierRules, registerCustomVerifier } from '../../../../lib/ksb/repository';
import type { RegisterVerifierRuleInput } from '../../../../lib/ksb/types';

export const dynamic = 'force-dynamic';

function readApiKey(request: Request) {
  return request.headers.get('x-ksb-api-key') ?? request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
}

export async function GET() {
  try {
    const db = getDb();
    const rules = await listKsbVerifierRules(db);

    return ksbJson({ rules });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return ksbJson({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const apiKey = readApiKey(request);
    if (!apiKey) {
      return ksbJson({ error: 'Missing API key' }, { status: 401 });
    }

    const db = getDb();
    const app = await authenticateAppApiKey(db, apiKey);
    const body = (await request.json()) as RegisterVerifierRuleInput;
    const rule = await registerCustomVerifier(db, app.appId, body);

    return ksbJson(rule, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('Invalid API key') ? 401 : 400;
    return ksbJson({ error: message }, { status });
  }
}
