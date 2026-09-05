import type { EN } from "./en";

/**
 * The Hindi interface.
 *
 * Written as an Indian regulatory application would speak, not as a
 * word-for-word rendering of the English. Terms that Indian practice keeps in
 * English or in their abbreviated form — NIRIKSHA, OCR, MRP, GTIN, EAN-13, AI,
 * PDF — are left as they are, because translating them would make the
 * interface harder to read for exactly the people who use it. "Legal
 * Metrology" appears as विधिक माप विज्ञान, which is the statute's own Hindi
 * name.
 *
 * Typed as a partial of the English keys: anything not yet translated falls
 * back to English rather than showing a key name to a user.
 */
export const HI: Partial<Record<keyof typeof EN, string>> = {
  /* ---------------------------------------------------------- navigation */
  "nav.dashboard": "डैशबोर्ड",
  "nav.inspect": "उत्पाद जाँच",
  "nav.history": "स्कैन इतिहास",
  "nav.listing": "लिस्टिंग जाँच",
  "nav.complaints": "शिकायतें",
  "nav.reports": "रिपोर्ट",
  "nav.howItWorks": "यह कैसे काम करता है",
  "nav.admin": "प्राधिकरण कंसोल",
  "nav.settings": "सेटिंग्स",

  /* --------------------------------------------------------------- brand */
  "brand.tagline": "स्मार्ट अनुपालन। सुरक्षित भारत।",

  /* -------------------------------------------------------------- topbar */
  "search.placeholder": "कुछ भी खोजें…",
  "topbar.notifications": "सूचनाएँ",
  "topbar.language": "भाषा बदलें",
  "topbar.languageCurrent": "वर्तमान भाषा",
  "topbar.theme": "थीम बदलें",
  "topbar.accessibility": "सुगम्यता",
  "topbar.signIn": "साइन इन करें",
  "topbar.signOut": "साइन आउट करें",
  "topbar.help": "सहायता चाहिए?",
  "topbar.helpLine": "उपभोक्ता हेल्पलाइन",

  /* ------------------------------------------------------ language panel */
  "language.title": "भाषा बदलें",
  "language.available": "अभी उपलब्ध",
  "language.more": "अन्य भाषाएँ",
  "language.comingSoon": "जल्द आ रहा है",
  "language.comingSoonNote":
    "इस भाषा का अनुवाद अभी तैयार नहीं हुआ है, इसलिए इंटरफ़ेस {current} में ही रहेगा।",
  "language.active": "सक्रिय",

  /* --------------------------------------------------------------- hero */
  "hero.title1": "स्मार्ट अनुपालन।",
  "hero.title2": "सुरक्षित उत्पाद।",
  "hero.lede": "पैकेज्ड वस्तुओं की घोषणाओं का AI-आधारित सत्यापन।",
  "hero.body":
    "उत्पाद लेबल स्कैन करें, अनिवार्य जानकारी निकालें, लागू विधिक माप विज्ञान आवश्यकताओं की जाँच करें, और संभावित अनुपालन समस्याएँ पहचानें।",
  "hero.cta": "उत्पाद की जाँच करें",
  "hero.secondary": "NIRIKSHA कैसे काम करता है",

  /* ------------------------------------------------------------- common */
  "common.close": "बंद करें",
  "common.cancel": "रद्द करें",
  "common.continue": "आगे बढ़ें",
  "common.back": "वापस",
  "common.retry": "पुनः प्रयास करें",
  "common.view": "देखें",
  "common.viewAll": "सभी देखें",
  "common.download": "डाउनलोड करें",
  "common.print": "प्रिंट करें",
  "common.share": "साझा करें",
  "common.loading": "लोड हो रहा है…",
  "common.search": "खोजें",
  "common.clear": "हटाएँ",
  "common.startAgain": "फिर से शुरू करें",
  "common.notDetected": "नहीं मिला",
  "common.confidence": "विश्वसनीयता",
  "common.of": "में से",

  /* -------------------------------------------------------------- status */
  "status.compliant": "अनुपालन में",
  "status.needsReview": "समीक्षा आवश्यक",
  "status.nonCompliant": "अनुपालन में नहीं",
  "status.pass": "उत्तीर्ण",
  "status.fail": "अनुत्तीर्ण",
  "status.review": "समीक्षा आवश्यक",
  "status.notApplicable": "लागू नहीं",
  "status.detected": "पाया गया",
  "status.pending": "प्रतीक्षारत",
  "status.processing": "प्रक्रिया जारी",
  "status.complete": "पूर्ण",
  "status.completeWithWarnings": "चेतावनियों के साथ पूर्ण",

  /* ----------------------------------------------------------- dashboard */
  "dashboard.eyebrow": "अवलोकन",
  "dashboard.inspectCard": "पैकेज्ड कमोडिटी का निरीक्षण करें",
  "dashboard.imageQuality": "छवि गुणवत्ता",
  "dashboard.processing": "प्रक्रिया",
  "dashboard.complianceAnalysis": "अनुपालन विश्लेषण",
  "dashboard.recentScans": "हाल के स्कैन",
  "dashboard.totalScans": "कुल स्कैन",
  "dashboard.noScans": "अभी कोई स्कैन नहीं",

  "dashboard.nonCompliantExample": "अनुपालन में न होने का उदाहरण",
  "dashboard.complianceReport": "अनुपालन रिपोर्ट",
  "dashboard.citizenComplaint": "नागरिक शिकायत",
  "dashboard.overview": "डैशबोर्ड अवलोकन",
  "scanResult.title": "निकाली गई जानकारी",
  "scanResult.pipeline": "प्रक्रिया",

  /* ------------------------------------------------------------- inspect */
  "inspect.eyebrow": "निरीक्षण कार्यक्षेत्र",
  "inspect.title": "उत्पाद की जाँच करें",
  "inspect.description":
    "पैकेज का वह हिस्सा कैप्चर या अपलोड करें जिस पर घोषणाएँ छपी हैं। पाठ पढ़ने से पहले छवि की पठनीयता जाँची जाती है।",
  "inspect.captureOrUpload": "कैप्चर या अपलोड करें",
  "inspect.uploadTitle": "उत्पाद का लेबल अपलोड करें",
  "inspect.uploadHint": "या घोषणा पैनल की तस्वीर लें",
  "inspect.uploadImage": "छवि अपलोड करें",
  "inspect.useCamera": "कैमरा इस्तेमाल करें",
  "inspect.scanBarcode": "बारकोड / GTIN स्कैन करें",
  "inspect.or": "या",
  "inspect.formats": "समर्थित फ़ॉर्मैट: JPG · PNG · WEBP",
  "inspect.sampleProducts": "नमूना उत्पाद",
  "inspect.pipeline": "निरीक्षण प्रक्रिया",
  "inspect.recognitionLanguage": "पहचान की भाषा",
  "inspect.betterPhoto": "बेहतर तस्वीर कैसे लें",
  "inspect.couldNotComplete": "पूरा नहीं हो सका",
  "inspect.assessmentComplete": "मूल्यांकन पूर्ण",
  "inspect.yourImage": "आपकी छवि",
  "inspect.liveImage": "लाइव छवि",
  "inspect.differentImage": "दूसरी छवि इस्तेमाल करें",
  "inspect.continueToOcr": "OCR की ओर बढ़ें",
  "inspect.viewExtracted": "निकाली गई जानकारी देखें",
  "inspect.runCompliance": "अनुपालन विश्लेषण चलाएँ",
  "inspect.barcodeRecorded":
    "दर्ज किया गया — अनुपालन जाँचने के लिए घोषणा पैनल की तस्वीर लें",

  /* -------------------------------------------------------------- camera */
  "camera.title": "लेबल कैप्चर करें",
  "camera.instruction":
    "उत्पाद के लेबल को फ़्रेम के भीतर रखें। घोषणाएँ आमतौर पर पैक के पीछे या बगल में होती हैं।",
  "camera.starting": "कैमरा शुरू हो रहा है…",
  "camera.capture": "कैप्चर करें",
  "camera.retake": "दोबारा लें",
  "camera.usePhoto": "यह तस्वीर इस्तेमाल करें",
  "camera.switch": "कैमरा बदलें",
  "camera.uploadInstead": "इसके बजाय छवि अपलोड करें",

  /* ------------------------------------------------------------- barcode */
  "barcode.title": "बारकोड / GTIN स्कैन करें",
  "barcode.instruction": "बारकोड को फ़्रेम के भीतर रखें। यह अपने आप पढ़ा जाएगा।",
  "barcode.detected": "बारकोड मिला",
  "barcode.continueInspection": "निरीक्षण जारी रखें",
  "barcode.scanAgain": "दोबारा स्कैन करें",
  "barcode.manual": "बारकोड मैन्युअल रूप से दर्ज करें",
  "barcode.manualShort": "बारकोड मैन्युअल रूप से दर्ज करें",
  "barcode.manualHint":
    "बारकोड के नीचे छपा नंबर टाइप करें। इस्तेमाल से पहले इसकी जाँच की जाती है।",
  "barcode.manualLabel": "बारकोड नंबर",
  "barcode.useThis": "यह बारकोड इस्तेमाल करें",
  "barcode.backToScanning": "स्कैनिंग पर वापस जाएँ",
  "barcode.lookupUnavailable":
    "उत्पाद खोज उपलब्ध नहीं है। आप छवि से निरीक्षण जारी रख सकते हैं।",
  "barcode.notACompliance":
    "बारकोड उत्पाद की पहचान बताता है; यह नहीं बताता कि पैक पर आवश्यक घोषणाएँ हैं या नहीं। अनुपालन का आकलन अगले चरण में पैकेजिंग से ही किया जाता है।",

  /* ---------------------------------------------------------- compliance */
  "compliance.title": "अनुपालन विश्लेषण",
  "compliance.description":
    "प्रत्येक लागू आवश्यकता, उसका परिणाम, और उसके पीछे का कारण। पूरा प्रमाण देखने के लिए कोई भी जाँच चुनें।",
  "compliance.allChecks": "सभी जाँच देखें",
  "compliance.evidenceImage": "प्रमाण छवि",
  "compliance.classification": "इस पैकेज का वर्गीकरण कैसे हुआ",
  "compliance.viewReport": "रिपोर्ट देखें",
  "compliance.reportProduct": "उत्पाद की शिकायत करें",
  "compliance.score": "मूल्यांकन स्कोर",
  "compliance.extractedInfo": "निकाली गई जानकारी",
  "compliance.requirement": "आवश्यकता",
  "compliance.finding": "निष्कर्ष",

  /* ------------------------------------------------------------- history */
  "history.eyebrow": "स्कैन इतिहास",
  "history.title": "निरीक्षण इतिहास",
  "history.description":
    "इस डिवाइस पर जाँचा गया हर उत्पाद, उसके मूल्यांकन परिणाम और संदर्भ संख्या के साथ।",
  "history.scans": "स्कैन",
  "history.empty": "अभी कोई स्कैन नहीं",
  "history.product": "उत्पाद",
  "history.result": "परिणाम",
  "history.when": "कब",
  "history.reference": "संदर्भ",
  "history.allTime": "सभी समय",
  "history.lastWeek": "पिछले 7 दिन",
  "history.lastMonth": "पिछले 30 दिन",

  /* ---------------------------------------------------------- complaints */
  "complaints.title": "शिकायतें",
  "complaints.submit": "शिकायत दर्ज करें",
  "complaints.useLocation": "मेरा स्थान इस्तेमाल करें",
  "complaints.description": "शिकायत का विवरण",
  "complaints.empty": "अभी तक कोई शिकायत दर्ज नहीं हुई",

  "complaints.eyebrow": "नागरिक शिकायत",
  "complaints.reportTitle": "संभावित उल्लंघन की शिकायत करें",
  "complaints.reportDescription":
    "किसी मूल्यांकन के विरुद्ध शिकायत दर्ज करें। लेबल की छवि और अनुपालन निष्कर्ष अपने आप संलग्न हो जाते हैं।",
  "complaints.details": "शिकायत का विवरण",
  "complaints.findingsAttached": "संलग्न निष्कर्ष",
  "complaints.recent": "आपकी हाल की शिकायतें",
  "complaints.none": "अभी कोई शिकायत नहीं",
  "howItWorks.eyebrow": "NIRIKSHA कैसे काम करता है",
  "howItWorks.title": "पाँच चरण, हर एक पिछले का उत्तर देता हुआ",
  "howItWorks.description":
    "एक तस्वीर तब तक प्रमाण नहीं है जब तक उसे जाँचा, पढ़ा, समझा और उन आवश्यकताओं पर परखा न जाए जो वास्तव में उस पैकेज पर लागू होती हैं।",

  /* ------------------------------------------------------------- reports */
  "reports.eyebrow": "अनुपालन रिपोर्ट",
  "reports.title": "उत्पाद अनुपालन रिपोर्ट",
  "reports.description":
    "एक साझा करने योग्य मूल्यांकन, जिसमें हर जाँच, उसका कारण और उससे जुड़ा प्रावधान शामिल है।",
  "reports.downloadPdf": "PDF डाउनलोड करें",
  "reports.preparing": "तैयार हो रहा है…",

  /* ------------------------------------------------------------ settings */
  "settings.eyebrow": "सेटिंग्स",
  "settings.title": "प्राथमिकताएँ",
  "settings.description": "ये इस डिवाइस पर लागू होती हैं और अगली बार भी याद रहती हैं।",
  "settings.language": "भाषा",
  "settings.appearance": "रूप-रंग",
  "settings.accessibility": "सुगम्यता",
  "settings.account": "खाता",
  "settings.dataSource": "डेटा स्रोत",

  /* --------------------------------------------------------- authority */
  "admin.eyebrow": "प्राधिकरण कंसोल",
  "admin.title": "NIRIKSHA प्राधिकरण कंसोल",
  "admin.queue": "शिकायत सूची",
  "admin.review": "शिकायत समीक्षा",

  /* --------------------------------------------------------------- auth */
  "auth.signIn": "साइन इन करें",
  "auth.signUp": "खाता बनाएँ",
  "auth.email": "ईमेल",
  "auth.password": "पासवर्ड",
  "auth.forgot": "पासवर्ड भूल गए?",

  /* ------------------------------------------------------------- errors */
  "error.generic": "कुछ गड़बड़ हो गई। कृपया पुनः प्रयास करें।",
  "error.notFound": "यह पृष्ठ नहीं मिला।",
  "error.offline": "NIRIKSHA सर्वर तक नहीं पहुँचा जा सका।",

  /* -------------------------------------------------------------- notice */
  "notice.assessment":
    "NIRIKSHA छवि से स्वचालित अनुपालन मूल्यांकन करता है। यह निर्णय में सहायक उपकरण है, वैधानिक निरीक्षण का विकल्प नहीं, और यह सरकारी प्रमाणन नहीं है।",
};
