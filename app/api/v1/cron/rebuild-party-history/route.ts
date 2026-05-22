import { getDb } from '../../../../../lib/db/client';
import { ksbJson } from '../../../../../lib/ksb/protocol';
import { rebuildKsbPartyHistory } from '../../../../../lib/ksb/repository';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const db = getDb();
    const result = await rebuildKsbPartyHistory(db);

    return ksbJson(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return ksbJson({ error: message }, { status: 400 });
  }
}
