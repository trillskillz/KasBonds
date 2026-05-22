import { getDb } from '../../../../../../lib/db/client';
import { ksbJson } from '../../../../../../lib/ksb/protocol';
import { getKsbReputationProfile } from '../../../../../../lib/ksb/repository';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ addr: string }> },
) {
  try {
    const { addr } = await context.params;
    const db = getDb();
    const profile = await getKsbReputationProfile(db, addr);

    return ksbJson(profile);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return ksbJson({ error: message }, { status: 400 });
  }
}
