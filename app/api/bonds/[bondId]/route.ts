import { NextResponse } from 'next/server';

import { getBondStatus } from '../../../../lib/bonds/repository';
import { getDb } from '../../../../lib/db/client';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ bondId: string }> },
) {
  try {
    const { bondId } = await context.params;
    const db = getDb();
    const status = await getBondStatus(db, bondId);

    return NextResponse.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const code = message.includes('not found') ? 404 : 400;
    return NextResponse.json({ error: message }, { status: code });
  }
}
