// ==========================================
// ROLE-AWARE CALL MANAGEMENT
// ==========================================

let maintenanceCalls = [];
let filteredMaintenanceCalls = [];
let maintenanceStatusMode = "all";
let maintenanceRefreshTimer = null;
const maintenancePagination = { page: 1, pageSize: 25 };
const DOWNTIME_SECRET_CLICK_COUNT = 15;
const DOWNTIME_SECRET_CLICK_WINDOW_MS = 10000;
let downtimeSecretClickState = { ticket: "", count: 0, lastClick: 0 };

const MAINTENANCE_PORTALS = {
    admin: {
        tone: "all", icon: "activity", eyebrow: "Hospital operations control", scope: "All engineering teams",
        description: "Coordinate Biomedical, Electrical and IT maintenance calls from one live service queue.",
    },
    manager: {
        tone: "all", icon: "activity", eyebrow: "Hospital operations control", scope: "All engineering teams",
        description: "Coordinate Biomedical, Electrical and IT maintenance calls from one live service queue.",
    },
    bme: {
        tone: "biomedical", icon: "heart-pulse", eyebrow: "Biomedical service desk", scope: "Biomedical Engineering",
        description: "Prioritise, repair and close biomedical equipment calls with a clear view of downtime and urgency.",
    },
    engineer: {
        tone: "biomedical", icon: "heart-pulse", eyebrow: "Biomedical service desk", scope: "Biomedical Engineering",
        description: "Prioritise, repair and close biomedical equipment calls with a clear view of downtime and urgency.",
    },
    electrical: {
        tone: "electrical", icon: "plug-zap", eyebrow: "Electrical service desk", scope: "Electrical Engineering",
        description: "Track electrical faults, active repairs and service delays across the hospital.",
    },
    it: {
        tone: "it", icon: "server-cog", eyebrow: "IT service desk", scope: "IT Engineering",
        description: "Manage technology incidents, infrastructure repairs and equipment downtime from one queue.",
    },
};

function maintenancePortalConfig() {
    const role = (localStorage.getItem("role") || "manager").trim().toLowerCase();
    return MAINTENANCE_PORTALS[role] || MAINTENANCE_PORTALS.manager;
}

function renderMaintenance() {
    const portal = maintenancePortalConfig();
    maintenanceStatusMode = "all";
    maintenanceCalls = [];
    filteredMaintenanceCalls = [];
    if (maintenanceRefreshTimer) clearInterval(maintenanceRefreshTimer);

    pageContent.innerHTML = `
        <div class="maintenance-page" data-maintenance-portal="${portal.tone}">
            <section class="maintenance-command-hero is-${portal.tone}">
                <div class="maintenance-hero-copy">
                    <div class="maintenance-hero-identity">
                        <span class="maintenance-hero-icon"><i data-lucide="${portal.icon}"></i></span>
                        <div><span class="maintenance-eyebrow">${portal.eyebrow}</span><h1>Call Management</h1></div>
                    </div>
                    <p>${portal.description}</p>
                </div>
                <div class="maintenance-hero-control">
                    <div class="maintenance-live-panel">
                        <span class="maintenance-live-icon"><i data-lucide="radio-tower"></i></span>
                        <div><small>Live service queue</small><strong>${portal.scope}</strong><time id="maintenanceUpdatedAt">Updating now…</time></div>
                        <span class="maintenance-live-dot" aria-label="Live"></span>
                    </div>
                    <button id="refreshMaintenanceButton" class="maintenance-refresh-button" type="button"><i data-lucide="refresh-cw"></i><span>Refresh queue</span></button>
                </div>
            </section>

            <section class="maintenance-kpis" aria-label="Call summary">
                <article class="maintenance-metric is-blue"><span class="maintenance-metric-icon"><i data-lucide="ticket-check"></i></span><div><small>Total requests</small><strong id="totalCalls">0</strong><em>All recorded service calls</em></div></article>
                <article class="maintenance-metric is-cyan"><span class="maintenance-metric-icon"><i data-lucide="radio"></i></span><div><small>Active queue</small><strong id="activeCalls">0</strong><em>Calls still requiring action</em></div></article>
                <article class="maintenance-metric is-orange"><span class="maintenance-metric-icon"><i data-lucide="wrench"></i></span><div><small>In progress</small><strong id="progressCalls">0</strong><em>Repairs currently underway</em></div></article>
                <article class="maintenance-metric is-red"><span class="maintenance-metric-icon"><i data-lucide="siren"></i></span><div><small>Critical priority</small><strong id="criticalCalls">0</strong><em>Active calls needing priority</em></div></article>
                <article class="maintenance-metric is-green"><span class="maintenance-metric-icon"><i data-lucide="circle-check-big"></i></span><div><small>Completed</small><strong id="completedCalls">0</strong><em>Resolved and closed calls</em></div></article>
            </section>

            <section class="maintenance-workspace">
                <header class="maintenance-workspace-header">
                    <div><span class="maintenance-section-kicker"><i data-lucide="list-filter"></i> Service request queue</span><h2>Maintenance calls</h2><p id="maintenanceResultsSummary">Loading service requests…</p></div>
                    <div class="maintenance-downtime-summary"><span><i data-lucide="timer"></i></span><div><small>Total recorded downtime</small><strong id="downtimeHours">0 h</strong></div></div>
                </header>

                <nav class="maintenance-status-tabs" aria-label="Filter calls by workflow status">
                    <button type="button" class="is-active" data-maintenance-tab="all"><i data-lucide="list"></i><span>All</span><em data-maintenance-count="all">0</em></button>
                    <button type="button" data-maintenance-tab="active"><i data-lucide="radio"></i><span>Active</span><em data-maintenance-count="active">0</em></button>
                    <button type="button" data-maintenance-tab="Open"><i data-lucide="inbox"></i><span>Open</span><em data-maintenance-count="Open">0</em></button>
                    <button type="button" data-maintenance-tab="In Progress"><i data-lucide="wrench"></i><span>In progress</span><em data-maintenance-count="In Progress">0</em></button>
                    <button type="button" data-maintenance-tab="Awaiting Parts"><i data-lucide="package-search"></i><span>Awaiting parts</span><em data-maintenance-count="Awaiting Parts">0</em></button>
                    <button type="button" data-maintenance-tab="completed"><i data-lucide="circle-check"></i><span>Completed</span><em data-maintenance-count="completed">0</em></button>
                </nav>

                <div class="maintenance-toolbar">
                    <label class="maintenance-search-field"><i data-lucide="search"></i><span class="sr-only">Search maintenance calls</span><input id="maintenanceSearch" type="search" placeholder="Search ticket, equipment, issue or department…" autocomplete="off"></label>
                    <label class="maintenance-select-field"><i data-lucide="building-2"></i><span class="sr-only">Filter by department</span><select id="maintenanceDepartmentFilter"><option value="">All departments</option></select></label>
                    <label class="maintenance-select-field"><i data-lucide="shield-alert"></i><span class="sr-only">Filter by priority</span><select id="maintenancePriorityFilter"><option value="">All priorities</option><option value="Critical">Critical</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select></label>
                    <button id="clearMaintenanceFilters" class="maintenance-clear-button" type="button"><i data-lucide="filter-x"></i><span>Clear</span></button>
                </div>

                <div class="maintenance-table-card">
                    <table class="maintenance-table">
                        <thead><tr><th>Request</th><th>Equipment</th><th>Team & department</th><th>Received</th><th>Status</th><th>Downtime</th><th><span class="sr-only">Action</span></th></tr></thead>
                        <tbody id="maintenanceTableBody"><tr><td colspan="7">Loading maintenance calls…</td></tr></tbody>
                    </table>
                </div>
                <div id="maintenancePagination" class="table-pagination"></div>
            </section>
        </div>
    `;

    document.getElementById("refreshMaintenanceButton")?.addEventListener("click", refreshMaintenancePage);
    document.getElementById("maintenanceSearch")?.addEventListener("input", applyMaintenanceFilters);
    document.getElementById("maintenanceDepartmentFilter")?.addEventListener("change", applyMaintenanceFilters);
    document.getElementById("maintenancePriorityFilter")?.addEventListener("change", applyMaintenanceFilters);
    document.getElementById("clearMaintenanceFilters")?.addEventListener("click", clearMaintenanceFilters);
    document.querySelectorAll("[data-maintenance-tab]").forEach(button => button.addEventListener("click", () => {
        maintenanceStatusMode = button.dataset.maintenanceTab;
        document.querySelectorAll("[data-maintenance-tab]").forEach(tab => tab.classList.toggle("is-active", tab === button));
        applyMaintenanceFilters();
    }));

    window.lucide?.createIcons();
    loadMaintenanceData();
    maintenanceRefreshTimer = setInterval(() => {
        if (document.getElementById("maintenanceTableBody")) loadMaintenanceData({ silent: true });
        else clearInterval(maintenanceRefreshTimer);
    }, 60000);
}

async function loadMaintenanceData({ silent = false } = {}) {
    const refreshButton = document.getElementById("refreshMaintenanceButton");
    if (!silent) showLoading();
    refreshButton?.classList.add("is-loading");
    if (refreshButton) refreshButton.disabled = true;
    try {
        const response = await fetch("/api/engineer/maintenance", { headers: { Accept: "application/json" } });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "Unable to load maintenance data.");
        maintenanceCalls = Array.isArray(data.calls) ? data.calls : [];
        updateMaintenanceMetrics(data);
        populateMaintenanceFilters(maintenanceCalls);
        updateMaintenanceTabCounts();
        applyMaintenanceFilters(false);
        updateLiveStatus();
    } catch (error) {
        showError(error.message || "Unable to load maintenance requests.");
        window.BioTrackToast?.error?.("Call queue unavailable", error.message || "Unable to load maintenance requests.");
    } finally {
        refreshButton?.classList.remove("is-loading");
        if (refreshButton) refreshButton.disabled = false;
    }
}

function updateMaintenanceMetrics(data) {
    const active = maintenanceCalls.filter(call => !["Completed", "Closed"].includes(call.status)).length;
    const critical = maintenanceCalls.filter(call => call.priority === "Critical" && !["Completed", "Closed"].includes(call.status)).length;
    const values = {
        totalCalls: data.total_calls ?? maintenanceCalls.length,
        activeCalls: active,
        progressCalls: data.inprogress ?? maintenanceCalls.filter(call => call.status === "In Progress").length,
        criticalCalls: critical,
        completedCalls: data.completed ?? maintenanceCalls.filter(call => ["Completed", "Closed"].includes(call.status)).length,
    };
    Object.entries(values).forEach(([id, value]) => {
        const target = document.getElementById(id);
        if (target) target.textContent = Number(value || 0).toLocaleString();
    });
    const downtime = document.getElementById("downtimeHours");
    if (downtime) downtime.textContent = `${Number(data.downtime || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} h`;
}

function populateMaintenanceFilters(calls) {
    const select = document.getElementById("maintenanceDepartmentFilter");
    if (!select) return;
    const previous = select.value;
    const departments = [...new Set(calls.map(call => call.department).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    select.innerHTML = `<option value="">All departments</option>${departments.map(value => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join("")}`;
    if (departments.includes(previous)) select.value = previous;
}

function updateMaintenanceTabCounts() {
    const counts = {
        all: maintenanceCalls.length,
        active: maintenanceCalls.filter(call => !["Completed", "Closed"].includes(call.status)).length,
        Open: maintenanceCalls.filter(call => call.status === "Open").length,
        "In Progress": maintenanceCalls.filter(call => call.status === "In Progress").length,
        "Awaiting Parts": maintenanceCalls.filter(call => call.status === "Awaiting Parts").length,
        completed: maintenanceCalls.filter(call => ["Completed", "Closed"].includes(call.status)).length,
    };
    Object.entries(counts).forEach(([key, value]) => {
        const target = document.querySelector(`[data-maintenance-count="${key}"]`);
        if (target) target.textContent = value.toLocaleString();
    });
}

function maintenanceStatusMatches(status) {
    if (maintenanceStatusMode === "all") return true;
    if (maintenanceStatusMode === "active") return !["Completed", "Closed"].includes(status);
    if (maintenanceStatusMode === "completed") return ["Completed", "Closed"].includes(status);
    return status === maintenanceStatusMode;
}

function applyMaintenanceFilters(resetPage = true) {
    const search = (document.getElementById("maintenanceSearch")?.value || "").trim().toLowerCase();
    const department = document.getElementById("maintenanceDepartmentFilter")?.value || "";
    const priority = document.getElementById("maintenancePriorityFilter")?.value || "";
    filteredMaintenanceCalls = maintenanceCalls.filter(call => {
        const searchable = [call.ticket, call.equipment, call.service_team, call.department, call.location, call.issue, call.description].filter(Boolean).join(" ").toLowerCase();
        return (!search || searchable.includes(search)) && (!department || call.department === department) && (!priority || call.priority === priority) && maintenanceStatusMatches(call.status);
    });
    if (resetPage) maintenancePagination.page = 1;
    renderMaintenanceTable(filteredMaintenanceCalls);
    const summary = document.getElementById("maintenanceResultsSummary");
    if (summary) summary.textContent = `Showing ${filteredMaintenanceCalls.length.toLocaleString()} of ${maintenanceCalls.length.toLocaleString()} service requests`;
}

function clearMaintenanceFilters() {
    const search = document.getElementById("maintenanceSearch");
    const department = document.getElementById("maintenanceDepartmentFilter");
    const priority = document.getElementById("maintenancePriorityFilter");
    if (search) search.value = "";
    if (department) department.value = "";
    if (priority) priority.value = "";
    maintenanceStatusMode = "all";
    document.querySelectorAll("[data-maintenance-tab]").forEach(tab => tab.classList.toggle("is-active", tab.dataset.maintenanceTab === "all"));
    applyMaintenanceFilters();
}

function renderMaintenanceTable(calls) {
    const tbody = document.getElementById("maintenanceTableBody");
    if (!tbody) return;
    if (!calls.length) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="maintenance-empty-state"><span><i data-lucide="search-x"></i></span><strong>No matching service calls</strong><p>Try another status, priority, department or search term.</p><button type="button" onclick="clearMaintenanceFilters()">Clear filters</button></div></td></tr>`;
        TablePagination.render(document.getElementById("maintenancePagination"), maintenancePagination, 0, () => renderMaintenanceTable(filteredMaintenanceCalls), "tickets");
        window.lucide?.createIcons();
        return;
    }
    const pageItems = TablePagination.pageItems(calls, maintenancePagination);
    tbody.innerHTML = pageItems.map(createMaintenanceRow).join("");
    TablePagination.render(document.getElementById("maintenancePagination"), maintenancePagination, calls.length, () => renderMaintenanceTable(filteredMaintenanceCalls), "tickets");
    window.lucide?.createIcons();
}

function createMaintenanceRow(call) {
    const priority = maintenancePriorityMeta(call.priority);
    const teamIcon = maintenanceTeamIcon(call.service_team);
    const downtimeDisplay = isMaintenanceAdmin()
        ? `<button type="button" class="downtime-value-trigger" data-ticket="${escapeHTML(call.ticket)}" data-hours="${Number(call.downtime || 0)}" onclick="handleDowntimeSecretClick(this.dataset.ticket, Number(this.dataset.hours))" aria-label="Downtime ${formatDowntime(call.downtime)}"><i data-lucide="timer"></i>${formatDowntime(call.downtime)}</button>`
        : `<span class="maintenance-downtime-value"><i data-lucide="timer"></i>${formatDowntime(call.downtime)}</span>`;
    return `
        <tr>
            <td><div class="maintenance-request-cell"><span class="maintenance-priority-icon is-${priority.tone}"><i data-lucide="${priority.icon}"></i></span><div><strong>${escapeHTML(call.ticket || "Unnumbered call")}</strong><small><span class="maintenance-priority-label is-${priority.tone}">${escapeHTML(call.priority || "Low")}</span>${escapeHTML(call.issue || "General service request")}</small></div></div></td>
            <td><div class="maintenance-equipment-cell"><span><i data-lucide="monitor-cog"></i></span><div><strong>${escapeHTML(call.equipment || "Equipment not specified")}</strong><small>${escapeHTML(call.location || "Location not recorded")}</small></div></div></td>
            <td><div class="maintenance-team-cell"><span><i data-lucide="${teamIcon}"></i></span><div><strong>${escapeHTML(call.service_team || "Engineering")}</strong><small>${escapeHTML(call.department || "Department not recorded")}</small></div></div></td>
            <td><div class="maintenance-date-cell"><i data-lucide="calendar-clock"></i><span>${escapeHTML(call.received || "Not recorded")}</span></div></td>
            <td>${getStatusBadge(call.status)}</td>
            <td>${downtimeDisplay}</td>
            <td><button class="maintenance-open-button" type="button" onclick="openTicket(${Number(call.id)})" aria-label="Open ${escapeHTML(call.ticket || "maintenance call")}"><span>Open</span><i data-lucide="arrow-up-right"></i></button></td>
        </tr>`;
}

function maintenancePriorityMeta(priority) {
    return ({ Critical: { tone: "critical", icon: "siren" }, High: { tone: "high", icon: "shield-alert" }, Medium: { tone: "medium", icon: "gauge" }, Low: { tone: "low", icon: "circle-check" } })[priority] || { tone: "low", icon: "circle-check" };
}

function maintenanceTeamIcon(team) {
    if (team === "Electrical") return "plug-zap";
    if (team === "IT") return "server-cog";
    return "heart-pulse";
}

function getStatusBadge(status) {
    const meta = ({
        Open: ["open", "circle-dot"], Assigned: ["assigned", "user-check"], "In Progress": ["progress", "wrench"],
        "Awaiting Parts": ["awaiting", "package-search"], "External Service": ["external", "truck"], Calibration: ["calibration", "gauge"],
        Completed: ["completed", "circle-check-big"], Closed: ["closed", "lock-keyhole"],
    })[status] || ["open", "circle-dot"];
    return `<span class="status ${meta[0]}"><i data-lucide="${meta[1]}"></i>${escapeHTML(status || "Open")}</span>`;
}

function showLoading() {
    const tbody = document.getElementById("maintenanceTableBody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7"><div class="maintenance-loading-state"><span><i data-lucide="loader-circle"></i></span><strong>Loading the live service queue…</strong></div></td></tr>`;
    window.lucide?.createIcons();
}

function showError(message) {
    const tbody = document.getElementById("maintenanceTableBody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7"><div class="maintenance-empty-state is-error"><span><i data-lucide="cloud-alert"></i></span><strong>Service queue unavailable</strong><p>${escapeHTML(message)}</p><button type="button" onclick="refreshMaintenancePage()">Try again</button></div></td></tr>`;
    window.lucide?.createIcons();
}

function formatDowntime(hours) {
    const totalMinutes = Math.floor(Number(hours || 0) * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return h === 0 ? `${m} min` : `${h}h ${m}m`;
}

function isMaintenanceAdmin() {
    const role = (localStorage.getItem("role") || "").trim().toLowerCase();
    return role === "admin" || role === "manager";
}

function handleDowntimeSecretClick(ticket, currentHours) {
    if (!isMaintenanceAdmin()) return;
    const now = Date.now();
    const sequenceExpired = now - downtimeSecretClickState.lastClick > DOWNTIME_SECRET_CLICK_WINDOW_MS;
    if (downtimeSecretClickState.ticket !== ticket || sequenceExpired) downtimeSecretClickState = { ticket, count: 0, lastClick: now };
    downtimeSecretClickState.count += 1;
    downtimeSecretClickState.lastClick = now;
    if (downtimeSecretClickState.count < DOWNTIME_SECRET_CLICK_COUNT) return;
    downtimeSecretClickState = { ticket: "", count: 0, lastClick: 0 };
    openDowntimeEditor(ticket, currentHours);
}

function openDowntimeEditor(ticket, currentHours) {
    if (!isMaintenanceAdmin()) return;
    document.getElementById("downtimeOverrideModal")?.remove();
    const safeHours = Math.max(0, Number(currentHours) || 0);
    let wholeHours = Math.floor(safeHours);
    let minutes = Math.round((safeHours - wholeHours) * 60);
    if (minutes === 60) { wholeHours += 1; minutes = 0; }
    const modal = document.createElement("div");
    modal.id = "downtimeOverrideModal";
    modal.className = "downtime-modal-backdrop";
    modal.innerHTML = `
        <section class="downtime-dialog" role="dialog" aria-modal="true" aria-labelledby="downtimeDialogTitle">
            <form id="downtimeOverrideForm">
                <header><span class="downtime-dialog-icon"><i data-lucide="timer-reset"></i></span><div><small>Administrator control</small><h2 id="downtimeDialogTitle">Change downtime</h2><p>${escapeHTML(ticket)}</p></div><button type="button" class="downtime-dialog-close" aria-label="Close downtime editor" onclick="closeDowntimeEditor()"><i data-lucide="x"></i></button></header>
                <div class="downtime-dialog-body">
                    <div class="downtime-input-grid"><label><span>Hours</span><input id="downtimeHoursInput" type="number" min="0" max="999999" step="1" value="${wholeHours}" required></label><label><span>Minutes</span><input id="downtimeMinutesInput" type="number" min="0" max="59" step="1" value="${minutes}" required></label></div>
                    <p class="downtime-dialog-note"><i data-lucide="info"></i> This replaces the current downtime value directly. No separate change-history entry is created.</p><p id="downtimeDialogError" class="downtime-dialog-error" role="alert"></p>
                </div>
                <footer><button type="button" class="downtime-cancel-btn" onclick="closeDowntimeEditor()">Cancel</button><button type="submit" class="downtime-save-btn"><i data-lucide="check"></i> Save downtime</button></footer>
            </form>
        </section>`;
    modal.addEventListener("click", event => { if (event.target === modal) closeDowntimeEditor(); });
    modal.querySelector("form").addEventListener("submit", event => saveDowntimeOverride(event, ticket));
    document.body.appendChild(modal);
    document.body.classList.add("has-modal-open");
    window.lucide?.createIcons();
    modal.querySelector("#downtimeHoursInput")?.focus();
}

function closeDowntimeEditor() {
    document.getElementById("downtimeOverrideModal")?.remove();
    document.body.classList.remove("has-modal-open");
}

async function saveDowntimeOverride(event, ticket) {
    event.preventDefault();
    const form = event.currentTarget;
    const error = form.querySelector("#downtimeDialogError");
    const submit = form.querySelector(".downtime-save-btn");
    const hours = Number(form.querySelector("#downtimeHoursInput")?.value);
    const minutes = Number(form.querySelector("#downtimeMinutesInput")?.value);
    if (!Number.isInteger(hours) || hours < 0 || hours > 999999 || !Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
        error.textContent = "Enter whole hours and minutes between 0 and 59.";
        return;
    }
    submit.disabled = true;
    error.textContent = "";
    try {
        const response = await fetch(`/api/requests/${encodeURIComponent(ticket)}/downtime`, {
            method: "PATCH", headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ hours: Number((hours + (minutes / 60)).toFixed(2)) }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.detail || "Unable to change downtime.");
        closeDowntimeEditor();
        showDowntimeFeedback(`Downtime for ${ticket} updated to ${formatDowntime(result.downtime)}.`);
        if (document.getElementById("ticketContainer") && typeof loadTicket === "function") await loadTicket();
        else await loadMaintenanceData();
    } catch (requestError) {
        error.textContent = requestError.message || "Unable to change downtime.";
        submit.disabled = false;
    }
}

function showDowntimeFeedback(message) {
    document.getElementById("downtimeFeedback")?.remove();
    const feedback = document.createElement("div");
    feedback.id = "downtimeFeedback";
    feedback.className = "downtime-feedback";
    feedback.setAttribute("role", "status");
    feedback.innerHTML = `<i data-lucide="circle-check"></i><span>${escapeHTML(message)}</span>`;
    document.body.appendChild(feedback);
    window.lucide?.createIcons();
    requestAnimationFrame(() => feedback.classList.add("is-visible"));
    setTimeout(() => { feedback.classList.remove("is-visible"); setTimeout(() => feedback.remove(), 220); }, 3200);
}

function updateLiveStatus() {
    const target = document.getElementById("maintenanceUpdatedAt");
    if (target) target.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

async function refreshMaintenancePage() {
    await loadMaintenanceData();
}

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && document.getElementById("downtimeOverrideModal")) closeDowntimeEditor();
});
