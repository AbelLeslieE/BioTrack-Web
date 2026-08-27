// ==========================================
// ROLE BASED SIDEBAR
// ==========================================

const sidebar = document.getElementById("sidebar-nav");

const role = (localStorage.getItem("role") || "").toLowerCase();

// ==========================================
// ADMIN MENU
// ==========================================

const adminMenu = `

<a href="#" class="nav-item active" data-page="dashboard">
    <i data-lucide="layout-dashboard"></i>
    <span>Dashboard</span>
</a>

<a href="#" class="nav-item" data-page="callManagement">
    <i data-lucide="clipboard-list"></i>
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
    <i data-lucide="clipboard-list"></i>
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
    <i data-lucide="clipboard-list"></i>
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
    <i data-lucide="clipboard-list"></i>
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

        default:

            sidebar.innerHTML = "";

    }

    lucide.createIcons();

});

// Mobile navigation remains usable on narrow screens without covering the page.
document.addEventListener("DOMContentLoaded", () => {
    const menuButton = document.querySelector(".menu-toggle");
    const appSidebar = document.querySelector(".sidebar");
    if (!menuButton || !appSidebar) return;

    const backdrop = document.createElement("button");
    backdrop.type = "button";
    backdrop.className = "sidebar-mobile-backdrop";
    backdrop.setAttribute("aria-label", "Close navigation menu");
    document.body.appendChild(backdrop);

    const closeMenu = () => {
        appSidebar.classList.remove("active");
        backdrop.classList.remove("show");
        menuButton.setAttribute("aria-expanded", "false");
    };
    const toggleMenu = () => {
        const willOpen = !appSidebar.classList.contains("active");
        appSidebar.classList.toggle("active", willOpen);
        backdrop.classList.toggle("show", willOpen);
        menuButton.setAttribute("aria-expanded", String(willOpen));
    };

    menuButton.setAttribute("aria-expanded", "false");
    menuButton.addEventListener("click", toggleMenu);
    backdrop.addEventListener("click", closeMenu);
    appSidebar.addEventListener("click", event => {
        if (event.target.closest(".nav-item") && window.matchMedia("(max-width: 768px)").matches) closeMenu();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") closeMenu();
    });
    window.addEventListener("resize", () => {
        if (!window.matchMedia("(max-width: 768px)").matches) closeMenu();
    });
});
