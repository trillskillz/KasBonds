import { getDb } from '../../../../../lib/db/client';
import { ksbJson } from '../../../../../lib/ksb/protocol';
import { resolveExpiredKsbBonds } from '../../../../../lib/ksb/repository';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const nowUnix = Number(body?.nowUnix);
    const db = getDb();
    const result = await resolveExpiredKsbBonds(
      db,
      Number.isFinite(nowUnix) ? nowUnix : Math.floor(Date.now() / 1000),
    );

    return ksbJson(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return ksbJson({ error: message }, { status: 400 });
  }
}
