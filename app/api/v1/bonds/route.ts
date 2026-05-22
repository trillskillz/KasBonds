import { getDb } from '../../../../lib/db/client';
import { ksbJson } from '../../../../lib/ksb/protocol';
import { authenticateAppApiKey, createKsbBond, listKsbBonds } from '../../../../lib/ksb/repository';
import type { CreateKsbBondInput } from '../../../../lib/ksb/types';

export const dynamic = 'force-dynamic';

function readApiKey(request: Request) {
  return request.headers.get('x-ksb-api-key') ?? request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const db = getDb();
    const bonds = await listKsbBonds(db, {
      appId: searchParams.get('appId'),
      providerAddress: searchParams.get('providerAddress'),
      counterpartyAddress: searchParams.get('counterpartyAddress'),
      status: searchParams.get('status'),
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 50,
    });

    return ksbJson({ bonds });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return ksbJson({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const apiKey = readApiKey(request);
    if (!apiKey) {
      return ksbJson({ error: 'Missing API key' }, { status: 401 });
    }

    const db = getDb();
    const app = await authenticateAppApiKey(db, apiKey);
    const body = (await request.json()) as CreateKsbBondInput;
    const detail = await createKsbBond(db, app.appId, body);

    return ksbJson(detail, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('Invalid API key') ? 401 : 400;
    return ksbJson({ error: message }, { status });
  }
}
