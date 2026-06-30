// ===========================
// Date & Time
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

async function loadKPIs() {

    try {

        const response =
            await fetch(
                "/api/kpis"
            );

        const data =
            await response.json();

        document.getElementById(
            "openCalls"
        ).textContent =
            data.open_calls;

        document.getElementById(
            "inProgress"
        ).textContent =
            data.in_progress;

        document.getElementById(
            "awaitingParts"
        ).textContent =
            data.awaiting_parts;

        document.getElementById(
            "closedToday"
        ).textContent =
            data.closed_today;

    }

    catch (error) {

        console.error(error);

    }

}
// ===========================
// Format Date Time
// ===========================

function formatDateTime(dateString) {

    if (
        !dateString ||
        dateString === "None"
    ) {

        return "Not Available";

    }

    const date =
        new Date(dateString);

    return date.toLocaleString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        }
    );

}

// ===========================
// Format Downtime
// ===========================

function formatDowntime(hours) {

    if (
        !hours ||
        hours <= 0
    ) {

        return "Not Available";

    }

    const totalMinutes =
        Math.round(hours * 60);

    const hrs =
        Math.floor(
            totalMinutes / 60
        );

    const mins =
        totalMinutes % 60;

    if (hrs === 0) {

        return `${mins} Minutes`;

    }

    return `${hrs} Hours ${mins} Minutes`;

}
// ===========================
// Demo Requests
// ===========================

let requests = [];
async function loadRequests() {

    try {

        const response =
            await fetch(
                "/api/requests"
            );

        requests =
            await response.json();

        renderTable();

    }

    catch (error) {

        console.error(
            error
        );

        showToast(
            "Failed to load requests"
        );

    }

}
function renderTable() {

    const body =
        document.getElementById(
            "requestBody"
        );

    body.innerHTML = "";

    requests.forEach(request => {

        const row =
            document.createElement("tr");

        let statusClass = "";
        let priorityClass = "";

        if (request.status === "Open") {

            statusClass =
                "status-open";

        }
        else if (
            request.status ===
            "In Progress"
        ) {

            statusClass =
                "status-progress";

        }
        else if (
            request.status ===
            "Awaiting Parts"
        ) {

            statusClass =
                "status-awaiting";

        }
        else if (
            request.status ===
            "Awaiting Parts"
        ) {

            statusClass =
                "status-awaiting";

        }
        else {

            statusClass =
                "status-closed";

        }

        if (request.priority === "High") {

            priorityClass =
                "priority-high";

        }
        else if (
            request.priority ===
            "Medium"
        ) {

            priorityClass =
                "priority-medium";

        }
        else {

            priorityClass =
                "priority-low";

        }

        row.innerHTML = `

            <td>${request.ticket}</td>

            <td>${request.department}</td>

            <td>${request.equipment}</td>

            <td>

                <span
                    class="priority-badge ${priorityClass}"
                >
                    ${request.priority}
                </span>

            </td>

            <td>

                <span
                    class="status-badge ${statusClass}"
                >
                    ${request.status}
                </span>

            </td>

            <td>

                <button
                    class="view-btn"
                    data-ticket="${request.ticket}"
                >
                    View
                </button>

            </td>

        `;

        body.appendChild(row);

    });

}

document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadRequests();

        loadKPIs();

        // Auto refresh every 10 seconds
        setInterval(() => {

            loadRequests();

            loadKPIs();

        }, 10000);

    }
);

// ===========================
// Logout
// ===========================

document.addEventListener("DOMContentLoaded", () => {

    const logoutBtn =
        document.querySelector(".logout-btn");

    if (!logoutBtn) return;

    logoutBtn.addEventListener("click", () => {

        localStorage.clear();

        window.location.href =
        "login.html";

    });

});
// ===========================
// VIEW MODAL
// ===========================

document.addEventListener("click", (e) => {

    if (
        !e.target.classList.contains(
            "view-btn"
        )
    ) return;

    const ticket =
        e.target.dataset.ticket;

    const modal =
        document.getElementById(
            "requestModal"
        );

    const details =
        document.getElementById(
            "modalDetails"
        );

    const request =
        requests.find(
            r => r.ticket === ticket
        );

    if (!request) return;

    details.innerHTML = `

        <div class="detail-row">
            <strong>Ticket:</strong>
            ${request.ticket}
        </div>

        <div class="detail-row">
            <strong>Department:</strong>
            ${request.department}
        </div>

        <div class="detail-row">
            <strong>Equipment:</strong>
            ${request.equipment}
        </div>

        <div class="detail-row">
            <strong>Priority:</strong>
            ${request.priority}
        </div>

        <div class="detail-row">
            <strong>Status:</strong>
            ${request.status}
        </div>

        <div class="detail-row">
            <strong>Reported By:</strong>
            ${request.reportedBy}
        </div>

        <div class="detail-row">
            <strong>Problem Category:</strong>
            ${request.category}
        </div>

        <div class="detail-row">
            <strong>Description:</strong>
            ${request.description}
        </div>

    `;

    document.getElementById(
        "engineerNotes"
    ).value =
        request.engineerNotes || "";

    document.getElementById(
        "workDone"
    ).value =
        request.workDone || "";

    document.getElementById(
        "spareParts"
    ).value =
        request.spareParts || "";

    document.getElementById(
        "callReceivedTime"
    ).innerHTML =
        "📞 " +
        formatDateTime(
            request.callReceived
        );

    document.getElementById(
        "engineerStartTime"
    ).innerHTML =
        "👨‍🔧 " +
        formatDateTime(
            request.engineerStart
        );

    document.getElementById(
        "fixedTime"
    ).innerHTML =
        "🔧 " +
        formatDateTime(
            request.fixedTime
        );

    document.getElementById(
        "downtimeHours"
    ).innerHTML =
        "⏱ " +
        formatDowntime(
            request.downtime
        );

    modal.style.display = "flex";

});
// ===========================
// CLOSE MODAL
// ===========================

document
    .getElementById(
        "closeModalBtn"
    )
    .addEventListener(
        "click",
        () => {

            document
                .getElementById(
                    "requestModal"
                )
                .style.display =
                "none";

        }
    );
// ===========================
// CURRENT REQUEST
// ===========================

let currentTicket = null;


// ===========================
// STORE CURRENT TICKET
// ===========================

document.addEventListener("click", (e) => {

    if (
        !e.target.classList.contains(
            "view-btn"
        )
    ) return;

    currentTicket =
        e.target.dataset.ticket;

});


// ===========================
// START WORK
// ===========================

document
    .getElementById("startWorkBtn")
    .addEventListener("click", async () => {

        const request =
            requests.find(
                r =>
                    r.ticket ===
                    currentTicket
            );

        if (!request) return;

        await fetch(
            `/api/requests/${currentTicket}/status`,
            {
                method: "PUT",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    status: "In Progress"
                })
            }
        );

        await loadRequests();
        loadKPIs();


        showToast(
            "✓ Status changed to In Progress"
        );

        document
            .getElementById(
                "requestModal"
            )
            .style.display = "none";

    });
// ===========================
// AWAITING PARTS
// ===========================

document
    .getElementById("awaitingBtn")
    .addEventListener("click", async () => {

        const request =
            requests.find(
                r =>
                    r.ticket ===
                    currentTicket
            );

        if (!request) return;

        await fetch(
            `/api/requests/${currentTicket}/status`,
            {
                method: "PUT",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    status:
                        "Awaiting Parts"
                })
            }
        );

        await loadRequests();
        loadKPIs();

        showToast(
            "✓ Status changed to Awaiting Parts"
        );

        document
            .getElementById(
                "requestModal"
            )
            .style.display = "none";

    });
// ===========================
// REOPEN CALL
// ===========================

document
    .getElementById("reopenBtn")
    .addEventListener("click", async () => {

        const request =
            requests.find(
                r =>
                    r.ticket ===
                    currentTicket
            );

        if (!request) return;

        await fetch(
            `/api/requests/${currentTicket}/status`,
            {
                method: "PUT",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    status: "Open"
                })
            }
        );

        request.status =
            "Open";

        renderTable();

        showToast(
            "✓ Call Reopened"
        );

        document
            .getElementById(
                "requestModal"
            )
            .style.display = "none";

    });
// ===========================
// CLOSE CALL
// ===========================

document
    .getElementById("closeCallBtn")
    .addEventListener("click", async () => {

        const request =
            requests.find(
                r =>
                    r.ticket ===
                    currentTicket
            );

        if (!request) return;

        try {

            await fetch(
                `/api/requests/${currentTicket}/status`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        status: "Closed",

                        engineer_notes:
                            document.getElementById(
                                "engineerNotes"
                            ).value,

                        work_done:
                            document.getElementById(
                                "workDone"
                            ).value,

                        spare_parts:
                            document.getElementById(
                                "spareParts"
                            ).value

                    })
                }
            );

            request.engineerNotes =
                document.getElementById(
                    "engineerNotes"
                ).value;

            request.workDone =
                document.getElementById(
                    "workDone"
                ).value;

            request.spareParts =
                document.getElementById(
                    "spareParts"
                ).value;

            await loadRequests();
            loadKPIs();

            showToast(
                "✓ Call Closed Successfully"
            );

            document
                .getElementById(
                    "requestModal"
                )
                .style.display = "none";

        }
        catch (error) {

            console.error(error);

            showToast(
                "Failed to update call",
                "error"
            );

        }

    });
// ===========================
// TOAST
// ===========================

function showToast(message) {

    const toast =
        document.getElementById(
            "toast"
        );

    toast.textContent =
        message;

    toast.classList.add(
        "show"
    );

    setTimeout(() => {

        toast.classList.remove(
            "show"
        );

    }, 3000);

}
// ===========================
// SAVE NOTES
// ===========================

const saveNotesBtn =
    document.getElementById(
        "saveNotesBtn"
    );

if (saveNotesBtn) {

    saveNotesBtn.addEventListener(
        "click",
        () => {

        const request =
            requests.find(
                r =>
                    r.ticket ===
                    currentTicket
            );

        if (!request) return;

        request.engineerNotes =
            document.getElementById(
                "engineerNotes"
            ).value;

        request.workDone =
            document.getElementById(
                "workDone"
            ).value;

        request.spareParts =
            document.getElementById(
                "spareParts"
            ).value;

        showToast(
            "✓ Notes Saved Successfully"
        );
    }
    );
}