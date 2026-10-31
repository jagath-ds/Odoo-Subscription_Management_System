"""BrightLoop FastAPI application entrypoint.

Run from the repository root:
    python -m backend.main          (host/port from .env)
    uvicorn backend.main:app --reload
"""

import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .api.analytics_routes import router as analytics_router
from .api.auth_routes import router as auth_router
from .api.auth_routes import team_router
from .api.catalog_routes import router as catalog_router
from .api.invoice_routes import router as invoice_router
from .api.subscription_routes import router as subscription_router
from .core import config
from .core import models  # noqa: F401 - registers SQLAlchemy models
from .core.database import Base, engine


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Hackathon bootstrap. Replace with Alembic migrations before production.
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="BrightLoop Subscription ERP", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Process-Time"],
)


@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Expose server-side latency so the <2s requirement is visible live."""
    started = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Process-Time"] = f"{(time.perf_counter() - started) * 1000:.2f}ms"
    return response


for router in (auth_router, team_router, catalog_router, subscription_router, invoice_router, analytics_router):
    app.include_router(router)


@app.get("/api/health", tags=["system"])
def health():
    return {"status": "ok", "service": "brightloop-api"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host=config.API_HOST, port=config.API_PORT, reload=config.ENVIRONMENT == "development")
