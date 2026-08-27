// Live PM schedule overview for biomedical engineers and administrators.
async function loadEngineeringPMSchedules() {
    const container = document.getElementById("pmScheduleOverview");
    if (!container) return;
    container.innerHTML = '<div class="pm-overview-loading">Loading scheduled PM visits…</div>';
    try {
        const response = await fetch("/api/pm/all");
        if (!response.ok) throw new Error("Unable to load PM schedules.");
        const schedules = await response.json();
        const items = Array.isArray(schedules) ? schedules : [];
        setPMEvents(items.map(item => ({ date: item.scheduled_date, status: item.status })));
        renderEngineeringPMSchedules(items);
    } catch (error) {
        console.error(error);
        container.innerHTML = `<div class="pm-overview-empty">${pmOverviewEscape(error.message)}</div>`;
    }
}

function renderEngineeringPMSchedules(schedules) {
    const container = document.getElementById("pmScheduleOverview");
    if (!container) return;
    if (!schedules.length) {
        container.innerHTML = `<div class="pm-overview-card"><div class="pm-overview-header"><div><span>Live schedule</span><h2>Department confirmations</h2></div></div><div class="pm-overview-empty">No PM visits have been scheduled yet.</div></div>`;
        return;
    }
    container.innerHTML = `
      <div class="pm-overview-card">
        <div class="pm-overview-header"><div><span>Live schedule</span><h2>Department confirmations</h2><p>PM dates, approval decisions and notes from department users.</p></div><button class="pm-overview-refresh" onclick="loadEngineeringPMSchedules()"><i data-lucide="refresh-cw"></i> Refresh</button></div>
        <div class="pm-overview-list">
          ${schedules.map(item => `
            <article class="pm-overview-row">
              <div class="pm-overview-date"><strong>${pmOverviewDay(item.scheduled_date)}</strong><span>${pmOverviewMonth(item.scheduled_date)}</span></div>
              <div class="pm-overview-equipment"><strong>${pmOverviewEscape(item.equipment_name || "Department equipment")}</strong><span>${pmOverviewEscape(item.asset_code || "-")} · ${pmOverviewEscape(item.department || "No department")}</span></div>
              <div class="pm-overview-state"><b class="pm-overview-badge ${pmOverviewClass(item.status)}">${pmOverviewEscape(item.status || "Upcoming")}</b><small>PM status</small></div>
              <div class="pm-overview-response"><b class="pm-overview-response-badge ${pmOverviewClass(item.department_response)}">${pmOverviewEscape(item.department_response || "Pending")}</b><small>Department response</small>${item.department_response_note ? `<p>“${pmOverviewEscape(item.department_response_note)}”</p>` : ""}</div>
            </article>
          `).join("")}
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
}

function pmOverviewDay(value) {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? "—" : String(date.getDate()).padStart(2, "0");
}
function pmOverviewMonth(value) {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(undefined, { month: "short" }).format(date);
}
function pmOverviewClass(value) {
    return String(value || "pending").toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
}
function pmOverviewEscape(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
