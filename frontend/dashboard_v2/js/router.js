// ==========================================
// PAGE CONTENT
// ==========================================

const pageContent = document.getElementById("page-content");

function normalizeDashboardRole(value) {
    const role = String(value || "").trim().toLowerCase();
    if (role === "manager") return "admin";
    if (role === "bme") return "engineer";
    return role;
}

const ROLE_HOME_PAGES = {
    admin: "dashboard",
    engineer: "engineerDashboard",
    electrical: "electricalDashboard",
    it: "itDashboard",
    user: "userDashboard",
    wardboy: "wardBoyDashboard",
};

const ROLE_PAGE_ACCESS = {
    admin: new Set(["dashboard", "ticket", "callManagement", "callAssignment", "maintenance", "assets", "assetForm", "assetDetails", "inventory", "pm", "reports", "users", "qr", "qrAssetProfile", "settings"]),
    engineer: new Set(["engineerDashboard", "ticket", "callManagement", "maintenance", "assets", "assetForm", "assetDetails", "inventory", "pm", "reports", "qr", "qrAssetProfile", "settings"]),
    electrical: new Set(["electricalDashboard", "ticket", "callManagement", "maintenance", "assets", "assetForm", "assetDetails", "inventory", "qr", "qrAssetProfile", "settings"]),
    it: new Set(["itDashboard", "ticket", "callManagement", "maintenance", "assets", "assetForm", "assetDetails", "inventory", "qr", "qrAssetProfile", "settings"]),
    user: new Set(["userDashboard", "newRequest", "myRequests", "myAssets", "assetDetails", "departmentPMSchedule", "requestDetails", "qr", "qrAssetProfile", "settings"]),
    wardboy: new Set(["wardBoyDashboard", "settings"]),
};
// ==========================================
// CURRENT SELECTED ASSET
// ==========================================

let currentAssetId = null;
let currentQRAssetId = null;

// ==========================================
// PAGE REGISTRY
// ==========================================

const Pages = {

    // Administrator
    dashboard: renderDashboard,
    ticket: renderTicket,
    
    // Department User
    // Department User
    userDashboard: renderUserDashboard,
    wardBoyDashboard: renderWardBoyDashboard,
    newRequest: renderNewRequest,
    myRequests: renderMyRequests,
    myAssets: renderMyAssets,
    departmentPMSchedule: renderDepartmentPMSchedule,
    requestDetails: renderRequestDetails,
    
    // Biomedical Engineer
    engineerDashboard: renderEngineerDashboard,
    electricalDashboard: renderElectricalDashboard,
    itDashboard: renderITDashboard,
    callManagement: renderMaintenance,
    // Admin
    callAssignment: renderMaintenance,

    maintenance: renderMaintenanceModule,
    assets: renderAssets,
    assetForm: renderAssetForm,
    assetDetails: renderAssetDetails,
    inventory: renderInventory,
    pm: renderPM,
    reports: renderReports,
    ai: renderAI,
    users: renderUsers,
    qr: renderQRScannerModule,
    qrAssetProfile: renderQRAssetProfile,
    settings: renderSettings

};

// ==========================================
// NAVIGATE
// ==========================================

function navigate(page) {
    const role = normalizeDashboardRole(localStorage.getItem("role"));
    const allowedPages = ROLE_PAGE_ACCESS[role];

    if (page !== "wardBoyDashboard" && typeof cleanupWardBoyDashboard === "function") cleanupWardBoyDashboard();

    if (!allowedPages || !allowedPages.has(page)) {
        const homePage = ROLE_HOME_PAGES[role];
        console.warn(`Blocked navigation to ${page} for role ${role || "unknown"}.`);
        if (!homePage) {
            window.location.href = "/";
            return;
        }
        if (page !== homePage && Pages[homePage]) navigate(homePage);
        return;
    }

    if (
        page !== "qr"
        && typeof isQRScannerActive === "function"
        && isQRScannerActive()
        && typeof closeQRScanner === "function"
    ) {
        void closeQRScanner();
    }

    if (page !== "inventory") {
        if (typeof closeInventoryModal === "function") closeInventoryModal();
        if (typeof closeInventoryDeleteDialog === "function") closeInventoryDeleteDialog();
    }

    if (page !== "assets" && typeof closeAssetManagementDialog === "function") {
        closeAssetManagementDialog();
    }

    if (!["assets", "myAssets"].includes(page) && typeof closeAssetRelocationDialog === "function") {
        closeAssetRelocationDialog();
    }

    if (page !== "reports" && typeof cleanupReportsSchedules === "function") {
        cleanupReportsSchedules();
    }

    // Check page exists
    if (!Pages[page]) {

        console.error("Page not found:", page);
        return;

    }

    // Sidebar Active State
    document.querySelectorAll(".nav-item").forEach(item => {

        item.classList.remove("active");

    });

    const activeItem = document.querySelector(`[data-page="${page}"]`);

    if (activeItem) {

        activeItem.classList.add("active");

    }

    // Render selected page
    // Render selected page

    console.log("Navigating to:", page);

    Pages[page]();

    if (page === "qr" && typeof openQRScanner === "function") {
        window.setTimeout(openQRScanner, 0);
    }

    // Refresh Lucide icons for dynamically rendered pages
    if (window.lucide) {

        lucide.createIcons();

    }

}

// ==========================================
// SIDEBAR EVENTS
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {

    if (typeof validateDashboardSession === "function") {
        const sessionIsValid = await validateDashboardSession();
        if (!sessionIsValid) return;
    }

    const role = normalizeDashboardRole(localStorage.getItem("role"));
    const homePage = ROLE_HOME_PAGES[role];
    if (!homePage) {
        window.location.href = "/";
        return;
    }
    const requestedPage = new URLSearchParams(window.location.search).get("page");
    navigate(requestedPage && ROLE_PAGE_ACCESS[role].has(requestedPage) ? requestedPage : homePage);

    // Sidebar navigation
    document.querySelectorAll(".nav-item").forEach(item => {

        item.addEventListener("click", function (e) {

            e.preventDefault();

            const page = this.dataset.page;

            if (page) {

                navigate(page);

            }

        });

    });

});
// ==========================================
// OPEN ASSET DETAILS
// ==========================================

function openAssetPage(assetId) {

    currentAssetId = assetId;

    navigate("assetDetails");

}

function openQRAssetProfile(assetId) {
    currentQRAssetId = Number(assetId);
    navigate("qrAssetProfile");
}
