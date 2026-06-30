// ==========================================
// USER DASHBOARD
// ==========================================

function renderUserDashboard() {

    pageContent.innerHTML = `

    <div class="content user-dashboard">

        <!-- ==========================================
             HEADER
        ========================================== -->

        <div class="user-header">

            <div>

                <h1 id="departmentWelcome">
                    Welcome Back
                </h1>

                <p>
                    Here's what's happening in your department today.
                </p>

            </div>

            <div class="live-status">

                <span class="live-dot"></span>

                BioTrack Live

            </div>

        </div>

        <!-- ==========================================
             KPI CARDS
        ========================================== -->

        <div class="user-summary-grid">

            <div class="summary-card">

                <div class="summary-icon blue">

                    <i data-lucide="clipboard-list"></i>

                </div>

                <div>

                    <h2 id="openRequests">0</h2>

                    <p>Open Requests</p>

                </div>

            </div>

            <div class="summary-card">

                <div class="summary-icon orange">

                    <i data-lucide="loader-circle"></i>

                </div>

                <div>

                    <h2 id="progressRequests">0</h2>

                    <p>In Progress</p>

                </div>

            </div>

            <div class="summary-card">

                <div class="summary-icon green">

                    <i data-lucide="check-circle"></i>

                </div>

                <div>

                    <h2 id="completedRequests">0</h2>

                    <p>Completed</p>

                </div>

            </div>

            <div class="summary-card">

                <div class="summary-icon purple">

                    <i data-lucide="monitor-smartphone"></i>

                </div>

                <div>

                    <h2 id="departmentAssets">0</h2>

                    <p>Department Assets</p>

                </div>

            </div>

        </div>

        <!-- ==========================================
             MAIN GRID
        ========================================== -->

        <div class="user-main-grid">

            <!-- LEFT SIDE -->

            <div class="dashboard-card">

                <div class="card-header">

                    <h2>Recent Requests</h2>

                    <a href="#">View All</a>

                </div>

                <div id="departmentRequestTable">

                    <p style="color:#64748b;">
                        No maintenance requests available.
                    </p>

                </div>

            </div>

            <!-- RIGHT SIDE -->

            <div>

                <div class="dashboard-card">

                    <div class="card-header">

                        <h2>Quick Actions</h2>

                    </div>

                    <div class="quick-grid">

                        <button class="quick-btn">

                            <i data-lucide="plus-circle"></i>

                            <span>New Request</span>

                        </button>

                        <button class="quick-btn">

                            <i data-lucide="scan-line"></i>

                            <span>Scan QR</span>

                        </button>

                        <button class="quick-btn">

                            <i data-lucide="monitor-smartphone"></i>

                            <span>My Assets</span>

                        </button>

                        <button class="quick-btn">

                            <i data-lucide="clipboard-list"></i>

                            <span>My Requests</span>

                        </button>

                    </div>

                </div>

                <div class="dashboard-card" style="margin-top:20px;">

                    <div class="card-header">

                        <h2>Notifications</h2>

                    </div>

                    <p style="color:#64748b;">

                        No new notifications.

                    </p>

                </div>

            </div>

        </div>

    </div>

    `;

    // Department Name

    const department =
        localStorage.getItem("department") || "Department";

    document.getElementById("departmentWelcome").textContent =
        `Welcome back, ${department} Department 👋`;

    lucide.createIcons();

}