import { NextResponse } from 'next/server';

export const KSB_PROTOCOL_VERSION = '0.1.0';

export function ksbJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('X-KSB-Protocol-Version', KSB_PROTOCOL_VERSION);
  return response;
}

export function readBearerOrHeaderToken(request: Request, headerName: string) {
  return request.headers.get(headerName)
    ?? request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    ?? '';
}

export function requireKsbOperator(request: Request) {
  const configuredKey = process.env.KSB_OPERATOR_API_KEY?.trim();
  if (!configuredKey) {
    return {
      ok: false as const,
      response: ksbJson(
        { error: 'KSB operator routes are disabled until KSB_OPERATOR_API_KEY is configured' },
        { status: 503 },
      ),
    };
  }

  const providedKey = readBearerOrHeaderToken(request, 'x-ksb-operator-key').trim();
  if (!providedKey) {
    return {
      ok: false as const,
      response: ksbJson({ error: 'Missing operator API key' }, { status: 401 }),
    };
  }

  if (providedKey !== configuredKey) {
    return {
      ok: false as const,
      response: ksbJson({ error: 'Invalid operator API key' }, { status: 403 }),
    };
  }

  return { ok: true as const };
}
