import type { KsbBondStatus } from './types';
import { BUILT_IN_VERIFIER_RULES } from './verifier-rules';

/**
 * Composable verifier rule sets.
 *
 * A bond `verifierConfigJson` describes how its verifier rules combine into a
 * single pass or fail outcome. Two shapes are supported:
 *
 *   Flat (treated as an implicit AND of every rule):
 *     { "rules": [ { "name": "http_status_check", ... }, ... ] }
 *
 *   Composed tree:
 *     { "ruleSet": {
 *         "op": "AND",
 *         "children": [
 *           { "name": "http_status_check", "params": { ... } },
 *           { "op": "OR", "children": [
 *             { "name": "signature_check" },
 *             { "name": "external_oracle_check" }
 *           ] }
 *         ]
 *     } }
 *
 * A group node passes when its `op` is satisfied over its children. A leaf
 * node carries one rule spec. Status evaluation walks the tree against the
 * per-rule results recorded in `ksb_verifications`.
 */

export type RuleResult = 'pending' | 'passed' | 'failed' | 'timed_out';
export type RuleSetOp = 'AND' | 'OR';

export interface RuleSpec {
  ruleName: string;
  verifierType: string;
  description: string;
  schemaJson: string;
  params: Record<string, unknown>;
}

export type RuleSetNode =
  | { kind: 'rule'; spec: RuleSpec }
  | { kind: 'group'; op: RuleSetOp; children: RuleSetNode[] };

function normalizeOp(value: unknown): RuleSetOp {
  const op = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return op === 'or' || op === 'any' ? 'OR' : 'AND';
}

function leafSpecFromObject(value: Record<string, unknown>): RuleSpec | null {
  const ruleName = typeof value.name === 'string'
    ? value.name
    : typeof value.ruleName === 'string'
      ? value.ruleName
      : null;
  if (!ruleName) {
    return null;
  }

  const builtIn = BUILT_IN_VERIFIER_RULES.find((rule) => rule.name === ruleName);
  const verifierType = typeof value.verifierType === 'string' ? value.verifierType : builtIn?.verifierType ?? 'custom';
  const description = typeof value.description === 'string'
    ? value.description
    : builtIn?.description ?? 'Rule declared in verifierConfigJson';
  const schemaJson = builtIn?.schemaJson
    ?? (value.schema && typeof value.schema === 'object' && !Array.isArray(value.schema) ? JSON.stringify(value.schema) : '{}');
  const params = value.params && typeof value.params === 'object' && !Array.isArray(value.params)
    ? (value.params as Record<string, unknown>)
    : {};

  return { ruleName, verifierType, description, schemaJson, params };
}

function leafSpecFromName(ruleName: string): RuleSpec {
  const builtIn = BUILT_IN_VERIFIER_RULES.find((rule) => rule.name === ruleName);
  return {
    ruleName,
    verifierType: builtIn?.verifierType ?? 'custom',
    description: builtIn?.description ?? 'Rule declared in verifierConfigJson',
    schemaJson: builtIn?.schemaJson ?? '{}',
    params: {},
  };
}

function parseNode(value: unknown): RuleSetNode | null {
  if (typeof value === 'string' && value.trim()) {
    return { kind: 'rule', spec: leafSpecFromName(value.trim()) };
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const isGroup = 'op' in record || Array.isArray(record.children);
  if (isGroup) {
    const rawChildren = Array.isArray(record.children)
      ? record.children
      : Array.isArray(record.rules)
        ? record.rules
        : [];
    const children = rawChildren
      .map((child) => parseNode(child))
      .filter((child): child is RuleSetNode => child != null);
    if (children.length === 0) {
      return null;
    }
    return { kind: 'group', op: normalizeOp(record.op), children };
  }

  const ruleObject = record.rule && typeof record.rule === 'object' && !Array.isArray(record.rule)
    ? (record.rule as Record<string, unknown>)
    : record;
  const spec = leafSpecFromObject(ruleObject);
  return spec ? { kind: 'rule', spec } : null;
}

/**
 * Parse a `verifierConfigJson` string into a rule set tree, or null when the
 * config declares no rules. A flat `rules` or `verifications` array is treated
 * as an implicit AND group.
 */
export function parseRuleSetConfig(verifierConfigJson: string): RuleSetNode | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(verifierConfigJson);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  if (record.ruleSet != null) {
    return parseNode(record.ruleSet);
  }

  const flat = Array.isArray(record.rules)
    ? record.rules
    : Array.isArray(record.verifications)
      ? record.verifications
      : null;
  if (!flat) {
    return null;
  }

  const children = flat
    .map((entry) => parseNode(entry))
    .filter((child): child is RuleSetNode => child != null);
  return children.length ? { kind: 'group', op: 'AND', children } : null;
}

/** Collect every distinct rule leaf in a tree, keyed by rule name (first wins). */
export function collectRuleSpecs(node: RuleSetNode | null): RuleSpec[] {
  const byName = new Map<string, RuleSpec>();
  const walk = (current: RuleSetNode) => {
    if (current.kind === 'rule') {
      if (!byName.has(current.spec.ruleName)) {
        byName.set(current.spec.ruleName, current.spec);
      }
      return;
    }
    for (const child of current.children) {
      walk(child);
    }
  };
  if (node) {
    walk(node);
  }
  return Array.from(byName.values());
}

/** Evaluate a tree against per-rule results. Unknown rules default to pending. */
export function evaluateRuleSet(node: RuleSetNode, results: Map<string, RuleResult>): RuleResult {
  if (node.kind === 'rule') {
    return results.get(node.spec.ruleName) ?? 'pending';
  }

  const childResults = node.children.map((child) => evaluateRuleSet(child, results));
  if (node.op === 'AND') {
    if (childResults.includes('failed')) return 'failed';
    if (childResults.includes('timed_out')) return 'timed_out';
    if (childResults.includes('pending')) return 'pending';
    return 'passed';
  }

  // OR
  if (childResults.includes('passed')) return 'passed';
  if (childResults.includes('pending')) return 'pending';
  if (childResults.includes('timed_out')) return 'timed_out';
  return 'failed';
}

const RESULT_TO_STATUS: Record<RuleResult, KsbBondStatus> = {
  passed: 'verified',
  failed: 'failed',
  timed_out: 'timed_out',
  pending: 'active',
};

/**
 * Derive the bond lifecycle status from its verifier config and the per-rule
 * results recorded so far.
 *
 * A `contested` result on any rule contests the whole bond. Rules that appear
 * in the results but not in the config tree (for example rules added by a
 * proof submission) are ANDed onto the configured tree, so a flat config and
 * a composed config both reduce to the same answer when no OR groups exist.
 */
export function evaluateBondStatus(
  verifierConfigJson: string,
  results: Record<string, string>,
): KsbBondStatus {
  if (Object.values(results).includes('contested')) {
    return 'contested';
  }

  const tree = parseRuleSetConfig(verifierConfigJson);
  const treeNames = new Set(collectRuleSpecs(tree).map((spec) => spec.ruleName));
  const extraLeaves: RuleSetNode[] = Object.keys(results)
    .filter((name) => !treeNames.has(name))
    .map((name) => ({ kind: 'rule', spec: leafSpecFromName(name) }));

  let effective: RuleSetNode | null;
  if (tree && extraLeaves.length) {
    effective = { kind: 'group', op: 'AND', children: [tree, ...extraLeaves] };
  } else if (tree) {
    effective = tree;
  } else if (extraLeaves.length) {
    effective = { kind: 'group', op: 'AND', children: extraLeaves };
  } else {
    effective = null;
  }

  if (!effective) {
    return 'active';
  }

  const resultMap = new Map<string, RuleResult>();
  for (const [name, value] of Object.entries(results)) {
    if (value === 'passed' || value === 'failed' || value === 'timed_out' || value === 'pending') {
      resultMap.set(name, value);
    }
  }

  return RESULT_TO_STATUS[evaluateRuleSet(effective, resultMap)];
}
