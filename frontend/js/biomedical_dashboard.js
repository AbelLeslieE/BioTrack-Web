/* ==========================================================
   BIOTRACK ENGINEER DASHBOARD
   engineerDashboard.js
========================================================== */
/* ==========================================================
   RENDER ENGINEER DASHBOARD
========================================================== */
function renderEngineerDashboard() {

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

function renderElectricalDashboard() {

    renderEngineerDashboard();

}

function renderITDashboard() {

    renderEngineerDashboard();

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

            <div class="call-card ${engineerClassToken(call.priority)}">

                <div class="call-header">

                    <div>

                        <h3>${escapeHTML(call.ticket)}</h3>

                        <small>${escapeHTML(call.department)}</small>

                    </div>

                    <span class="priority ${engineerClassToken(call.priority)}">

                        ${escapeHTML(call.priority)}

                    </span>

                </div>

                <div class="call-grid">

                    <div>

                        <label>Equipment</label>

                        <strong>${escapeHTML(call.equipment)}</strong>

                    </div>

                    <div>

                        <label>Equipment ID</label>

                        <strong>${escapeHTML(call.equipment_id)}</strong>

                    </div>

                    <div>

                        <label>Status</label>

                        <strong>${escapeHTML(call.status)}</strong>

                    </div>

                    <div>

                        <label>Reported</label>

                        <strong>${escapeHTML(call.reported_time)}</strong>

                    </div>

                </div>

                <p class="call-description">
                    <strong>${escapeHTML(call.issue || "Maintenance issue")}:</strong>
                    ${escapeHTML(call.description || "No description provided.")}
                </p>

                <div class="call-actions">

                    <button
                        class="primary-btn"
                        onclick="openEngineerTicket(${Number(call.id)})">

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

function engineerClassToken(value) {
    return String(value || "normal").toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
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

                <strong>${escapeHTML(item.title)}</strong>

                <small>${escapeHTML(item.time)}</small>

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

function navigateToEngineerHome() {

    navigate(
        (localStorage.getItem("role") || "").toLowerCase() === "electrical"
            ? "electricalDashboard"
            : (localStorage.getItem("role") || "").toLowerCase() === "it"
                ? "itDashboard"
                : "engineerDashboard"
    );

}

/* ==========================================================
   MODULE STARTUP
========================================================== */

async function startEngineerDashboard() {

    await initializeEngineerDashboard();

}

window.startEngineerDashboard =
    startEngineerDashboard;
window.renderElectricalDashboard = renderElectricalDashboard;
window.renderITDashboard = renderITDashboard;
window.navigateToEngineerHome = navigateToEngineerHome;
