import { getDb } from '../../../../lib/db/client';
import { ksbJson } from '../../../../lib/ksb/protocol';
import { listKsbVerifierRules } from '../../../../lib/ksb/repository';

export const dynamic = 'force-dynamic';

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
