// Data binding for the hospital-wide administrator dashboard.
async function loadDashboard() {
    if (!document.getElementById("adminTeamGrid")) return;
    const data = await getDashboardData();
    if (!data || !data.summary) {
        renderAdminDashboardError("Dashboard data is temporarily unavailable. Refresh to try again.");
        return;
    }

    const summary = data.summary;
    setAdminDashboardText("adminOpsActiveCalls", summary.active_calls);
    setAdminDashboardText("adminOpsCriticalCalls", summary.critical_calls);
    setAdminDashboardText("adminOpsCompletedToday", summary.completed_today);
    setAdminDashboardText("adminOpsAssets", summary.total_assets);
    setAdminDashboardText("adminOpsActiveDetail", (summary.engineers || 0) + " engineering users across all departments");
    setAdminDashboardText("adminOpsAssetsDetail", (summary.asset_availability_percent ?? 100) + "% currently available");
    setAdminDashboardText("adminOpsActiveDowntime", adminFormatHours(summary.active_downtime_hours));
    setAdminDashboardText("adminOpsAvgDowntime", adminFormatHours(summary.avg_downtime));
    setAdminDashboardText("adminOpsStockHealth", (summary.stock_health_percent ?? 100) + "%");
    setAdminDashboardText("adminOpsPmDue", summary.pm_due || 0);
    setAdminDashboardText("adminOpsAwaitingParts", summary.awaiting_parts || 0);
    setAdminDashboardText("adminOpsAssetAvailability", (summary.asset_availability_percent ?? 100) + "%");
    setAdminDashboardText("adminOpsOldestCall", adminFormatHours(summary.oldest_active_call_hours) + " oldest active call");
    setAdminDashboardText("adminOpsStockDetail", (summary.inventory_alerts || 0) + " low · " + (summary.out_of_stock || 0) + " out of stock");
    setAdminDashboardText("adminOpsPmDetail", (summary.pm_overdue || 0) + " overdue · " + (summary.pm_pending_confirmation || 0) + " awaiting confirmation");
    setAdminDashboardText("adminOpsAssetDetail", (summary.out_of_service_assets || 0) + " out of service");
    setAdminDashboardText("adminLastUpdated", "Updated " + adminFormatDateTime(data.generated_at));
    renderAdminTeams(data.teams || []);
    renderAdminActivity(data.recent_activity || []);
    renderAdminAttention(summary, data.teams || []);
    if (window.lucide) lucide.createIcons();
}

function setAdminDashboardText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value ?? "0";
}

function renderAdminTeams(teams) {
    const container = document.getElementById("adminTeamGrid");
    if (!container) return;
    const expectedTeams = ["Biomedical", "Electrical", "IT"];
    const teamRows = expectedTeams.map(team => teams.find(item => item.team === team) || { team, active_calls: 0, open_calls: 0, in_progress: 0, awaiting_parts: 0, completed_today: 0, critical_calls: 0, assets: 0, inventory_items: 0, low_stock: 0, engineers: 0 });
    container.innerHTML = teamRows.map(team => {
        const style = adminTeamStyle(team.team);
        const attention = team.critical_calls || team.low_stock || team.awaiting_parts;
        return `
          <article class="admin-team-card is-${style.className}">
            <header class="admin-team-card-header">
              <div class="admin-team-identity"><span class="admin-team-icon">${adminTeamIconSvg(style.className)}</span><div><span>${adminEscape(team.team)} department</span><h3>${adminEscape(team.team)} Services</h3></div></div>
              <span class="admin-team-state ${attention ? "is-attention" : "is-healthy"}">${attention ? "Needs review" : "On track"}</span>
            </header>
            <div class="admin-team-primary"><strong>${team.active_calls || 0}</strong><span>Active maintenance calls</span></div>
            <div class="admin-team-metrics">
              <div><strong>${team.in_progress || 0}</strong><span>In progress</span></div>
              <div><strong>${team.awaiting_parts || 0}</strong><span>Awaiting parts</span></div>
              <div><strong>${team.completed_today || 0}</strong><span>Resolved today</span></div>
            </div>
            <div class="admin-team-footer">
              <span><i data-lucide="monitor-cog"></i> ${team.assets || 0} assets</span>
              <span><i data-lucide="package-search"></i> ${team.low_stock || 0} stock alerts</span>
              <span><i data-lucide="users"></i> ${team.engineers || 0} engineers</span>
            </div>
            <button class="admin-team-action" onclick="navigate('callManagement')">Review calls <i data-lucide="arrow-right"></i></button>
          </article>
        `;
    }).join("");
}

function renderAdminActivity(items) {
    const container = document.getElementById("adminActivityFeed");
    if (!container) return;
    if (!items.length) {
        container.innerHTML = '<div class="admin-empty-state"><i data-lucide="clipboard-check"></i><strong>No maintenance calls yet</strong><p>New activity from all three departments will appear here.</p></div>';
        return;
    }
    container.innerHTML = items.map(item => `
      <article class="admin-activity-row">
        <span class="admin-activity-team is-${adminTeamStyle(item.team).className}">${adminEscape(item.team)}</span>
        <div class="admin-activity-copy"><strong>${adminEscape(item.equipment_name)}</strong><span>${adminEscape(item.ticket_number)} · ${adminEscape(item.department)}</span></div>
        <div class="admin-activity-status"><span class="admin-status-pill is-${adminStatusClass(item.status)}">${adminEscape(item.status)}</span><time>${adminFormatDateTime(item.occurred_at)}</time></div>
      </article>
    `).join("");
}

function renderAdminAttention(summary, teams) {
    const container = document.getElementById("adminAttentionList");
    if (!container) return;
    const items = [];
    if (summary.critical_calls) items.push({ icon: "siren", tone: "red", title: summary.critical_calls + " critical call" + (summary.critical_calls === 1 ? "" : "s"), text: "Prioritize assignment and resolution.", page: "callManagement" });
    if (summary.inventory_alerts) items.push({ icon: "package-x", tone: "orange", title: summary.inventory_alerts + " inventory alert" + (summary.inventory_alerts === 1 ? "" : "s"), text: (summary.out_of_stock || 0) + " items are completely out of stock.", page: "inventory" });
    if (summary.pm_due) items.push({ icon: "calendar-clock", tone: "blue", title: summary.pm_due + " PM visit" + (summary.pm_due === 1 ? "" : "s") + " due", text: (summary.pm_overdue || 0) + " preventive-maintenance visits are overdue.", page: "pm" });
    const awaiting = teams.reduce((total, team) => total + (team.awaiting_parts || 0), 0);
    if (awaiting) items.push({ icon: "clock-3", tone: "violet", title: awaiting + " call" + (awaiting === 1 ? "" : "s") + " awaiting parts", text: "Coordinate supply before service delays increase.", page: "callManagement" });
    if (summary.out_of_service_assets) items.push({ icon: "monitor-x", tone: "red", title: summary.out_of_service_assets + " asset" + (summary.out_of_service_assets === 1 ? "" : "s") + " out of service", text: "Review availability and maintenance status.", page: "assets" });
    if ((summary.oldest_active_call_hours || 0) >= 24) items.push({ icon: "alarm-clock", tone: "orange", title: adminFormatHours(summary.oldest_active_call_hours) + " oldest active call", text: "This request has remained active for more than one day.", page: "callManagement" });
    if (!items.length) items.push({ icon: "circle-check-big", tone: "green", title: "Operations are on track", text: "No critical calls, stock alerts, or PM visits need immediate action." });
    items.push({ icon: "timer-reset", tone: "slate", title: adminFormatHours(summary.avg_downtime) + " average downtime", text: "Based on completed maintenance calls.", page: "reports" });
    container.innerHTML = items.map(item => `<div class="admin-attention-row is-${item.tone}"><span><i data-lucide="${item.icon}"></i></span><div><strong>${adminEscape(item.title)}</strong><p>${adminEscape(item.text)}</p></div>${item.page ? `<button type="button" onclick="navigate('${item.page}')">Review</button>` : ""}</div>`).join("");
}

function renderAdminDashboardError(message) {
    ["adminTeamGrid", "adminActivityFeed", "adminAttentionList"].forEach(id => {
        const container = document.getElementById(id);
        if (container) container.innerHTML = `<div class="admin-empty-state"><i data-lucide="wifi-off"></i><strong>Unable to load operations data</strong><p>${adminEscape(message)}</p></div>`;
    });
    if (window.lucide) lucide.createIcons();
}

function adminTeamStyle(team) {
    const value = String(team || "Biomedical").toLowerCase();
    if (value === "electrical") return { className: "electrical" };
    if (value === "it") return { className: "it" };
    return { className: "biomedical" };
}

function adminTeamIconSvg(team) {
    const shared = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';
    if (team === "electrical") {
        return `<svg ${shared}><path d="M8 2v5M16 2v5M6 7h12v3a6 6 0 0 1-12 0V7Z"/><path d="M12 16v6M9 22h6"/></svg>`;
    }
    if (team === "it") {
        return `<svg ${shared}><rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01M11 7.5h6M11 16.5h6"/></svg>`;
    }
    return `<svg ${shared}><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M7 11h2l1.4-3 3.1 6 1.4-3H18M9 22h6M12 18v4"/></svg>`;
}

function adminStatusClass(value) {
    return String(value || "open").toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
}

function adminFormatDateTime(value) {
    if (!value) return "No timestamp";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Recently";
    return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(date);
}

function adminFormatHours(value) {
    const hours = Number(value || 0);
    return (Number.isInteger(hours) ? hours : hours.toFixed(1)) + " h";
}

if (!window.adminDashboardShortcutsBound) {
    window.adminDashboardShortcutsBound = true;
    document.addEventListener("keydown", event => {
        if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (event.target.closest("input, textarea, select, [contenteditable='true']")) return;
        const shortcuts = { c: "callManagement", a: "assets", i: "inventory", p: "pm", q: "qr", r: "reports", u: "users", s: "settings" };
        const page = shortcuts[String(event.key || "").toLowerCase()];
        if (!page || typeof navigate !== "function") return;
        event.preventDefault();
        navigate(page);
    });
}

function adminEscape(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
