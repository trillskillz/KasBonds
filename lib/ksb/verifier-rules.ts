import type { KsbVerifierRuleRecord } from './types';

/**
 * Built-in KSB verifier rule catalog.
 *
 * These rules are protocol constants, not database rows. They are always
 * available to every registered app and cover the rule families described in
 * the KSB plan: HTTP checks, content checks, time checks, signature checks,
 * and external oracle checks.
 *
 * Apps reference a built-in rule by name inside `verifierConfigJson`, for
 * example:
 *
 *   {
 *     "rules": [
 *       { "name": "http_status_check", "params": { "url": "https://...", "expectedStatus": 200 } }
 *     ]
 *   }
 *
 * Custom rules declared by an app are stored in `ksb_verifier_rules` and are
 * merged with this catalog by `listKsbVerifierRules`.
 */

interface BuiltInVerifierRuleDefinition {
  name: string;
  description: string;
  verifierType: string;
  defaultTimeoutMs: number;
  schema: Record<string, unknown>;
}

const BUILT_IN_DEFINITIONS: BuiltInVerifierRuleDefinition[] = [
  {
    name: 'http_status_check',
    description: 'Confirms an HTTP endpoint responds with an expected status code before the deadline.',
    verifierType: 'http',
    defaultTimeoutMs: 15000,
    schema: {
      type: 'object',
      required: ['url'],
      properties: {
        url: { type: 'string', description: 'Absolute http or https URL to request.' },
        method: { type: 'string', enum: ['GET', 'HEAD', 'POST'], default: 'GET' },
        expectedStatus: { type: 'integer', default: 200, description: 'Status code that counts as a pass.' },
      },
    },
  },
  {
    name: 'http_content_check',
    description: 'Fetches a URL and checks the response body for required or forbidden content.',
    verifierType: 'content',
    defaultTimeoutMs: 15000,
    schema: {
      type: 'object',
      required: ['url'],
      properties: {
        url: { type: 'string', description: 'Absolute http or https URL to fetch.' },
        mustContain: { type: 'array', items: { type: 'string' }, description: 'Substrings that must all be present.' },
        mustNotContain: { type: 'array', items: { type: 'string' }, description: 'Substrings that must all be absent.' },
        contentHashSha256: { type: 'string', description: 'Optional exact sha256 hex digest of the response body.' },
      },
    },
  },
  {
    name: 'deadline_time_check',
    description: 'Confirms a claimed completion timestamp lands on or before the bond deadline.',
    verifierType: 'time',
    defaultTimeoutMs: 1000,
    schema: {
      type: 'object',
      required: ['completedAtUnix'],
      properties: {
        completedAtUnix: { type: 'integer', description: 'Unix seconds the work was completed.' },
        graceSeconds: { type: 'integer', default: 0, description: 'Seconds of slack allowed past the deadline.' },
      },
    },
  },
  {
    name: 'signature_check',
    description: 'Verifies a cryptographic signature over an agreed message using a known public key.',
    verifierType: 'signature',
    defaultTimeoutMs: 1000,
    schema: {
      type: 'object',
      required: ['publicKey', 'message', 'signature'],
      properties: {
        publicKey: { type: 'string', description: 'PEM or hex encoded public key of the expected signer.' },
        message: { type: 'string', description: 'Exact message bytes that were signed.' },
        signature: { type: 'string', description: 'Signature encoded as hex or base64.' },
        algorithm: { type: 'string', default: 'ed25519', description: 'Signature algorithm hint.' },
      },
    },
  },
  {
    name: 'external_oracle_check',
    description: 'Delegates the decision to a registered external oracle that returns a signed pass or fail.',
    verifierType: 'oracle',
    defaultTimeoutMs: 30000,
    schema: {
      type: 'object',
      required: ['oracleUrl'],
      properties: {
        oracleUrl: { type: 'string', description: 'Webhook the protocol layer calls for a verdict.' },
        oraclePublicKey: { type: 'string', description: 'Public key used to verify the signed oracle response.' },
        query: { type: 'object', description: 'Arbitrary payload forwarded to the oracle.' },
      },
    },
  },
];

export const BUILT_IN_VERIFIER_RULES: KsbVerifierRuleRecord[] = BUILT_IN_DEFINITIONS.map((definition) => ({
  name: definition.name,
  description: definition.description,
  schemaJson: JSON.stringify(definition.schema),
  verifierType: definition.verifierType,
  defaultTimeoutMs: definition.defaultTimeoutMs,
  createdAt: null,
  source: 'builtin',
}));

export const BUILT_IN_VERIFIER_RULE_NAMES: ReadonlySet<string> = new Set(
  BUILT_IN_VERIFIER_RULES.map((rule) => rule.name),
);

export function isBuiltInVerifierRule(name: string): boolean {
  return BUILT_IN_VERIFIER_RULE_NAMES.has(name);
}
