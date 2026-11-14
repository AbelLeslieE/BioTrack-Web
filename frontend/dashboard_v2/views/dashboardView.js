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
            <div class="admin-live-status"><span></span><div><strong>Live operations</strong><small id="adminLastUpdated">Updating now…</small></div></div>
            <button class="admin-primary-action" onclick="navigate('callManagement')"><i data-lucide="clipboard-list"></i> Open call management</button>
          </div>
        </section>

        <section class="admin-summary-grid" aria-label="Hospital maintenance summary">
          <article class="admin-summary-card is-blue"><div class="admin-summary-icon"><i data-lucide="wrench"></i></div><div><span>Active calls</span><strong id="adminOpsActiveCalls">—</strong><small id="adminOpsActiveDetail">Across all departments</small></div></article>
          <article class="admin-summary-card is-red"><div class="admin-summary-icon"><i data-lucide="siren"></i></div><div><span>Critical calls</span><strong id="adminOpsCriticalCalls">—</strong><small>Needs immediate attention</small></div></article>
          <article class="admin-summary-card is-green"><div class="admin-summary-icon"><i data-lucide="circle-check-big"></i></div><div><span>Completed today</span><strong id="adminOpsCompletedToday">—</strong><small>Calls resolved today</small></div></article>
          <article class="admin-summary-card is-violet"><div class="admin-summary-icon"><i data-lucide="boxes"></i></div><div><span>Assets monitored</span><strong id="adminOpsAssets">—</strong><small id="adminOpsAssetsDetail">Across three service teams</small></div></article>
        </section>

        <section class="admin-insight-section" aria-labelledby="adminInsightTitle">
          <div class="admin-section-heading"><div><span class="admin-eyebrow">Operations pulse</span><h2 id="adminInsightTitle">Information to know now</h2><p>Live risk, availability, maintenance and supply indicators.</p></div></div>
          <div class="admin-insight-grid" id="adminInsightGrid">
            <button class="admin-insight-card is-blue" type="button" onclick="navigate('callManagement')"><span class="admin-insight-icon"><i data-lucide="timer"></i></span><span><small>Active downtime</small><strong id="adminOpsActiveDowntime">—</strong><em id="adminOpsOldestCall">Oldest active call</em></span><i data-lucide="arrow-up-right"></i></button>
            <button class="admin-insight-card is-slate" type="button" onclick="navigate('reports')"><span class="admin-insight-icon"><i data-lucide="gauge"></i></span><span><small>Average downtime</small><strong id="adminOpsAvgDowntime">—</strong><em>Completed maintenance</em></span><i data-lucide="arrow-up-right"></i></button>
            <button class="admin-insight-card is-orange" type="button" onclick="navigate('inventory')"><span class="admin-insight-icon"><i data-lucide="package-search"></i></span><span><small>Stock health</small><strong id="adminOpsStockHealth">—</strong><em id="adminOpsStockDetail">Checking inventory</em></span><i data-lucide="arrow-up-right"></i></button>
            <button class="admin-insight-card is-violet" type="button" onclick="navigate('pm')"><span class="admin-insight-icon"><i data-lucide="calendar-clock"></i></span><span><small>PM attention</small><strong id="adminOpsPmDue">—</strong><em id="adminOpsPmDetail">Due or overdue</em></span><i data-lucide="arrow-up-right"></i></button>
            <button class="admin-insight-card is-red" type="button" onclick="navigate('callManagement')"><span class="admin-insight-icon"><i data-lucide="boxes"></i></span><span><small>Awaiting parts</small><strong id="adminOpsAwaitingParts">—</strong><em>Calls delayed by supply</em></span><i data-lucide="arrow-up-right"></i></button>
            <button class="admin-insight-card is-green" type="button" onclick="navigate('assets')"><span class="admin-insight-icon"><i data-lucide="activity"></i></span><span><small>Asset availability</small><strong id="adminOpsAssetAvailability">—</strong><em id="adminOpsAssetDetail">Across monitored assets</em></span><i data-lucide="arrow-up-right"></i></button>
          </div>
        </section>

        <section class="admin-shortcut-section" aria-labelledby="adminShortcutTitle">
          <div class="admin-section-heading"><div><span class="admin-eyebrow">Quick access</span><h2 id="adminShortcutTitle">Common administrator shortcuts</h2><p>Open frequently used workspaces directly or use the shown keyboard shortcut.</p></div></div>
          <div class="admin-shortcut-grid">
            <button type="button" onclick="navigate('callManagement')" aria-keyshortcuts="Alt+C"><i data-lucide="clipboard-list"></i><span><strong>Call management</strong><small>Open and active calls</small></span><kbd>Alt C</kbd></button>
            <button type="button" onclick="navigate('assets')" aria-keyshortcuts="Alt+A"><i data-lucide="monitor-cog"></i><span><strong>Asset register</strong><small>Equipment and availability</small></span><kbd>Alt A</kbd></button>
            <button type="button" onclick="navigate('inventory')" aria-keyshortcuts="Alt+I"><i data-lucide="package-search"></i><span><strong>Stock control</strong><small>Low and out-of-stock items</small></span><kbd>Alt I</kbd></button>
            <button type="button" onclick="navigate('pm')" aria-keyshortcuts="Alt+P"><i data-lucide="calendar-clock"></i><span><strong>PM schedule</strong><small>Due preventive maintenance</small></span><kbd>Alt P</kbd></button>
            <button type="button" onclick="navigate('qr')" aria-keyshortcuts="Alt+Q"><i data-lucide="scan-line"></i><span><strong>QR scanner</strong><small>Find an asset quickly</small></span><kbd>Alt Q</kbd></button>
            <button type="button" onclick="navigate('reports')" aria-keyshortcuts="Alt+R"><i data-lucide="bar-chart-3"></i><span><strong>Reports</strong><small>Downtime and performance</small></span><kbd>Alt R</kbd></button>
            <button type="button" onclick="navigate('users')" aria-keyshortcuts="Alt+U"><i data-lucide="users"></i><span><strong>User access</strong><small>Teams and permissions</small></span><kbd>Alt U</kbd></button>
            <button type="button" onclick="navigate('settings')" aria-keyshortcuts="Alt+S"><i data-lucide="settings"></i><span><strong>Settings</strong><small>Profile and security</small></span><kbd>Alt S</kbd></button>
          </div>
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
