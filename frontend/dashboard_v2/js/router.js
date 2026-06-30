// ==========================================
// PAGE CONTENT
// ==========================================

const pageContent = document.getElementById("page-content");
// ==========================================
// CURRENT SELECTED ASSET
// ==========================================

let currentAssetId = null;

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
    newRequest: renderNewRequest,
    myRequests: renderMyRequests,
    // Biomedical Engineer
    engineerDashboard: renderEngineerDashboard,
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
    departments: renderDepartments,
    qr: renderQR,
    settings: renderSettings

};

// ==========================================
// NAVIGATE
// ==========================================

function navigate(page) {

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
    Pages[page]();

    // Refresh Lucide icons for dynamically rendered pages
    if (window.lucide) {

        lucide.createIcons();

    }

}

// ==========================================
// SIDEBAR EVENTS
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    const role = (localStorage.getItem("role") || "").toLowerCase();
    // Default page based on role
    switch (role) {

        case "admin":
        case "manager":

            navigate("dashboard");

            break;

        case "user":
            navigate("userDashboard");
            break;

        case "engineer":

        navigate("engineerDashboard");

        break;

        default:

            window.location.href = "/";

            return;

    }

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