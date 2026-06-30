const trendCanvas = document.getElementById("maintenanceChart");
const statusCanvas = document.getElementById("statusChart");

if (trendCanvas) {
    new Chart(trendCanvas, {
        type: "line",
        data: {
            labels: [],
            datasets: []
        }
    });
}

if (statusCanvas) {
    new Chart(statusCanvas, {
        type: "doughnut",
        data: {
            labels: [],
            datasets: []
        }
    });
}