import { getDb } from '../../../../../../lib/db/client';
import { ksbJson } from '../../../../../../lib/ksb/protocol';
import { submitKsbBondProof } from '../../../../../../lib/ksb/repository';
import type { SubmitKsbBondProofInput } from '../../../../../../lib/ksb/types';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ bondId: string }> },
) {
  try {
    const { bondId } = await context.params;
    const body = (await request.json()) as SubmitKsbBondProofInput;
    const db = getDb();
    const detail = await submitKsbBondProof(db, bondId, body);

    return ksbJson(detail, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('not found') ? 404 : 400;
    return ksbJson({ error: message }, { status });
  }
}
