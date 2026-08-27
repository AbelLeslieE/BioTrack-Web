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
    setAdminDashboardText("adminOpsAssetsDetail", (summary.inventory_alerts || 0) + " stock alerts to review");
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
              <div class="admin-team-identity"><span class="admin-team-icon"><i data-lucide="${style.icon}"></i></span><div><span>${adminEscape(team.team)} department</span><h3>${adminEscape(team.team)} Services</h3></div></div>
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
    if (summary.critical_calls) items.push({ icon: "siren", tone: "red", title: summary.critical_calls + " critical call" + (summary.critical_calls === 1 ? "" : "s"), text: "Prioritize assignment and resolution." });
    if (summary.inventory_alerts) items.push({ icon: "package-x", tone: "orange", title: summary.inventory_alerts + " inventory alert" + (summary.inventory_alerts === 1 ? "" : "s"), text: "Parts are at or below their minimum stock level." });
    if (summary.pm_due) items.push({ icon: "calendar-clock", tone: "blue", title: summary.pm_due + " PM visit" + (summary.pm_due === 1 ? "" : "s") + " due", text: "Review preventive-maintenance scheduling." });
    const awaiting = teams.reduce((total, team) => total + (team.awaiting_parts || 0), 0);
    if (awaiting) items.push({ icon: "clock-3", tone: "violet", title: awaiting + " call" + (awaiting === 1 ? "" : "s") + " awaiting parts", text: "Coordinate supply before service delays increase." });
    if (!items.length) items.push({ icon: "circle-check-big", tone: "green", title: "Operations are on track", text: "No critical calls, stock alerts, or PM visits need immediate action." });
    items.push({ icon: "timer-reset", tone: "slate", title: (summary.avg_downtime || 0) + " h average downtime", text: "Based on completed maintenance calls." });
    container.innerHTML = items.map(item => `<div class="admin-attention-row is-${item.tone}"><span><i data-lucide="${item.icon}"></i></span><div><strong>${adminEscape(item.title)}</strong><p>${adminEscape(item.text)}</p></div></div>`).join("");
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
    if (value === "electrical") return { className: "electrical", icon: "zap" };
    if (value === "it") return { className: "it", icon: "monitor-cog" };
    return { className: "biomedical", icon: "heart-pulse" };
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

function adminEscape(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
