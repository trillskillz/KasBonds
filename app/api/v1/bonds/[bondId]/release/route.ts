import { getDb } from '../../../../../../lib/db/client';
import { ksbJson, requireKsbOperator, requireVerifiedKsbExecution } from '../../../../../../lib/ksb/protocol';
import { recordKsbReleaseExecution } from '../../../../../../lib/ksb/repository';
import type { RecordKsbReleaseExecutionInput } from '../../../../../../lib/ksb/types';

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
    const body = (await request.json()) as RecordKsbReleaseExecutionInput;
    const executionAuth = requireVerifiedKsbExecution(
      typeof body.executionPayloadJson === 'string' ? body.executionPayloadJson : JSON.stringify(body.executionPayloadJson),
      body.executionSignature,
      body.executionSigner,
      body.executionSignedAt,
    );
    if (!executionAuth.ok) {
      return executionAuth.response;
    }

    const db = getDb();
    const detail = await recordKsbReleaseExecution(db, bondId, body);

    return ksbJson(detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return ksbJson({ error: message }, { status: 400 });
  }
}
