"""
The languages a report may be generated in.

The same list the interface offers, kept here so the server checks what it
is told rather than trusting it: a language code arrives from the client,
and only one of these is recorded. Adding a language means adding it here
and in the frontend's dictionaries; the two lists are meant to match.
"""

REPORT_LANGUAGES: dict[str, str] = {
    "en": "English",
    "hi": "Hindi",
    "bn": "Bengali",
    "te": "Telugu",
    "mr": "Marathi",
    "ta": "Tamil",
    "gu": "Gujarati",
    "kn": "Kannada",
    "ml": "Malayalam",
    "pa": "Punjabi",
    "ur": "Urdu",
    "as": "Assamese",
    "or": "Odia",
    "sa": "Sanskrit",
    "ne": "Nepali",
    "kok": "Konkani",
    "mai": "Maithili",
    "ks": "Kashmiri",
    "sd": "Sindhi",
    "doi": "Dogri",
}

REPORT_FORMATS = ("pdf", "docx", "png", "jpeg")

# Bumped alongside the frontend's REPORT_TEMPLATE_VERSION when the documents
# change shape, so a recorded generation names the template that drew it.
REPORT_TEMPLATE_VERSION = "2"


def is_report_language(code: str | None) -> bool:
    return bool(code) and code in REPORT_LANGUAGES


def is_report_format(fmt: str | None) -> bool:
    return bool(fmt) and fmt in REPORT_FORMATS
