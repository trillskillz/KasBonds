import { getDb } from '../../../../../../lib/db/client';
import { ksbJson } from '../../../../../../lib/ksb/protocol';
import { recordKsbReleaseExecution } from '../../../../../../lib/ksb/repository';
import type { RecordKsbReleaseExecutionInput } from '../../../../../../lib/ksb/types';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ bondId: string }> },
) {
  try {
    const { bondId } = await context.params;
    const body = (await request.json()) as RecordKsbReleaseExecutionInput;
    const db = getDb();
    const detail = await recordKsbReleaseExecution(db, bondId, body);

    return ksbJson(detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return ksbJson({ error: message }, { status: 400 });
  }
}
