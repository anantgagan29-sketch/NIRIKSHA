import type { DemoProduct } from "./types";

/**
 * Demonstration data for the frontend build.
 *
 * This file is the ONLY place product data is defined. Components read it
 * through `src/services`, never directly, so replacing it with a real API
 * response is a change to the service layer alone.
 *
 * The rule citations are genuine provisions of the Legal Metrology (Packaged
 * Commodities) Rules, 2011. The products themselves are invented for
 * demonstration and are not real commodities.
 */

const LMPC = "Legal Metrology (Packaged Commodities) Rules, 2011";

export const DEMO_PRODUCTS: DemoProduct[] = [
  /* ------------------------------------------------------------ compliant */
  {
    id: "sunflower-oil",
    scanId: "NIR-2026-00124",
    name: "Suryodaya Sunflower Oil",
    category: "Edible oil",
    netQuantity: "1 L",
    gtin: "8901234567890",
    result: "compliant",
    score: 100,
    scannedAt: "2026-09-04T10:24:00+05:30",
    ocrConfidence: 96,
    labelLines: [
      "SURYODAYA",
      "Refined Sunflower Oil",
      "Common name: Refined sunflower oil",
      "Net Qty: 1 L",
      "MRP Rs 180.00 incl. of all taxes",
      "Unit sale price: Rs 180.00 per L",
      "Mfd. by: Suryodaya Foods Pvt Ltd",
      "Plot 18, Food Park, Nashik,",
      "Maharashtra - 422001",
      "Consumer care: 1800-123-4567",
      "care@suryodaya.example",
      "Mfg date: 05/2026",
      "Best before: 11/2027",
      "FSSAI Lic. No. 10019022001234",
    ],
    quality: {
      score: 94,
      verdict: "good",
      proceed: true,
      metrics: [
        { key: "sharpness", label: "Sharpness", verdict: "good", detail: "Edges are crisp; small print is legible." },
        { key: "brightness", label: "Brightness", verdict: "good", detail: "Evenly lit with no glare across the print." },
        { key: "resolution", label: "Resolution", verdict: "good", detail: "2048 × 2731 px — ample detail for small declarations." },
        { key: "textVisibility", label: "Text Visibility", verdict: "good", detail: "Strong text-like structure across the label region." },
      ],
    },
    fields: [
      { key: "product_name", label: "Product Name", value: "Suryodaya Refined Sunflower Oil", confidence: 97, status: "detected", evidence: "SURYODAYA Refined Sunflower Oil" },
      { key: "generic_name", label: "Common / Generic Name", value: "Refined sunflower oil", confidence: 96, status: "detected", evidence: "Common name: Refined sunflower oil" },
      { key: "mrp", label: "MRP", value: "₹180.00 inclusive of all taxes", confidence: 97, status: "detected", evidence: "MRP Rs 180.00 incl. of all taxes" },
      { key: "net_quantity", label: "Net Quantity", value: "1 L", confidence: 96, status: "detected", evidence: "Net Qty: 1 L" },
      { key: "unit_sale_price", label: "Unit Sale Price", value: "₹180.00 per L", confidence: 93, status: "detected", evidence: "Unit sale price: Rs 180.00 per L" },
      { key: "manufacturer", label: "Manufacturer", value: "Suryodaya Foods Pvt Ltd", confidence: 95, status: "detected", evidence: "Mfd. by: Suryodaya Foods Pvt Ltd" },
      { key: "address", label: "Manufacturer Address", value: "Plot 18, Food Park, Nashik, Maharashtra – 422001", confidence: 92, status: "detected", evidence: "Plot 18, Food Park, Nashik, Maharashtra - 422001" },
      { key: "consumer_care", label: "Consumer Care", value: "1800-123-4567 · care@suryodaya.example", confidence: 95, status: "detected", evidence: "Consumer care: 1800-123-4567" },
      { key: "mfg_date", label: "Month & Year of Manufacture", value: "05/2026", confidence: 94, status: "detected", evidence: "Mfg date: 05/2026" },
      { key: "best_before", label: "Best Before", value: "11/2027", confidence: 93, status: "detected", evidence: "Best before: 11/2027" },
      { key: "country_of_origin", label: "Country of Origin", value: null, confidence: null, status: "missing" },
    ],
    checks: [
      { id: "c1", fieldKey: "manufacturer", label: "Manufacturer, packer or importer declared", status: "pass", detected: "Suryodaya Foods Pvt Ltd", confidence: 95, requirement: "The name of the manufacturer, packer or importer must be declared on the package.", reason: "A responsible party is declared on the label as manufacturer.", evidence: "Mfd. by: Suryodaya Foods Pvt Ltd", provision: "Rule 6(1)(a)", instrument: LMPC, severity: "critical" },
      { id: "c2", fieldKey: "address", label: "Address of the responsible party declared", status: "pass", detected: "Nashik, Maharashtra – 422001", confidence: 92, requirement: "A complete address for the responsible party must accompany the name.", reason: "An address including the postal code 422001 was found.", evidence: "Plot 18, Food Park, Nashik, Maharashtra - 422001", provision: "Rule 6(1)(a)", instrument: LMPC, severity: "critical" },
      { id: "c3", fieldKey: "generic_name", label: "Common or generic name declared", status: "pass", detected: "Refined sunflower oil", confidence: 96, requirement: "The package must state the common or generic name of the commodity.", reason: "A common or generic name is declared.", evidence: "Common name: Refined sunflower oil", provision: "Rule 6(1)(b)", instrument: LMPC, severity: "major" },
      { id: "c4", fieldKey: "net_quantity", label: "Net quantity in a standard unit", status: "pass", detected: "1 L", confidence: 96, requirement: "Net quantity must be declared in a standard unit of weight or measure.", reason: "Net quantity is declared as 1 L in a standard unit.", evidence: "Net Qty: 1 L", provision: "Rule 6(1)(c)", instrument: LMPC, severity: "critical" },
      { id: "c5", fieldKey: "mfg_date", label: "Month and year of manufacture or packing", status: "pass", detected: "05/2026", confidence: 94, requirement: "The month and year of manufacture, pre-packing or import must be stated.", reason: "A date of manufacture is declared.", evidence: "Mfg date: 05/2026", provision: "Rule 6(1)(d)", instrument: LMPC, severity: "major" },
      { id: "c6", fieldKey: "mrp", label: "Retail sale price declared", status: "pass", detected: "₹180.00", confidence: 97, requirement: "The package must bear a declaration of the retail sale price.", reason: "A retail sale price of ₹180.00 is declared.", evidence: "MRP Rs 180.00", provision: "Rule 6(1)(e)", instrument: LMPC, severity: "critical" },
      { id: "c7", fieldKey: "mrp", label: "Price stated as inclusive of all taxes", status: "pass", detected: "MRP Rs 180.00 incl. of all taxes", confidence: 97, requirement: "The retail sale price must be printed in the prescribed form, stating that it is inclusive of all taxes.", reason: "The price is declared as inclusive of all taxes, in the prescribed form.", evidence: "MRP Rs 180.00 incl. of all taxes", provision: "Rule 2(m)", instrument: LMPC, severity: "major" },
      { id: "c8", fieldKey: "consumer_care", label: "Consumer care contact declared", status: "pass", detected: "1800-123-4567 · care@suryodaya.example", confidence: 95, requirement: "A contact for consumer complaints — telephone number, and e-mail address if available.", reason: "A consumer care contact is declared, including a telephone number and an e-mail address.", evidence: "Consumer care: 1800-123-4567", provision: "Rule 6(2)", instrument: LMPC, severity: "critical" },
      { id: "c9", fieldKey: "best_before", label: "Best before or use by date", status: "pass", detected: "11/2027", confidence: 93, requirement: "Where a commodity becomes unfit after a period, a best before or use by date must be declared.", reason: "A best before date is declared for this food article.", evidence: "Best before: 11/2027", provision: "Rule 6(1)(da)", instrument: LMPC, severity: "major" },
      { id: "c10", fieldKey: "country_of_origin", label: "Country of origin for imported packages", status: "not_applicable", detected: null, confidence: null, requirement: "The country of origin must be stated on an imported package.", reason: "Nothing on the label indicates an imported package, and this declaration is required only for imported products. It has therefore not been treated as a deficiency.", provision: "Rule 6(1)(aa)", instrument: LMPC, severity: "major" },
    ],
    rawText: "SURYODAYA\nRefined Sunflower Oil\nCommon name: Refined sunflower oil\nNet Qty: 1 L\nMRP Rs 180.00 incl. of all taxes\nUnit sale price: Rs 180.00 per L\nMfd. by: Suryodaya Foods Pvt Ltd\nPlot 18, Food Park, Nashik,\nMaharashtra - 422001\nConsumer care: 1800-123-4567\ncare@suryodaya.example\nMfg date: 05/2026\nBest before: 11/2027\nFSSAI Lic. No. 10019022001234",
  },

  /* -------------------------------------------------------- non-compliant */
  {
    id: "digestive-biscuits",
    scanId: "NIR-2026-00123",
    name: "Grainwell Digestive Biscuits",
    category: "Bakery",
    netQuantity: "200 g",
    gtin: "8904567891234",
    result: "non_compliant",
    score: 68,
    scannedAt: "2026-09-03T16:15:00+05:30",
    ocrConfidence: 91,
    labelLines: [
      "GRAINWELL",
      "Digestive Biscuits",
      "Common name: Wheat biscuits",
      "Net Qty: 200 g",
      "MRP Rs 50.00",
      "Mfd. by: Grainwell Foods Pvt Ltd",
      "123, Industrial Area,",
      "New Delhi - 110001",
      "Mfg date: 06/2026",
      "Best before: 12/2026",
      "FSSAI Lic. No. 10019022004567",
    ],
    quality: {
      score: 88,
      verdict: "good",
      proceed: true,
      metrics: [
        { key: "sharpness", label: "Sharpness", verdict: "good", detail: "Edges are crisp across the declaration panel." },
        { key: "brightness", label: "Brightness", verdict: "good", detail: "Well exposed with minor glare at the seal." },
        { key: "resolution", label: "Resolution", verdict: "good", detail: "1620 × 2160 px — sufficient for small print." },
        { key: "textVisibility", label: "Text Visibility", verdict: "marginal", detail: "Text structure is slightly reduced near the crimped edge." },
      ],
    },
    fields: [
      { key: "product_name", label: "Product Name", value: "Grainwell Digestive Biscuits", confidence: 94, status: "detected", evidence: "GRAINWELL Digestive Biscuits" },
      { key: "generic_name", label: "Common / Generic Name", value: "Wheat biscuits", confidence: 92, status: "detected", evidence: "Common name: Wheat biscuits" },
      { key: "mrp", label: "MRP", value: "₹50.00", confidence: 93, status: "detected", evidence: "MRP Rs 50.00" },
      { key: "net_quantity", label: "Net Quantity", value: "200 g", confidence: 94, status: "detected", evidence: "Net Qty: 200 g" },
      { key: "manufacturer", label: "Manufacturer", value: "Grainwell Foods Pvt Ltd", confidence: 91, status: "detected", evidence: "Mfd. by: Grainwell Foods Pvt Ltd" },
      { key: "address", label: "Manufacturer Address", value: "123, Industrial Area, New Delhi – 110001", confidence: 89, status: "detected", evidence: "123, Industrial Area, New Delhi - 110001" },
      { key: "consumer_care", label: "Consumer Care", value: null, confidence: null, status: "missing" },
      { key: "mfg_date", label: "Month & Year of Manufacture", value: "06/2026", confidence: 90, status: "detected", evidence: "Mfg date: 06/2026" },
      { key: "best_before", label: "Best Before", value: "12/2026", confidence: 88, status: "detected", evidence: "Best before: 12/2026" },
      { key: "unit_sale_price", label: "Unit Sale Price", value: null, confidence: null, status: "missing" },
      { key: "country_of_origin", label: "Country of Origin", value: null, confidence: null, status: "missing" },
    ],
    checks: [
      { id: "d1", fieldKey: "manufacturer", label: "Manufacturer, packer or importer declared", status: "pass", detected: "Grainwell Foods Pvt Ltd", confidence: 91, requirement: "The name of the manufacturer, packer or importer must be declared.", reason: "A responsible party is declared on the label as manufacturer.", evidence: "Mfd. by: Grainwell Foods Pvt Ltd", provision: "Rule 6(1)(a)", instrument: LMPC, severity: "critical" },
      { id: "d2", fieldKey: "address", label: "Address of the responsible party declared", status: "pass", detected: "New Delhi – 110001", confidence: 89, requirement: "A complete address for the responsible party must accompany the name.", reason: "An address including the postal code 110001 was found.", evidence: "123, Industrial Area, New Delhi - 110001", provision: "Rule 6(1)(a)", instrument: LMPC, severity: "critical" },
      { id: "d3", fieldKey: "generic_name", label: "Common or generic name declared", status: "pass", detected: "Wheat biscuits", confidence: 92, requirement: "The package must state the common or generic name of the commodity.", reason: "A common or generic name is declared.", evidence: "Common name: Wheat biscuits", provision: "Rule 6(1)(b)", instrument: LMPC, severity: "major" },
      { id: "d4", fieldKey: "net_quantity", label: "Net quantity in a standard unit", status: "pass", detected: "200 g", confidence: 94, requirement: "Net quantity must be declared in a standard unit of weight or measure.", reason: "Net quantity is declared as 200 g in a standard unit.", evidence: "Net Qty: 200 g", provision: "Rule 6(1)(c)", instrument: LMPC, severity: "critical" },
      { id: "d5", fieldKey: "mrp", label: "Retail sale price declared", status: "pass", detected: "₹50.00", confidence: 93, requirement: "The package must bear a declaration of the retail sale price.", reason: "A retail sale price of ₹50.00 is declared.", evidence: "MRP Rs 50.00", provision: "Rule 6(1)(e)", instrument: LMPC, severity: "critical" },
      { id: "d6", fieldKey: "mrp", label: "Price stated as inclusive of all taxes", status: "fail", detected: "MRP Rs 50.00", confidence: 93, requirement: "“MRP Rs <amount> incl. of all taxes”, or the equivalent full wording.", reason: "The price is declared without stating that it is inclusive of all taxes. Rule 2(m) prescribes the form “Maximum retail price Rs … inclusive of all taxes”. A bare price does not meet that form.", evidence: "MRP Rs 50.00", provision: "Rule 2(m)", instrument: LMPC, severity: "major" },
      { id: "d7", fieldKey: "consumer_care", label: "Consumer care contact declared", status: "fail", detected: null, confidence: null, requirement: "A contact for consumer complaints — telephone number, and e-mail address if available.", reason: "No consumer care contact could be found. No telephone number or e-mail address matching a complaints contact was detected on the label.", provision: "Rule 6(2)", instrument: LMPC, severity: "critical" },
      { id: "d8", fieldKey: "mfg_date", label: "Month and year of manufacture or packing", status: "pass", detected: "06/2026", confidence: 90, requirement: "The month and year of manufacture, pre-packing or import must be stated.", reason: "A date of manufacture is declared.", evidence: "Mfg date: 06/2026", provision: "Rule 6(1)(d)", instrument: LMPC, severity: "major" },
      { id: "d9", fieldKey: "best_before", label: "Best before or use by date", status: "pass", detected: "12/2026", confidence: 88, requirement: "Where a commodity becomes unfit after a period, a best before date must be declared.", reason: "A best before date is declared for this food article.", evidence: "Best before: 12/2026", provision: "Rule 6(1)(da)", instrument: LMPC, severity: "major" },
      { id: "d10", fieldKey: "unit_sale_price", label: "Unit sale price", status: "review", detected: null, confidence: null, requirement: "A price per unit of quantity, where the requirement applies to this package.", reason: "No unit sale price declaration was found. This requirement was introduced by amendment and its exact scope and exemptions are not verified in this rule pack, so it is reported for review rather than as a failure.", provision: "Rule 6(11)", instrument: LMPC, severity: "minor" },
      { id: "d11", fieldKey: "country_of_origin", label: "Country of origin for imported packages", status: "not_applicable", detected: null, confidence: null, requirement: "The country of origin must be stated on an imported package.", reason: "Nothing on the label indicates an imported package, so this declaration has not been treated as a deficiency.", provision: "Rule 6(1)(aa)", instrument: LMPC, severity: "major" },
    ],
    rawText: "GRAINWELL\nDigestive Biscuits\nCommon name: Wheat biscuits\nNet Qty: 200 g\nMRP Rs 50.00\nMfd. by: Grainwell Foods Pvt Ltd\n123, Industrial Area,\nNew Delhi - 110001\nMfg date: 06/2026\nBest before: 12/2026\nFSSAI Lic. No. 10019022004567",
  },

  /* --------------------------------------------------------- needs review */
  {
    id: "herbal-shampoo",
    scanId: "NIR-2026-00122",
    name: "Vanaspati Herbal Shampoo",
    category: "Personal care",
    netQuantity: "180 ml",
    gtin: "5012345678900",
    result: "needs_review",
    score: 79,
    scannedAt: "2026-09-02T11:10:00+05:30",
    ocrConfidence: 61,
    labelLines: [
      "VANASPATI HERBAL",
      "Nourishing Shampoo",
      "Net Qty: 180 ml",
      "MRP Rs 245.00 incl. of all taxes",
      "Imported by: Meridian Trading Co Pvt Ltd",
      "19 Marine Lines, Mumbai,",
      "Maharashtra - 400020",
      "Consumer care: 1800-222-8899",
      "Mfg date: 02/2026",
    ],
    quality: {
      score: 61,
      verdict: "marginal",
      proceed: true,
      note: "Recognition confidence on this image is low. Several values should be confirmed by a person before the result is relied on.",
      metrics: [
        { key: "sharpness", label: "Sharpness", verdict: "marginal", detail: "Edges are soft; fine print may be misread." },
        { key: "brightness", label: "Brightness", verdict: "marginal", detail: "Glare across the upper third of the bottle." },
        { key: "resolution", label: "Resolution", verdict: "good", detail: "1440 × 1920 px — adequate for the declaration panel." },
        { key: "textVisibility", label: "Text Visibility", verdict: "marginal", detail: "Curved surface reduces legible text structure." },
      ],
    },
    fields: [
      { key: "product_name", label: "Product Name", value: "Vanaspati Herbal Nourishing Shampoo", confidence: 72, status: "needs_review", evidence: "VANASPATI HERBAL Nourishing Shampoo" },
      { key: "generic_name", label: "Common / Generic Name", value: null, confidence: null, status: "missing" },
      { key: "mrp", label: "MRP", value: "₹245.00 inclusive of all taxes", confidence: 66, status: "needs_review", evidence: "MRP Rs 245.00 incl. of all taxes" },
      { key: "net_quantity", label: "Net Quantity", value: "180 ml", confidence: 71, status: "needs_review", evidence: "Net Qty: 180 ml" },
      { key: "manufacturer", label: "Importer", value: "Meridian Trading Co Pvt Ltd", confidence: 58, status: "needs_review", evidence: "Imported by: Meridian Trading Co Pvt Ltd" },
      { key: "address", label: "Importer Address", value: "19 Marine Lines, Mumbai, Maharashtra – 400020", confidence: 54, status: "needs_review", evidence: "19 Marine Lines, Mumbai, Maharashtra - 400020" },
      { key: "consumer_care", label: "Consumer Care", value: "1800-222-8899", confidence: 63, status: "needs_review", evidence: "Consumer care: 1800-222-8899" },
      { key: "country_of_origin", label: "Country of Origin", value: null, confidence: null, status: "missing" },
      { key: "mfg_date", label: "Month & Year of Manufacture", value: "02/2026", confidence: 69, status: "needs_review", evidence: "Mfg date: 02/2026" },
    ],
    checks: [
      { id: "s1", fieldKey: "manufacturer", label: "Manufacturer, packer or importer declared", status: "pass", detected: "Meridian Trading Co Pvt Ltd (importer)", confidence: 58, requirement: "For an imported package, the name of the importer must be declared.", reason: "A responsible party is declared on the label as importer.", evidence: "Imported by: Meridian Trading Co Pvt Ltd", provision: "Rule 6(1)(a)", instrument: LMPC, severity: "critical" },
      { id: "s2", fieldKey: "address", label: "Address of the responsible party declared", status: "review", detected: "Mumbai, Maharashtra – 400020", confidence: 54, requirement: "A complete address for the responsible party must accompany the name.", reason: "An address was found, but it was read at only 54% confidence — too low to rely on without a person confirming it.", evidence: "19 Marine Lines, Mumbai, Maharashtra - 400020", provision: "Rule 6(1)(a)", instrument: LMPC, severity: "critical" },
      { id: "s3", fieldKey: "generic_name", label: "Common or generic name declared", status: "review", detected: null, confidence: null, requirement: "The package must state the common or generic name of the commodity.", reason: "No explicitly labelled common or generic name was found. A brand name alone does not satisfy this requirement, but the generic name may be printed without a label the extractor can anchor to.", provision: "Rule 6(1)(b)", instrument: LMPC, severity: "major" },
      { id: "s4", fieldKey: "net_quantity", label: "Net quantity in a standard unit", status: "pass", detected: "180 ml", confidence: 71, requirement: "Net quantity must be declared in a standard unit of weight or measure.", reason: "Net quantity is declared as 180 ml in a standard unit.", evidence: "Net Qty: 180 ml", provision: "Rule 6(1)(c)", instrument: LMPC, severity: "critical" },
      { id: "s5", fieldKey: "mrp", label: "Price stated as inclusive of all taxes", status: "pass", detected: "MRP Rs 245.00 incl. of all taxes", confidence: 66, requirement: "The retail sale price must state that it is inclusive of all taxes.", reason: "The price is declared as inclusive of all taxes, in the prescribed form.", evidence: "MRP Rs 245.00 incl. of all taxes", provision: "Rule 2(m)", instrument: LMPC, severity: "major" },
      { id: "s6", fieldKey: "consumer_care", label: "Consumer care contact declared", status: "pass", detected: "1800-222-8899", confidence: 63, requirement: "A contact for consumer complaints must be declared.", reason: "A consumer care telephone number is declared.", evidence: "Consumer care: 1800-222-8899", provision: "Rule 6(2)", instrument: LMPC, severity: "critical" },
      { id: "s7", fieldKey: "country_of_origin", label: "Country of origin for imported packages", status: "review", detected: null, confidence: null, requirement: "The country of origin, manufacture or assembly must be stated on an imported package.", reason: "The label indicates an imported package, and no country of origin was found — but recognition confidence across this image was only 61%, which is too low to conclude the declaration is absent rather than unread.", provision: "Rule 6(1)(aa)", instrument: LMPC, severity: "major" },
      { id: "s8", fieldKey: "mfg_date", label: "Month and year of manufacture or import", status: "pass", detected: "02/2026", confidence: 69, requirement: "The month and year of manufacture, pre-packing or import must be stated.", reason: "A date is declared.", evidence: "Mfg date: 02/2026", provision: "Rule 6(1)(d)", instrument: LMPC, severity: "major" },
      { id: "s9", fieldKey: "best_before", label: "Best before or use by date", status: "not_applicable", detected: null, confidence: null, requirement: "Applies to commodities that become unfit for consumption after a period.", reason: "No perishable-commodity indicators were found, so this declaration has not been treated as a deficiency.", provision: "Rule 6(1)(da)", instrument: LMPC, severity: "major" },
    ],
    rawText: "VANASPATI HERBAL\nNourishing Shampoo\nNet Qty: 180 ml\nMRP Rs 245.00 incl. of all taxes\nImported by: Meridian Trading Co Pvt Ltd\n19 Marine Lines, Mumbai,\nMaharashtra - 400020\nConsumer care: 1800-222-8899\nMfg date: 02/2026",
  },
];

export const getDemoProduct = (id: string) => DEMO_PRODUCTS.find((p) => p.id === id) ?? null;
export const getDemoProductByScanId = (scanId: string) =>
  DEMO_PRODUCTS.find((p) => p.scanId === scanId) ?? null;
