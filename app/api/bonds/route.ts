import { NextResponse } from 'next/server';

import { createBondDraft, listBonds } from '../../../lib/bonds/repository';
import type { CreateBondDraftInput } from '../../../lib/bonds/types';
import { getDb } from '../../../lib/db/client';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateBondDraftInput;
    const db = getDb();
    const bond = await createBondDraft(db, body);

    return NextResponse.json({ bond }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const db = getDb();
    const bonds = await listBonds(db, {
      buyerId: searchParams.get('buyerId'),
      agentId: searchParams.get('agentId'),
      state: searchParams.get('state'),
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 50,
    });

    return NextResponse.json({ bonds });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
