/* ==========================================================
   BIOTRACK ENGINEER DASHBOARD
   engineerDashboard.js
========================================================== */
/* ==========================================================
   RENDER ENGINEER DASHBOARD
========================================================== */
function renderEngineerDashboard() {

    console.log("Engineer Dashboard Rendered");

    if (engineerRefreshTimer) {

        clearInterval(engineerRefreshTimer);

    }

    const pageContent = document.getElementById("page-content");

    pageContent.innerHTML = engineerDashboardView();

    if (window.lucide) {

        lucide.createIcons();

    }

    startEngineerDashboard();

}
/* ==========================================================
   INITIALIZE
========================================================== */

async function initializeEngineerDashboard() {

    initializeEngineerButtons();

    await loadEngineerDashboard();

    startEngineerAutoRefresh();

}

/* ==========================================================
   DASHBOARD LOADER
========================================================== */

async function loadEngineerDashboard() {

    try {

        const response = await fetch("/api/engineer/dashboard");

        if (!response.ok) {

            throw new Error("Failed to load engineer dashboard.");

        }

        const data = await response.json();

        updateEngineerKPIs(data);

        renderAssignedCalls(data.assigned || []);

        renderEquipmentStatus(data);

        renderActivityFeed(Array.isArray(data.activity) ? data.activity : []);

    }

    catch (error) {

        console.error(error);

    }

}

/* ==========================================================
   KPI CARDS
========================================================== */

function updateEngineerKPIs(data) {

    setEngineerValue(
        "assignedCalls",
        data.assigned_calls
    );

    setEngineerValue(
        "progressCalls",
        data.in_progress
    );

    setEngineerValue(
        "criticalCalls",
        data.critical_calls
    );

    setEngineerValue(
        "completedCalls",
        data.completed_today
    );

}

function setEngineerValue(id, value) {

    const element = document.getElementById(id);

    if (element) {

        element.textContent = value ?? 0;

    }

}

/* ==========================================================
   BUTTONS
========================================================== */

function initializeEngineerButtons() {

    document

        .querySelectorAll(".quick-actions button")

        .forEach(button => {

            button.addEventListener(

                "click",

                createEngineerRipple

            );

        });

}

/* ==========================================================
   RIPPLE EFFECT
========================================================== */

function createEngineerRipple(event) {

    const button = event.currentTarget;

    const ripple = document.createElement("span");

    const size = Math.max(

        button.clientWidth,

        button.clientHeight

    );

    const rect = button.getBoundingClientRect();

    ripple.className = "reports-ripple";

    ripple.style.width = size + "px";

    ripple.style.height = size + "px";

    ripple.style.left =

        event.clientX -

        rect.left -

        size / 2 +

        "px";

    ripple.style.top =

        event.clientY -

        rect.top -

        size / 2 +

        "px";

    button.appendChild(ripple);

    setTimeout(() => {

        ripple.remove();

    }, 600);

}

/* ==========================================================
   AUTO REFRESH
========================================================== */

let engineerRefreshTimer = null;

function startEngineerAutoRefresh() {

    if (engineerRefreshTimer) {

        clearInterval(engineerRefreshTimer);

    }

    engineerRefreshTimer = setInterval(

        loadEngineerDashboard,

        10000

    );

}
/* ==========================================================
   ASSIGNED CALLS
========================================================== */

function renderAssignedCalls(calls) {

    const container =
        document.getElementById("assignedList");

    if (!container) return;

    container.innerHTML = "";

    if (calls.length === 0) {

        container.innerHTML = `

            <div class="loading-card">

                No maintenance calls assigned.

            </div>

        `;

        return;

    }

    calls.forEach(call => {

        container.innerHTML += `

            <div class="call-card ${(call.priority || "normal").toLowerCase()}

                <div class="call-header">

                    <div>

                        <h3>${call.ticket}</h3>

                        <small>${call.department}</small>

                    </div>

                    <span class="priority ${(call.priority || "normal").toLowerCase()}">

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

                        <label>Status</label>

                        <strong>${call.status}</strong>

                    </div>

                    <div>

                        <label>Reported</label>

                        <strong>${call.reported_time}</strong>

                    </div>

                </div>

                <div class="call-actions">

                    <button
                        class="primary-btn"
                        onclick="openEngineerTicket(${call.id})">

                        Open Ticket

                    </button>

                </div>

            </div>

        `;

    });

    if (window.lucide) {

        lucide.createIcons();

    }

}

/* ==========================================================
   EQUIPMENT STATUS
========================================================== */

function renderEquipmentStatus(data) {

    setEngineerValue(

        "onlineEquipment",

        data.online_equipment

    );

    setEngineerValue(

        "offlineEquipment",

        data.offline_equipment

    );

    setEngineerValue(

        "pmDueToday",

        data.pm_due_today

    );

}

/* ==========================================================
   ACTIVITY FEED
========================================================== */

function renderActivityFeed(activity) {

    const feed =
        document.getElementById("activityFeed");

    if (!feed) return;

    feed.innerHTML = "";

    if (!activity || activity.length === 0) {

        feed.innerHTML = `

            <p>No activity available.</p>

        `;

        return;

    }

    activity.forEach(item => {

        feed.innerHTML += `

            <div class="activity-item">

                <strong>${item.title}</strong>

                <small>${item.time}</small>

            </div>

        `;

    });

}

/* ==========================================================
   OPEN TICKET
========================================================== */

function openEngineerTicket(id) {

    localStorage.setItem(

        "selectedTicket",

        id

    );

    navigate("ticket");

}

/* ==========================================================
   MODULE STARTUP
========================================================== */

async function startEngineerDashboard() {

    await initializeEngineerDashboard();

}

window.startEngineerDashboard =
    startEngineerDashboard;