"""
Scan history.

Every completed scan is recorded by the product route; these endpoints read
that record back for the history and dashboard screens.
"""

from fastapi import APIRouter, HTTPException, Query

from app.core import database

router = APIRouter()


@router.get("/scans")
def list_scans(limit: int = Query(100, ge=1, le=500)):
    return {"items": database.list_scans(limit)}


@router.get("/scans/stats")
def scan_stats():
    return database.scan_stats()


@router.get("/scans/{scan_id}")
def get_scan(scan_id: str):
    result = database.get_scan(scan_id)

    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"No scan with reference {scan_id}.",
        )

    return result
