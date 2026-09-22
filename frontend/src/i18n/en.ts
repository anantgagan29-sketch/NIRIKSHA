/**
 * The English interface, and the shape every other language fills in.
 *
 * Keys are grouped by where they appear, so a translator can work through one
 * screen at a time rather than a flat alphabetical list. Technical terms that
 * are not translated anywhere in Indian practice — NIRIKSHA, OCR, MRP, GTIN,
 * EAN-13, Legal Metrology — stay as they are inside the sentences around them.
 */

export const EN = {
  /* ---------------------------------------------------------- navigation */
  "nav.dashboard": "Dashboard",
  "nav.inspect": "Inspect Product",
  "nav.history": "Scan History",
  "nav.listing": "Listing Check",
  "nav.complaints": "Complaints",
  "nav.reports": "Reports",
  "nav.howItWorks": "How It Works",
  "nav.admin": "Authority Console",
  "nav.settings": "Settings",

  /* --------------------------------------------------------------- brand */
  "brand.tagline": "Smart Compliance. Safer India.",

  /* -------------------------------------------------------------- topbar */
  "search.placeholder": "Search anything…",
  "topbar.notifications": "Notifications",
  "topbar.language": "Change language",
  "topbar.languageCurrent": "Current language",
  "topbar.theme": "Switch theme",
  "topbar.accessibility": "Accessibility",
  "topbar.signIn": "Sign in",
  "topbar.signOut": "Sign out",
  "topbar.help": "Need help?",
  "topbar.helpLine": "Consumer helpline",

  /* ------------------------------------------------------ language panel */
  "language.title": "Change language",
  "language.available": "Available now",
  "language.more": "More languages",
  "language.comingSoon": "Coming soon",
  "language.comingSoonNote":
    "A translation for this language has not been written yet, so the interface stays in {current}.",
  "language.active": "Active",

  /* --------------------------------------------------------------- hero */
  "hero.title1": "Smart Compliance.",
  "hero.title2": "Safer Products.",
  "hero.lede": "AI-powered verification of packaged commodity declarations.",
  "hero.body":
    "Scan a product label, extract mandatory information, validate applicable Legal Metrology requirements, and identify potential compliance issues.",
  "hero.cta": "Inspect a Product",
  "hero.secondary": "How NIRIKSHA Works",

  /* ------------------------------------------------------------- common */
  "common.close": "Close",
  "common.cancel": "Cancel",
  "common.continue": "Continue",
  "common.back": "Back",
  "common.retry": "Try again",
  "common.view": "View",
  "common.viewAll": "View all",
  "common.download": "Download",
  "common.print": "Print",
  "common.share": "Share",
  "common.loading": "Loading…",
  "common.search": "Search",
  "common.clear": "Clear",
  "common.startAgain": "Start again",
  "common.notDetected": "Not detected",
  "common.confidence": "confidence",
  "common.of": "of",

  /* -------------------------------------------------------------- status */
  "status.compliant": "Compliant",
  "status.needsReview": "Needs Review",
  "status.nonCompliant": "Non-Compliant",
  "status.pass": "Passed",
  "status.fail": "Failed",
  "status.review": "Needs review",
  "status.notApplicable": "Not applicable",
  "status.retakeRequired": "Retake required",
  "status.detected": "Detected",
  "status.pending": "Pending",
  "status.processing": "Processing",
  "status.complete": "Completed",
  "status.completeWithWarnings": "Completed with warnings",

  /* ----------------------------------------------------------- dashboard */
  "dashboard.eyebrow": "Overview",
  "dashboard.inspectCard": "Inspect a Packaged Commodity",
  "dashboard.imageQuality": "Image Quality",
  "dashboard.processing": "Processing",
  "dashboard.complianceAnalysis": "Compliance Analysis",
  "dashboard.recentScans": "Recent scans",
  "dashboard.totalScans": "Total scans",
  "dashboard.noScans": "No scans yet",

  "dashboard.nonCompliantExample": "Non-Compliant Example",
  "dashboard.complianceReport": "Compliance Report",
  "dashboard.citizenComplaint": "Citizen Complaint",
  "dashboard.overview": "Dashboard Overview",
  "scanResult.title": "Extracted Information",
  "scanResult.pipeline": "Pipeline",

  /* ------------------------------------------------------------- inspect */
  "inspect.eyebrow": "Inspection workspace",
  "inspect.title": "Inspect a Product",
  "inspect.description":
    "Capture or upload the face of the package carrying the declarations. The image is measured for readability before any text is read from it.",
  "inspect.captureOrUpload": "Capture or upload",
  "inspect.uploadTitle": "Upload a product label",
  "inspect.uploadHint": "or capture an image of the declaration panel",
  "inspect.uploadImage": "Upload Image",
  "inspect.useCamera": "Use Camera",
  "inspect.scanBarcode": "Scan Barcode / GTIN",
  "inspect.or": "OR",
  "inspect.formats": "Supported formats: JPG · PNG · WEBP",
  "inspect.sampleProducts": "Sample products",
  "inspect.pipeline": "Inspection Pipeline",
  "inspect.recognitionLanguage": "Recognition language",
  "inspect.betterPhoto": "How to take a better photo",
  "inspect.couldNotComplete": "Could not complete",
  "inspect.assessmentComplete": "Assessment complete",
  "inspect.yourImage": "Your image",
  "inspect.liveImage": "Live image",
  "inspect.differentImage": "Use a different image",
  "inspect.continueToOcr": "Continue to OCR",
  "inspect.viewExtracted": "View Extracted Information",
  "inspect.runCompliance": "Run Compliance Analysis",
  "inspect.barcodeRecorded":
    "recorded — photograph the declaration panel to assess compliance",

  /* -------------------------------------------------------------- camera */
  "camera.title": "Capture the label",
  "camera.instruction":
    "Position the product label inside the frame. The declarations are usually on the back or side of the pack.",
  "camera.starting": "Starting the camera…",
  "camera.capture": "Capture",
  "camera.retake": "Retake",
  "camera.usePhoto": "Use Photo",
  "camera.light": "Light",
  "camera.lightOff": "Light off",
  "camera.switch": "Switch camera",
  "camera.uploadInstead": "Upload Image instead",

  /* ------------------------------------------------------------- barcode */
  "barcode.title": "Scan barcode / GTIN",
  "barcode.instruction": "Align the barcode inside the frame. It is read automatically.",
  "barcode.detected": "Barcode detected",
  "barcode.continueInspection": "Continue Inspection",
  "barcode.scanAgain": "Scan Again",
  "barcode.manual": "Enter Barcode Manually",
  "barcode.manualShort": "Enter barcode manually",
  "barcode.manualHint": "Type the number printed beneath the barcode. It is checked before it is used.",
  "barcode.manualLabel": "Barcode number",
  "barcode.useThis": "Use this barcode",
  "barcode.backToScanning": "Back to scanning",
  "barcode.lookupUnavailable":
    "Product lookup is unavailable. You can continue with image inspection.",
  "barcode.notACompliance":
    "A barcode identifies a product; it says nothing about whether the pack carries its required declarations. Compliance is assessed from the packaging itself in the next step.",

  /* ---------------------------------------------------------- compliance */
  "compliance.title": "Compliance Analysis",
  "compliance.description":
    "Each applicable requirement, the outcome, and the reasoning behind it. Select any check to open its full evidence.",
  "compliance.allChecks": "All checks",
  "compliance.evidenceImage": "Evidence image",
  "compliance.classification": "How this package was classified",
  "compliance.viewReport": "View Report",
  "compliance.reportProduct": "Report Product",
  "compliance.score": "Assessment score",
  "compliance.extractedInfo": "Extracted Information",
  "compliance.requirement": "Requirement",
  "compliance.finding": "Finding",

  /* ------------------------------------------------------------- history */
  "history.eyebrow": "Scan history",
  "history.title": "Inspection History",
  "history.description":
    "Every product inspected on this device, with its assessment outcome and reference.",
  "history.scans": "Scans",
  "history.empty": "No scans yet",
  "history.product": "Product",
  "history.result": "Result",
  "history.when": "When",
  "history.reference": "Reference",
  "history.allTime": "All time",
  "history.lastWeek": "Last 7 days",
  "history.lastMonth": "Last 30 days",

  /* ---------------------------------------------------------- complaints */
  "complaints.title": "Complaints",
  "complaints.submit": "Submit Complaint",
  "complaints.useLocation": "Use my location",
  "complaints.description": "Complaint description",
  "complaints.empty": "No complaints have been raised yet",

  "complaints.eyebrow": "Citizen complaint",
  "complaints.reportTitle": "Report a Potential Violation",
  "complaints.reportDescription":
    "Raise a complaint against an assessment. The label image and the compliance findings are attached automatically.",
  "complaints.details": "Complaint details",
  "complaints.findingsAttached": "Findings attached",
  "complaints.recent": "Your recent complaints",
  "complaints.none": "No complaints yet",
  "howItWorks.eyebrow": "How NIRIKSHA works",
  "howItWorks.title": "Five stages, each answering the one before it",
  "howItWorks.description":
    "A photograph is not evidence until it has been checked, read, understood, and tested against the requirements that actually govern that package.",

  /* ------------------------------------------------------------- reports */
  "reports.eyebrow": "Compliance report",
  "reports.title": "Product Compliance Report",
  "reports.description":
    "A shareable assessment carrying every field check, its reason and the provision it cites.",
  "reports.downloadPdf": "Download PDF",
  "reports.preparing": "Preparing…",

  /* ------------------------------------------------------------ settings */
  "settings.eyebrow": "Settings",
  "settings.title": "Preferences",
  "settings.description": "These apply to this device and are remembered between visits.",
  "settings.language": "Language",
  "settings.appearance": "Appearance",
  "settings.accessibility": "Accessibility",
  "settings.account": "Account",
  "settings.dataSource": "Data source",

  /* --------------------------------------------------------- authority */
  "admin.eyebrow": "Authority console",
  "admin.title": "NIRIKSHA Authority Console",
  "admin.queue": "Complaint queue",
  "admin.review": "Complaint review",

  /* --------------------------------------------------------------- auth */
  "auth.signIn": "Sign in",
  "auth.signUp": "Create account",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.forgot": "Forgot password?",

  /* ------------------------------------------------------------- errors */
  "error.generic": "Something went wrong. Please try again.",
  "error.notFound": "That page could not be found.",
  "error.offline": "Could not reach the NIRIKSHA server.",

  /* ------------------------------------------------------------- report */
  "report.masthead": "Automated compliance assessment for packaged commodities",
  "report.assessment": "Assessment",
  "report.scanReference": "Scan reference",
  "report.assessed": "Assessed",
  "report.product": "Product",
  "report.netQuantity": "Net quantity",
  "report.score": "score",
  "report.productImage": "Product image",
  "report.imageUnavailable": "Product image unavailable — it could not be embedded.",
  "report.declarations": "Declarations read from the label",
  "report.requirements": "Requirements assessed",
  "report.lettering": "Font / lettering compliance",
  "report.scope": "Scope of this assessment",
  "report.selectedChecks": "Selected checks",
  "report.selectedNote": "This assessment covers the declarations listed above. Requirements outside them were not assessed here and no conclusion about them should be drawn from this document.",
  "report.outsideSelection": "Outside the selected checks, the reading also found {n} issue(s). They are recorded in the full assessment for this scan.",
  "report.requirement": "Requirement",
  "report.finding": "Finding",
  "report.detected": "Detected",
  "report.readAt": "read at {n}% confidence",
  "report.notDetected": "Not detected",
  "report.language": "Report language",
  "report.compliant": "Compliant",
  "report.nonCompliant": "Non-compliant",
  "report.needsReview": "Review required",
  "report.pass": "PASS",
  "report.fail": "FAIL",
  "report.review": "REVIEW",
  "report.notApplicable": "NOT APPLICABLE",

  /* pipeline — the six stages of an inspection */
  "pipeline.quality.title": "Image Quality",
  "pipeline.vision.title": "Computer Vision",
  "pipeline.ocr.title": "OCR Extraction",
  "pipeline.fields.title": "Field Extraction",
  "pipeline.rules.title": "Rule Validation",
  "pipeline.result.title": "Compliance Result",
  "pipeline.quality.description": "Sharpness, brightness, resolution and text visibility measured before anything is read.",
  "pipeline.vision.description": "The label surface is located and the regions carrying declarations are isolated.",
  "pipeline.ocr.description": "Text recognised with a confidence value for every word. Raw output is preserved.",
  "pipeline.fields.description": "Free text becomes structured declarations, each keeping the evidence it came from.",
  "pipeline.rules.description": "Only the requirements that apply to this package are selected and tested.",
  "pipeline.result.description": "Field outcomes combined into an assessment, with the reason for each.",
  "inspect.sampleNote": "Each sample carries a real declaration set and runs through every stage of the workspace. They are demonstration products, not real commodities.",

  /* reportPage — the on-screen report */
  "reportPage.scanId": "Scan ID",
  "reportPage.overallResult": "Overall result",
  "reportPage.scannedProduct": "Scanned product",
  "reportPage.fieldChecks": "Field checks",
  "reportPage.provision": "Provision",
  "reportPage.recognisedText": "Recognised text",
  "reportPage.modelReturned": "What the model returned",
  "reportPage.whatThisIs": "What this report is",

  /* reportDialog — choosing the language a report is written in */
  "reportDialog.title": "Choose report language",
  "reportDialog.hint": "Select the language for your report. It does not have to match the language of this screen.",
  "reportDialog.generate": "Generate report",
  "reportDialog.current": "Interface language",
  "history.reportLanguage": "Report language",
  "history.allLanguages": "All languages",
  "history.notGenerated": "Not generated",
  "report.generating": "Generating your {language} report…",

  /* field — declaration names, as read from a label */
  "field.product_name": "Product Name",
  "field.brand": "Brand",
  "field.mrp": "MRP",
  "field.net_quantity": "Net Quantity",
  "field.unit_sale_price": "Unit Sale Price",
  "field.manufacturer": "Manufacturer",
  "field.packer": "Packer",
  "field.address": "Address",
  "field.consumer_care_phone": "Consumer Care — Phone",
  "field.consumer_care_email": "Consumer Care — Email",
  "field.manufacturing_date": "Manufacturing Date",
  "field.packing_date": "Packing Date",
  "field.expiry_date": "Expiry / Use By",
  "field.best_before": "Best Before",
  "field.shelf_life": "Shelf Life",
  "field.batch_number": "Batch Number",
  "field.license_number": "Licence Number",
  "field.country_of_origin": "Country of Origin",
  "field.other": "Other Declaration",
  /* check — the requirements the assessment applies */
  "check.manufacturer_or_packer": "Manufacturer, packer or importer declared",
  "check.generic_product_name": "Common or generic name declared",
  "check.net_quantity": "Net quantity declared",
  "check.mrp": "Retail sale price declared",
  "check.consumer_care_details": "Consumer care contact declared",
  "check.manufacturing_date": "Month and year of manufacture or packing",
  "check.best_before_or_use_by": "Best before or use by date",
  "check.batch_number": "Batch or lot number",
  "check.country_of_origin": "Country of origin",
  "check.unit_sale_price": "Unit sale price declared",
  "check.unit_price_consistency": "Unit sale price consistent with MRP and quantity",
  "check.font_size_readability": "Declarations legible at the required size",
  "check.misleading_declarations": "No misleading declarations detected",
  "check.non_standard_declarations": "No non-standard declaration formats detected",
  "check.dimensions": "Dimensions of the commodity",

  /* -------------------------------------------------------------- notice */
  "notice.assessment":
    "NIRIKSHA performs an automated compliance assessment from an image. It is a decision-support tool, not a substitute for statutory inspection, and it is not a government certification.",
} as const;

export type TranslationKey = keyof typeof EN;
