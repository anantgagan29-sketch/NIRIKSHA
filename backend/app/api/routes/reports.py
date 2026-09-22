"""
Report generation records.

The documents themselves are produced on the reader's device, from the
scan's stored result and the dictionaries the interface already carries —
that is what lets a report be made with the server unreachable, and keeps
the fonts for nine scripts out of a 0.1-CPU host. What the server holds is
the record: which scan, which language, which format, which template, when
and by whom. That is enough to reproduce the document and enough for the
history to say which language a scan was last reported in.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core import database
from app.core.auth import current_user_id
from app.core.report_languages import (
    REPORT_FORMATS,
    REPORT_LANGUAGES,
    REPORT_TEMPLATE_VERSION,
    is_report_format,
    is_report_language,
)

router = APIRouter()


class GenerateReportRequest(BaseModel):
    language: str
    format: str = "pdf"


@router.get("/reports/languages")
def report_languages():
    """The languages the server will accept a report in."""
    return {
        "languages": [{"code": code, "name": name} for code, name in REPORT_LANGUAGES.items()],
        "formats": list(REPORT_FORMATS),
        "template_version": REPORT_TEMPLATE_VERSION,
    }


@router.post("/reports/{scan_id}/generate")
def generate_report(
    scan_id: str,
    body: GenerateReportRequest,
    user_id: Optional[str] = Depends(current_user_id),
):
    """
    Records a report generation and returns its metadata.

    The language and format are checked against the server's own lists; a
    code the client made up is refused rather than stored. `download` says
    where the file comes from: the client renders it, so there is no URL.
    """
    if not is_report_language(body.language):
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported report language '{body.language}'. "
            f"Supported: {', '.join(REPORT_LANGUAGES)}.",
        )
    if not is_report_format(body.format):
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported report format '{body.format}'. Supported: {', '.join(REPORT_FORMATS)}.",
        )

    record = database.record_report(scan_id, user_id, body.language, body.format, REPORT_TEMPLATE_VERSION)
    if record is None:
        raise HTTPException(status_code=404, detail="Scan not found.")

    return {
        "reportId": record["report_id"],
        "scanId": scan_id,
        "language": body.language,
        "format": body.format,
        "status": "generated",
        "templateVersion": REPORT_TEMPLATE_VERSION,
        "generatedAt": record["generated_at"],
        "generatedBy": record["generated_by"],
        "download": "client",
    }


@router.get("/reports/{scan_id}")
def list_reports(scan_id: str, user_id: Optional[str] = Depends(current_user_id)):
    return {"items": database.list_reports(scan_id, user_id)}
