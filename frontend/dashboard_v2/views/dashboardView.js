// ==========================================
// DASHBOARD VIEW
// ==========================================

function renderDashboard() {

    pageContent.innerHTML = `

    <!-- Hero -->
    <section class="dashboard-hero">

        <h1>Welcome back, Admin 👋</h1>

        <p>
            Here's what's happening in your biomedical maintenance system today.
        </p>

    </section>

    <!-- =====================================
         Maintenance Operations
    ====================================== -->

    <section class="dashboard-section">

        <div class="section-header">

            <h2>📋 Maintenance Operations</h2>

            <p>Live overview of maintenance requests</p>

        </div>

        <div class="dashboard-kpi maintenance-grid">

            <div class="kpi-card">

                <div class="kpi-icon blue">
                    <i data-lucide="clipboard-list"></i>
                </div>

                <div class="kpi-content">

                    <h2 id="openCalls">0</h2>

                    <p>Open Calls</p>

                </div>

            </div>

            <div class="kpi-card">

                <div class="kpi-icon teal">
                    <i data-lucide="check-circle"></i>
                </div>

                <div class="kpi-content">

                    <h2 id="closedToday">0</h2>

                    <p>Closed Today</p>

                </div>

            </div>

            <div class="kpi-card">

                <div class="kpi-icon orange">
                    <i data-lucide="calendar-days"></i>
                </div>

                <div class="kpi-content">

                    <h2 id="todayCalls">0</h2>

                    <p>Today's Calls</p>

                </div>

            </div>

            <div class="kpi-card">

                <div class="kpi-icon red">
                    <i data-lucide="clock-3"></i>
                </div>

                <div class="kpi-content">

                    <h2 id="avgDowntime">0 h</h2>

                    <p>Average Downtime</p>

                </div>

            </div>

            <div class="kpi-card">

                <div class="kpi-icon purple">
                    <i data-lucide="users"></i>
                </div>

                <div class="kpi-content">

                    <h2 id="engineersOnline">0</h2>

                    <p>Engineers Online</p>

                </div>

            </div>

        </div>

    </section>

    <!-- =====================================
         Asset Overview
    ====================================== -->

    <section class="dashboard-section">

        <div class="section-header">

            <h2>🏥 Asset Overview</h2>

            <p>Hospital equipment summary</p>

        </div>

        <div class="dashboard-kpi asset-grid">

            <div class="kpi-card">

                <div class="kpi-icon blue">
                    <i data-lucide="monitor-smartphone"></i>
                </div>

                <div class="kpi-content">

                    <h2 id="totalAssets">0</h2>

                    <p>Total Assets</p>

                </div>

            </div>

            <div class="kpi-card">

                <div class="kpi-icon red">
                    <i data-lucide="triangle-alert"></i>
                </div>

                <div class="kpi-content">

                    <h2 id="criticalAssets">0</h2>

                    <p>Critical Assets</p>

                </div>

            </div>

            <div class="kpi-card">

                <div class="kpi-icon orange">
                    <i data-lucide="calendar-clock"></i>
                </div>

                <div class="kpi-content">

                    <h2 id="pmDue">0</h2>

                    <p>PM Due</p>

                </div>

            </div>

            <div class="kpi-card">

                <div class="kpi-icon teal">
                    <i data-lucide="power"></i>
                </div>

                <div class="kpi-content">

                    <h2 id="outOfService">0</h2>

                    <p>Out of Service</p>

                </div>

            </div>

        </div>

    </section>

    <!-- =====================================
         Charts
    ====================================== -->

    <section class="dashboard-analytics">

        <div class="analytics-card trend-card">

            <div class="card-header">

                <h2>Maintenance Trend</h2>

                <select>

                    <option>This Week</option>

                    <option>This Month</option>

                    <option>This Year</option>

                </select>

            </div>

            <canvas id="maintenanceChart"></canvas>

        </div>

        <div class="analytics-card status-card">

            <div class="card-header">

                <h2>Request Status</h2>

            </div>

            <canvas id="statusChart"></canvas>

        </div>

    </section>

    <!-- Activity -->

    <section class="dashboard-activity">

    </section>

    <!-- Table -->

    <section class="dashboard-table">

    </section>

    `;

    lucide.createIcons();

    // Load KPI values
    loadDashboard();

    // Refresh every 5 seconds
    if (window.dashboardRefresh) {
        clearInterval(window.dashboardRefresh);
    }

    window.dashboardRefresh = setInterval(loadDashboard, 5000);

    }