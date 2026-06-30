// ==========================================
// BIOMEDICAL ENGINEER DASHBOARD
// ==========================================

async function renderEngineerDashboard() {
    // ==========================================
    // LOAD DASHBOARD DATA
    // ==========================================

    const response = await fetch("/api/engineer/dashboard");
    const data = await response.json();
    pageContent.innerHTML = `

        <div class="maintenance-dashboard">

            <!-- ====================================== -->
            <!-- HEADER -->
            <!-- ====================================== -->

            <div class="maintenance-header">

                <div>

                    <button class="back-btn"
                        onclick="navigate('dashboard')">

                        <i data-lucide="arrow-left"></i>

                        Back to Dashboard

                    </button>

                    <h1>

                        Maintenance Calls

                    </h1>

                    <p>

                        All biomedical maintenance requests assigned to you.

                    </p>

                </div>

                <div class="maintenance-tools">

                    <div class="search-box">

                        <i data-lucide="search"></i>

                        <input
                            type="text"
                            id="maintenanceSearch"
                            placeholder="Search by Token / Equipment / Department">

                    </div>

                    <button class="filter-btn">

                        <i data-lucide="filter"></i>

                        Filter

                    </button>

                </div>

            </div>

            <!-- ====================================== -->
            <!-- KPI CARDS -->
            <!-- ====================================== -->

            <div class="maintenance-kpis">

                <div class="kpi-card">

                    <i data-lucide="clipboard-list"></i>

                    <div>

                        <h2 id="totalCalls">0</h2>

                        <span>Total Calls</span>

                    </div>

                </div>

                <div class="kpi-card orange">

                    <i data-lucide="wrench"></i>

                    <div>

                        <h2 id="progressCalls">0</h2>

                        <span>In Progress</span>

                    </div>

                </div>

                <div class="kpi-card green">

                    <i data-lucide="badge-check"></i>

                    <div>

                        <h2 id="completedCalls">0</h2>

                        <span>Completed</span>

                    </div>

                </div>

                <div class="kpi-card purple">

                    <i data-lucide="clock-3"></i>

                    <div>

                        <h2 id="totalDowntime">

                            0h

                        </h2>

                        <span>Total Downtime</span>

                    </div>

                </div>

            </div>

            <!-- ====================================== -->
            <!-- TABLE -->
            <!-- ====================================== -->

            <div class="maintenance-table-card">

                <div class="table-header">

                    <h2>

                        <i data-lucide="list"></i>

                        All Maintenance Calls

                    </h2>

                </div>

                <table class="maintenance-table">

                    <thead>

                        <tr>

                            <th>#</th>

                            <th>Token</th>

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

        </div>

        `;

    lucide.createIcons();

    loadEngineerDashboard();

}
// ==========================================
// LOAD ENGINEER DASHBOARD
// ==========================================

// ==========================================
// LOAD ENGINEER DASHBOARD
// ==========================================

async function loadEngineerDashboard() {

    try {

        const res = await fetch("/api/engineer/dashboard");

        const data = await res.json();

        // ==========================
        // KPI CARDS
        // ==========================

        document.getElementById("assignedCalls").textContent =
            data.assigned_calls;

        document.getElementById("progressCalls").textContent =
            data.in_progress;

        document.getElementById("criticalCalls").textContent =
            data.critical_calls;

        document.getElementById("completedCalls").textContent =
            data.completed_today;

        // ==========================
        // ASSIGNED CALLS
        // ==========================

        const assignedList = document.getElementById("assignedList");

        assignedList.innerHTML = "";

        data.assigned.forEach(call => {

            assignedList.innerHTML += `

            <div class="call-card ${call.priority.toLowerCase()}">

                <div class="call-header">

                    <div>

                        <h3>${call.ticket}</h3>

                        <small>${call.department}</small>

                    </div>

                    <span class="priority ${call.priority.toLowerCase()}">

                        ${call.priority}

                    </span>

                </div>

                <div class="call-grid">

                    <div>

                        <label>Equipment</label>

                        <strong>${call.equipment}</strong>

                    </div>

                    <div>

                        <label>Equipment ID</label>

                        <strong>${call.equipment_id}</strong>

                    </div>

                    <div>

                        <label>Issue</label>

                        <strong>${call.issue}</strong>

                    </div>

                    <div>

                        <label>Status</label>

                        <strong>${call.status}</strong>

                    </div>

                    <div>

                        <label>Location</label>

                        <strong>${call.location}</strong>

                    </div>

                    <div>

                        <label>Reported By</label>

                        <strong>${call.reported_by}</strong>

                    </div>

                    <div>

                        <label>Received</label>

                        <strong>${call.reported_time}</strong>

                    </div>

                </div>

                <div class="call-actions">

                    <button
                        class="open-ticket-btn"
                        onclick="openTicket(${call.id})">

                        Open Ticket

                    </button>

                </div>

            </div>

            `;

        });

    }

    catch (err) {

        console.error(err);

    }

}
// ==========================================
// AUTO REFRESH
// ==========================================

setInterval(() => {

    if(document.getElementById("assignedCalls")){

        loadEngineerDashboard();

    }

},5000);
// ==========================================
// OPEN TICKET
// ==========================================

function openTicket(id){

    localStorage.setItem("selectedTicket", id);

    navigate("ticket");

}