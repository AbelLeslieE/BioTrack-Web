// ==========================================
// CURRENT REQUEST
// ==========================================

let currentRequestTicket = null;


// ==========================================
// INITIALIZE PAGE
// ==========================================

async function initializeRequestDetails() {

    currentRequestTicket =
        localStorage.getItem("selectedRequest");

    if (!currentRequestTicket) {

        navigate("myRequests");

        return;

    }

    await loadRequestDetails();

}


// ==========================================
// LOAD REQUEST DETAILS
// ==========================================

async function loadRequestDetails() {

    try {

        const response = await fetch(

            `/api/users/request/${currentRequestTicket}`

        );

        if (!response.ok) {

            throw new Error("Unable to load request.");

        }

        const request = await response.json();

        populateRequestDetails(request);

    }

    catch (error) {

        console.error(error);

        showSuccess({

            title: "Unable to Load Request",

            message: error.message

        });

    }

}


// ==========================================
// POPULATE PAGE
// ==========================================

function populateRequestDetails(request) {

    document.getElementById("requestTicketNumber").textContent =
        `Ticket #${request.ticket}`;

    const badge =
        document.getElementById("requestStatusBadge");

    badge.textContent =
        request.status;

    badge.className =
        `status-badge ${request.status.toLowerCase().replaceAll(" ","-")}`;

    document.getElementById("equipmentName").textContent =
        request.equipment;

    document.getElementById("equipmentId").textContent =
        request.equipment_id;

    document.getElementById("departmentName").textContent =
        request.department;

    document.getElementById("priorityLevel").textContent =
        request.priority;

    document.getElementById("reportedDate").textContent =
        formatDateTime(request.received);

    document.getElementById("engineerNotes").textContent =
        request.notes || "No engineer notes available.";

    document.getElementById("workPerformed").textContent =
        request.work_done || "No work has been recorded.";

    document.getElementById("resolutionText").textContent =

        request.status === "Completed"

        ? "Maintenance completed successfully."

        : "Maintenance is still in progress.";

    buildTimeline(request);

    buildSpareParts(request);

}


// ==========================================
// BUILD TIMELINE
// ==========================================

function buildTimeline(request) {

    const timeline =
        document.getElementById("timelineContainer");

    let html = "";

    html += `
        <div class="timeline-item">

            <div class="timeline-dot"></div>

            <div>

                <strong>Request Submitted</strong>

                <p>${formatDateTime(request.received)}</p>

            </div>

        </div>
    `;

    if (request.started) {

        html += `
            <div class="timeline-item">

                <div class="timeline-dot active"></div>

                <div>

                    <strong>Engineer Started Work</strong>

                    <p>${formatDateTime(request.started)}</p>

                </div>

            </div>
        `;

    }

    if (request.completed) {

        html += `
            <div class="timeline-item">

                <div class="timeline-dot success"></div>

                <div>

                    <strong>Maintenance Completed</strong>

                    <p>${formatDateTime(request.completed)}</p>

                </div>

            </div>
        `;

    }

    timeline.innerHTML = html;

}


// ==========================================
// BUILD SPARE PARTS
// ==========================================

function buildSpareParts(request) {

    const tbody =
        document.getElementById("sparePartsBody");

    tbody.innerHTML = "";

    if (!request.spare_parts) {

        tbody.innerHTML = `

            <tr>

                <td colspan="2">

                    No spare parts used.

                </td>

            </tr>

        `;

        return;

    }

    request.spare_parts
        .split(",")

        .forEach(part => {

            tbody.innerHTML += `

                <tr>

                    <td>${part.trim()}</td>

                    <td>1</td>

                </tr>

            `;

        });

}


// ==========================================
// GLOBAL
// ==========================================

window.initializeRequestDetails =
    initializeRequestDetails;