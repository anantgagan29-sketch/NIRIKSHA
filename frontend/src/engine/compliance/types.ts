import type {
  ExtractedField,
  FieldKey,
  RuleResult,
  RuleSource,
  RuleStatus,
  Severity,
} from "@/engine/domain";
import type { PackageClassification } from "@/engine/extraction/classify";

/** Everything a rule may look at. Rules never reach outside this. */
export interface RuleContext {
  fields: Map<FieldKey, ExtractedField>;
  classification: PackageClassification;
  /** Normalised OCR text, for rules that need wording rather than a field. */
  text: string;
  meanConfidence: number;
  /**
   * True when the package falls within an exemption that switches off the
   * declaration requirements entirely.
   */
  exemption?: { applies: boolean; reason: string; source: RuleSource };
}

/** What a rule concluded, before the engine applies its safety policies. */
export interface RuleOutcome {
  status: Exclude<RuleStatus, "NOT_APPLICABLE">;
  reason: string;
  expected: string;
  detected?: string;
  evidence?: string;
}

export interface Applicability {
  applicable: boolean;
  /** Required when not applicable: the condition that excluded this rule. */
  reason?: string;
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  /** The declaration this rule is about, used to link results to fields. */
  fieldKey?: FieldKey;
  severity: Severity;
  source: RuleSource;
  /**
   * Whether this rule governs this package at all. A rule that does not apply
   * produces NOT_APPLICABLE with a reason -- never a failure.
   */
  appliesWhen(context: RuleContext): Applicability;
  evaluate(context: RuleContext): RuleOutcome;
}

export type { RuleResult, RuleSource, RuleStatus, Severity, PackageClassification };
