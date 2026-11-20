// ==========================================
// ROLE BASED SIDEBAR
// ==========================================

const sidebar = document.getElementById("sidebar-nav");

const storedRole = (localStorage.getItem("role") || "").toLowerCase();
const role = storedRole === "manager" ? "admin" : storedRole === "bme" ? "engineer" : storedRole;

// ==========================================
// ADMIN MENU
// ==========================================

const adminMenu = `

<a href="#" class="nav-item active" data-page="dashboard">
    <i data-lucide="layout-dashboard"></i>
    <span>Dashboard</span>
</a>

<a href="#" class="nav-item" data-page="callManagement">
    <i data-lucide="radio-tower"></i>
    <span>Call Management</span>
</a>

<a href="#" class="nav-item" data-page="assets">
    <i data-lucide="monitor-smartphone"></i>
    <span>Assets</span>
</a>

<a href="#" class="nav-item" data-page="pm">
    <i data-lucide="calendar-clock"></i>
    <span>Preventive Maintenance</span>
</a>

<a href="#" class="nav-item" data-page="inventory">
    <i data-lucide="boxes"></i>
    <span>Inventory</span>
</a>

<a href="#" class="nav-item" data-page="centralStore">
    <i data-lucide="warehouse"></i>
    <span>Central Store</span>
</a>

<a href="#" class="nav-item" data-page="vendors">
    <i data-lucide="handshake"></i>
    <span>Vendors & Contracts</span>
</a>

<a href="#" class="nav-item" data-page="users">
    <i data-lucide="users"></i>
    <span>Users</span>
</a>

 

<a href="#" class="nav-item" data-page="qr">
    <i data-lucide="scan-line"></i>
    <span>QR Scanner</span>
</a>

<a href="#" class="nav-item" data-page="reports">
    <i data-lucide="bar-chart-3"></i>
    <span>Reports</span>
</a>



<a href="#" class="nav-item" data-page="settings">
    <i data-lucide="settings"></i>
    <span>Settings</span>
</a>

`;

// ==========================================
// BIOMEDICAL ENGINEER MENU
// ==========================================

const engineerMenu = `

<a href="#" class="nav-item" data-page="engineerDashboard">
    <i data-lucide="layout-dashboard"></i>
    <span>Dashboard</span>
</a>
<a href="#" class="nav-item" data-page="callManagement">
    <i data-lucide="stethoscope"></i>
    <span>Call Management</span>
</a>
<a href="#" class="nav-item" data-page="pm">
    <i data-lucide="calendar-clock"></i>
    <span>Preventive Maintenance</span>
</a>

<a href="#" class="nav-item" data-page="assets">
    <i data-lucide="monitor-smartphone"></i>
    <span>Assets</span>
</a>

<a href="#" class="nav-item" data-page="inventory">
    <i data-lucide="boxes"></i>
    <span>Inventory & Parts</span>
</a>

<a href="#" class="nav-item" data-page="storeRequests">
    <i data-lucide="package-plus"></i>
    <span>Request Spare Parts</span>
</a>

<a href="#" class="nav-item" data-page="vendors">
    <i data-lucide="handshake"></i>
    <span>Vendors & Contracts</span>
</a>

<a href="#" class="nav-item" data-page="reports">
    <i data-lucide="bar-chart-3"></i>
    <span>Reports</span>
</a>

<a href="#" class="nav-item" data-page="qr">
    <i data-lucide="scan-line"></i>
    <span>QR Scanner</span>
</a>

<a href="#" class="nav-item" data-page="settings">
    <i data-lucide="settings"></i>
    <span>Settings</span>
</a>
`;

// ==========================================
// ELECTRICAL ENGINEER MENU
// ==========================================

const electricalMenu = `

<a href="#" class="nav-item" data-page="electricalDashboard">
    <i data-lucide="zap"></i>
    <span>Electrical Dashboard</span>
</a>

<a href="#" class="nav-item" data-page="callManagement">
    <i data-lucide="plug-zap"></i>
    <span>Electrical Calls</span>
</a>

<a href="#" class="nav-item" data-page="assets">
    <i data-lucide="monitor-smartphone"></i>
    <span>Assets</span>
</a>

<a href="#" class="nav-item" data-page="inventory">
    <i data-lucide="boxes"></i>
    <span>Inventory & Parts</span>
</a>

<a href="#" class="nav-item" data-page="storeRequests">
    <i data-lucide="package-plus"></i>
    <span>Request Spare Parts</span>
</a>

<a href="#" class="nav-item" data-page="vendors">
    <i data-lucide="handshake"></i>
    <span>Vendors & Contracts</span>
</a>

<a href="#" class="nav-item" data-page="settings">
    <i data-lucide="settings"></i>
    <span>Settings</span>
</a>
`;

// ==========================================
// IT DEPARTMENT MENU
// ==========================================

const itMenu = `

<a href="#" class="nav-item" data-page="itDashboard">
    <i data-lucide="monitor-cog"></i>
    <span>IT Dashboard</span>
</a>

<a href="#" class="nav-item" data-page="callManagement">
    <i data-lucide="server-cog"></i>
    <span>IT Calls</span>
</a>

<a href="#" class="nav-item" data-page="assets">
    <i data-lucide="laptop"></i>
    <span>Assets</span>
</a>

<a href="#" class="nav-item" data-page="inventory">
    <i data-lucide="boxes"></i>
    <span>Inventory & Parts</span>
</a>

<a href="#" class="nav-item" data-page="storeRequests">
    <i data-lucide="package-plus"></i>
    <span>Request Spare Parts</span>
</a>

<a href="#" class="nav-item" data-page="vendors">
    <i data-lucide="handshake"></i>
    <span>Vendors & Contracts</span>
</a>

<a href="#" class="nav-item" data-page="settings">
    <i data-lucide="settings"></i>
    <span>Settings</span>
</a>
`;
// ==========================================
// USER MENU
// ==========================================

const userMenu = `

<a href="#" class="nav-item active" data-page="userDashboard">
    <i data-lucide="layout-dashboard"></i>
    <span>Dashboard</span>
</a>

<a href="#" class="nav-item" data-page="newRequest">
    <i data-lucide="plus-circle"></i>
    <span>New Request</span>
</a>

<a href="#" class="nav-item" data-page="myRequests">
    <i data-lucide="clipboard-list"></i>
    <span>My Requests</span>
</a>

<a href="#" class="nav-item" data-page="myAssets">
    <i data-lucide="monitor-smartphone"></i>
    <span>My Assets</span>
</a>

<a href="#" class="nav-item" data-page="departmentPMSchedule">
    <i data-lucide="calendar-clock"></i>
    <span>PM Schedule</span>
</a>

<a href="#" class="nav-item" data-page="qr">
    <i data-lucide="scan-line"></i>
    <span>Scan QR</span>
</a>

<a href="#" class="nav-item" data-page="settings">
    <i data-lucide="settings"></i>
    <span>Settings</span>
</a>

`;

const wardBoyMenu = `
<a href="#" class="nav-item active" data-page="wardBoyDashboard">
    <i data-lucide="truck"></i>
    <span>Transport Jobs</span>
</a>
<a href="#" class="nav-item" data-page="settings">
    <i data-lucide="settings"></i>
    <span>Settings</span>
</a>
`;

const centralStoreMenu = `
<a href="#" class="nav-item active" data-page="centralStore">
    <i data-lucide="warehouse"></i>
    <span>Central Store</span>
</a>
<a href="#" class="nav-item" data-page="settings">
    <i data-lucide="settings"></i>
    <span>Settings</span>
</a>
`;
 
// ==========================================
// LOAD MENU
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    const sidebar = document.getElementById("sidebar-nav");

    if (!sidebar) return;

    switch (role) {

        case "manager":
        case "admin":

            sidebar.innerHTML = adminMenu;
            break;

        case "user":

            sidebar.innerHTML = userMenu;
            break;

        case "engineer":

            sidebar.innerHTML = engineerMenu;   
            break;

        case "electrical":

            sidebar.innerHTML = electricalMenu;
            break;

        case "it":

            sidebar.innerHTML = itMenu;
            break;

        case "wardboy":

            sidebar.innerHTML = wardBoyMenu;
            break;

        case "centralstore":

            sidebar.innerHTML = centralStoreMenu;
            break;

        default:

            sidebar.innerHTML = "";

    }

    lucide.createIcons();

});

// The sidebar is an on-demand drawer on desktop and mobile.
document.addEventListener("DOMContentLoaded", () => {
    const menuButton = document.querySelector(".menu-toggle");
    const appSidebar = document.querySelector(".sidebar");
    if (!menuButton || !appSidebar) return;
    const backdrop = document.createElement("button");
    backdrop.type = "button";
    backdrop.className = "sidebar-mobile-backdrop";
    backdrop.setAttribute("aria-label", "Close navigation menu");
    document.body.appendChild(backdrop);

    const closeMenu = (restoreFocus = false) => {
        appSidebar.classList.remove("active");
        backdrop.classList.remove("show");
        document.body.classList.remove("mobile-nav-open");
        appSidebar.setAttribute("aria-hidden", "true");
        appSidebar.inert = true;
        menuButton.setAttribute("aria-expanded", "false");
        menuButton.setAttribute("aria-label", "Open navigation menu");
        if (restoreFocus) menuButton.focus();
    };
    const toggleMenu = () => {
        const willOpen = !appSidebar.classList.contains("active");
        appSidebar.classList.toggle("active", willOpen);
        backdrop.classList.toggle("show", willOpen);
        document.body.classList.toggle("mobile-nav-open", willOpen);
        appSidebar.setAttribute("aria-hidden", String(!willOpen));
        appSidebar.inert = !willOpen;
        menuButton.setAttribute("aria-expanded", String(willOpen));
        menuButton.setAttribute("aria-label", willOpen ? "Close navigation menu" : "Open navigation menu");
    };

    closeMenu();
    menuButton.addEventListener("click", toggleMenu);
    backdrop.addEventListener("click", () => closeMenu(true));
    appSidebar.addEventListener("click", event => {
        if (event.target.closest(".nav-item")) closeMenu();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && appSidebar.classList.contains("active")) closeMenu(true);
    });
});
