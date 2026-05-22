import { getDb } from '../../../../../lib/db/client';
import { ksbJson } from '../../../../../lib/ksb/protocol';
import { getKsbBondDetail } from '../../../../../lib/ksb/repository';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ bondId: string }> },
) {
  try {
    const { bondId } = await context.params;
    const db = getDb();
    const detail = await getKsbBondDetail(db, bondId);

    return ksbJson(detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('not found') ? 404 : 400;
    return ksbJson({ error: message }, { status });
  }
}
