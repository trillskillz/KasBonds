import { createHash, createPublicKey, verify as cryptoVerify } from 'node:crypto';

import { BUILT_IN_VERIFIER_RULES } from './verifier-rules';

/**
 * KSB verifier hub dispatch.
 *
 * The hub executes a built-in verifier rule and returns a pass/fail/timed_out
 * verdict with structured evidence. This is the protocol-computed counterpart
 * to a self-reported proof submission: instead of trusting a caller-supplied
 * result, the hub runs the check itself.
 *
 * Runtime inputs (a claimed completion time, a signature, an oracle query)
 * are merged over the static params declared in the bond `verifierConfigJson`.
 */

export type VerifierRuleResult = 'pending' | 'passed' | 'failed' | 'timed_out';

export interface VerifierDispatchContext {
  /** Bond deadline in unix seconds, used by time-based rules. */
  deadlineUnix: number;
}

export interface VerifierRuleExecution {
  result: VerifierRuleResult;
  evidence: Record<string, unknown>;
}

const TIMEOUT_BY_RULE = new Map(BUILT_IN_VERIFIER_RULES.map((rule) => [rule.name, rule.defaultTimeoutMs]));

function timeoutForRule(ruleName: string): number {
  return TIMEOUT_BY_RULE.get(ruleName) ?? 15000;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

async function executeHttpStatusCheck(
  params: Record<string, unknown>,
  ruleName: string,
): Promise<VerifierRuleExecution> {
  const url = asString(params.url);
  if (!url) {
    return { result: 'pending', evidence: { reason: 'missing url param' } };
  }

  const method = asString(params.method) ?? 'GET';
  const expectedStatus = Number.isFinite(Number(params.expectedStatus)) ? Number(params.expectedStatus) : 200;

  try {
    const response = await fetch(url, { method, signal: AbortSignal.timeout(timeoutForRule(ruleName)) });
    return {
      result: response.status === expectedStatus ? 'passed' : 'failed',
      evidence: { url, method, expectedStatus, observedStatus: response.status },
    };
  } catch (error) {
    if (isTimeoutError(error)) {
      return { result: 'timed_out', evidence: { url, method, error: 'request timed out' } };
    }
    return { result: 'failed', evidence: { url, method, error: error instanceof Error ? error.message : 'request failed' } };
  }
}

async function executeHttpContentCheck(
  params: Record<string, unknown>,
  ruleName: string,
): Promise<VerifierRuleExecution> {
  const url = asString(params.url);
  if (!url) {
    return { result: 'pending', evidence: { reason: 'missing url param' } };
  }

  const mustContain = asStringArray(params.mustContain);
  const mustNotContain = asStringArray(params.mustNotContain);
  const contentHashSha256 = asString(params.contentHashSha256);

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutForRule(ruleName)) });
    if (!response.ok) {
      return { result: 'failed', evidence: { url, error: `unexpected status ${response.status}` } };
    }

    const body = await response.text();
    const missing = mustContain.filter((needle) => !body.includes(needle));
    const forbidden = mustNotContain.filter((needle) => body.includes(needle));
    const observedHash = createHash('sha256').update(body).digest('hex');
    const hashMismatch = contentHashSha256 != null && observedHash !== contentHashSha256.toLowerCase();

    const passed = missing.length === 0 && forbidden.length === 0 && !hashMismatch;
    return {
      result: passed ? 'passed' : 'failed',
      evidence: { url, missing, forbidden, observedHash, hashChecked: contentHashSha256 != null, hashMismatch },
    };
  } catch (error) {
    if (isTimeoutError(error)) {
      return { result: 'timed_out', evidence: { url, error: 'request timed out' } };
    }
    return { result: 'failed', evidence: { url, error: error instanceof Error ? error.message : 'request failed' } };
  }
}

function executeDeadlineTimeCheck(
  params: Record<string, unknown>,
  ctx: VerifierDispatchContext,
): VerifierRuleExecution {
  const completedAtUnix = Number(params.completedAtUnix);
  if (!Number.isFinite(completedAtUnix)) {
    return { result: 'pending', evidence: { reason: 'missing completedAtUnix input' } };
  }

  const graceSeconds = Number.isFinite(Number(params.graceSeconds)) ? Number(params.graceSeconds) : 0;
  const allowedUntil = ctx.deadlineUnix + graceSeconds;
  return {
    result: completedAtUnix <= allowedUntil ? 'passed' : 'failed',
    evidence: { completedAtUnix, deadlineUnix: ctx.deadlineUnix, graceSeconds, allowedUntil },
  };
}

function decodeSignatureBytes(signature: string): Buffer {
  if (/^[0-9a-f]+$/i.test(signature) && signature.length % 2 === 0) {
    return Buffer.from(signature, 'hex');
  }
  return Buffer.from(signature, 'base64');
}

function executeSignatureCheck(params: Record<string, unknown>): VerifierRuleExecution {
  const publicKey = asString(params.publicKey);
  const message = asString(params.message);
  const signature = asString(params.signature);
  if (!publicKey || !message || !signature) {
    return { result: 'pending', evidence: { reason: 'missing publicKey, message, or signature input' } };
  }

  const algorithm = asString(params.algorithm) ?? 'ed25519';
  try {
    const key = createPublicKey(publicKey);
    const payload = Buffer.from(message);
    const signatureBytes = decodeSignatureBytes(signature);
    // ed25519/ed448 keys verify with a null algorithm; others use sha256.
    const ok = cryptoVerify(null, payload, key, signatureBytes)
      || cryptoVerify('sha256', payload, key, signatureBytes);
    return { result: ok ? 'passed' : 'failed', evidence: { algorithm, verified: ok } };
  } catch (error) {
    return { result: 'failed', evidence: { algorithm, error: error instanceof Error ? error.message : 'verification failed' } };
  }
}

async function executeExternalOracleCheck(
  params: Record<string, unknown>,
  ruleName: string,
): Promise<VerifierRuleExecution> {
  const oracleUrl = asString(params.oracleUrl);
  if (!oracleUrl) {
    return { result: 'pending', evidence: { reason: 'missing oracleUrl param' } };
  }

  const oraclePublicKey = asString(params.oraclePublicKey);
  const query = params.query ?? {};

  try {
    const response = await fetch(oracleUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(timeoutForRule(ruleName)),
    });
    if (!response.ok) {
      return { result: 'failed', evidence: { oracleUrl, error: `oracle returned status ${response.status}` } };
    }

    const rawBody = await response.text();
    const parsed = JSON.parse(rawBody) as { verdict?: unknown; signature?: unknown };
    const verdict = asString(parsed.verdict);
    if (verdict !== 'pass' && verdict !== 'fail') {
      return { result: 'failed', evidence: { oracleUrl, error: 'oracle verdict must be "pass" or "fail"' } };
    }

    if (oraclePublicKey) {
      const oracleSignature = asString(parsed.signature);
      if (!oracleSignature) {
        return { result: 'failed', evidence: { oracleUrl, error: 'oracle response is missing a signature' } };
      }
      const signedOk = (() => {
        try {
          const key = createPublicKey(oraclePublicKey);
          const signatureBytes = decodeSignatureBytes(oracleSignature);
          const payload = Buffer.from(verdict);
          return cryptoVerify(null, payload, key, signatureBytes) || cryptoVerify('sha256', payload, key, signatureBytes);
        } catch {
          return false;
        }
      })();
      if (!signedOk) {
        return { result: 'failed', evidence: { oracleUrl, error: 'oracle signature verification failed' } };
      }
    }

    return {
      result: verdict === 'pass' ? 'passed' : 'failed',
      evidence: { oracleUrl, verdict, signatureChecked: oraclePublicKey != null },
    };
  } catch (error) {
    if (isTimeoutError(error)) {
      return { result: 'timed_out', evidence: { oracleUrl, error: 'oracle request timed out' } };
    }
    return { result: 'failed', evidence: { oracleUrl, error: error instanceof Error ? error.message : 'oracle request failed' } };
  }
}

/**
 * Execute a single verifier rule by name. Rules that are not part of the
 * built-in catalog, or that are missing required runtime inputs, resolve to
 * `pending` so a caller can still self-report a result for them.
 */
export async function executeVerifierRule(
  ruleName: string,
  params: Record<string, unknown>,
  ctx: VerifierDispatchContext,
): Promise<VerifierRuleExecution> {
  switch (ruleName) {
    case 'http_status_check':
      return executeHttpStatusCheck(params, ruleName);
    case 'http_content_check':
      return executeHttpContentCheck(params, ruleName);
    case 'deadline_time_check':
      return executeDeadlineTimeCheck(params, ctx);
    case 'signature_check':
      return executeSignatureCheck(params);
    case 'external_oracle_check':
      return executeExternalOracleCheck(params, ruleName);
    default:
      return { result: 'pending', evidence: { reason: `no built-in executor for rule "${ruleName}"` } };
  }
}
