import { getDb } from '../../../../../../lib/db/client';
import { ksbJson } from '../../../../../../lib/ksb/protocol';
import { recordKsbSlashExecution } from '../../../../../../lib/ksb/repository';
import type { RecordKsbSlashExecutionInput } from '../../../../../../lib/ksb/types';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ bondId: string }> },
) {
  try {
    const { bondId } = await context.params;
    const body = (await request.json()) as RecordKsbSlashExecutionInput;
    const db = getDb();
    const detail = await recordKsbSlashExecution(db, bondId, body);

    return ksbJson(detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return ksbJson({ error: message }, { status: 400 });
  }
}
