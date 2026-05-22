import { getDb } from '../../../../../lib/db/client';
import { ksbJson } from '../../../../../lib/ksb/protocol';
import { getKsbPartyHistory } from '../../../../../lib/ksb/repository';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ addr: string }> },
) {
  try {
    const { addr } = await context.params;
    const db = getDb();
    const detail = await getKsbPartyHistory(db, addr);

    return ksbJson(detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return ksbJson({ error: message }, { status: 400 });
  }
}
