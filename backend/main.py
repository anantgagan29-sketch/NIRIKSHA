"""
NIRIKSHA backend.

Entry point: wires the route modules onto the application and configures the
cross-origin policy the browser client needs.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import ALLOWED_ORIGINS
from app.core.database import init_db
from app.api.routes.health import router as health_router
from app.api.routes.product import router as product_router
from app.api.routes.compliance import router as compliance_router
from app.api.routes.ocr import router as ocr_router
from app.api.routes.scans import router as scans_router
from app.api.routes.complaints import router as complaints_router
from app.api.routes.barcode import router as barcode_router

app = FastAPI(
    title="NIRIKSHA Compliance Checker API",
    description=(
        "Backend for NIRIKSHA — packaged commodity compliance screening "
        "against the Legal Metrology (Packaged Commodities) Rules, 2011."
    ),
    version="1.0.0",
)


# ============================================================
# CORS
# ============================================================
# The frontend runs on its own origin during development, so the browser
# pre-flights every upload. Origins are listed explicitly rather than
# wildcarded — a wildcard cannot be combined with credentials, and being
# specific about who may call this API is worth the small amount of config.

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    # Lets the client read the scan id off a response without a second call.
    expose_headers=["X-Scan-Id"],
)


app.include_router(health_router)
app.include_router(product_router)
app.include_router(compliance_router)
app.include_router(ocr_router)
app.include_router(scans_router)
app.include_router(complaints_router)
app.include_router(barcode_router)


@app.on_event("startup")
def on_startup() -> None:
    """Creates the scan and complaint tables if they do not exist yet."""
    init_db()


@app.get("/")
def root():
    return {
        "service": "niriksha-api",
        "message": "NIRIKSHA Compliance Checker API is running",
        "docs": "/docs",
    }
