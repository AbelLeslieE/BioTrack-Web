/* ==========================================
   MAINTENANCE TREND CHART
========================================== */

const maintenanceChart =
    document.getElementById("maintenanceChart");

if (maintenanceChart) {

    new Chart(
        maintenanceChart,
        {
            type: "line",

            data: {

                labels: [
                    "Week 1",
                    "Week 2",
                    "Week 3",
                    "Week 4"
                ],

                datasets: [

                    {
                        label: "Open Calls",

                        data: [8, 12, 10, 6],

                        borderWidth: 3,

                        tension: 0.4
                    },

                    {
                        label: "Closed Calls",

                        data: [5, 10, 15, 18],

                        borderWidth: 3,

                        tension: 0.4
                    }

                ]
            },

            options: {

                responsive: true,

                maintainAspectRatio: false
            }
        }
    );
}

/* ==========================================
   PROBLEM CATEGORY PIE CHART
========================================== */

const problemChart =
    document.getElementById("problemChart");

if (problemChart) {

    new Chart(
        problemChart,
        {
            type: "pie",

            data: {

                labels: [
                    "Electrical",
                    "Mechanical",
                    "Network",
                    "Calibration"
                ],

                datasets: [
                    {
                        data: [30, 25, 20, 25]
                    }
                ]
            },

            options: {

                responsive: true,

                maintainAspectRatio: false
            }
        }
    );
}
/* ==========================================
   LOGOUT
========================================== */

document.addEventListener("DOMContentLoaded", () => {

    const logoutLink =
        document.getElementById("logoutLink");

    if (!logoutLink) return;

    logoutLink.addEventListener("click", (e) => {

        e.preventDefault();

        localStorage.clear();

        window.location.href =
            "/static/login.html";

    });

});
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
// ==========================================
// LOAD DASHBOARD DATA
// ==========================================

async function loadDashboard() {

    try {

        const response =
            await fetch(
                "/api/dashboard"
            );

        const data =
            await response.json();

        document.getElementById(
            "openCalls"
        ).textContent =
            data.open_calls;

        document.getElementById(
            "closedCalls"
        ).textContent =
            data.closed_calls;

        document.getElementById(
            "todayCalls"
        ).textContent =
            data.today_calls;

        document.getElementById(
            "avgDowntime"
        ).textContent =
            data.avg_downtime +
            " hrs";

        const table =
            document.getElementById(
                "recentLogsBody"
            );

        table.innerHTML = "";

        data.recent_logs.forEach(log => {

            table.innerHTML += `

            <tr>

                <td class="ticket-cell">
                    ${log.ticket}
                </td>  

                <td>
                    ${log.equipment || "-"}
                </td>

                <td>
                    ${log.department || "-"}
                </td>

                <td>

                    <span class="
                        priority-badge
                        ${
                            log.priority === "High"
                                ? "priority-high"
                                : log.priority === "Medium"
                                ? "priority-medium"
                                : "priority-low"
                        }
                    ">

                        ${log.priority || "-"}

                    </span>

                </td>

                <td>

                    <span class="
                        status-badge
                        ${
                            log.status === "Open"
                                ? "status-open"
                                : log.status === "In Progress"
                                ? "status-progress"
                                : log.status === "Awaiting Parts"
                                ? "status-awaiting"
                                : "status-closed"
                        }
                    ">

                        ${log.status}

                    </span>

                </td>

                <td>
    ${log.downtime || 0} hrs
                </td>

                <td>
                    ${
                        log.call_received
                        ? new Date(
                            log.call_received
                        ).toLocaleString("en-IN")
                        : "-"
                    }
                </td>

                <td>

                    <button
                        class="view-btn"
                        data-ticket="${log.ticket}"
                    >

                        View

                    </button>

                </td>

            </tr>

            `;

        });

    }

    catch(error) {

        console.error(error);

    }

}

loadDashboard();

setInterval(
    loadDashboard,
    10000
);


// ==========================================
// DATE & TIME
// ==========================================

function updateDateTime() {

    const now = new Date();

    document.getElementById(
        "currentDate"
    ).textContent =
        now.toLocaleDateString(
            "en-IN",
            {
                day: "numeric",
                month: "long",
                year: "numeric"
            }
        );

    document.getElementById(
        "currentDay"
    ).textContent =
        now.toLocaleDateString(
            "en-IN",
            {
                weekday: "long"
            }
        );

}

updateDateTime();

setInterval(
    updateDateTime,
    60000
);


// ==========================================
// VIEW LOG DETAILS
// ==========================================

document.addEventListener(
    "click",
    async (e) => {

        if (
            !e.target.classList.contains(
                "view-btn"
            )
        ) return;

        const ticket =
            e.target.dataset.ticket;

        const response =
            await fetch(
                "/api/requests"
            );

        const requests =
            await response.json();

        const request =
            requests.find(
                r =>
                    r.ticket === ticket
            );
        document.getElementById(
            "modalTicket"
        ).value =
            request.ticket || "";

        document.getElementById(
            "modalDepartment"
        ).value =
            request.department || "";

        document.getElementById(
            "modalEquipment"
        ).value =
            request.equipment || "";

        document.getElementById(
            "modalPriority"
        ).value =
            request.priority || "";    
        if (!request) return;

        

        document.getElementById(
            "modalTicket"
        ).value =
            request.ticket;

        document.getElementById(
            "modalDepartment"
        ).value =
            request.department || "";

        document.getElementById(
            "modalEquipment"
        ).value =
            request.equipment || "";

        document.getElementById(
            "modalPriority"
        ).value =
            request.priority || "";

        document.getElementById(
            "modalCallReceived"
        ).value =
            request.callReceived
            ? request.callReceived.slice(0,16)
            : "";

        document.getElementById(
            "modalEngineerStart"
        ).value =
            request.engineerStart
            ? request.engineerStart.slice(0,16)
            : "";

        document.getElementById(
            "modalFixedTime"
        ).value =
            request.fixedTime
            ? request.fixedTime.slice(0,16)
            : "";

        document.getElementById(
            "modalDowntime"
        ).value =
            request.downtime || 0;

        document.getElementById(
            "logModal"
        ).style.display =
            "flex";

    }
);
document.addEventListener(
    "click",
    (e) => {

        if (
            e.target.id ===
            "closeAdminModal"
        ) {

            document.getElementById(
                "adminLogModal"
            ).style.display =
                "none";

        }

    }
);
function recalculateDowntime() {

    const callReceived =
        document.getElementById(
            "modalCallReceived"
        ).value;

    const fixedTime =
        document.getElementById(
            "modalFixedTime"
        ).value;

    if (
        !callReceived ||
        !fixedTime
    ) return;

    const start =
        new Date(callReceived);

    const end =
        new Date(fixedTime);

    const hours =
        (
            end - start
        ) /
        1000 /
        60 /
        60;

    document.getElementById(
        "modalDowntime"
    ).value =
        hours.toFixed(2);
}

const callReceivedInput =
    document.getElementById(
        "modalCallReceived"
    );

const fixedTimeInput =
    document.getElementById(
        "modalFixedTime"
    );

if (callReceivedInput) {

    callReceivedInput.addEventListener(
        "change",
        recalculateDowntime
    );

}

if (fixedTimeInput) {

    fixedTimeInput.addEventListener(
        "change",
        recalculateDowntime
    );

}
// ==========================================
// MODAL BUTTONS
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const closeBtn =
            document.getElementById(
                "closeLogModal"
            );

        const modal =
            document.getElementById(
                "logModal"
            );

        if (closeBtn) {

            closeBtn.addEventListener(
                "click",
                () => {

                    modal.style.display =
                        "none";

                }
            );

        }

        if (modal) {

            modal.addEventListener(
                "click",
                (e) => {

                    if (
                        e.target === modal
                    ) {

                        modal.style.display =
                            "none";

                    }

                }
            );

        }

    }
);
// ==========================================
// SAVE LOG
// ==========================================

document.addEventListener(
    "click",
    async (e) => {

        if (
            e.target.id !==
            "saveLogBtn"
        ) return;

        try {

            const ticket =
                document.getElementById(
                    "modalTicket"
                ).value;

            const payload = {

                call_received:
                    document.getElementById(
                        "modalCallReceived"
                    ).value,

                engineer_start:
                    document.getElementById(
                        "modalEngineerStart"
                    ).value,

                fixed_time:
                    document.getElementById(
                        "modalFixedTime"
                    ).value,

                downtime:
                    parseFloat(
                        document.getElementById(
                            "modalDowntime"
                        ).value
                    ) || 0

            };

            const response =
                await fetch(
                    `/api/requests/${ticket}/edit`,
                    {
                        method: "PUT",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify(
                                payload
                            )
                    }
                );

            const result =
                await response.json();

            if (result.success) {

                alert(
                    "Changes Saved Successfully"
                );

                document
                    .getElementById(
                        "logModal"
                    )
                    .classList.remove(
                        "active"
                    );

                loadDashboard();

            }

            else {

                alert(
                    result.message ||
                    "Failed to save changes"
                );

            }

        }

        catch (error) {

            console.error(error);

            alert(
                "Error saving changes"
            );

        }

    }
);


// ==========================================
// DELETE LOG
// ==========================================

document.addEventListener(
    "click",
    async (e) => {

        if (
            e.target.id !==
            "deleteLogBtn"
        ) return;

        const ticket =
            document.getElementById(
                "modalTicket"
            ).value;

        const confirmDelete =
            confirm(
                `Are you sure you want to delete ${ticket}?`
            );

        if (!confirmDelete)
            return;

        try {

            const response =
                await fetch(
                    `/api/requests/${ticket}`,
                    {
                        method:
                            "DELETE"
                    }
                );

            const result =
                await response.json();

            if (result.success) {

                alert(
                    "Log Deleted Successfully"
                );

                document
                    .getElementById(
                        "logModal"
                    )
                    .classList.remove(
                        "active"
                    );

                loadDashboard();

            }

            else {

                alert(
                    result.message ||
                    "Delete failed"
                );

            }

        }

        catch (error) {

            console.error(error);

            alert(
                "Error deleting log"
            );

        }

    }
);