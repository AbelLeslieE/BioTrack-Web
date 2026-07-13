

function reportsView() {

    return `

<section class="reports-page">

    <!-- ==========================================
        REPORTS HEADER
    =========================================== -->

    <header class="reports-header">

        <div class="reports-header-left">

            <div class="reports-icon">

                <i class="fa-solid fa-chart-pie"></i>

            </div>

            <div class="reports-title">

                <h1>Reports</h1>

                <p>

                    Get insights and analytics on maintenance
                    activities, equipment performance and
                    biomedical service efficiency.

                </p>

            </div>

        </div>

        <div class="reports-header-image">

            <img
                src="/static/assets/reports-banner.svg"
                alt="Reports Illustration"
                loading="lazy"
                decoding="async">

        </div>

    </header>



    <!-- ==========================================
        FILTERS
    =========================================== -->

    <section class="reports-filters">

        <div class="reports-filter-grid">

            <div class="reports-filter">

                <label>Date Range</label>

                <div class="reports-input">

                    <i class="fa-regular fa-calendar"></i>

                    <input
                        type="date"
                        id="reportsStartDate">

                    <span>-</span>

                    <input
                        type="date"
                        id="reportsEndDate">

                </div>

            </div>

            <div class="reports-filter">

                <label>Department</label>

                <div class="reports-input">

                    <i class="fa-solid fa-building"></i>

                    <select id="reportsDepartment">

                        <option>All Departments</option>

                        <option>ICU</option>

                        <option>Radiology</option>

                        <option>Operation Theatre</option>

                        <option>Emergency</option>

                        <option>Laboratory</option>

                        <option>Biomedical Engineering</option>

                    </select>

                </div>

            </div>

            <div class="reports-filter">

                <label>Location</label>

                <div class="reports-input">

                    <i class="fa-solid fa-location-dot"></i>

                    <select id="reportsLocation">

                        <option>All Locations</option>

                        <option>Main Building</option>

                        <option>Block A</option>

                        <option>Block B</option>

                        <option>Emergency Wing</option>

                    </select>

                </div>

            </div>

            <div class="reports-filter">

                <label>Equipment</label>

                <div class="reports-input">

                    <i class="fa-solid fa-stethoscope"></i>

                    <select id="reportsEquipment">

                        <option>All Equipment</option>

                        <option>Ventilator</option>

                        <option>Patient Monitor</option>

                        <option>ECG</option>

                        <option>X-Ray</option>

                        <option>Ultrasound</option>

                    </select>

                </div>

            </div>

            <div class="reports-filter-buttons">

                <button
                    class="reports-btn-secondary"
                    id="reportsResetBtn">

                    Reset

                </button>

                <button
                    class="reports-btn-primary"
                    id="reportsApplyBtn">

                    <i class="fa-solid fa-filter"></i>

                    Apply Filters

                </button>

            </div>

        </div>

    </section>



    <!-- ==========================================
        KPI SECTION
    =========================================== -->

    <section class="reports-kpi-grid">
    <!-- ==========================================
        KPI CARDS
    =========================================== -->

    <section class="reports-kpi-section">

        <!-- Total Requests -->

        <div class="reports-kpi-card">

            <div class="reports-kpi-icon reports-blue">

                <i class="fa-solid fa-clipboard-list"></i>

            </div>

            <div class="reports-kpi-content">

                <span class="reports-kpi-title">

                    Total Requests

                </span>

                <h2 id="reportsTotalRequests">

                    128

                </h2>

                <p class="reports-kpi-trend positive">

                    <i class="fa-solid fa-arrow-trend-up"></i>

                    +12.4% from last month

                </p>

            </div>

        </div>

        <!-- Completed -->

        <div class="reports-kpi-card">

            <div class="reports-kpi-icon reports-green">

                <i class="fa-solid fa-circle-check"></i>

            </div>

            <div class="reports-kpi-content">

                <span class="reports-kpi-title">

                    Completed

                </span>

                <h2 id="reportsCompletedRequests">

                    89

                </h2>

                <p class="reports-kpi-trend positive">

                    <i class="fa-solid fa-arrow-trend-up"></i>

                    +15.7% completion

                </p>

            </div>

        </div>

        <!-- Pending -->

        <div class="reports-kpi-card">

            <div class="reports-kpi-icon reports-yellow">

                <i class="fa-solid fa-clock"></i>

            </div>

            <div class="reports-kpi-content">

                <span class="reports-kpi-title">

                    Pending

                </span>

                <h2 id="reportsPendingRequests">

                    26

                </h2>

                <p class="reports-kpi-trend warning">

                    Awaiting Engineer

                </p>

            </div>

        </div>

        <!-- Overdue -->

        <div class="reports-kpi-card">

            <div class="reports-kpi-icon reports-red">

                <i class="fa-solid fa-triangle-exclamation"></i>

            </div>

            <div class="reports-kpi-content">

                <span class="reports-kpi-title">

                    Overdue

                </span>

                <h2 id="reportsOverdueRequests">

                    13

                </h2>

                <p class="reports-kpi-trend negative">

                    Immediate attention required

                </p>

            </div>

        </div>

        <!-- Average Downtime -->

        <div class="reports-kpi-card">

            <div class="reports-kpi-icon reports-cyan">

                <i class="fa-solid fa-stopwatch"></i>

            </div>

            <div class="reports-kpi-content">

                <span class="reports-kpi-title">

                    Avg. Downtime

                </span>

                <h2>

                    <span id="reportsAvgDowntime">

                        24.6

                    </span>

                    <small>hrs</small>

                </h2>

                <p class="reports-kpi-trend positive">

                    −9.8% from last month

                </p>

            </div>

        </div>

    </section>



    <!-- ==========================================
        REPORT GRID
    =========================================== -->

    <section class="reports-grid">
    <!-- ==========================================
        REQUESTS OVERVIEW
    =========================================== -->

    <section class="reports-card reports-card-large">

        <div class="reports-card-header">

            <div>

                <h3>Requests Overview</h3>

                <p>Monthly biomedical maintenance requests</p>

            </div>

            <select
                class="reports-select"
                id="reportsOverviewRange">

                <option>Last 30 Days</option>
                <option selected>Last 12 Months</option>
                <option>This Year</option>

            </select>

        </div>

        <div class="reports-chart-container">

            <canvas id="reportsOverviewChart"></canvas>

        </div>

    </section>



    <!-- ==========================================
        REQUEST STATUS
    =========================================== -->

    <section class="reports-card">

        <div class="reports-card-header">

            <div>

                <h3>Requests by Status</h3>

                <p>Current maintenance request status</p>

            </div>

        </div>

        <div class="reports-chart-container reports-chart-small">

            <canvas id="reportsStatusChart"></canvas>

        </div>

        <div class="reports-legend">

            <div class="reports-legend-item">

                <span class="reports-dot reports-green"></span>

                <span>Completed</span>

                <strong>89</strong>

            </div>

            <div class="reports-legend-item">

                <span class="reports-dot reports-yellow"></span>

                <span>Pending</span>

                <strong>26</strong>

            </div>

            <div class="reports-legend-item">

                <span class="reports-dot reports-red"></span>

                <span>Overdue</span>

                <strong>13</strong>

            </div>

        </div>

    </section>



    <!-- ==========================================
        PROBLEM CATEGORIES
    =========================================== -->

    <section class="reports-card">

        <div class="reports-card-header">

            <div>

                <h3>Top Problem Categories</h3>

                <p>Distribution of reported faults</p>

            </div>

        </div>

        <div class="reports-chart-container reports-chart-small">

            <canvas id="reportsCategoryChart"></canvas>

        </div>

        <div class="reports-legend">

            <div class="reports-legend-item">

                <span class="reports-dot reports-blue"></span>

                <span>Electrical</span>

                <strong>38</strong>

            </div>

            <div class="reports-legend-item">

                <span class="reports-dot reports-purple"></span>

                <span>Mechanical</span>

                <strong>32</strong>

            </div>

            <div class="reports-legend-item">

                <span class="reports-dot reports-cyan"></span>

                <span>Software</span>

                <strong>21</strong>

            </div>

            <div class="reports-legend-item">

                <span class="reports-dot reports-green"></span>

                <span>Calibration</span>

                <strong>15</strong>

            </div>

            <div class="reports-legend-item">

                <span class="reports-dot reports-gray"></span>

                <span>Others</span>

                <strong>22</strong>

            </div>

        </div>

    </section>



    <!-- ==========================================
        REQUESTS BY DEPARTMENT
    =========================================== -->

    <section class="reports-card">

        <div class="reports-card-header">

            <h3>Requests by Department</h3>

            <button class="reports-icon-button">

                <i class="fa-solid fa-arrow-up-right-from-square"></i>

            </button>

        </div>

        <div class="reports-chart-container">

            <canvas id="reportsDepartmentChart"></canvas>

        </div>

    </section>



    <!-- ==========================================
        DOWNTIME TREND
    =========================================== -->

    <section class="reports-card">

        <div class="reports-card-header">

            <h3>Downtime Trend</h3>

            <button class="reports-icon-button">

                <i class="fa-solid fa-arrow-up-right-from-square"></i>

            </button>

        </div>

        <div class="reports-chart-container">

            <canvas id="reportsDowntimeChart"></canvas>

        </div>

    </section>
    <!-- ==========================================
        REPORT SUMMARY
    =========================================== -->

    <section class="reports-summary-card">

        <div class="reports-card-header">

            <h3>Reports Summary</h3>

        </div>

        <div class="reports-summary-list">

            <div class="reports-summary-item">

                <span>

                    <i class="fa-solid fa-clipboard-list reports-blue"></i>

                    Total Requests

                </span>

                <strong>128</strong>

            </div>

            <div class="reports-summary-item">

                <span>

                    <i class="fa-solid fa-circle-check reports-green"></i>

                    Completed Requests

                </span>

                <strong>89</strong>

            </div>

            <div class="reports-summary-item">

                <span>

                    <i class="fa-solid fa-clock reports-yellow"></i>

                    Pending Requests

                </span>

                <strong>26</strong>

            </div>

            <div class="reports-summary-item">

                <span>

                    <i class="fa-solid fa-triangle-exclamation reports-red"></i>

                    Overdue Requests

                </span>

                <strong>13</strong>

            </div>

            <div class="reports-summary-item">

                <span>

                    <i class="fa-solid fa-stopwatch reports-cyan"></i>

                    Average Downtime

                </span>

                <strong>24.6 hrs</strong>

            </div>

            <div class="reports-summary-item">

                <span>

                    <i class="fa-solid fa-hospital reports-purple"></i>

                    Active Departments

                </span>

                <strong>6</strong>

            </div>

        </div>

    </section>



    <!-- ==========================================
        EXPORT REPORTS
    =========================================== -->

    <section class="reports-export-card">

        <div class="reports-card-header">

            <div>

                <h3>Export Reports</h3>

                <p>

                    Download reports or schedule
                    automatic report generation.

                </p>

            </div>

        </div>

        <div class="reports-export-grid">

            <button
                class="reports-btn-secondary"
                id="reportsPdfBtn">

                <i class="fa-solid fa-file-pdf"></i>

                Download PDF

            </button>

            <button
                class="reports-btn-secondary"
                id="reportsExcelBtn">

                <i class="fa-solid fa-file-excel"></i>

                Export Excel

            </button>

            <button
                class="reports-btn-secondary"
                id="reportsCsvBtn">

                <i class="fa-solid fa-file-csv"></i>

                Export CSV

            </button>

            <button
                class="reports-btn-primary"
                id="reportsScheduleBtn">

                <i class="fa-solid fa-calendar-days"></i>

                Schedule Report

            </button>

        </div>

    </section>

</section>

</section>

`;
}
/* ==========================================
   RENDER REPORTS
========================================== */

function renderReports() {

    const pageContent = document.getElementById("page-content");

    pageContent.innerHTML = reportsView();

    if (typeof startReports === "function") {

        startReports();

    }

}

/* ==========================================
   GLOBAL FUNCTIONS
========================================== */

window.reportsView = reportsView;
window.renderReports = renderReports;