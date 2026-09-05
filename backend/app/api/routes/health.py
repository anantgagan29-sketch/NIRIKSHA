from fastapi import APIRouter

from app.core.config import ENABLE_READABILITY
from app.core.database import store_status
from app.services.ai_provider import availability
from app.services.scan_cache import cache

router = APIRouter()


@router.get("/health")
def health_check():
    return {
        "status": "healthy"
    }


@router.get("/health/processing")
def processing_status():
    """
    What the service can do right now.

    This is for operating the system, not for the interface — a person
    demonstrating NIRIKSHA can see whether any model is still answering, and
    how long an exhausted one is resting for, without reading the logs. The
    interface never surfaces provider quota as a product concept.
    """

    models = availability.snapshot()

    return {
        "models": models,
        "any_model_available": bool(models["available"]),
        "cache": cache.stats(),
        # Which store the scans are going to. "sqlite" on a deployment means
        # they are on a disk that is wiped on the next deploy.
        "storage": store_status(),
        "readability_enabled": ENABLE_READABILITY,
        "calls_per_inspection": 2 if ENABLE_READABILITY else 1,
    }
