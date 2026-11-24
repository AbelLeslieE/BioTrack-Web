"""Fail-fast readiness audit for BioTrack builds and scheduled CI checks."""

from __future__ import annotations

import importlib
import os
import sqlite3
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
REQUIRED_TABLES = {
    "users",
    "assets",
    "asset_documents",
    "asset_relocation_requests",
    "inventory",
    "requests",
    "logs",
    "report_schedules",
    "request_attachments",
    "vendor_contracts",
    "vendor_service_history",
    "central_store_items",
    "spare_part_requests",
    "store_delivery_tasks",
    "ward_boy_tasks",
    "auth_sessions",
    "security_audit",
    "business_budgets",
    "purchase_requests",
    "business_transactions",
    "insurance_policies",
    "insurance_claim_batches",
    "business_vendors",
    "supplier_quotations",
    "supplier_invoices",
    "supplier_payments",
    "business_documents",
}
REQUIRED_ROUTES = {
    "/api/assets/{asset_id}/documents",
    "/api/assets/documents/{document_id}/download",
    "/api/engineer/ticket/{ticket_id}/attachments",
    "/api/vendors",
    "/api/central-store/dashboard",
    "/api/central-store/requests",
    "/api/ward-boy/dashboard",
    "/api/security/audit",
    "/api/business/dashboard",
    "/api/business/purchases",
    "/api/business/admin-summary",
    "/api/business/report.csv",
    "/api/business/vendors",
    "/api/business/purchases/{purchase_id}/quotations",
    "/api/business/invoices",
    "/api/business/invoices/{invoice_id}/payments",
    "/api/business/vendor-outstanding.csv",
    "/api/business/documents/{record_type}/{record_id}",
    "/api/auth/mfa/setup",
    "/api/auth/mfa/enable",
    "/api/auth/mfa/disable",
    "/dashboard",
}


def check(condition: bool, message: str, failures: list[str]) -> None:
    if condition:
        print(f"[PASS] {message}")
    else:
        print(f"[FAIL] {message}")
        failures.append(message)


def registered_route_paths(routes) -> set[str]:
    """Collect routes across both legacy and deferred FastAPI router layouts."""
    paths: set[str] = set()
    for route in routes:
        path = getattr(route, "path", None)
        if path:
            paths.add(path)
        included_router = getattr(route, "original_router", None)
        if included_router is not None:
            paths.update(registered_route_paths(included_router.routes))
    return paths


def main() -> int:
    failures: list[str] = []
    schema_path = ROOT / "database" / "schema.sql"
    connection = sqlite3.connect(":memory:")
    try:
        connection.executescript(schema_path.read_text(encoding="utf-8"))
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            )
        }
        check(REQUIRED_TABLES.issubset(tables), "fresh database schema contains every operational table", failures)
        asset_document_columns = {
            row[1] for row in connection.execute("PRAGMA table_info(asset_documents)")
        }
        check(
            {"content_type", "original_size_bytes", "stored_size_bytes", "file_data"}.issubset(asset_document_columns),
            "asset documents retain compressed database-backed content",
            failures,
        )
        request_attachment_columns = {
            row[1] for row in connection.execute("PRAGMA table_info(request_attachments)")
        }
        check(
            "file_data" in request_attachment_columns,
            "maintenance evidence uses durable database storage",
            failures,
        )
        business_money_types = {
            row[1]: row[2] for row in connection.execute("PRAGMA table_info(supplier_invoices)")
        }
        check(
            all("NUMERIC" in business_money_types.get(name, "") for name in ("subtotal_amount", "total_amount", "paid_amount")),
            "supplier accounting uses exact decimal currency columns",
            failures,
        )
    finally:
        connection.close()

    for package in ("PIL", "fitz"):
        try:
            importlib.import_module(package)
            available = True
        except ImportError:
            available = False
        check(available, f"attachment compression dependency {package} is installed", failures)

    with tempfile.TemporaryDirectory(prefix="biotrack-audit-", ignore_cleanup_errors=True) as directory:
        # Use one temporary file rather than SQLite's per-connection in-memory
        # databases.  Release migrations deliberately open independent schema
        # connections, matching production, and must all inspect the same DB.
        audit_database = Path(directory) / "audit.db"
        audit_database_url = f"sqlite:///{audit_database.as_posix()}"
        os.environ["DATABASE_URL"] = audit_database_url
        os.environ["DATABASE_URL_UNPOOLED"] = audit_database_url
        os.environ["BIOTRACK_DATA_DIR"] = directory
        os.environ["JWT_SECRET_KEY"] = "x" * 40
        os.environ["COOKIE_SECURE"] = "false"
        from backend.main import app

        route_paths = registered_route_paths(app.routes)
        check(REQUIRED_ROUTES.issubset(route_paths), "all critical API routes are registered", failures)

    worker = (ROOT / "frontend" / "service-worker.js").read_text(encoding="utf-8")
    check(
        'url.pathname.startsWith("/api/")' in worker and "caches.open(CACHE_VERSION)" in worker,
        "offline cache is enabled while authenticated API responses stay network-only",
        failures,
    )
    bundle = (ROOT / "frontend" / "dashboard_v2" / "dist" / "dashboard.bundle.js").read_text(encoding="utf-8")
    check("views/centralStoreView.js" in bundle, "Central Store portal is present in the dashboard bundle", failures)
    check("views/vendorsView.js" in bundle, "vendor contracts are present in the dashboard bundle", failures)
    check("views/businessView.js" in bundle, "Business Office portal is present in the dashboard bundle", failures)
    check("uploadAssetDocument" in bundle, "asset document upload is present in the dashboard bundle", failures)
    check(
        all(path in bundle for path in ("/api/auth/mfa/setup", "/api/auth/mfa/enable", "/api/auth/mfa/disable")),
        "optional MFA can be managed from account settings",
        failures,
    )
    check("X-CSRF-Token" in bundle, "dashboard unsafe requests carry CSRF protection", failures)
    security_middleware = (ROOT / "backend" / "security_middleware.py").read_text(encoding="utf-8")
    check(
        all(header in security_middleware for header in ("Content-Security-Policy", "Strict-Transport-Security", "X-Content-Type-Options")),
        "browser security headers are installed",
        failures,
    )

    if failures:
        print(f"\nBioTrack audit failed with {len(failures)} issue(s).")
        return 1
    print("\nBioTrack readiness audit passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
