// ==========================================
// PM DASHBOARD VIEW
// ==========================================

function renderPM() {

    pageContent.innerHTML = `

    <!-- =====================================
         HERO
    ====================================== -->

    <section class="dashboard-hero">

        <h1>Preventive Maintenance</h1>

        <p>

            Plan, monitor and manage preventive maintenance schedules
            for all biomedical equipment.

        </p>

    </section>

    <!-- =====================================
         PM KPI
    ====================================== -->

    <section class="dashboard-section">

        <div class="section-header">

            <h2>📅 Preventive Maintenance Overview</h2>

            <p>Live PM statistics across the hospital</p>

        </div>

        <div class="dashboard-kpi maintenance-grid">

            <div class="kpi-card">

                <div class="kpi-icon blue">

                    <i data-lucide="calendar-days"></i>

                </div>

                <div class="kpi-content">

                    <h2 id="pmUpcoming">0</h2>

                    <p>Upcoming PM</p>

                </div>

            </div>

            <div class="kpi-card">

                <div class="kpi-icon orange">

                    <i data-lucide="calendar-clock"></i>

                </div>

                <div class="kpi-content">

                    <h2 id="pmDue">0</h2>

                    <p>Due Today</p>

                </div>

            </div>

            <div class="kpi-card">

                <div class="kpi-icon red">

                    <i data-lucide="triangle-alert"></i>

                </div>

                <div class="kpi-content">

                    <h2 id="pmOverdue">0</h2>

                    <p>Overdue</p>

                </div>

            </div>

            <div class="kpi-card">

                <div class="kpi-icon teal">

                    <i data-lucide="check-circle-2"></i>

                </div>

                <div class="kpi-content">

                    <h2 id="pmCompleted">0</h2>

                    <p>Completed</p>

                </div>

            </div>

        </div>

    </section>

    <!-- =====================================
         TOOLBAR
    ====================================== -->

    <section class="dashboard-section">

        <div class="pm-toolbar">

            <input
                id="pmSearch"
                type="text"
                placeholder="Search Equipment..."
            >

            <select id="pmDepartment">

                <option value="">All Departments</option>

            </select>

            <select id="pmEngineer">

                <option value="">All Engineers</option>

            </select>

            <select id="pmStatus">

                <option value="">All Status</option>

                <option>Upcoming</option>

                <option>Due</option>

                <option>Overdue</option>

                <option>Completed</option>

            </select>

            <button
                class="primary-btn"
                id="addPMSchedule"
            >

                <i data-lucide="plus"></i>

                Schedule PM

            </button>

        </div>

    </section>

    <!-- =====================================
         CALENDAR
    ====================================== -->

    <section class="dashboard-section">

        <div class="analytics-card">

            <div class="card-header">

                <h2>PM Calendar</h2>

            </div>

            <div id="pmCalendar">

                Loading calendar...

            </div>

        </div>

    </section>

    <!-- =====================================
         PM TABLE
    ====================================== -->

    <section class="dashboard-section">

        <div class="analytics-card">

            <div class="card-header">

                <h2>Scheduled Preventive Maintenance</h2>

            </div>

            <div id="pmTable">

                Loading schedules...

            </div>

        </div>

    </section>

    <!-- =====================================
         PM HISTORY
    ====================================== -->

    <section class="dashboard-section">

        <div class="analytics-card">

            <div class="card-header">

                <h2>Recent PM History</h2>

            </div>

            <div id="pmHistory">

                Loading history...

            </div>

        </div>

    </section>

    `;

    lucide.createIcons();

    loadPMDashboard();

    //loadPMCalendar();

    loadPMTable();

    loadPMHistory();

    if (window.pmRefresh) {

        clearInterval(window.pmRefresh);

    }

    window.pmRefresh = setInterval(() => {

        loadPMDashboard();

        //loadPMCalendar();

        loadPMTable();

        loadPMHistory();

    }, 30000);

}
// ==========================================
// LOAD PM DASHBOARD
// ==========================================

async function loadPMDashboard() {

    try {

        const response = await fetch("/api/pm/dashboard");

        if (!response.ok) {

            throw new Error("Unable to load PM Dashboard");

        }

        const data = await response.json();

        document.getElementById("pmUpcoming").textContent =
            data.upcoming ?? 0;

        document.getElementById("pmDue").textContent =
            data.due ?? 0;

        document.getElementById("pmOverdue").textContent =
            data.overdue ?? 0;

        document.getElementById("pmCompleted").textContent =
            data.completed ?? 0;

    }

    catch (error) {

        console.error(error);

        document.getElementById("pmUpcoming").textContent = "--";

        document.getElementById("pmDue").textContent = "--";

        document.getElementById("pmOverdue").textContent = "--";

        document.getElementById("pmCompleted").textContent = "--";

    }

}
// ==========================================
// LOAD PM TABLE
// ==========================================

async function loadPMTable() {

    const tableContainer = document.getElementById("pmTable");

    try {

        const response = await fetch("/api/pm/all");

        if (!response.ok) {

            throw new Error("Unable to load PM Schedule");

        }

        const schedules = await response.json();

        if (schedules.length === 0) {

            tableContainer.innerHTML = `

                <div class="empty-state">

                    <i data-lucide="calendar-x"></i>

                    <h3>No Preventive Maintenance Scheduled</h3>

                    <p>

                        Click "Schedule PM" to create your first
                        preventive maintenance schedule.

                    </p>

                </div>

            `;

            lucide.createIcons();

            return;

        }

        let html = `

        <table class="pm-table">

            <thead>

                <tr>

                    <th>Equipment</th>

                    <th>Department</th>

                    <th>Engineer</th>

                    <th>Next PM</th>

                    <th>Status</th>

                    <th>Action</th>

                </tr>

            </thead>

            <tbody>

        `;

        schedules.forEach(schedule => {

            html += `

            <tr>

                <td>

                    <strong>

                        ${schedule.asset?.equipment_name || "Unknown"}

                    </strong>

                </td>

                <td>

                    ${schedule.department || "-"}

                </td>

                <td>

                    ${schedule.engineer_name || "Unassigned"}

                </td>

                <td>

                    ${schedule.scheduled_date}

                </td>

                <td>

                    ${getPMBadge(schedule.status)}

                </td>

                <td>

                    <button
                        class="table-btn"
                        onclick="viewPM(${schedule.id})"
                    >

                        View

                    </button>

                </td>

            </tr>

            `;

        });

        html += `

            </tbody>

        </table>

        `;

        tableContainer.innerHTML = html;

    }

    catch(error){

        console.error(error);

        tableContainer.innerHTML = `

            <div class="error-state">

                Unable to load PM Schedule

            </div>

        `;

    }

}
// ==========================================
// PM STATUS BADGE
// ==========================================

function getPMBadge(status){

    switch(status){

        case "Upcoming":

            return `<span class="badge badge-blue">

                        Upcoming

                    </span>`;

        case "Due":

            return `<span class="badge badge-orange">

                        Due

                    </span>`;

        case "Overdue":

            return `<span class="badge badge-red">

                        Overdue

                    </span>`;

        case "Completed":

            return `<span class="badge badge-green">

                        Completed

                    </span>`;

        default:

            return `<span class="badge">

                        Unknown

                    </span>`;

    }

}
// ==========================================
// VIEW PM
// ==========================================

function viewPM(id){

    console.log("Open PM", id);

}