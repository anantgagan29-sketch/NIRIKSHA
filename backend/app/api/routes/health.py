from fastapi import APIRouter

from app.core.config import ENABLE_READABILITY
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
        "readability_enabled": ENABLE_READABILITY,
        "calls_per_inspection": 2 if ENABLE_READABILITY else 1,
    }
