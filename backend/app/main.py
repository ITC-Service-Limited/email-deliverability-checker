from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers.checks import router as checks_router

settings = get_settings()

app = FastAPI(
    title="Email Deliverability Checker API",
    version="0.1.0",
    description="Live SPF, DKIM, DMARC, and DNS diagnostics for email domains.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(checks_router)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "name": "email-deliverability-checker-api",
        "status": "ok",
        "docs": "/docs",
    }
