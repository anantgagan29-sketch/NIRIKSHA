import type { ExtractedField, FieldKey, RuleSource } from "@/engine/domain";
import type { Applicability, Rule, RuleContext, RuleOutcome } from "../types";

/**
 * Rule pack: Legal Metrology (Packaged Commodities) Rules, 2011.
 *
 * Two disciplines govern this file.
 *
 * 1. Every rule cites the provision it comes from. A citation marked
 *    `unverified` has not been checked against the primary text, and the
 *    engine will not let such a rule produce a failure -- only NEEDS_REVIEW.
 *
 * 2. Requirements are conditional. `appliesWhen` is not decoration: a rule
 *    that does not govern a package must say so and say why, rather than
 *    contributing a failure it has no business contributing.
 *
 * Provisions marked verified below were read against the Gazette text of the
 * Rules and the amended consolidation of Rule 6.
 */

const INSTRUMENT = "Legal Metrology (Packaged Commodities) Rules, 2011";
const GAZETTE_URL =
  "https://foodsafetystandard.in/wp-content/uploads/2019/11/LM-Packaged-Commodities-Rules-2011.pdf";

const source = (provision: string, extra?: Partial<RuleSource>): RuleSource => ({
  instrument: INSTRUMENT,
  provision,
  url: GAZETTE_URL,
  ...extra,
});

/* ------------------------------------------------------------------ helpers */

/** A field the extractor actually found, or undefined. */
function got(context: RuleContext, key: FieldKey): ExtractedField | undefined {
  const field = context.fields.get(key);
  return field && field.status !== "NOT_FOUND" ? field : undefined;
}

const ALWAYS: Applicability = { applicable: true };

/** Chapter II declarations govern retail packages intended for the consumer. */
function retailOnly(context: RuleContext): Applicability {
  if (context.classification.packageType !== "RETAIL") {
    return {
      applicable: false,
      reason:
        "The label indicates this is not a retail package intended for the ultimate consumer, so the retail declaration requirements were not applied.",
    };
  }
  return ALWAYS;
}

/**
 * Rule 6(1)(a) Explanation III and the proviso to Rule 6(1)(d) displace the
 * Legal Metrology requirement for packages containing food articles, putting
 * those declarations under food safety law instead. Where that happens the
 * Legal Metrology rule steps aside and its food-law counterpart takes over.
 */
function nonFoodOnly(context: RuleContext, provision: string): Applicability {
  const retail = retailOnly(context);
  if (!retail.applicable) return retail;

  if (context.classification.isFoodArticle) {
    return {
      applicable: false,
      reason: `This package shows food-article indicators. Under ${provision} the Legal Metrology requirement is displaced for food articles, and the corresponding food safety labelling requirement applies instead.`,
    };
  }
  return ALWAYS;
}

const missing = (what: string, expected: string): RuleOutcome => ({
  status: "FAIL",
  reason: `${what} could not be found on the label.`,
  expected,
});

/* -------------------------------------------------------------------- rules */

const partyDeclaration: Rule = {
  id: "LMPC-6-1-a-party",
  name: "Manufacturer, packer or importer declared",
  description:
    "Every package must declare the name and address of the manufacturer; where the manufacturer is not the packer, of both; and for an imported package, of the importer.",
  fieldKey: "manufacturer_name",
  severity: "CRITICAL",
  source: source("Rule 6(1)(a)"),
  appliesWhen: (context) => nonFoodOnly(context, "Rule 6(1)(a) Explanation III"),
  evaluate(context) {
    const field = got(context, "manufacturer_name");
    if (!field) {
      return missing(
        "A manufacturer, packer or importer declaration",
        "The name of the manufacturer, packer or importer, declared on the package.",
      );
    }

    const value = field.normalisedValue as { name?: string; role?: string } | undefined;
    return {
      status: "PASS",
      reason: `A responsible party is declared on the label as ${(value?.role ?? "manufacturer").toLowerCase()}.`,
      expected: "The name of the manufacturer, packer or importer.",
      detected: field.rawValue,
      evidence: field.evidence,
    };
  },
};

const addressDeclaration: Rule = {
  id: "LMPC-6-1-a-address",
  name: "Address of the responsible party declared",
  description:
    "The declaration under Rule 6(1)(a) requires an address, not only a name.",
  fieldKey: "manufacturer_address",
  severity: "CRITICAL",
  source: source("Rule 6(1)(a)"),
  appliesWhen: (context) => nonFoodOnly(context, "Rule 6(1)(a) Explanation III"),
  evaluate(context) {
    const field = got(context, "manufacturer_address");
    if (!field) {
      return missing(
        "An address for the manufacturer, packer or importer",
        "A complete address for the responsible party.",
      );
    }

    const value = field.normalisedValue as { pinCode?: string } | undefined;
    return {
      status: "PASS",
      reason: value?.pinCode
        ? `An address including the postal code ${value.pinCode} was found.`
        : "An address was found.",
      expected: "A complete address for the responsible party.",
      detected: field.rawValue,
      evidence: field.evidence,
    };
  },
};

const foodPartyDeclaration: Rule = {
  id: "FSS-LABEL-party",
  name: "Manufacturer or packer declared (food article)",
  description:
    "For food articles the name and address declaration is governed by food safety labelling law rather than by the Legal Metrology Rules.",
  fieldKey: "manufacturer_name",
  severity: "CRITICAL",
  source: {
    instrument: "Food Safety and Standards (Labelling and Display) Regulations, 2020",
    provision: "Labelling requirements for pre-packaged food",
    // The displacement itself is established by Rule 6(1)(a) Explanation III,
    // but the exact food-law provision has not been read against source text,
    // so this rule may never produce a failure.
    unverified: true,
  },
  appliesWhen(context) {
    const retail = retailOnly(context);
    if (!retail.applicable) return retail;
    return context.classification.isFoodArticle
      ? ALWAYS
      : {
          applicable: false,
          reason: "No food-article indicators were found, so food labelling law was not applied.",
        };
  },
  evaluate(context) {
    const field = got(context, "manufacturer_name");
    if (!field) {
      return {
        status: "FAIL",
        reason:
          "No manufacturer or packer declaration was found. For a food article this requirement sits in food safety labelling law, whose exact provision is not verified in this rule pack, so this needs confirmation by a person.",
        expected: "The name and address of the manufacturer or packer of the food article.",
      };
    }
    return {
      status: "PASS",
      reason: "A responsible party is declared on the label.",
      expected: "The name and address of the manufacturer or packer of the food article.",
      detected: field.rawValue,
      evidence: field.evidence,
    };
  },
};

const genericName: Rule = {
  id: "LMPC-6-1-b-generic-name",
  name: "Common or generic name declared",
  description:
    "The package must state the common or generic name of the commodity it contains.",
  fieldKey: "generic_name",
  severity: "MAJOR",
  source: source("Rule 6(1)(b)"),
  appliesWhen: retailOnly,
  evaluate(context) {
    const field = got(context, "generic_name");
    if (!field) {
      return {
        status: "NEEDS_REVIEW",
        reason:
          "No explicitly labelled common or generic name was found. A brand name alone does not satisfy this requirement, but the generic name may be printed without a label that automated extraction can anchor to.",
        expected: "The common or generic name of the commodity.",
        detected: got(context, "product_name")?.rawValue,
      };
    }
    return {
      status: "PASS",
      reason: "A common or generic name is declared.",
      expected: "The common or generic name of the commodity.",
      detected: field.rawValue,
      evidence: field.evidence,
    };
  },
};

const netQuantity: Rule = {
  id: "LMPC-6-1-c-net-quantity",
  name: "Net quantity declared in a standard unit",
  description:
    "The net quantity must be declared in terms of the standard unit of weight or measure, or by number where the commodity is sold by count.",
  fieldKey: "net_quantity",
  severity: "CRITICAL",
  source: source("Rule 6(1)(c)"),
  appliesWhen: retailOnly,
  evaluate(context) {
    const field = got(context, "net_quantity");
    if (!field) {
      return missing(
        "A net quantity declaration",
        "Net quantity in a standard unit of weight or measure, or a count.",
      );
    }

    const value = field.normalisedValue as
      | { value?: number | null; unit?: string; isStandardUnit?: boolean; labelled?: boolean }
      | undefined;

    if (!value?.isStandardUnit) {
      return {
        status: "FAIL",
        reason: `The quantity is declared in "${value?.unit ?? "an unrecognised unit"}", which is not a standard unit of weight or measure.`,
        expected: "A standard unit such as g, kg, ml, l, cm, m, or a count.",
        detected: field.rawValue,
        evidence: field.evidence,
      };
    }

    if (!value.labelled) {
      return {
        status: "NEEDS_REVIEW",
        reason:
          "A quantity in a standard unit was found, but it is not labelled as the net quantity. It may belong to a nutrition panel or a serving reference rather than being the net quantity declaration.",
        expected: 'A net quantity declaration, for example "Net Qty: 200 g".',
        detected: field.rawValue,
        evidence: field.evidence,
      };
    }

    return {
      status: "PASS",
      reason: `Net quantity is declared as ${value.value} ${value.unit} in a standard unit.`,
      expected: "Net quantity in a standard unit of weight or measure.",
      detected: field.rawValue,
      evidence: field.evidence,
    };
  },
};

const manufactureDate: Rule = {
  id: "LMPC-6-1-d-date",
  name: "Month and year of manufacture, pre-packing or import",
  description:
    "The package must state the month and year in which the commodity was manufactured, pre-packed or imported.",
  fieldKey: "manufacturing_date",
  severity: "MAJOR",
  source: source("Rule 6(1)(d)"),
  appliesWhen: (context) => nonFoodOnly(context, "the proviso to Rule 6(1)(d)"),
  evaluate(context) {
    const field = got(context, "manufacturing_date");
    if (!field) {
      return missing(
        "A month and year of manufacture, pre-packing or import",
        "The month and year of manufacture, pre-packing or import.",
      );
    }
    return {
      status: "PASS",
      reason: "A date of manufacture, packing or import is declared.",
      expected: "The month and year of manufacture, pre-packing or import.",
      detected: field.rawValue,
      evidence: field.evidence,
    };
  },
};

const retailSalePricePresent: Rule = {
  id: "LMPC-6-1-e-price-present",
  name: "Retail sale price declared",
  description: "The package must bear a declaration of the retail sale price.",
  fieldKey: "mrp",
  severity: "CRITICAL",
  source: source("Rule 6(1)(e)"),
  appliesWhen: retailOnly,
  evaluate(context) {
    const field = got(context, "mrp");
    if (!field) {
      return missing("A retail sale price declaration", "A declared maximum retail price.");
    }

    const value = field.normalisedValue as { amount?: number | null } | undefined;
    if (value?.amount == null || !(value.amount > 0)) {
      return {
        status: "NEEDS_REVIEW",
        reason: "A price declaration was found but no valid amount could be read from it.",
        expected: "A declared maximum retail price with a readable amount.",
        detected: field.rawValue,
        evidence: field.evidence,
      };
    }

    return {
      status: "PASS",
      reason: `A retail sale price of ₹${value.amount} is declared.`,
      expected: "A declared maximum retail price.",
      detected: field.rawValue,
      evidence: field.evidence,
    };
  },
};

/**
 * The format rule. Rule 2(m) defines the retail sale price as the maximum
 * price at which the commodity may be sold to the ultimate consumer, and
 * prescribes how it is to be printed: "Maximum or Max. retail price
 * Rs ..... inclusive of all taxes", or "MRP Rs ..... incl. of all taxes".
 *
 * This is the check that separates reading a label from understanding it:
 * a bare "₹50" carries the number but not the declaration the Rules require.
 */
const retailSalePriceFormat: Rule = {
  id: "LMPC-2-m-price-format",
  name: "Retail sale price stated as inclusive of all taxes",
  description:
    'The retail sale price must be printed in the prescribed form, stating that the price is inclusive of all taxes.',
  fieldKey: "mrp",
  severity: "MAJOR",
  source: source("Rule 2(m)"),
  appliesWhen(context) {
    const retail = retailOnly(context);
    if (!retail.applicable) return retail;
    return got(context, "mrp")
      ? ALWAYS
      : {
          applicable: false,
          reason:
            "No price declaration was found, so its format could not be assessed. The absence itself is reported by the retail sale price rule.",
        };
  },
  evaluate(context) {
    const field = got(context, "mrp")!;
    const value = field.normalisedValue as
      | { inclusiveOfTaxes?: boolean; declaredAs?: string; amount?: number | null }
      | undefined;

    if (!value?.inclusiveOfTaxes) {
      return {
        status: "FAIL",
        reason:
          'The price is declared without stating that it is inclusive of all taxes. Rule 2(m) prescribes the form "Maximum retail price Rs ... inclusive of all taxes", or "MRP Rs ... incl. of all taxes". A bare price does not meet that form.',
        expected: '"MRP Rs <amount> incl. of all taxes", or the equivalent full wording.',
        detected: value?.declaredAs ?? field.rawValue,
        evidence: field.evidence,
      };
    }

    return {
      status: "PASS",
      reason: "The price is declared as inclusive of all taxes, in the prescribed form.",
      expected: '"MRP Rs <amount> incl. of all taxes", or the equivalent full wording.',
      detected: value.declaredAs ?? field.rawValue,
      evidence: field.evidence,
    };
  },
};

const consumerCare: Rule = {
  id: "LMPC-6-2-consumer-care",
  name: "Consumer care contact declared",
  description:
    "Every package must bear the name, address, telephone number and e-mail address, if available, of the person or office to be contacted in case of consumer complaints.",
  fieldKey: "consumer_care",
  severity: "CRITICAL",
  source: source("Rule 6(2)"),
  appliesWhen: retailOnly,
  evaluate(context) {
    const field = got(context, "consumer_care");
    if (!field) {
      return {
        status: "FAIL",
        reason:
          "No consumer care contact could be found. No telephone number or e-mail address matching a complaints contact was detected on the label.",
        expected:
          "A contact for consumer complaints — telephone number, and e-mail address if available.",
      };
    }

    const value = field.normalisedValue as
      | { email?: string | null; phone?: string | null; hasContextLabel?: boolean }
      | undefined;

    if (!value?.hasContextLabel) {
      return {
        status: "NEEDS_REVIEW",
        reason:
          "Contact details were found, but not alongside wording identifying them as a consumer complaints contact. They may belong to a marketing or corporate address rather than to a complaints office.",
        expected: "A contact identified as being for consumer complaints.",
        detected: field.rawValue,
        evidence: field.evidence,
      };
    }

    const parts = [value.phone && "a telephone number", value.email && "an e-mail address"]
      .filter(Boolean)
      .join(" and ");

    return {
      status: "PASS",
      reason: `A consumer care contact is declared, including ${parts}.`,
      expected: "A contact for consumer complaints.",
      detected: field.rawValue,
      evidence: field.evidence,
    };
  },
};

const countryOfOrigin: Rule = {
  id: "LMPC-6-1-aa-country-of-origin",
  name: "Country of origin declared for imported packages",
  description:
    "The name of the country of origin, manufacture or assembly must be mentioned on an imported package.",
  fieldKey: "country_of_origin",
  severity: "MAJOR",
  source: source("Rule 6(1)(aa)"),
  appliesWhen(context) {
    const retail = retailOnly(context);
    if (!retail.applicable) return retail;

    if (!context.classification.isImported) {
      return {
        applicable: false,
        reason:
          "Nothing on the label indicates this is an imported package, and this declaration is required only for imported products. It has therefore not been treated as a deficiency.",
      };
    }
    return ALWAYS;
  },
  evaluate(context) {
    const field = got(context, "country_of_origin");
    if (!field) {
      return missing(
        "A country of origin declaration",
        "The country of origin, manufacture or assembly, for an imported package.",
      );
    }
    return {
      status: "PASS",
      reason: `Country of origin is declared as ${(field.normalisedValue as { country?: string })?.country ?? field.rawValue}.`,
      expected: "The country of origin for an imported package.",
      detected: field.rawValue,
      evidence: field.evidence,
    };
  },
};

const bestBefore: Rule = {
  id: "LMPC-6-1-da-best-before",
  name: "Best before or use by date",
  description:
    "Where a commodity becomes unfit for consumption after a period of time, the best before or use by date, month and year must be declared.",
  fieldKey: "best_before",
  severity: "MAJOR",
  source: source("Rule 6(1)(da)"),
  appliesWhen(context) {
    const retail = retailOnly(context);
    if (!retail.applicable) return retail;

    if (!context.classification.isFoodArticle) {
      return {
        applicable: false,
        reason:
          "This declaration applies to commodities that become unfit for consumption after a period. Nothing on the label indicates a perishable commodity, so it has not been treated as a deficiency.",
      };
    }
    return ALWAYS;
  },
  evaluate(context) {
    const field = got(context, "best_before");
    if (!field) {
      return {
        status: "FAIL",
        reason:
          "This package shows food-article indicators, but no best before or use by date could be found.",
        expected: "A best before or use by date, month and year.",
      };
    }
    return {
      status: "PASS",
      reason: "A best before or use by date is declared.",
      expected: "A best before or use by date, month and year.",
      detected: field.rawValue,
      evidence: field.evidence,
    };
  },
};

const unitSalePrice: Rule = {
  id: "LMPC-6-11-unit-sale-price",
  name: "Unit sale price",
  description:
    "A declaration of the price per unit of quantity, introduced by amendment to Rule 6.",
  fieldKey: "unit_sale_price",
  severity: "MINOR",
  source: source("Rule 6(11)", {
    effectiveDate: "2022-04-01",
    // Reported as inserted by a November 2021 amendment, but the amending
    // notification has not been read against source text in this rule pack.
    unverified: true,
  }),
  appliesWhen: retailOnly,
  evaluate(context) {
    const field = got(context, "unit_sale_price");
    if (!field) {
      return {
        status: "FAIL",
        reason:
          "No unit sale price declaration was found. This requirement was introduced by amendment and its exact scope and exemptions are not verified in this rule pack, so it requires confirmation by a person.",
        expected: "A price per unit of quantity, where the requirement applies to this package.",
      };
    }
    return {
      status: "PASS",
      reason: "A unit sale price is declared.",
      expected: "A price per unit of quantity.",
      detected: field.rawValue,
      evidence: field.evidence,
    };
  },
};

const dimensions: Rule = {
  id: "LMPC-6-1-f-dimensions",
  name: "Dimensions of the commodity",
  description:
    "Where the dimensions of the commodity are relevant to its content, they must be declared.",
  fieldKey: "dimensions",
  severity: "MINOR",
  source: source("Rule 6(1)(f)"),
  appliesWhen(context) {
    const retail = retailOnly(context);
    if (!retail.applicable) return retail;

    return {
      applicable: false,
      reason:
        "This declaration is required only where the dimensions of the commodity are relevant to its content. Whether that is so cannot be determined from a photograph of the label, so it has not been assessed.",
    };
  },
  evaluate(context) {
    const field = got(context, "dimensions");
    return field
      ? {
          status: "PASS",
          reason: "Dimensions are declared.",
          expected: "The dimensions of the commodity, where relevant.",
          detected: field.rawValue,
          evidence: field.evidence,
        }
      : {
          status: "NEEDS_REVIEW",
          reason: "No dimensions were found.",
          expected: "The dimensions of the commodity, where relevant.",
        };
  },
};

export const LMPC_2011_RULES: Rule[] = [
  partyDeclaration,
  foodPartyDeclaration,
  addressDeclaration,
  genericName,
  netQuantity,
  manufactureDate,
  retailSalePricePresent,
  retailSalePriceFormat,
  consumerCare,
  countryOfOrigin,
  bestBefore,
  unitSalePrice,
  dimensions,
];

/**
 * Rule 26(a): the Rules do not apply to a package of ten grams or ten
 * millilitres or less, with a proviso preserving the maximum retail price and
 * net quantity declarations for packages between ten and twenty grams or
 * millilitres.
 */
export const RULE_26_EXEMPTION_SOURCE = source("Rule 26(a)");

export const RULE_PACK = {
  id: "lmpc-2011",
  name: "Legal Metrology (Packaged Commodities) Rules, 2011",
  version: "2011.1.0",
  rules: LMPC_2011_RULES,
};
