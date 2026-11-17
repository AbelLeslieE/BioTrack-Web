// Department-user maintenance request centre.

let myRequestsCache = [];
let filteredMyRequests = [];
let myRequestsStatusMode = "all";
const myRequestsPagination = { page: 1, pageSize: 10 };

const MY_REQUEST_STATUS_META = {
    open: { label: "Open", icon: "circle-dot" },
    assigned: { label: "Assigned", icon: "user-check" },
    "in-progress": { label: "In progress", icon: "loader-circle" },
    "awaiting-parts": { label: "Awaiting parts", icon: "package-search" },
    completed: { label: "Completed", icon: "circle-check-big" },
    closed: { label: "Closed", icon: "circle-check-big" }
};

function normalizeMyRequestStatus(value) {
    return String(value || "open").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function myRequestStatusMeta(value) {
    const key = normalizeMyRequestStatus(value);
    return { key, ...(MY_REQUEST_STATUS_META[key] || { label: value || "Open", icon: "circle-dot" }) };
}

function myRequestPriorityMeta(value) {
    const key = String(value || "medium").trim().toLowerCase();
    if (key === "critical") return { key, icon: "siren", label: "Critical" };
    if (key === "high") return { key, icon: "triangle-alert", label: "High" };
    if (key === "low") return { key, icon: "arrow-down", label: "Low" };
    return { key: "medium", icon: "minus", label: "Medium" };
}

async function renderMyRequests() {
    const pageContent = document.getElementById("page-content");
    if (!pageContent) return;

    if (window.__myRequestsRefreshTimer) {
        window.clearInterval(window.__myRequestsRefreshTimer);
        window.__myRequestsRefreshTimer = null;
    }

    pageContent.innerHTML = `
        <section class="my-requests-page" aria-labelledby="myRequestsTitle">
            <header class="my-requests-command-hero">
                <div class="my-requests-hero-copy">
                    <span class="my-requests-eyebrow"><i data-lucide="radio-tower"></i> Department service desk</span>
                    <h1 id="myRequestsTitle">My maintenance requests</h1>
                    <p>Report equipment problems and follow every service update from one clear workspace.</p>
                    <div class="my-requests-hero-actions">
                        <button class="my-requests-primary-action" type="button" onclick="navigate('newRequest')">
                            <i data-lucide="circle-plus"></i><span>New maintenance request</span>
                        </button>
                        <button class="my-requests-secondary-action" id="myRequestsRefresh" type="button">
                            <i data-lucide="refresh-cw"></i><span>Refresh</span>
                        </button>
                    </div>
                </div>
                <div class="my-requests-live-panel" aria-label="Request centre status">
                    <span class="my-requests-live-label"><i data-lucide="activity"></i> Live request tracking</span>
                    <strong id="myRequestsActiveHero">— active</strong>
                    <small id="myRequestsUpdated">Updating request status…</small>
                    <div class="my-requests-live-visual" aria-hidden="true">
                        <i data-lucide="clipboard-check"></i>
                    </div>
                </div>
            </header>

            <section class="myrequest-kpis" aria-label="Request summary">
                <article class="myrequest-card is-blue">
                    <span class="myrequest-icon"><i data-lucide="ticket-check"></i></span>
                    <span class="myrequest-info"><small>Total requests</small><strong id="totalRequests">—</strong><em>All submitted tickets</em></span>
                </article>
                <article class="myrequest-card is-orange">
                    <span class="myrequest-icon"><i data-lucide="radio"></i></span>
                    <span class="myrequest-info"><small>Active queue</small><strong id="openRequests">—</strong><em>Waiting for completion</em></span>
                </article>
                <article class="myrequest-card is-cyan">
                    <span class="myrequest-icon"><i data-lucide="loader-circle"></i></span>
                    <span class="myrequest-info"><small>In progress</small><strong id="progressRequests">—</strong><em>Engineer is working</em></span>
                </article>
                <article class="myrequest-card is-green">
                    <span class="myrequest-icon"><i data-lucide="badge-check"></i></span>
                    <span class="myrequest-info"><small>Completed</small><strong id="completedRequests">—</strong><em>Resolved requests</em></span>
                </article>
            </section>

            <section class="my-requests-workspace" aria-labelledby="myRequestsWorkspaceTitle">
                <div class="my-requests-workspace-heading">
                    <div>
                        <span class="my-requests-section-label">Request history</span>
                        <h2 id="myRequestsWorkspaceTitle">Track service progress</h2>
                        <p>Search your tickets or focus on the requests that need attention.</p>
                    </div>
                    <span class="my-requests-result-count" id="myRequestsResultCount">0 requests</span>
                </div>

                <div class="my-requests-status-tabs" id="myRequestsStatusTabs" role="tablist" aria-label="Filter requests by status">
                    <button class="is-active" type="button" data-status-mode="all"><i data-lucide="list-filter"></i>All <span id="myRequestsTabAll">0</span></button>
                    <button type="button" data-status-mode="active"><i data-lucide="radio"></i>Active <span id="myRequestsTabActive">0</span></button>
                    <button type="button" data-status-mode="open"><i data-lucide="circle-dot"></i>Open <span id="myRequestsTabOpen">0</span></button>
                    <button type="button" data-status-mode="in-progress"><i data-lucide="loader-circle"></i>In progress <span id="myRequestsTabProgress">0</span></button>
                    <button type="button" data-status-mode="completed"><i data-lucide="circle-check-big"></i>Completed <span id="myRequestsTabCompleted">0</span></button>
                </div>

                <div class="myrequest-toolbar">
                    <label class="myrequest-search" for="myRequestsSearch">
                        <i data-lucide="search"></i>
                        <input id="myRequestsSearch" type="search" placeholder="Search ticket, equipment or department…" autocomplete="off">
                    </label>
                    <div class="myrequest-filters">
                        <label><span>Priority</span><select id="myRequestsPriorityFilter"><option value="">All priorities</option></select></label>
                        <button id="myRequestsClear" type="button"><i data-lucide="filter-x"></i><span>Clear</span></button>
                    </div>
                </div>

                <div class="myrequest-table-card">
                    <table class="myrequest-table">
                        <thead><tr><th>Request</th><th>Equipment</th><th>Status</th><th>Reported</th><th>Downtime</th><th><span class="sr-only">Action</span></th></tr></thead>
                        <tbody id="myRequestsBody"><tr><td colspan="6"><div class="my-requests-loading"><i data-lucide="loader-circle"></i>Loading your requests…</div></td></tr></tbody>
                    </table>
                </div>
                <div id="myRequestsPagination" class="table-pagination"></div>
            </section>
        </section>`;

    document.getElementById("myRequestsSearch")?.addEventListener("input", () => applyMyRequestsFilters());
    document.getElementById("myRequestsPriorityFilter")?.addEventListener("change", () => applyMyRequestsFilters());
    document.getElementById("myRequestsRefresh")?.addEventListener("click", () => loadMyRequests(true));
    document.getElementById("myRequestsClear")?.addEventListener("click", clearMyRequestsFilters);
    document.querySelectorAll("#myRequestsStatusTabs [data-status-mode]").forEach((button) => {
        button.addEventListener("click", () => {
            myRequestsStatusMode = button.dataset.statusMode || "all";
            document.querySelectorAll("#myRequestsStatusTabs [data-status-mode]").forEach((item) => item.classList.toggle("is-active", item === button));
            applyMyRequestsFilters();
        });
    });

    window.lucide?.createIcons();
    await loadMyRequests();

    window.__myRequestsRefreshTimer = window.setInterval(() => {
        if (!document.querySelector(".my-requests-page")) {
            window.clearInterval(window.__myRequestsRefreshTimer);
            window.__myRequestsRefreshTimer = null;
            return;
        }
        loadMyRequests(false, true);
    }, 60000);
}

async function loadMyRequests(showFeedback = false, silent = false) {
    const refreshButton = document.getElementById("myRequestsRefresh");
    refreshButton?.classList.add("is-loading");
    refreshButton?.setAttribute("aria-busy", "true");

    try {
        const response = await fetch("/api/user/my-requests", { credentials: "same-origin" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "Unable to load your maintenance requests.");

        myRequestsCache = Array.isArray(data.requests) ? data.requests : [];
        updateMyRequestSummary(data.summary || {}, myRequestsCache);
        populateMyRequestsFilters(myRequestsCache);
        applyMyRequestsFilters(false);

        const updated = document.getElementById("myRequestsUpdated");
        if (updated) updated.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
        if (showFeedback) window.BioTrackToast?.success("Requests refreshed", "Your maintenance requests are up to date.");
    } catch (error) {
        if (!silent) window.BioTrackToast?.error("Requests unavailable", error.message || "Unable to load your maintenance requests.");
        const tbody = document.getElementById("myRequestsBody");
        if (tbody && !myRequestsCache.length) {
            tbody.innerHTML = `<tr><td colspan="6"><div class="my-requests-empty is-error"><i data-lucide="cloud-alert"></i><strong>Requests could not be loaded</strong><span>Check your connection and try Refresh.</span></div></td></tr>`;
        }
    } finally {
        refreshButton?.classList.remove("is-loading");
        refreshButton?.removeAttribute("aria-busy");
        window.lucide?.createIcons();
    }
}

function updateMyRequestSummary(summary, requests) {
    const completed = requests.filter((request) => ["completed", "closed"].includes(normalizeMyRequestStatus(request.status))).length;
    const inProgress = requests.filter((request) => normalizeMyRequestStatus(request.status) === "in-progress").length;
    const active = Math.max(0, requests.length - completed);
    const totals = {
        totalRequests: Number(summary.total ?? requests.length),
        openRequests: active,
        progressRequests: Number(summary.in_progress ?? inProgress),
        completedRequests: Number(summary.completed ?? completed)
    };

    Object.entries(totals).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = String(value);
    });

    const activeHero = document.getElementById("myRequestsActiveHero");
    if (activeHero) activeHero.textContent = `${active} active ${active === 1 ? "request" : "requests"}`;

    const counts = {
        myRequestsTabAll: requests.length,
        myRequestsTabActive: active,
        myRequestsTabOpen: requests.filter((request) => normalizeMyRequestStatus(request.status) === "open").length,
        myRequestsTabProgress: inProgress,
        myRequestsTabCompleted: completed
    };
    Object.entries(counts).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = String(value);
    });
}

function populateMyRequestsFilters(requests) {
    const select = document.getElementById("myRequestsPriorityFilter");
    if (!select) return;
    const previous = select.value;
    const options = [...new Set(requests.map((request) => request.priority).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    select.innerHTML = `<option value="">All priorities</option>${options.map((value) => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join("")}`;
    if (options.includes(previous)) select.value = previous;
}

function clearMyRequestsFilters() {
    const search = document.getElementById("myRequestsSearch");
    const priority = document.getElementById("myRequestsPriorityFilter");
    if (search) search.value = "";
    if (priority) priority.value = "";
    myRequestsStatusMode = "all";
    document.querySelectorAll("#myRequestsStatusTabs [data-status-mode]").forEach((item) => item.classList.toggle("is-active", item.dataset.statusMode === "all"));
    applyMyRequestsFilters();
}

function applyMyRequestsFilters(resetPage = true) {
    const search = (document.getElementById("myRequestsSearch")?.value || "").trim().toLowerCase();
    const priority = document.getElementById("myRequestsPriorityFilter")?.value || "";

    filteredMyRequests = myRequestsCache.filter((request) => {
        const status = normalizeMyRequestStatus(request.status);
        const statusMatches = myRequestsStatusMode === "all"
            || (myRequestsStatusMode === "active" && !["completed", "closed"].includes(status))
            || (myRequestsStatusMode === "completed" && ["completed", "closed"].includes(status))
            || status === myRequestsStatusMode;
        const searchable = [request.ticket, request.equipment, request.equipment_id, request.department, request.status]
            .filter(Boolean).join(" ").toLowerCase();
        return statusMatches && (!search || searchable.includes(search)) && (!priority || request.priority === priority);
    });

    if (resetPage) myRequestsPagination.page = 1;
    const resultCount = document.getElementById("myRequestsResultCount");
    if (resultCount) resultCount.textContent = `${filteredMyRequests.length} ${filteredMyRequests.length === 1 ? "request" : "requests"}`;
    renderMyRequestsTable(filteredMyRequests);
}

function renderMyRequestsTable(requests) {
    const tbody = document.getElementById("myRequestsBody");
    if (!tbody) return;

    if (!requests.length) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="my-requests-empty"><i data-lucide="inbox"></i><strong>No matching requests</strong><span>Try another filter or create a new maintenance request.</span><button type="button" onclick="navigate('newRequest')"><i data-lucide="circle-plus"></i>New request</button></div></td></tr>`;
        TablePagination.render(document.getElementById("myRequestsPagination"), myRequestsPagination, 0, () => renderMyRequestsTable(filteredMyRequests), "requests");
        window.lucide?.createIcons();
        return;
    }

    const pageItems = TablePagination.pageItems(requests, myRequestsPagination);
    tbody.innerHTML = pageItems.map((request) => {
        const status = myRequestStatusMeta(request.status);
        const priority = myRequestPriorityMeta(request.priority);
        const downtime = Number(request.downtime || 0);
        return `<tr>
            <td data-label="Request"><div class="myrequest-ticket"><strong>${escapeHTML(request.ticket || "—")}</strong><span class="myrequest-priority is-${priority.key}"><i data-lucide="${priority.icon}"></i>${priority.label}</span></div></td>
            <td data-label="Equipment"><div class="myrequest-equipment"><span><i data-lucide="monitor-cog"></i></span><div><strong>${escapeHTML(request.equipment || "Unnamed equipment")}</strong><small>${escapeHTML(request.equipment_id || "No equipment ID")} · ${escapeHTML(request.department || "Department not set")}</small></div></div></td>
            <td data-label="Status"><span class="myrequest-status is-${status.key}"><i data-lucide="${status.icon}"></i>${escapeHTML(status.label)}</span></td>
            <td data-label="Reported"><div class="myrequest-date"><i data-lucide="calendar-clock"></i><span>${formatDateTime(request.reported_time)}</span></div></td>
            <td data-label="Downtime"><div class="myrequest-downtime"><i data-lucide="timer"></i><strong>${downtime > 0 ? `${downtime.toFixed(1)} h` : "—"}</strong></div></td>
            <td data-label="Action"><button class="myrequest-open" type="button" data-ticket="${escapeHTML(request.ticket || "")}" aria-label="Open request ${escapeHTML(request.ticket || "")}"><span>Open</span><i data-lucide="arrow-up-right"></i></button></td>
        </tr>`;
    }).join("");

    tbody.querySelectorAll(".myrequest-open[data-ticket]").forEach((button) => button.addEventListener("click", () => openRequest(button.dataset.ticket || "")));
    TablePagination.render(document.getElementById("myRequestsPagination"), myRequestsPagination, requests.length, () => renderMyRequestsTable(filteredMyRequests), "requests");
    window.lucide?.createIcons();
}

function openRequest(ticket) {
    if (!ticket) return;
    localStorage.setItem("selectedRequest", ticket);
    navigate("requestDetails");
}
