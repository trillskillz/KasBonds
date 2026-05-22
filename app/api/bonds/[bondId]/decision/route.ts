import { NextResponse } from 'next/server';

import { recordVerifierDecision } from '../../../../../lib/bonds/repository';
import type { RecordVerifierDecisionInput } from '../../../../../lib/bonds/types';
import { getDb } from '../../../../../lib/db/client';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ bondId: string }> },
) {
  try {
    const { bondId } = await context.params;
    const body = (await request.json()) as RecordVerifierDecisionInput;
    const db = getDb();
    const status = await recordVerifierDecision(db, bondId, body);

    return NextResponse.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const code = message.includes('not found') ? 404 : 400;
    return NextResponse.json({ error: message }, { status: code });
  }
}
