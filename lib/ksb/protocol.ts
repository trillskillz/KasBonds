import { createPublicKey, timingSafeEqual, verify } from 'node:crypto';

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

function decodeSignature(signature: string) {
  const normalized = signature.trim();
  if (!normalized) {
    throw new Error('Missing execution signature');
  }

  if (/^[0-9a-f]+$/i.test(normalized) && normalized.length % 2 === 0) {
    return Buffer.from(normalized, 'hex');
  }

  return Buffer.from(normalized, 'base64');
}

export function requireVerifiedKsbExecution(
  executionPayloadJson: string,
  executionSignature: string,
  executionSigner: string,
  executionSignedAt: string,
) {
  const configuredPublicKey = process.env.KSB_OPERATOR_SIGNING_PUBLIC_KEY?.trim();
  if (!configuredPublicKey) {
    return {
      ok: false as const,
      response: ksbJson(
        { error: 'KSB execution verification is disabled until KSB_OPERATOR_SIGNING_PUBLIC_KEY is configured' },
        { status: 503 },
      ),
    };
  }

  const configuredSigner = process.env.KSB_OPERATOR_SIGNER_ID?.trim();
  if (configuredSigner) {
    const a = Buffer.from(executionSigner.trim());
    const b = Buffer.from(configuredSigner);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return {
        ok: false as const,
        response: ksbJson({ error: 'Execution signer is not authorized' }, { status: 403 }),
      };
    }
  }

  const maxAgeSeconds = Number(process.env.KSB_EXECUTION_SIGNATURE_MAX_AGE_SECONDS ?? '900');
  const signedAtMs = Date.parse(executionSignedAt);
  if (!Number.isFinite(signedAtMs)) {
    return {
      ok: false as const,
      response: ksbJson({ error: 'executionSignedAt must be a valid ISO timestamp' }, { status: 400 }),
    };
  }
  if (Number.isFinite(maxAgeSeconds) && maxAgeSeconds > 0) {
    const ageMs = Math.abs(Date.now() - signedAtMs);
    if (ageMs > maxAgeSeconds * 1000) {
      return {
        ok: false as const,
        response: ksbJson({ error: 'Execution signature is outside the allowed age window' }, { status: 403 }),
      };
    }
  }

  try {
    const publicKey = createPublicKey(configuredPublicKey);
    const signature = decodeSignature(executionSignature);
    const payload = Buffer.from(executionPayloadJson);

    const verifiedOk = verify(null, payload, publicKey, signature)
      || verify('sha256', payload, publicKey, signature);

    if (!verifiedOk) {
      return {
        ok: false as const,
        response: ksbJson({ error: 'Execution signature verification failed' }, { status: 403 }),
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown signature verification error';
    return {
      ok: false as const,
      response: ksbJson({ error: `Execution signature verification failed: ${message}` }, { status: 400 }),
    };
  }

  return { ok: true as const };
}
