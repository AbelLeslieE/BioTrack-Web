# ==========================================
# IMPORTS
# ==========================================

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from backend.models import Base
from backend.routes.dashboard_routes import router as dashboard_router
from backend.routes.log_routes import router as log_router
from backend.database import engine
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
from backend.auth import validate_auth_config
# ==========================================
# APPLICATION
# ==========================================
validate_auth_config()
Base.metadata.create_all(bind=engine)
create_default_admin()

app = FastAPI(
    title="BioTrack Web",
    version="1.0.0"
)

# ==========================================
# STATIC FILES
# ==========================================

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
