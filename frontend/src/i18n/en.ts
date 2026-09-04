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

  /* -------------------------------------------------------------- notice */
  "notice.assessment":
    "NIRIKSHA performs an automated compliance assessment from an image. It is a decision-support tool, not a substitute for statutory inspection, and it is not a government certification.",
} as const;

export type TranslationKey = keyof typeof EN;
