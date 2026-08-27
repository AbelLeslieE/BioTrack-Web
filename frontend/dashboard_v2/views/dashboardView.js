// Executive administration dashboard.
function renderDashboard() {
    pageContent.innerHTML = `
      <main class="admin-operations-dashboard">
        <section class="admin-operations-hero">
          <div class="admin-operations-hero-copy">
            <span class="admin-eyebrow"><i data-lucide="activity"></i> Hospital operations control</span>
            <h1>One view of every engineering team.</h1>
            <p>Track maintenance work, asset availability and stock health across Biomedical, Electrical and IT services.</p>
          </div>
          <div class="admin-hero-actions">
            <div class="admin-live-status"><span></span> Live operations</div>
            <button class="admin-primary-action" onclick="navigate('callManagement')"><i data-lucide="clipboard-list"></i> Open call management</button>
          </div>
        </section>

        <section class="admin-summary-grid" aria-label="Hospital maintenance summary">
          <article class="admin-summary-card is-blue"><div class="admin-summary-icon"><i data-lucide="wrench"></i></div><div><span>Active calls</span><strong id="adminOpsActiveCalls">—</strong><small id="adminOpsActiveDetail">Across all departments</small></div></article>
          <article class="admin-summary-card is-red"><div class="admin-summary-icon"><i data-lucide="siren"></i></div><div><span>Critical calls</span><strong id="adminOpsCriticalCalls">—</strong><small>Needs immediate attention</small></div></article>
          <article class="admin-summary-card is-green"><div class="admin-summary-icon"><i data-lucide="circle-check-big"></i></div><div><span>Completed today</span><strong id="adminOpsCompletedToday">—</strong><small>Calls resolved today</small></div></article>
          <article class="admin-summary-card is-violet"><div class="admin-summary-icon"><i data-lucide="boxes"></i></div><div><span>Assets monitored</span><strong id="adminOpsAssets">—</strong><small id="adminOpsAssetsDetail">Across three service teams</small></div></article>
        </section>

        <section class="admin-team-section">
          <div class="admin-section-heading"><div><span class="admin-eyebrow">Department activity</span><h2>Service team command center</h2><p>Live workload and resource health for every engineering department.</p></div><button class="admin-quiet-action" onclick="loadDashboard()"><i data-lucide="refresh-cw"></i> Refresh</button></div>
          <div id="adminTeamGrid" class="admin-team-grid"><div class="admin-dashboard-loading">Loading department activity…</div></div>
        </section>

        <section class="admin-operations-grid">
          <article class="admin-panel admin-activity-panel">
            <div class="admin-panel-heading"><div><span class="admin-eyebrow">Live queue</span><h2>Recent maintenance activity</h2></div><button class="admin-link-button" onclick="navigate('callManagement')">View all <i data-lucide="arrow-up-right"></i></button></div>
            <div id="adminActivityFeed" class="admin-activity-feed"><div class="admin-dashboard-loading">Loading activity…</div></div>
          </article>
          <aside class="admin-side-stack">
            <article class="admin-panel admin-attention-panel">
              <div class="admin-panel-heading"><div><span class="admin-eyebrow">Operational attention</span><h2>What needs a look</h2></div></div>
              <div id="adminAttentionList" class="admin-attention-list"><div class="admin-dashboard-loading">Checking operations…</div></div>
            </article>
            <article class="admin-panel admin-quick-panel">
              <span class="admin-eyebrow">Administrator tools</span>
              <h2>Keep work moving</h2>
              <div class="admin-quick-actions">
                <button onclick="navigate('assets')"><i data-lucide="monitor-cog"></i><span>Asset register</span><i data-lucide="arrow-right"></i></button>
                <button onclick="navigate('inventory')"><i data-lucide="package-search"></i><span>Inventory health</span><i data-lucide="arrow-right"></i></button>
                <button onclick="navigate('pm')"><i data-lucide="calendar-clock"></i><span>PM schedule</span><i data-lucide="arrow-right"></i></button>
              </div>
            </article>
          </aside>
        </section>
      </main>
    `;

    if (window.lucide) lucide.createIcons();
    loadDashboard();
    if (window.dashboardRefresh) clearInterval(window.dashboardRefresh);
    window.dashboardRefresh = setInterval(loadDashboard, 30000);
}
