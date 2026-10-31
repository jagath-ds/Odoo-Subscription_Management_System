"""BrightLoop FastAPI application entrypoint."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.auth_routes import router as auth_router
from .api.catalog_routes import router as catalog_router
from .api.invoice_routes import router as invoice_router
from .api.subscription_routes import router as subscription_router
from .core import models  # noqa: F401 - registers SQLAlchemy models
from .core.database import Base, engine


app = FastAPI(title="BrightLoop Subscription ERP", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(catalog_router)
app.include_router(subscription_router)
app.include_router(invoice_router)
app.include_router(auth_router)


@app.get("/api/health", tags=["system"])
def health():
    return {"status": "ok", "service": "brightloop-api"}


@app.on_event("startup")
def initialize_database() -> None:
    # Hackathon bootstrap. Replace with Alembic migrations before production.
    Base.metadata.create_all(bind=engine)
