// ==========================================
// MAINTENANCE VIEW
// ==========================================

let maintenanceCalls = [];
let filteredMaintenanceCalls = [];
const maintenancePagination = { page: 1, pageSize: 25 };

function renderMaintenance() {

    const role = (localStorage.getItem("role") || "").toLowerCase();
    const serviceName = role === "electrical" ? "electrical" : role === "it" ? "IT" : "biomedical";

    pageContent.innerHTML = `

    <div class="maintenance-page">

        <!-- ================================= -->
        <!-- HEADER -->
        <!-- ================================= -->

        <section class="maintenance-header">

            <div class="maintenance-title">

                <div class="page-badge">

                    <i data-lucide="clipboard-list"></i>

                    <span>Call Management</span>

                </div>

                <h1>Call Management</h1>

                <p>

                    Monitor, update and manage ${serviceName} maintenance requests.

                </p>

            </div>

            <div class="maintenance-actions">

                <div class="live-status">

                    <span class="live-dot"></span>

                    Live

                </div>

                <button
                    class="btn-secondary"
                    onclick="loadMaintenanceData()">

                    <i data-lucide="refresh-cw"></i>

                    Refresh

                </button>

            </div>

        </section>

        <!-- ================================= -->
        <!-- KPI -->
        <!-- ================================= -->

        <section class="maintenance-kpis">

            <div class="kpi-card blue">

                <div class="kpi-icon">

                    <i data-lucide="clipboard-list"></i>

                </div>

                <div class="kpi-info">

                    <h2 id="totalCalls">0</h2>

                    <span>Total Calls</span>

                </div>

            </div>

            <div class="kpi-card orange">

                <div class="kpi-icon">

                    <i data-lucide="wrench"></i>

                </div>

                <div class="kpi-info">

                    <h2 id="progressCalls">0</h2>

                    <span>In Progress</span>

                </div>

            </div>

            <div class="kpi-card green">

                <div class="kpi-icon">

                    <i data-lucide="badge-check"></i>

                </div>

                <div class="kpi-info">

                    <h2 id="completedCalls">0</h2>

                    <span>Completed</span>

                </div>

            </div>

            <div class="kpi-card purple">

                <div class="kpi-icon">

                    <i data-lucide="clock-3"></i>

                </div>

                <div class="kpi-info">

                    <h2 id="downtimeHours">0 h</h2>

                    <span>Total Downtime</span>

                </div>

            </div>

        </section>

        <!-- ================================= -->
        <!-- TOOLBAR -->
        <!-- ================================= -->

        <section class="maintenance-toolbar">

            <div class="toolbar-search">

                <i data-lucide="search"></i>

                <input

                    id="maintenanceSearch"

                    type="text"

                    placeholder="Search ticket, equipment or department..."

                >

            </div>

            <select id="maintenanceStatusFilter" aria-label="Filter tickets by status">
                <option value="">All Statuses</option>
            </select>

            <select id="maintenanceDepartmentFilter" aria-label="Filter tickets by department">
                <option value="">All Departments</option>
            </select>

        </section>

        <!-- ================================= -->
        <!-- TABLE -->
        <!-- ================================= -->

        <div class="maintenance-table-card">

            <table class="maintenance-table">

                <thead>

                    <tr>

                        <th>#</th>

                        <th>Ticket</th>

                        <th>Equipment</th>

                        <th>Department</th>

                        <th>Received</th>

                        <th>Status</th>

                        <th>Downtime</th>

                        <th>Action</th>

                    </tr>

                </thead>

                <tbody id="maintenanceTableBody">

                    <tr>

                        <td colspan="8">

                            Loading maintenance calls...

                        </td>

                    </tr>

                </tbody>

            </table>

        </div>

        <div id="maintenancePagination" class="table-pagination"></div>

    </div>

    `;

    lucide.createIcons();

    document.getElementById("maintenanceSearch").addEventListener("input", applyMaintenanceFilters);
    document.getElementById("maintenanceStatusFilter").addEventListener("change", applyMaintenanceFilters);
    document.getElementById("maintenanceDepartmentFilter").addEventListener("change", applyMaintenanceFilters);

    loadMaintenanceData();

}
// ==========================================
// LOAD MAINTENANCE DATA
// ==========================================

async function loadMaintenanceData() {

    try {

        const response = await fetch("/api/engineer/maintenance");

        if (!response.ok) {

            throw new Error("Unable to load maintenance data.");

        }

        const data = await response.json();

        // =====================================
        // KPI CARDS
        // =====================================

        const totalCalls = document.getElementById("totalCalls");
        const progressCalls = document.getElementById("progressCalls");
        const completedCalls = document.getElementById("completedCalls");
        const downtimeHours = document.getElementById("downtimeHours");

        if(totalCalls)
            totalCalls.textContent = data.total_calls ?? 0;

        if(progressCalls)
            progressCalls.textContent = data.inprogress ?? 0;

        if(completedCalls)
            completedCalls.textContent = data.completed ?? 0;

        if(downtimeHours)
            downtimeHours.textContent =
                `${Number(data.downtime ?? 0).toFixed(2)} h`;

        maintenanceCalls = Array.isArray(data.calls) ? data.calls : [];
        populateMaintenanceFilters(maintenanceCalls);
        applyMaintenanceFilters(false);

    }

    catch (error) {

        console.error(error);

        document.getElementById("maintenanceTableBody").innerHTML = `

            <tr>

                <td colspan="8">

                    Failed to load maintenance requests.

                </td>

            </tr>

        `;

    }

}

function populateMaintenanceFilters(calls) {
    const populate = (id, values, label) => {
        const select = document.getElementById(id);
        if (!select) return;
        const previous = select.value;
        const options = [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
        select.innerHTML = `<option value="">${label}</option>${options.map(value => `<option value="${String(value).replaceAll('"', '&quot;')}">${value}</option>`).join("")}`;
        if (options.includes(previous)) select.value = previous;
    };

    populate("maintenanceStatusFilter", calls.map(call => call.status), "All Statuses");
    populate("maintenanceDepartmentFilter", calls.map(call => call.department), "All Departments");
}

function applyMaintenanceFilters(resetPage = true) {
    const search = (document.getElementById("maintenanceSearch")?.value || "").trim().toLowerCase();
    const status = document.getElementById("maintenanceStatusFilter")?.value || "";
    const department = document.getElementById("maintenanceDepartmentFilter")?.value || "";

    filteredMaintenanceCalls = maintenanceCalls.filter((call) => {
        const searchable = [call.ticket, call.equipment, call.department, call.issue, call.description]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
        return (!search || searchable.includes(search))
            && (!status || call.status === status)
            && (!department || call.department === department);
    });

    if (resetPage) maintenancePagination.page = 1;
    renderMaintenanceTable(filteredMaintenanceCalls);
}

function renderMaintenanceTable(calls) {
    const tbody = document.getElementById("maintenanceTableBody");
    if (!tbody) return;

    if (calls.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="8" class="empty-table">No maintenance requests found.</td></tr>
        `;
        TablePagination.render(
            document.getElementById("maintenancePagination"),
            maintenancePagination,
            0,
            () => renderMaintenanceTable(filteredMaintenanceCalls),
            "tickets"
        );
        return;
    }

    const pageItems = TablePagination.pageItems(calls, maintenancePagination);
    const startIndex = (maintenancePagination.page - 1) * maintenancePagination.pageSize;
    tbody.innerHTML = pageItems.map((call, index) => createMaintenanceRow(call, startIndex + index)).join("");

    TablePagination.render(
        document.getElementById("maintenancePagination"),
        maintenancePagination,
        calls.length,
        () => renderMaintenanceTable(filteredMaintenanceCalls),
        "tickets"
    );

    if (window.lucide) lucide.createIcons();
}
// ==========================================
// CREATE TABLE ROW
// ==========================================

function createMaintenanceRow(call, index) {

    const priority =
        (call.priority || "Low").toLowerCase();

    const status =
        getStatusBadge(call.status);

    return `

    <tr>

        <td>

            ${index + 1}

        </td>

        <td>

            <strong class="ticket-link">

                ${call.ticket}

            </strong>

        </td>

        <td>

            <div class="equipment-cell">

                <strong>

                    ${call.equipment}

                </strong>

            </div>

        </td>

        <td>

            ${call.department}

        </td>

        <td>

            ${call.received}

        </td>

        <td>

            ${status}

        </td>

        <td>

            ${formatDowntime(call.downtime)}

        </td>

        <td>

            <button 

                class="view-btn"

                onclick="openTicket(${call.id})"

            >

                <i data-lucide="eye"></i>

                View

            </button>

        </td>

    </tr>

    `;

}
// ==========================================
// STATUS BADGE
// ==========================================

function getStatusBadge(status) {

    switch (status) {

        case "Open":

            return `
                <span class="status open">
                    Open
                </span>
            `;

        case "Assigned":

            return `
                <span class="status assigned">
                    Assigned
                </span>
            `;

        case "In Progress":

            return `
                <span class="status progress">
                    In Progress
                </span>
            `;

        case "Awaiting Parts":

            return `
                <span class="status awaiting">
                    Awaiting Parts
                </span>
            `;

        case "Completed":

            return `
                <span class="status completed">
                    Completed
                </span>
            `;

        case "Closed":

            return `
                <span class="status closed">
                    Closed
                </span>
            `;

        default:

            return `
                <span class="status open">
                    ${status}
                </span>
            `;

    }

}
// ==========================================
// REFRESH BUTTON
// ==========================================

document.addEventListener("click",function(e){

    if(
        e.target.closest(".btn-secondary")
    ){

        loadMaintenanceData();

    }

});
// ==========================================
// AUTO REFRESH
// ==========================================

setInterval(()=>{

    if(
        document.getElementById(
            "maintenanceTableBody"
        )
    ){

        loadMaintenanceData();

    }

},5000);
// ==========================================
// EMPTY TABLE
// ==========================================

function showEmptyTable(){

    document.getElementById(
        "maintenanceTableBody"
    ).innerHTML = `

        <tr>

            <td colspan="8" class="empty-table">

                No maintenance requests found.

            </td>

        </tr>

    `;

}
// ==========================================
// FORMAT DOWNTIME
// ==========================================

function formatDowntime(hours) {

    hours = Number(hours || 0);

    const totalMinutes = Math.floor(hours * 60);

    const h = Math.floor(totalMinutes / 60);

    const m = totalMinutes % 60;

    if (h === 0) {

        return `${m} min`;

    }

    return `${h}h ${m}m`;

}

// ==========================================
// LIVE STATUS
// ==========================================

function updateLiveStatus() {

    const liveText = document.querySelector(".live-status small");

    if (!liveText) return;

    const now = new Date();

    liveText.textContent =
        "Updated " +
        now.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });

}

updateLiveStatus();

setInterval(updateLiveStatus,60000);

// ==========================================
// REFRESH PAGE
// ==========================================

async function refreshMaintenancePage(){

    await loadMaintenanceData();

    updateLiveStatus();

}

// ==========================================
// LOADING STATE
// ==========================================

function showLoading(){

    const tbody =
        document.getElementById("maintenanceTableBody");

    if(!tbody) return;

    tbody.innerHTML=`

    <tr>

        <td colspan="8" class="loading-row">

            <i data-lucide="loader-circle" class="spin"></i>

            Loading maintenance requests...

        </td>

    </tr>

    `;

    lucide.createIcons();

}

// ==========================================
// ERROR STATE
// ==========================================

function showError(message){

    const tbody =
        document.getElementById("maintenanceTableBody");

    if(!tbody) return;

    tbody.innerHTML=`

    <tr>

        <td colspan="8" class="empty-table">

            ⚠ ${message}

        </td>

    </tr>

    `;

}

// ==========================================
// INITIALIZE EVENTS
// ==========================================

document.addEventListener("click",(e)=>{

    const refreshButton =
        e.target.closest(".btn-secondary");

    if(!refreshButton)
        return;

    refreshMaintenancePage();

});

// ==========================================
// PAGE CLEANUP
// ==========================================

window.addEventListener("beforeunload",()=>{

    console.log("Maintenance module closed.");

});
