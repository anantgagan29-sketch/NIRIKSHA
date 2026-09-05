from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends

from app.core.auth import current_user_id
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
import os
import time
import uuid

from app.services.image_quality_service import (
    analyze_image_quality
)

from app.services.product_parser import (
    parse_product_image
)

from app.services import letter_height, placement
from app.api.routes.compliance import small_package_quantity
from app.services.readability_service import (
    analyze_product_readability
)

from app.api.routes.compliance import (
    check_compliance,
    ComplianceRequest
)

from app.core import database

from app.core.config import (
    ENABLE_READABILITY,
    GEMINI_TIMEOUT_SECONDS,
    READABILITY_TIMEOUT_SECONDS
)

from app.services.ai_provider import (
    AllModelsUnavailable,
    availability
)

from app.services.scan_cache import (
    cache as scan_cache,
    image_fingerprint
)

from app.services.image_prep import (
    prepare_for_vision,
    discard_prepared,
    thumbnail_for_record
)


router = APIRouter()


# ============================================================
# UPLOAD DIRECTORY
# ============================================================

UPLOAD_DIR = "uploads"

os.makedirs(
    UPLOAD_DIR,
    exist_ok=True
)


# ============================================================
# BUILD VISUAL EVIDENCE
# ============================================================

def build_visual_evidence(
    readability_result,
    compliance_result
):
    """
    Combine readability bounding boxes with compliance results.

    This creates a frontend-friendly list of visual evidence
    that can later be drawn over the product image.
    """

    evidence = []

    readability_fields = {}

    if isinstance(readability_result, dict):

        readability_fields = readability_result.get(
            "fields",
            {}
        )

    compliance_checks = {}

    if isinstance(compliance_result, dict):

        compliance_checks = compliance_result.get(
            "checks",
            {}
        )

    # --------------------------------------------------------
    # Map readability field names to compliance check names
    # --------------------------------------------------------

    field_mapping = {
        "product_name": "generic_product_name",
        "net_quantity": "net_quantity",
        "mrp": "mrp",
        "unit_sale_price": "unit_sale_price",
        "batch_number": "batch_number",
        "manufacturing_date": "manufacturing_date",
        "expiry_or_use_by": "best_before_or_use_by",
        "manufacturer_or_packer": "manufacturer_or_packer",
        "consumer_care": "consumer_care_details",
        "country_of_origin": "country_of_origin"
    }

    # --------------------------------------------------------
    # Create visual evidence for every detected field
    # --------------------------------------------------------

    for field_name, compliance_name in field_mapping.items():

        readability_field = readability_fields.get(
            field_name,
            {}
        )

        if not isinstance(
            readability_field,
            dict
        ):
            continue

        bounding_box = readability_field.get(
            "bounding_box"
        )

        if not bounding_box:
            continue

        readability_status = readability_field.get(
            "status",
            "NOT_DETERMINED"
        )

        confidence = readability_field.get(
            "confidence",
            0
        )

        compliance_check = compliance_checks.get(
            compliance_name,
            {}
        )

        if not isinstance(
            compliance_check,
            dict
        ):
            compliance_check = {}

        compliance_status = compliance_check.get(
            "status",
            "NOT_DETERMINED"
        )

        # ----------------------------------------------------
        # Determine visual display status
        # ----------------------------------------------------

        if compliance_status == "FAIL":

            visual_status = "FAIL"

        elif readability_status in [
            "SMALL",
            "UNCLEAR"
        ]:

            visual_status = "REVIEW"

        elif compliance_status in [
            "PASS",
            "DETECTED"
        ]:

            visual_status = "PASS"

        else:

            visual_status = "REVIEW"

        evidence.append(
            {
                "field": field_name,

                "compliance_check": compliance_name,

                "status": visual_status,

                "readability": readability_status,

                "confidence": confidence,

                "bounding_box": bounding_box,

                "reason": readability_field.get(
                    "reason",
                    ""
                ),

                "compliance_message": compliance_check.get(
                    "message",
                    ""
                )
            }
        )

    return evidence


# ============================================================
# SCAN PRODUCT
# ============================================================

@router.post("/product/scan")
async def scan_product(
    file: UploadFile = File(...),
    # One scan action, named by the client. Sent again with the same value --
    # a retry, a double submit -- this returns the first result rather than
    # recording the scan twice.
    scan_event_id: Optional[str] = Form(None),
    # Optional, measured by the person scanning: the width of the pack in
    # centimetres. It is the only thing that turns pixels into millimetres,
    # and without it every Rule 7 height finding stays under review.
    package_width_cm: Optional[float] = Form(None),
    # Taken from the verified token, never from the request body: a caller
    # cannot record a scan against somebody else's account.
    user_id: Optional[str] = Depends(current_user_id),
):
    """
    Complete product scanning pipeline.

    Image
       ↓
    Save image
       ↓
    Image quality check
       ↓
    If bad → RETAKE_REQUIRED
       ↓
    Gemini Vision
       ↓
    Structured Product JSON
       ↓
    Readability Analysis
       ↓
    Compliance Checker
       ↓
    Visual Evidence
       ↓
    Final Result
    """

    # ========================================================
    # 1. CHECK FILE TYPE
    # ========================================================

    allowed_types = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ]

    if file.content_type not in allowed_types:

        raise HTTPException(
            status_code=400,
            detail="Only JPG, PNG and WEBP images are allowed."
        )

    # ========================================================
    # 2. CREATE UNIQUE FILE NAME
    # ========================================================

    extension = os.path.splitext(
        file.filename or ""
    )[1]

    if not extension:
        extension = ".jpg"

    filename = f"{uuid.uuid4()}{extension}"

    file_path = os.path.join(
        UPLOAD_DIR,
        filename
    )

    # ========================================================
    # 3. SAVE IMAGE
    # ========================================================

    try:

        file_content = await file.read()

        if not file_content:

            raise HTTPException(
                status_code=400,
                detail="Uploaded image is empty."
            )

        with open(
            file_path,
            "wb"
        ) as buffer:

            buffer.write(file_content)

        # An identical image has an identical answer. During a demonstration
        # the same packet is inspected several times, and each repeat used to
        # cost another pair of API requests for a result already computed.
        fingerprint = image_fingerprint(file_content)

    except HTTPException:
        raise

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Failed to save image: {str(e)}"
        )

    cached = scan_cache.get(fingerprint)

    if cached is not None:

        print("Scan: served from cache; no model was called.")

        cached["filename"] = file.filename
        cached["processing_path"] = "cache"

        try:
            cached["scan_id"] = database.record_scan(cached, user_id, scan_event_id, thumbnail_for_record(file_path))
        except Exception as e:
            print("Scan: could not record cached scan -", str(e))

        return cached


    # ========================================================
    # 4. IMAGE QUALITY CHECK
    # ========================================================

    try:

        print(
            "OpenCV: Checking image quality..."
        )

        image_quality = analyze_image_quality(
            file_path
        )

        print(
            "OpenCV:",
            image_quality.get("status"),
            "| Score:",
            image_quality.get("score")
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=(
                "Image quality analysis failed: "
                + str(e)
            )
        )

    # ========================================================
    # 5. STOP IF PHOTO QUALITY IS TOO LOW
    # ========================================================

    if image_quality.get("status") == "RETAKE_REQUIRED":

        print(
            "OpenCV: Image quality insufficient. "
            "Stopping scan."
        )

        rejected = {
            "filename": file.filename,

            "image_quality": image_quality,

            "scan_status": "RETAKE_REQUIRED",

            "message": (
                "The photo is not clear enough for "
                "reliable product inspection. "
                "Please retake the photo."
            ),

            "photo_guidance": {
                "title": "How to take a good photo",
                "tips": [
                    "Use good lighting.",
                    "Hold the phone steady.",
                    "Keep the whole package visible.",
                    "Make sure the text is clear.",
                    "Avoid glare."
                ]
            },

            "product": None,

            "compliance": None,

            "readability": None,

            "visual_evidence": []
        }

        # Rejected photos are recorded too: a run of retakes is worth seeing
        # in the history, and it is what the quality gate is there to prevent.
        rejected["scan_id"] = database.record_scan(rejected, user_id, scan_event_id, thumbnail_for_record(file_path))

        return rejected

    # ========================================================
    # 6 + 7. VISION PARSING AND READABILITY, CONCURRENTLY
    # ========================================================
    # These two calls are independent: one reads the declarations, the other
    # judges how legible they are. Running them in sequence meant paying for
    # both round trips end to end, which was the single largest cost in a
    # scan. Run together, a scan costs the slower of the two rather than
    # their sum.
    #
    # Both are given a hard deadline. Without one, a model that hangs takes
    # the whole request with it and the user is left with nothing.

    prepared_path = prepare_for_vision(file_path)

    started = time.perf_counter()

    # The pool is not used as a context manager. Leaving a `with` block calls
    # shutdown(wait=True), which blocks until the running calls finish — so a
    # request that timed out at 45s would still sit there for as long as the
    # model took, and the deadline above would mean nothing. Shutting down
    # without waiting is what actually bounds the request.

    pool = ThreadPoolExecutor(max_workers=2)

    try:

        parse_future = pool.submit(
            parse_product_image,
            prepared_path
        )

        # The readability pass is a second full vision call on the same image.
        # It adds per-declaration confidence and bounding boxes; it does not
        # change the compliance outcome. Off by default, an inspection costs
        # one request instead of two.
        readability_future = (
            pool.submit(analyze_product_readability, prepared_path)
            if ENABLE_READABILITY
            else None
        )

        # ----------------------------------------------------
        # Product parsing — required
        # ----------------------------------------------------

        try:

            print(
                "Gemini: Reading declarations..."
            )

            product_info = parse_future.result(
                timeout=GEMINI_TIMEOUT_SECONDS
            )

        except FutureTimeout:

            if readability_future:
                readability_future.cancel()

            discard_prepared(prepared_path, file_path)

            # A model that overran the deadline is, for this inspection, no
            # different from one that refused: nothing was read. The caller
            # gets the same signal and takes the same path — reading the
            # label on the device — instead of being told to try again.
            #
            # Raised inside the try; the finally below releases the pool
            # without waiting for the call that overran.
            print(
                f"Scan: no model answered within "
                f"{int(GEMINI_TIMEOUT_SECONDS)}s."
            )

            raise HTTPException(
                status_code=503,
                detail={
                    "code": "AI_UNAVAILABLE",
                    "message": (
                        "The hosted vision service did not respond in time. "
                        "The label can still be read on this device."
                    ),
                    "models": {
                        "deadline": f"{int(GEMINI_TIMEOUT_SECONDS)}s exceeded"
                    }
                }
            )

        except FileNotFoundError as e:

            discard_prepared(prepared_path, file_path)

            raise HTTPException(
                status_code=500,
                detail=str(e)
            )

        except AllModelsUnavailable as e:

            discard_prepared(prepared_path, file_path)

            # Nothing was read, so there is nothing to assess here. The caller
            # is told plainly that the hosted models are the thing that is
            # unavailable, so it can fall back to reading the label itself
            # rather than showing the user a provider error.
            print("Scan: no model available -", str(e))

            raise HTTPException(
                status_code=503,
                detail={
                    "code": "AI_UNAVAILABLE",
                    "message": (
                        "The hosted vision service is not responding at the "
                        "moment. The label can still be read on this device."
                    ),
                    "models": e.reasons
                }
            )

        except Exception as e:

            discard_prepared(prepared_path, file_path)

            raise HTTPException(
                status_code=502,
                detail=(
                    "Product analysis failed: "
                    + str(e)
                )
            )

        # ----------------------------------------------------
        # Readability — optional
        # ----------------------------------------------------
        # It contributes per-declaration confidence and bounding boxes. A
        # compliance result is still useful without them, so a failure here
        # degrades the response rather than losing the scan.

        if readability_future is None:

            readability_result = None

            remaining = 0.0

        else:

            remaining = max(
                1.0,
                READABILITY_TIMEOUT_SECONDS - (time.perf_counter() - started)
            )

        try:

            readability_result = (
                readability_future.result(timeout=remaining)
                if readability_future
                else None
            )

        except FutureTimeout:

            print(
                "Readability: timed out; continuing without it."
            )

            if readability_future:
                readability_future.cancel()

            readability_result = None

        except Exception as e:

            print(
                "Readability: failed; continuing without it -",
                str(e)
            )

            readability_result = None

    finally:

        # Anything still running is abandoned rather than waited on. The
        # orphaned thread finishes into a result nobody reads.
        pool.shutdown(wait=False, cancel_futures=True)

    # Safe to remove even if an abandoned thread still holds the file open:
    # on POSIX the data stays available to that open descriptor until it
    # closes, and the name goes away now.
    discard_prepared(prepared_path, file_path)

    print(
        f"Vision stage completed in "
        f"{time.perf_counter() - started:.1f}s"
    )


    # ========================================================
    # 8. RUN COMPLIANCE CHECK
    # ========================================================

    try:

        compliance_result = check_compliance(
            ComplianceRequest(
                extracted_text="",
                product_info=product_info,
                readability_result=readability_result
            )
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=(
                "Compliance check failed: "
                + str(e)
            )
        )

    # ========================================================
    # 9. BUILD VISUAL EVIDENCE
    # ========================================================

    try:

        visual_evidence = build_visual_evidence(
            readability_result,
            compliance_result
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=(
                "Visual evidence generation failed: "
                + str(e)
            )
        )

    # ========================================================
    # 10. RETURN COMPLETE RESULT
    # ========================================================

    result = {

        "filename": file.filename,

        "image_quality": image_quality,

        "scan_status": "SUCCESS",

        "product": product_info,

        "compliance": compliance_result,

        "readability": readability_result,

        # Rule 7 — the size of letters and numerals. Assessed separately from
        # whether a declaration is present at all, and separately again from
        # how confidently it was read: a declaration can be present, read
        # perfectly, and still be printed too small to be lawful.
        #
        # No scale reaches this call, so the heights it reports are in the
        # image's own terms and its height findings are REVIEW. The argument
        # for computing it anyway is that it states the applicable minimum for
        # this package, which is the part an inspector cannot look up in the
        # aisle.
        "letter_height": letter_height.assess(
            readability_result,
            net_quantity=small_package_quantity(
                (product_info or {}).get("net_quantity")
            ),
            image_height_px=(image_quality or {}).get("resolution", {}).get("height"),
            mm_per_unit=letter_height.scale_from_package_width(
                package_width_cm,
                (image_quality or {}).get("resolution", {}).get("width"),
                (image_quality or {}).get("resolution", {}).get("height"),
            ),
        ),

        # Rule 9 — where the declarations sit. One photograph is one panel of a
        # package, so this reports what the view supports and never concludes
        # against a package on that basis.
        "placement": placement.assess(readability_result),

        "visual_evidence": visual_evidence,

        # Which route produced this result: a hosted model, or the store. The
        # interface does not show it; it is here so a failure can be traced
        # to the path it came from.
        "processing_path": "vision_model"
    }

    # Only a completed inspection is stored. A failure is never served back
    # as though it were an answer.
    if result.get("scan_status") == "SUCCESS":
        scan_cache.put(fingerprint, result)

    # ========================================================
    # 11. RECORD THE SCAN
    # ========================================================
    # Storing the result is a convenience, not a precondition for the caller
    # getting their assessment — a failure here must not lose the scan.

    try:

        result["scan_id"] = database.record_scan(result, user_id, scan_event_id, thumbnail_for_record(file_path))

    except Exception as e:

        print(
            "Warning: could not record scan:",
            str(e)
        )

        result["scan_id"] = None

    return result


# ============================================================
# TEST ROUTE
# ============================================================

@router.get("/product")
def get_product():

    return {
        "message": "Product route is working"
    }