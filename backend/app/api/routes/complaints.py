"""
Citizen complaints.

A complaint records what a person reported against a scan, together with the
audit trail of every status change. Nothing here transmits anything to a
statutory authority — NIRIKSHA has no such integration, and the interface says
so wherever a complaint is shown.
"""

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core import database

router = APIRouter()


class ComplaintCreate(BaseModel):
    scan_id: Optional[str] = None
    product: Optional[str] = None
    violation_type: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=20, max_length=4000)
    location: Optional[str] = Field(default=None, max_length=300)
    contact: Optional[str] = Field(default=None, max_length=200)


class ComplaintStatusUpdate(BaseModel):
    status: str
    note: Optional[str] = Field(default=None, max_length=1000)


@router.post("/complaints", status_code=201)
def create_complaint(data: ComplaintCreate):
    return database.create_complaint(
        scan_id=data.scan_id,
        product=data.product,
        violation_type=data.violation_type,
        description=data.description,
        location=data.location,
        contact=data.contact,
    )


@router.get("/complaints")
def list_complaints():
    return {"items": database.list_complaints()}


@router.get("/complaints/{complaint_id}")
def get_complaint(complaint_id: str):
    complaint = database.get_complaint(complaint_id)

    if complaint is None:
        raise HTTPException(
            status_code=404,
            detail=f"No complaint with reference {complaint_id}.",
        )

    return complaint


@router.patch("/complaints/{complaint_id}")
def update_complaint(complaint_id: str, data: ComplaintStatusUpdate):
    try:
        return database.update_complaint_status(
            complaint_id,
            data.status,
            data.note,
        )

    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error))

    # An invalid transition is a client mistake, not a server fault.
    except database.TransitionError as error:
        raise HTTPException(status_code=409, detail=str(error))
