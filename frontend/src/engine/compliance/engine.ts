import type {
  ComplianceRun,
  ExtractedField,
  FieldKey,
  OverallStatus,
  RuleResult,
  RuleStatus,
  Severity,
} from "@/engine/domain";
import { classify } from "@/engine/extraction/classify";
import { normalise } from "@/engine/extraction/text";
import { ENGINE_VERSION } from "@/engine/version";
import { RULE_26_EXEMPTION_SOURCE, RULE_PACK } from "./rules/lmpc-2011";
import type { Rule, RuleContext } from "./types";

/**
 * The compliance engine.
 *
 * It does three things beyond running rules, and each exists to stop the
 * system from making a claim it cannot support:
 *
 *   1. It applies exemptions before rules, so an exempt package is not
 *      assessed against requirements that do not reach it.
 *   2. It downgrades a failure to NEEDS_REVIEW whenever the failure could be
 *      an artefact of a bad read or of a citation that has not been verified.
 *      Failing a product because the camera struggled is a false accusation.
 *   3. It records the rule pack and engine versions, so any assessment can be
 *      reproduced against the exact logic that produced it.
 */

/** Below this OCR confidence, an absent declaration is more likely a bad read. */
const UNRELIABLE_READ_THRESHOLD = 55;

const SEVERITY_WEIGHT: Record<Severity, number> = {
  CRITICAL: 4,
  MAJOR: 3,
  MINOR: 2,
  INFO: 1,
};

const STATUS_VALUE: Record<Exclude<RuleStatus, "NOT_APPLICABLE">, number> = {
  PASS: 1,
  NEEDS_REVIEW: 0.5,
  FAIL: 0,
};

export interface AssessmentInput {
  scanId: string;
  rawText: string;
  fields: ExtractedField[];
  meanConfidence: number;
  rules?: Rule[];
  rulePackVersion?: string;
}

/**
 * Rule 26(a): a package of ten grams or ten millilitres or less falls outside
 * these Rules altogether.
 */
function exemption(netQuantityBase: number | null, kind: string | null) {
  if (netQuantityBase == null || (kind !== "mass" && kind !== "volume")) return undefined;
  if (netQuantityBase > 10) return undefined;

  return {
    applies: true,
    reason: `The declared net quantity is ${netQuantityBase} ${kind === "mass" ? "g" : "ml"}, at or below the ten gram or ten millilitre threshold at which these Rules do not apply to the package. The declaration requirements were therefore not assessed.`,
    source: RULE_26_EXEMPTION_SOURCE,
  };
}

export function assessCompliance({
  scanId,
  rawText,
  fields,
  meanConfidence,
  rules = RULE_PACK.rules,
  rulePackVersion = RULE_PACK.version,
}: AssessmentInput): ComplianceRun {
  const startedAt = Date.now();

  const fieldMap = new Map<FieldKey, ExtractedField>(fields.map((f) => [f.key, f]));
  const classification = classify(rawText, fields);
  const context: RuleContext = {
    fields: fieldMap,
    classification,
    text: normalise(rawText),
    meanConfidence,
    exemption: exemption(classification.netQuantityBase, classification.netQuantityKind),
  };

  const results: RuleResult[] = rules.map((rule) => evaluateRule(rule, context));

  const counts = results.reduce<Record<RuleStatus, number>>(
    (acc, result) => ({ ...acc, [result.status]: acc[result.status] + 1 }),
    { PASS: 0, FAIL: 0, NOT_APPLICABLE: 0, NEEDS_REVIEW: 0 },
  );

  return {
    scanId,
    rulePackVersion,
    engineVersion: ENGINE_VERSION,
    overallStatus: overall(counts),
    score: score(results),
    counts,
    results,
    assessedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
  };
}

function evaluateRule(rule: Rule, context: RuleContext): RuleResult {
  const base = {
    ruleId: rule.id,
    ruleName: rule.name,
    fieldKey: rule.fieldKey,
    severity: rule.severity,
    source: rule.source,
  };

  // An exemption switches off the declaration requirements entirely.
  if (context.exemption?.applies) {
    return {
      ...base,
      status: "NOT_APPLICABLE",
      reason: context.exemption.reason,
      expected: rule.description,
      source: context.exemption.source,
      notApplicableReason: context.exemption.reason,
    };
  }

  let applicability;
  let outcome;
  try {
    applicability = rule.appliesWhen(context);
    if (!applicability.applicable) {
      return {
        ...base,
        status: "NOT_APPLICABLE",
        reason: applicability.reason ?? "This requirement does not apply to this package.",
        expected: rule.description,
        notApplicableReason: applicability.reason,
      };
    }
    outcome = rule.evaluate(context);
  } catch (error) {
    // A broken rule must degrade to "a person should look", never to a verdict.
    console.error(`[niriksha] rule ${rule.id} threw:`, error);
    return {
      ...base,
      status: "NEEDS_REVIEW",
      reason: "This rule could not be evaluated because of an internal error, so it needs review.",
      expected: rule.description,
    };
  }

  const field = rule.fieldKey ? context.fields.get(rule.fieldKey) : undefined;
  let { status, reason } = outcome;

  if (status === "FAIL") {
    // Policy 1: an unverified citation may never produce a failure.
    if (rule.source.unverified) {
      status = "NEEDS_REVIEW";
      reason = `${reason} The provision behind this check has not been verified against source text in this rule pack, so it is reported for review rather than as a failure.`;
    }
    // Policy 2: a value read poorly is not a value that is absent.
    else if (field && field.status === "NEEDS_REVIEW") {
      status = "NEEDS_REVIEW";
      reason = `${reason} The related text was read at only ${field.confidence}% confidence, so this may be a reading failure rather than a missing declaration.`;
    }
    // Policy 3: when the whole image read badly, absence proves little.
    else if (context.meanConfidence < UNRELIABLE_READ_THRESHOLD) {
      status = "NEEDS_REVIEW";
      reason = `${reason} Text recognition confidence across this image was only ${Math.round(context.meanConfidence)}%, which is too low to conclude that the declaration is absent rather than unread.`;
    }
  }

  return {
    ...base,
    status,
    reason,
    expected: outcome.expected,
    detected: outcome.detected,
    evidence: outcome.evidence,
  };
}

function overall(counts: Record<RuleStatus, number>): OverallStatus {
  if (counts.FAIL > 0) return "NON_COMPLIANT";
  if (counts.NEEDS_REVIEW > 0) return "NEEDS_REVIEW";
  if (counts.PASS === 0) return "NEEDS_REVIEW";
  return "COMPLIANT";
}

/**
 * A weighted assessment score, severity-weighted and excluding rules that do
 * not apply. It is a summary of the checks below it, never a substitute for
 * reading them, and the interface must always present it as such.
 */
function score(results: RuleResult[]): number {
  const applicable = results.filter((r) => r.status !== "NOT_APPLICABLE");
  if (applicable.length === 0) return 0;

  let earned = 0;
  let possible = 0;
  for (const result of applicable) {
    const weight = SEVERITY_WEIGHT[result.severity];
    possible += weight;
    earned += weight * STATUS_VALUE[result.status as Exclude<RuleStatus, "NOT_APPLICABLE">];
  }
  return Math.round((earned / possible) * 100);
}

export { RULE_PACK } from "./rules/lmpc-2011";
export type { Rule, RuleContext } from "./types";
