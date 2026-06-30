// ===========================
// Department Title
// ===========================

document.addEventListener("DOMContentLoaded", () => {

    const department =
        localStorage.getItem("department");

    const title =
        document.getElementById(
            "departmentTitle"
        );

    if (
        department &&
        title
    ) {

        title.textContent =
            `Welcome to ${department} Maintenance Portal`;

    }

});

// ===========================
// Current Date
// ===========================

document.addEventListener("DOMContentLoaded", () => {

    const dateElement =
        document.getElementById("currentDate");

    const timeElement =
        document.getElementById("currentTime");

    function updateDateTime() {

        const now = new Date();

        dateElement.textContent =
            now.toLocaleDateString(
                "en-IN",
                {
                    weekday: "long",
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                }
            );

        timeElement.textContent =
            now.toLocaleTimeString(
                "en-IN",
                {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: true
                }
            );

    }

    updateDateTime();

    setInterval(updateDateTime, 1000);

});


// ===========================
// Demo Data
// Remove later when database
// is connected
// ===========================

document.addEventListener("DOMContentLoaded", () => {

    const department =
    localStorage.getItem("department");

let requests = [];

/* ==================================
   DIALYSIS
================================== */

if (department === "Dialysis") {

    requests = [

        {
            ticket: "BT-DIA-0001",
            equipment: "Hemodialysis Machine",
            status: "Open",
            date: "21-Jun-2026"
        },

        {
            ticket: "BT-DIA-0002",
            equipment: "RO Water System",
            status: "Closed",
            date: "20-Jun-2026"
        }

    ];

}

/* ==================================
   ICU
================================== */

else if (department === "ICU") {

    requests = [

        {
            ticket: "BT-ICU-0001",
            equipment: "Ventilator",
            status: "Open",
            date: "21-Jun-2026"
        },

        {
            ticket: "BT-ICU-0002",
            equipment: "Patient Monitor",
            status: "In Progress",
            date: "21-Jun-2026"
        },

        {
            ticket: "BT-ICU-0003",
            equipment: "Syringe Pump",
            status: "Closed",
            date: "19-Jun-2026"
        }

    ];

}

/* ==================================
   CATH LAB
================================== */

else if (department === "CATH Lab") {

    requests = [

        {
            ticket: "BT-CATH-0001",
            equipment: "Cath Lab Imaging System",
            status: "Open",
            date: "21-Jun-2026"
        },

        {
            ticket: "BT-CATH-0002",
            equipment: "ECG Recorder",
            status: "Closed",
            date: "20-Jun-2026"
        }

    ];

}

/* ==================================
   DEFAULT
================================== */

else {

    requests = [];

}

    const table =
        document.getElementById("requestTable");

    const empty =
        document.getElementById("emptyState");

    if (!empty) {

        console.error(
            "emptyState element not found"
        );

        return;
    }

    if (requests.length > 0) {

        empty.style.display = "none";

        table.style.display = "table";

        requests.forEach(request => {

            const row =
                document.createElement("tr");

            let statusClass = "";

            if (request.status === "Open") {

                statusClass = "status-open";

            }
            else if (
                request.status === "In Progress"
            ) {

                statusClass = "status-progress";

            }
            else {

                statusClass = "status-closed";

            }

            row.innerHTML = `

                <td>${request.ticket}</td>

                <td>${request.equipment}</td>

                <td>

                    <span class="status ${statusClass}">
                        ${request.status}
                    </span>

                </td>

                <td>${request.date}</td>

                <td>

                    <button class="view-btn">
                        View
                    </button>

                </td>

            `;

            document
                .getElementById("requestBody")
                .appendChild(row);

        });

    }
    else {

        empty.addEventListener("click", () => {

            window.location.href =
                "/static/new_call.html";

        });

    }

});
// ===========================
// Create New Request Button
// ===========================

document.addEventListener("DOMContentLoaded", () => {

    const newRequestBtn =
        document.getElementById("newRequestBtn");

    if (newRequestBtn) {

        newRequestBtn.addEventListener("click", () => {

            window.location.href =
                "/static/new_call.html";

        });

    }

});
// ===========================
// Logout
// ===========================

document.addEventListener("DOMContentLoaded", () => {

    const logoutBtn =
        document.querySelector(".logout-btn");

    if (!logoutBtn) return;

    logoutBtn.addEventListener("click", () => {

        localStorage.removeItem("userRole");
        localStorage.removeItem("username");

        window.location.href =
            "/static/login.html";

    });

});