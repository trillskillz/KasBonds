import { getDb } from '../../../../../../lib/db/client';
import { ksbJson, requireKsbOperator } from '../../../../../../lib/ksb/protocol';
import { dispatchKsbBondVerifications } from '../../../../../../lib/ksb/repository';
import type { DispatchKsbVerificationInput } from '../../../../../../lib/ksb/types';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ bondId: string }> },
) {
  try {
    const auth = requireKsbOperator(request);
    if (!auth.ok) {
      return auth.response;
    }

    const { bondId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as DispatchKsbVerificationInput;
    const db = getDb();
    const result = await dispatchKsbBondVerifications(db, bondId, body);

    return ksbJson(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('not found') ? 404 : 400;
    return ksbJson({ error: message }, { status });
  }
}
