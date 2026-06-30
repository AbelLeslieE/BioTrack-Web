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
from sqlalchemy import text
from backend.routes.request_routes import router as request_router
from backend.routes.auth_routes import router as auth_router
from backend.routes.device_routes import router as device_router
from backend.routes.user_routes import router as user_router
from backend.routes.asset_routes import router as asset_router
from backend.routes.qr_routes import router as qr_router
from backend.routes.engineer_routes import router as engineer_router
# ==========================================
# APPLICATION
# ==========================================
Base.metadata.create_all(bind=engine)

# Fix users role constraint for BME/User/Manager roles
def fix_users_role_constraint():
    with engine.begin() as conn:
        result = conn.execute(text("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'"))
        row = result.fetchone()
        if row and row[0] and 'CHECK' in row[0] and 'BME' not in row[0]:
            conn.execute(text("ALTER TABLE users RENAME TO users_old"))
            conn.execute(text("""
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY,
                    username VARCHAR NOT NULL UNIQUE,
                    password_hash VARCHAR NOT NULL,
                    department VARCHAR,
                    name VARCHAR,
                    email VARCHAR,
                    phone VARCHAR,
                    role VARCHAR NOT NULL CHECK(role IN ('BME','User','Manager')),
                    created_at DATETIME
                )
            """))
            conn.execute(text("""
                INSERT INTO users (id, username, password_hash, department, name, email, phone, role, created_at)
                SELECT id, username, password_hash, department, name, email, phone,
                CASE WHEN role NOT IN ('BME','User','Manager') THEN 'User' ELSE role END,
                created_at FROM users_old
            """))
            conn.execute(text("DROP TABLE users_old"))

fix_users_role_constraint()

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
def dashboard_v2():
    return FileResponse("frontend/dashboard_v2/dashboard.html")