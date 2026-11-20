# ==========================================
# IMPORTS
# ==========================================

import os

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.middleware.gzip import GZipMiddleware
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from backend.models import Base
from backend.routes.dashboard_routes import router as dashboard_router
from backend.routes.log_routes import router as log_router
from backend.database import schema_engine
from backend.routes.request_routes import router as request_router
from backend.routes.auth_routes import router as auth_router
from backend.routes.report_routes import router as report_router
from backend.routes.device_routes import router as device_router
from backend.routes.user_routes import router as user_router
from backend.routes.asset_routes import router as asset_router
from backend.routes.qr_routes import router as qr_router
from backend.routes.engineer_routes import router as engineer_router
from backend.create_default_admin import create_default_admin
from backend.routes.pm_routes import router as pm_router, department_user_router
from backend.routes.inventory_routes import router as inventory_router
from backend.routes.settings_routes import router as settings_router
from backend.routes.ward_boy_routes import router as ward_boy_router
from backend.routes.attachment_routes import router as attachment_router
from backend.routes.vendor_routes import router as vendor_router
from backend.routes.central_store_routes import router as central_store_router
from backend.routes.security_routes import router as security_router
from backend.auth import validate_auth_config
from backend.security_middleware import SecurityMiddleware
from backend.storage import QR_DIRECTORY
# ==========================================
# APPLICATION
# ==========================================
validate_auth_config()
Base.metadata.create_all(bind=schema_engine)
create_default_admin()

app = FastAPI(
    title="BioTrack Web",
    version="1.0.0"
)

allowed_hosts = [host.strip() for host in os.getenv("ALLOWED_HOSTS", "").split(",") if host.strip()]
if allowed_hosts:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)
if os.getenv("FORCE_HTTPS", "false").casefold() == "true":
    app.add_middleware(HTTPSRedirectMiddleware)
app.add_middleware(SecurityMiddleware)

# Compress the dashboard bundles on their first download. Short-lived browser
# caching keeps repeat visits fast while still allowing deployments to appear
# quickly without stale application files.
app.add_middleware(GZipMiddleware, minimum_size=1000, compresslevel=6)


@app.middleware("http")
async def cache_static_assets(request, call_next):
    response = await call_next(request)
    if request.method == "GET" and request.url.path.startswith("/static/"):
        response.headers["Cache-Control"] = "public, max-age=3600, stale-while-revalidate=86400"
    return response


@app.get("/api/health", include_in_schema=False)
def health_check():
    """Unauthenticated readiness check for Render and other hosting platforms."""
    return {"status": "ok"}


@app.get("/manifest.webmanifest", include_in_schema=False)
def web_app_manifest():
    return FileResponse(
        "frontend/manifest.webmanifest",
        media_type="application/manifest+json",
        headers={"Cache-Control": "public, max-age=3600"},
    )


@app.get("/service-worker.js", include_in_schema=False)
def service_worker():
    return FileResponse(
        "frontend/service-worker.js",
        media_type="application/javascript",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Service-Worker-Allowed": "/",
        },
    )


@app.get("/offline", include_in_schema=False)
def offline_page():
    return FileResponse("frontend/offline.html")

# ==========================================
# STATIC FILES
# ==========================================

app.mount(
    "/static/qr",
    StaticFiles(directory=str(QR_DIRECTORY)),
    name="generated-qr"
)

app.mount(
    "/static",
    StaticFiles(directory="frontend"),
    name="static"
)

# ==========================================
# ROUTERS
# ==========================================

app.include_router(dashboard_router)
app.include_router(log_router)
app.include_router(request_router)
app.include_router(auth_router)
app.include_router(device_router)
app.include_router(user_router)
app.include_router(asset_router)
app.include_router(qr_router)
app.include_router(engineer_router)
app.include_router(pm_router)
app.include_router(department_user_router)
app.include_router(inventory_router)
app.include_router(report_router)
app.include_router(settings_router)
app.include_router(ward_boy_router)
app.include_router(attachment_router)
app.include_router(vendor_router)
app.include_router(central_store_router)
app.include_router(security_router)
# ==========================================
# ROUTES
# ==========================================

@app.get("/")
def root(): 
    return FileResponse("frontend/login.html")


@app.get("/dashboard_v2")
def dashboard_v2():
    return FileResponse("frontend/dashboard_v2/dashboard.html")
@app.get("/maintenance")
def maintenance():
    return FileResponse(
        "frontend/dashboard_v2/maintenance.html"
    )
@app.get("/devices")
def devices_page():
    return FileResponse("frontend/devices.html")
@app.get("/dashboard-v2")
def dashboard_v2_alias():
    return FileResponse("frontend/dashboard_v2/dashboard.html")
