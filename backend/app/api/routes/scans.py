"""
Scan history.

Every completed scan is recorded by the product route; these endpoints read
that record back for the history and dashboard screens.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import current_user_id

from app.core import database

router = APIRouter()


# Every endpoint below is scoped to the caller, and the caller is established
# from a verified access token rather than anything the request says about
# itself. Before this, all three answered with the whole table: signing in as
# anyone showed everyone's inspections, and a reference number was enough to
# open a scan belonging to somebody else.


@router.get("/scans")
def list_scans(
    limit: int = Query(100, ge=1, le=500),
    user_id: Optional[str] = Depends(current_user_id),
):
    return {"items": database.list_scans(limit, user_id)}


@router.get("/scans/stats")
def scan_stats(user_id: Optional[str] = Depends(current_user_id)):
    return database.scan_stats(user_id)


@router.get("/scans/{scan_id}")
def get_scan(
    scan_id: str,
    user_id: Optional[str] = Depends(current_user_id),
):
    result = database.get_scan(scan_id, user_id)

    if result is None:
        # Someone else's reference and one that does not exist are answered
        # the same way. Distinguishing them would confirm which references are
        # real, which is a question this API has no reason to answer.
        raise HTTPException(
            status_code=404,
            detail=f"No scan with reference {scan_id}.",
        )

    return result
