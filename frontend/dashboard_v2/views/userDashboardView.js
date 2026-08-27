// Department user dashboard
async function renderUserDashboard() {
    const department = localStorage.getItem("department") || "Your";
    const username = localStorage.getItem("username") || "there";
    pageContent.innerHTML = `
      <main class="user-home-page">
        <section class="user-home-hero">
          <div class="user-home-hero-copy">
            <span class="user-home-eyebrow"><span class="user-home-live-dot"></span> Department workspace</span>
            <h1>Good day, <span>${escapeUserDashboardHtml(username)}</span>.</h1>
            <p>Manage maintenance, equipment and preventive-care schedules for <strong>${escapeUserDashboardHtml(department)}</strong> from one focused workspace.</p>
            <div class="user-home-hero-actions">
              <button class="user-home-primary-action" onclick="navigate('newRequest')"><i data-lucide="plus"></i> Report a problem</button>
              <button class="user-home-secondary-action" onclick="navigate('myAssets')"><i data-lucide="monitor-smartphone"></i> View my assets</button>
            </div>
          </div>
          <div class="user-home-hero-panel"><span>Today</span><strong id="userHomeDate">—</strong><small><i data-lucide="shield-check"></i> BioTrack is online</small></div>
        </section>
        <section class="user-home-metrics" aria-label="Department overview">
          <button class="user-home-metric is-blue" onclick="navigate('myRequests')"><span class="user-home-metric-icon"><i data-lucide="clipboard-list"></i></span><span><small>Open requests</small><strong id="userHomeOpen">—</strong><em>View requests <i data-lucide="arrow-up-right"></i></em></span></button>
          <button class="user-home-metric is-orange" onclick="navigate('myRequests')"><span class="user-home-metric-icon"><i data-lucide="loader-circle"></i></span><span><small>In progress</small><strong id="userHomeProgress">—</strong><em>Track progress <i data-lucide="arrow-up-right"></i></em></span></button>
          <button class="user-home-metric is-purple" onclick="navigate('myAssets')"><span class="user-home-metric-icon"><i data-lucide="monitor-smartphone"></i></span><span><small>Department assets</small><strong id="userHomeAssets">—</strong><em>Open asset list <i data-lucide="arrow-up-right"></i></em></span></button>
          <button class="user-home-metric is-green" onclick="navigate('departmentPMSchedule')"><span class="user-home-metric-icon"><i data-lucide="calendar-clock"></i></span><span><small>PM due / overdue</small><strong id="userHomePM">—</strong><em>View schedule <i data-lucide="arrow-up-right"></i></em></span></button>
        </section>
        <section class="user-home-grid">
          <article class="user-home-card user-home-requests-card">
            <div class="user-home-card-heading"><div><span class="user-home-section-label">Maintenance</span><h2>Your recent requests</h2></div><button class="user-home-text-button" onclick="navigate('myRequests')">View all <i data-lucide="arrow-right"></i></button></div>
            <div id="userHomeRequests" class="user-home-request-list"><div class="user-home-loading">Loading your recent requests…</div></div>
          </article>
          <aside class="user-home-side-stack">
            <article class="user-home-card user-home-pm-card">
              <div class="user-home-card-heading"><div><span class="user-home-section-label">Preventive care</span><h2>Next PM visit</h2></div><i data-lucide="calendar-check" class="user-home-heading-icon"></i></div>
              <div id="userHomeNextPM" class="user-home-pm-empty">Loading PM schedule…</div>
              <button class="user-home-outline-button" onclick="navigate('departmentPMSchedule')">Open PM schedule <i data-lucide="arrow-right"></i></button>
            </article>
            <article class="user-home-card user-home-actions-card">
              <div class="user-home-card-heading"><div><span class="user-home-section-label">Shortcuts</span><h2>Quick actions</h2></div></div>
              <div class="user-home-action-grid">
                <button onclick="navigate('newRequest')"><i data-lucide="plus-circle"></i><span>New request</span></button>
                <button onclick="navigate('qr')"><i data-lucide="scan-line"></i><span>Scan QR</span></button>
                <button onclick="navigate('myAssets')"><i data-lucide="monitor-smartphone"></i><span>My assets</span></button>
                <button onclick="navigate('departmentPMSchedule')"><i data-lucide="calendar-clock"></i><span>PM schedule</span></button>
              </div>
            </article>
          </aside>
        </section>
        <p id="userHomeUpdated" class="user-home-updated">Loading department information…</p>
      </main>
    `;
    document.getElementById("userHomeDate").textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "short" }).format(new Date());
    if (window.lucide) lucide.createIcons();
    await loadUserDashboardData();
}

async function loadUserDashboardData() {
    const [requestResult, assetsResult, pmResult] = await Promise.all([
        userDashboardFetch("/api/user/my-requests"),
        userDashboardFetch("/api/assets/department/mine"),
        userDashboardFetch("/api/user/pm-schedule"),
    ]);
    const data = requestResult && !Array.isArray(requestResult) ? requestResult : { summary: {}, requests: [] };
    const requests = Array.isArray(data.requests) ? data.requests : [];
    const assets = Array.isArray(assetsResult) ? assetsResult : [];
    const schedules = Array.isArray(pmResult) ? pmResult : [];
    const summary = data.summary || {};
    setUserDashboardValue("userHomeOpen", summary.open ?? requests.filter(item => item.status === "Open").length);
    setUserDashboardValue("userHomeProgress", summary.in_progress ?? requests.filter(item => item.status === "In Progress").length);
    setUserDashboardValue("userHomeAssets", assets.length);
    setUserDashboardValue("userHomePM", schedules.filter(item => ["Due", "Overdue"].includes(item.status)).length);
    renderUserDashboardRequests(requests.slice(0, 4));
    renderUserDashboardNextPM(schedules);
    const updated = document.getElementById("userHomeUpdated");
    if (updated) updated.textContent = `Updated just now · ${requests.length} request${requests.length === 1 ? "" : "s"} and ${assets.length} department asset${assets.length === 1 ? "" : "s"}`;
    if (window.lucide) lucide.createIcons();
}

async function userDashboardFetch(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        return await response.json();
    } catch (error) {
        console.error(`Dashboard data failed for ${url}:`, error);
        return null;
    }
}

function renderUserDashboardRequests(requests) {
    const container = document.getElementById("userHomeRequests");
    if (!container) return;
    if (!requests.length) {
        container.innerHTML = `<div class="user-home-empty-state"><span><i data-lucide="clipboard-check"></i></span><div><strong>No requests yet</strong><p>Everything is quiet. Report an issue whenever you need support.</p></div><button onclick="navigate('newRequest')">Create request</button></div>`;
        return;
    }
    container.innerHTML = requests.map(item => `
      <button class="user-home-request-row" onclick="openUserDashboardRequest('${escapeUserDashboardHtml(item.ticket)}')">
        <span class="user-home-request-icon"><i data-lucide="wrench"></i></span>
        <span class="user-home-request-copy"><strong>${escapeUserDashboardHtml(item.equipment || "Maintenance request")}</strong><small>${escapeUserDashboardHtml(item.ticket || "-")} · ${formatUserDashboardDate(item.reported_time)}</small></span>
        <span class="user-home-request-meta"><em class="user-home-priority ${userDashboardClass(item.priority)}">${escapeUserDashboardHtml(item.priority || "Normal")}</em><b class="user-home-status ${userDashboardClass(item.status)}">${escapeUserDashboardHtml(item.status || "Open")}</b></span>
        <i data-lucide="chevron-right" class="user-home-row-arrow"></i>
      </button>
    `).join("");
}

function renderUserDashboardNextPM(schedules) {
    const container = document.getElementById("userHomeNextPM");
    if (!container) return;
    const next = schedules.find(item => item.status !== "Completed");
    if (!next) {
        container.innerHTML = `<div class="user-home-pm-empty"><i data-lucide="calendar-plus"></i><div><strong>No PM visit scheduled</strong><p>Your department has no planned preventive-maintenance visits at the moment.</p></div></div>`;
        return;
    }
    container.innerHTML = `<div class="user-home-pm-date"><span>${formatUserDashboardDay(next.scheduled_date)}</span><small>${formatUserDashboardMonth(next.scheduled_date)}</small></div><div class="user-home-pm-copy"><strong>${escapeUserDashboardHtml(next.equipment_name || "Department equipment")}</strong><p>${escapeUserDashboardHtml(next.location || "Department location")}</p><b class="user-home-status ${userDashboardClass(next.status)}">${escapeUserDashboardHtml(next.status || "Upcoming")}</b></div>`;
}

function openUserDashboardRequest(ticket) {
    localStorage.setItem("selectedRequest", ticket);
    navigate("requestDetails");
}

function setUserDashboardValue(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function formatUserDashboardDate(value) {
    if (!value) return "Recently";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Recently" : new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short" }).format(date);
}
function formatUserDashboardDay(value) {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? "—" : String(date.getDate()).padStart(2, "0");
}
function formatUserDashboardMonth(value) {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(undefined, { month: "short" }).format(date);
}
function userDashboardClass(value) {
    return String(value || "unknown").toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
}
function escapeUserDashboardHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
