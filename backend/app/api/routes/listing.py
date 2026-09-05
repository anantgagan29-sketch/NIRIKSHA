"""
Compliance of an e-commerce product listing.

Rule 6 requires the mandatory declarations on the package. Where a packaged
commodity is offered for sale online, the same declarations have to be visible
to the purchaser on the listing before they buy — a photograph of the pack is
not a substitute for reading them, and the buyer cannot turn the box over.

This assesses the listing's own text. The declarations are read from it and
tested by exactly the same rules engine a photographed label goes through, so
a finding about a listing and a finding about a pack mean the same thing and
cite the same provisions.

Two things it deliberately does not do:

  * It does not decide that a declaration absent from the text supplied is
    absent from the listing. Someone may have pasted part of a page.

  * It does not assess lettering. Rule 7 is about the height of printed
    characters on a package; a web page has no printed characters, and
    applying a millimetre rule to it would be inventing a requirement.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.routes.compliance import ComplianceRequest, check_compliance
from app.core import database
from app.core.auth import current_user_id
from app.services.ai_provider import AllModelsUnavailable
from app.services.listing_parser import parse_listing_text

router = APIRouter()


class ListingRequest(BaseModel):
    """The listing's text, as shown to a purchaser."""

    text: str = Field(min_length=20, max_length=40000)
    # Recorded with the assessment so a finding can be traced back to what was
    # read. Never fetched: what is assessed is what was supplied.
    source_url: Optional[str] = Field(default=None, max_length=2000)
    platform: Optional[str] = Field(default=None, max_length=120)
    # One assessment, named by the client. A second click on the same one
    # returns the reference already issued rather than a second record.
    scan_event_id: Optional[str] = Field(default=None, max_length=64)


@router.post("/listing/check")
def check_listing(
    data: ListingRequest,
    user_id: Optional[str] = Depends(current_user_id),
):
    """
    Reads the declarations out of a listing and tests them against the Rules.

    The text is supplied rather than fetched. Retrieving a page from here
    would mean this service making requests to addresses a caller chooses,
    and would in any case fail against the platforms that matter, which
    refuse automated retrieval. Pasting what is on screen is both honest
    about what was assessed and the thing that actually works.
    """
    text = data.text.strip()

    if not text:
        raise HTTPException(
            status_code=400,
            detail="Paste the listing text to assess.",
        )

    try:
        product = parse_listing_text(text)

    except AllModelsUnavailable as unavailable:
        # Reported rather than answered with empty fields. An assessment built
        # on nothing read would mark every declaration missing and call a
        # compliant listing non-compliant.
        raise HTTPException(
            status_code=503,
            detail=(
                "The listing could not be read: no vision service was available. "
                "Try again shortly."
            ),
        ) from unavailable

    assessment = check_compliance(
        ComplianceRequest(
            extracted_text=text,
            product_info=product,
            readability_result=None,
        )
    )

    result = {
        "scan_status": "SUCCESS",
        "source": {
            "kind": "listing",
            "url": data.source_url,
            "platform": data.platform,
            "characters": len(text),
        },
        "product": product,
        "compliance": assessment,
        # No photograph was taken, so there is no image quality to report.
        # An empty object rather than an invented verdict: the report screens
        # read this and must not be told the picture was good.
        "image_quality": None,
        "readability": None,
        # Rule 7 governs printed characters on a package. A listing has none,
        # so no lettering assessment is offered rather than one being
        # manufactured for it.
        "letter_height": None,
        "placement": None,
        "note": (
            "Assessed from listing text supplied by the user. A declaration not present in "
            "that text is not necessarily absent from the listing — only from what was "
            "supplied. Character height requirements under Rule 7 apply to the printed "
            "package and are not assessed here."
        ),
    }

    # Recorded alongside photographed scans. A listing assessed and then lost
    # is an inspection nobody can produce afterwards, and the history is meant
    # to be the record of what was inspected — not of one kind of inspection.
    try:
        result["scan_id"] = database.record_scan(
            result,
            user_id,
            data.scan_event_id,
            image=None,
            source_kind="listing",
        )
    except Exception as error:
        # The assessment stands even if it could not be filed.
        print("Listing assessment not recorded -", str(error))

    return result
