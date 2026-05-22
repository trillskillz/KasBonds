import { NextResponse } from 'next/server';

export const KSB_PROTOCOL_VERSION = '0.1.0';

export function ksbJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('X-KSB-Protocol-Version', KSB_PROTOCOL_VERSION);
  return response;
}
