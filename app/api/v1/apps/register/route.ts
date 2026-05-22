import { getDb } from '../../../../../lib/db/client';
import { ksbJson } from '../../../../../lib/ksb/protocol';
import { registerApp } from '../../../../../lib/ksb/repository';
import type { RegisterAppInput } from '../../../../../lib/ksb/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegisterAppInput;
    const db = getDb();
    const appSecret = await registerApp(db, body);

    return ksbJson(appSecret, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return ksbJson({ error: message }, { status: 400 });
  }
}
