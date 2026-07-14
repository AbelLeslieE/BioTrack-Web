// ==========================================
// ENGINEER DASHBOARD VIEW
// ==========================================

function engineerDashboardView() {

    return `

<section class="engineer-dashboard">

    <!-- ==========================================
    HEADER
    =========================================== -->

    <header class="engineer-header">

        <div>

            <h1>Biomedical Engineer Dashboard</h1>

            <p>

                Monitor your assigned maintenance calls and equipment activity.

            </p>

        </div>

        <button
            class="primary-btn"
            onclick="navigate('callManagement')">

            <i data-lucide="clipboard-list"></i>

            Open Call Management

        </button>

    </header>

    <!-- ==========================================
    KPI CARDS
    =========================================== -->

    <section class="engineer-kpis">

        <div class="dashboard-card">

            <div class="card-icon blue">

                <i data-lucide="clipboard-list"></i>

            </div>

            <div>

                <h2 id="assignedCalls">0</h2>

                <span>Assigned Calls</span>

            </div>

        </div>

        <div class="dashboard-card">

            <div class="card-icon orange">

                <i data-lucide="wrench"></i>

            </div>

            <div>

                <h2 id="progressCalls">0</h2>

                <span>In Progress</span>

            </div>

        </div>

        <div class="dashboard-card">

            <div class="card-icon red">

                <i data-lucide="triangle-alert"></i>

            </div>

            <div>

                <h2 id="criticalCalls">0</h2>

                <span>Critical Calls</span>

            </div>

        </div>

        <div class="dashboard-card">

            <div class="card-icon green">

                <i data-lucide="badge-check"></i>

            </div>

            <div>

                <h2 id="completedCalls">0</h2>

                <span>Completed Today</span>

            </div>

        </div>

    </section>

    <!-- ==========================================
    MAIN GRID
    =========================================== -->

    <section class="engineer-grid">

        <!-- LEFT -->

        <div class="engineer-left">

            <!-- Assigned Calls -->

            <div class="dashboard-panel">

                <div class="panel-header">

                    <h2>

                        <i data-lucide="list-checks"></i>

                        Assigned Maintenance Calls

                    </h2>

                </div>

                <div
                    id="assignedList"
                    class="assigned-calls">

                    <div class="loading-card">

                        Loading assigned calls...

                    </div>

                </div>

            </div>

        </div>

        <!-- RIGHT -->

        <div class="engineer-right">

            <!-- Equipment -->

            <div class="dashboard-panel">

                <div class="panel-header">

                    <h2>

                        <i data-lucide="monitor-cog"></i>

                        Equipment Status

                    </h2>

                </div>

                <div class="mini-stats">

                    <div>

                        <h3 id="onlineEquipment">0</h3>

                        <span>Online</span>

                    </div>

                    <div>

                        <h3 id="offlineEquipment">0</h3>

                        <span>Offline</span>

                    </div>

                    <div>

                        <h3 id="pmDueToday">0</h3>

                        <span>PM Due</span>

                    </div>

                </div>

            </div>

            <!-- Activity -->

            <div class="dashboard-panel">

                <div class="panel-header">

                    <h2>

                        <i data-lucide="history"></i>

                        Today's Activity

                    </h2>

                </div>

                <div
                    id="activityFeed"
                    class="activity-feed">

                    <p>No recent activity.</p>

                </div>

            </div>

            <!-- Quick Actions -->

            <div class="dashboard-panel">

                <div class="panel-header">

                    <h2>

                        <i data-lucide="bolt"></i>

                        Quick Actions

                    </h2>

                </div>

                <div class="quick-actions">

                    <button onclick="navigate('callManagement')">

                        <i data-lucide="clipboard-list"></i>

                        Call Management

                    </button>

                    <button onclick="navigate('assets')">

                        <i data-lucide="boxes"></i>

                        Assets

                    </button>

                    <button onclick="navigate('reports')">

                        <i data-lucide="chart-column"></i>

                        Reports

                    </button>

                </div>

            </div>

        </div>

    </section>

</section>

`;

}
window.engineerDashboardView = engineerDashboardView;