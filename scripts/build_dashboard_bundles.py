"""Build the dashboard's ordered CSS and JavaScript bundles.

The dashboard uses classic scripts that share browser globals, so source order
is preserved exactly. Keeping this as a tiny build step avoids dozens of
network round trips without introducing a frontend framework or bundler.
"""

from pathlib import Path
from shutil import copy2, copytree


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
OUTPUT = FRONTEND / "dashboard_v2" / "dist"
VENDOR_OUTPUT = FRONTEND / "vendor"

CSS_FILES = [
    "dashboard_v2/css/theme.css",
    "dashboard_v2/css/layout.css",
    "dashboard_v2/css/sidebar.css",
    "dashboard_v2/css/topbar.css",
    "dashboard_v2/css/cards.css",
    "dashboard_v2/css/admin_dashboard.css",
    "dashboard_v2/css/charts.css",
    "dashboard_v2/css/tables.css",
    "dashboard_v2/css/responsive.css",
    "dashboard_v2/css/maintenance.css",
    "dashboard_v2/css/qr.css",
    "dashboard_v2/css/qr_modal.css",
    "dashboard_v2/css/assets.css",
    "dashboard_v2/css/asset_details.css",
    "dashboard_v2/css/asset_profile.css",
    "dashboard_v2/css/asset_form.css",
    "dashboard_v2/css/user_dashboard.css",
    "dashboard_v2/css/engineer_dashboard.css",
    "dashboard_v2/css/ticket.css",
    "dashboard_v2/css/new_request.css",
    "dashboard_v2/css/my_requests.css",
    "dashboard_v2/css/inventory.css",
    "dashboard_v2/css/central_store.css",
    "dashboard_v2/css/vendors.css",
    "dashboard_v2/css/settings.css",
    "dashboard_v2/css/reports.css",
    "dashboard_v2/css/successModal.css",
    "dashboard_v2/css/requestDetails.css",
    "dashboard_v2/css/ward_boy.css",
    "dashboard_v2/css/pm.css",
    "dashboard_v2/css/pmDrawer.css",
    "dashboard_v2/css/department_modules.css",
    "dashboard_v2/css/responsive_overrides.css",
    "dashboard_v2/css/dark_theme.css",
    "css/toast.css",
    "dashboard_v2/css/users.css",
]

JS_FILES = [
    "js/toast.js",
    "js/csrf.js",
    "dashboard_v2/js/security.js",
    "dashboard_v2/js/hospital_departments.js",
    "dashboard_v2/js/assetRelocation.js",
    "dashboard_v2/js/api.js",
    "dashboard_v2/js/pagination.js",
    "dashboard_v2/js/logout.js",
    "dashboard_v2/js/dashboard.js",
    "dashboard_v2/js/sidebar.js",
    "dashboard_v2/js/preferences.js",
    "dashboard_v2/js/notifications.js",
    "dashboard_v2/js/topbarInteractions.js",
    "dashboard_v2/js/responsive_tables.js",
    "dashboard_v2/views/engineerDashboardView.js",
    "dashboard_v2/views/wardBoyDashboardView.js",
    "dashboard_v2/views/dashboardView.js",
    "dashboard_v2/views/userDashboardView.js",
    "dashboard_v2/views/myAssetsView.js",
    "dashboard_v2/views/departmentPmScheduleView.js",
    "dashboard_v2/views/newRequestView.js",
    "dashboard_v2/views/maintenanceView.js",
    "dashboard_v2/views/ticketView.js",
    "dashboard_v2/views/assetsView.js",
    "dashboard_v2/views/assetFormView.js",
    "dashboard_v2/views/assetProfileView.js",
    "dashboard_v2/views/assetDetailsView.js",
    "dashboard_v2/views/maintenanceModuleView.js",
    "dashboard_v2/views/inventoryView.js",
    "dashboard_v2/views/centralStoreView.js",
    "dashboard_v2/views/storeRequestsView.js",
    "dashboard_v2/views/vendorsView.js",
    "dashboard_v2/js/settings.js",
    "dashboard_v2/views/pmView.js",
    "dashboard_v2/js/pmCalendar.js",
    "dashboard_v2/js/pmDrawer.js",
    "dashboard_v2/js/pmScheduleOverview.js",
    "dashboard_v2/views/reportsView.js",
    "dashboard_v2/js/reports.js",
    "dashboard_v2/views/usersView.js",
    "dashboard_v2/views/qrScannerView.js",
    "dashboard_v2/views/qrAssetProfileView.js",
    "dashboard_v2/js/requestDetails.js",
    "dashboard_v2/views/requestDetailsView.js",
    "dashboard_v2/js/successModal.js",
    "dashboard_v2/views/myRequestsView.js",
    "dashboard_v2/views/settingsView.js",
    "dashboard_v2/views/aiView.js",
    "dashboard_v2/js/asset_profile.js",
    "js/biomedical_dashboard.js",
    "dashboard_v2/js/router.js",
    "dashboard_v2/js/new_request.js",
    "dashboard_v2/js/clock.js",
    "dashboard_v2/js/assets_details.js",
    "dashboard_v2/js/qr_scanner.js",
]


def build_bundle(paths: list[str], output_name: str, separator: str) -> Path:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    chunks = []
    for relative_path in paths:
        source = FRONTEND / relative_path
        content = source.read_text(encoding="utf-8").lstrip("\ufeff")
        content = "\n".join(line.rstrip() for line in content.splitlines())
        chunks.append(f"/* source: {relative_path} */\n{content}")
    destination = OUTPUT / output_name
    destination.write_text(separator.join(chunks) + "\n", encoding="utf-8", newline="\n")
    return destination


def copy_icon_runtime() -> list[Path]:
    """Keep every icon dependency on the same origin as the dashboard."""

    lucide_source = ROOT / "node_modules" / "lucide" / "dist" / "umd" / "lucide.min.js"
    fontawesome_root = ROOT / "node_modules" / "@fortawesome" / "fontawesome-free"
    required_sources = [
        lucide_source,
        fontawesome_root / "css" / "all.min.css",
        fontawesome_root / "webfonts",
    ]
    missing = [str(source.relative_to(ROOT)) for source in required_sources if not source.exists()]
    if missing:
        raise FileNotFoundError(
            "Missing icon dependencies. Run `npm install` before building: " + ", ".join(missing)
        )

    VENDOR_OUTPUT.mkdir(parents=True, exist_ok=True)
    lucide_destination = VENDOR_OUTPUT / "lucide.min.js"
    copy2(lucide_source, lucide_destination)

    fontawesome_destination = VENDOR_OUTPUT / "fontawesome"
    (fontawesome_destination / "css").mkdir(parents=True, exist_ok=True)
    copy2(fontawesome_root / "css" / "all.min.css", fontawesome_destination / "css" / "all.min.css")
    copytree(
        fontawesome_root / "webfonts",
        fontawesome_destination / "webfonts",
        dirs_exist_ok=True,
    )
    return [lucide_destination, fontawesome_destination / "css" / "all.min.css"]


if __name__ == "__main__":
    vendor_files = copy_icon_runtime()
    css = build_bundle(CSS_FILES, "dashboard.bundle.css", "\n\n")
    js = build_bundle(JS_FILES, "dashboard.bundle.js", "\n;\n")
    for vendor_file in vendor_files:
        print(f"Copied {vendor_file.relative_to(ROOT)} ({vendor_file.stat().st_size:,} bytes)")
    print(f"Built {css.relative_to(ROOT)} ({css.stat().st_size:,} bytes)")
    print(f"Built {js.relative_to(ROOT)} ({js.stat().st_size:,} bytes)")
