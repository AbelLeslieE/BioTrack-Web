// ==========================================
// LOAD DASHBOARD
// ==========================================

async function loadDashboard() {

    // Dashboard is not currently visible
    if (!document.getElementById("openCalls")) {
        return;
    }

    const data = await getDashboardData();

    if (!data) return;
function setText(id, value) {

    const el = document.getElementById(id);

    if (el) {
        el.textContent = value;
    }

}

    // ======================================
    // MAINTENANCE
    // ======================================

    console.log({
        openCalls: document.getElementById("openCalls"),
        closedToday: document.getElementById("closedToday"),
        todayCalls: document.getElementById("todayCalls"),
        avgDowntime: document.getElementById("avgDowntime"),
        engineersOnline: document.getElementById("engineersOnline"),
        totalAssets: document.getElementById("totalAssets"),
        criticalAssets: document.getElementById("criticalAssets"),
        pmDue: document.getElementById("pmDue"),
        outOfService: document.getElementById("outOfService")
    });

    setText("openCalls", data.open_calls);

    setText("closedToday", data.completed_today);
    setText("todayCalls", data.today_calls);
    setText("avgDowntime", data.avg_downtime + " h");
    setText("engineersOnline", data.engineers_online);

    setText("totalAssets", data.total_assets);
    setText("criticalAssets", data.critical_requests);
    setText("pmDue", data.pm_due);
    setText("outOfService", data.out_of_service);
}