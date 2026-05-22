import { getDb } from '../../../../../lib/db/client';
import { ksbJson, requireKsbOperator } from '../../../../../lib/ksb/protocol';
import { rebuildKsbPartyHistory } from '../../../../../lib/ksb/repository';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const auth = requireKsbOperator(request);
    if (!auth.ok) {
      return auth.response;
    }

    const db = getDb();
    const result = await rebuildKsbPartyHistory(db);

    return ksbJson(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return ksbJson({ error: message }, { status: 400 });
  }
}
