// ==========================================
// CURRENT TICKET
// ==========================================

let currentTicketId = null;

// ==========================================
// OPEN TICKET
// ==========================================

function openTicket(ticketId) {

    currentTicketId = ticketId;

    navigate("ticket");

}

async function renderTicket() {

    // ==========================================
    // LOAD SELECTED TICKET
    // ==========================================

    currentTicketId = localStorage.getItem("selectedTicket");

    if (!currentTicketId) {

        pageContent.innerHTML = `

            <div class="ticket-page">

                <h2>No ticket selected.</h2>

            </div>

        `;

        return;

    }

    pageContent.innerHTML = `

    <div class="ticket-page">

        <div class="ticket-header">

            <button
                class="back-btn"
                onclick="navigate('engineerDashboard')"
            >
                ← Back
            </button>

            <div class="ticket-title">

                <h1>Maintenance Ticket</h1>

                <p>
                    Biomedical Maintenance Request Details
                </p>

            </div>

        </div>

        <div id="ticketContainer">

            Loading Ticket...

        </div>

    </div>

    `;

    await loadTicket();

}

// ==========================================
// LOAD TICKET
// ==========================================

async function loadTicket() {

    const container = document.getElementById("ticketContainer");

    try {

        const res = await fetch(
            `/api/engineer/ticket/${currentTicketId}`
        );

        const ticket = await res.json();

        container.innerHTML = `

        <div class="ticket-grid">

            <!-- =========================== -->
            <!-- EQUIPMENT -->
            <!-- =========================== -->

            <div class="ticket-card">

                <h2>Equipment Information</h2>

                <div class="info-grid">

                    <div class="info-item">
                        <label>Equipment</label>
                        <strong>${ticket.equipment}</strong>
                    </div>

                    <div class="info-item">
                        <label>Equipment ID</label>
                        <strong>${ticket.equipment_id}</strong>
                    </div>

                    <div class="info-item">
                        <label>Department</label>
                        <strong>${ticket.department}</strong>
                    </div>

                    <div class="info-item">
                        <label>Location</label>
                        <strong>${ticket.location}</strong>
                    </div>

                </div>

            </div>

            <!-- =========================== -->
            <!-- CALL -->
            <!-- =========================== -->

            <div class="ticket-card">

                <h2>Call Information</h2>

                <div class="info-grid">

                    <div class="info-item">
                        <label>Ticket</label>
                        <strong>${ticket.ticket}</strong>
                    </div>

                    <div class="info-item">
                        <label>Reported By</label>
                        <strong>${ticket.reported_by}</strong>
                    </div>

                    <div class="info-item">
                        <label>Received</label>
                        <strong>${ticket.received}</strong>
                    </div>

                    <div class="info-item">
                        <label>Priority</label>
                        <strong>${ticket.priority}</strong>
                    </div>

                </div>

            </div>

            <!-- =========================== -->
            <!-- STATUS -->
            <!-- =========================== -->

            <div class="ticket-card full">

                <h2>Maintenance Progress</h2>

                <div class="ticket-form-grid">

                    <div class="form-group">

                        <label>Status</label>

                        <select
                            id="ticketStatus"
                            class="ticket-input"
                        >

                            <option>Open</option>

                            <option>Assigned</option>

                            <option>In Progress</option>

                            <option>Awaiting Parts</option>

                            <option>External Service</option>

                            <option>Calibration</option>

                            <option>Completed</option>

                            <option>Closed</option>

                        </select>

                    </div>

                </div>

            </div>

            <!-- =========================== -->

            <div class="ticket-card full">

                <h2>Failure Description</h2>

                <div class="ticket-text">

                    ${ticket.description || "-"}

                </div>

            </div>

            <!-- =========================== -->

            <div class="ticket-card full">

                <h2>Engineer Notes</h2>

                <textarea
                    id="engineerNotes"
                    class="ticket-textarea"
                >${ticket.notes || ""}</textarea>

            </div>

            <!-- =========================== -->

            <div class="ticket-card full">

                <h2>Work Performed</h2>

                <textarea
                    id="workDone"
                    class="ticket-textarea"
                >${ticket.work_done || ""}</textarea>

            </div>

            <!-- =========================== -->

            <div class="ticket-card full">

                <h2>Spare Parts Used</h2>

                <textarea
                    id="spareParts"
                    class="ticket-textarea"
                >${ticket.spare_parts || ""}</textarea>

            </div>

            <!-- =========================== -->

            <div class="ticket-actions">

                <button
                    class="ticket-btn secondary"
                    onclick="startWork()"
                >
                    ▶ Start Work
                </button>

                <button
                    class="ticket-btn success"
                    onclick="completeWork()"
                >
                    ✔ Complete Repair
                </button>

                <button
                    class="ticket-btn primary"
                    onclick="saveTicketChanges()"
                >
                    💾 Save Progress
                </button>

            </div>

        </div>

        `;

        document.getElementById("ticketStatus").value =
            ticket.status;

    }

    catch (err) {

        console.error(err);

        container.innerHTML = "Unable to load ticket.";

    }

}
// ==========================================
// SAVE TICKET
// ==========================================

async function saveTicketChanges(){

    try{

        const response = await fetch(

            `/api/engineer/ticket/${currentTicketId}`,

            {

                method:"PUT",

                headers:{

                    "Content-Type":"application/json"

                },

                body:JSON.stringify({

                    status:

                        document.getElementById("ticketStatus").value,

                    engineer_notes:

                        document.getElementById("engineerNotes").value,

                    work_done:

                        document.getElementById("workDone").value,

                    spare_parts:

                        document.getElementById("spareParts").value

                })

            }

        );

        const data = await response.json();

        if(data.success){

            showSuccess({

                title:"Changes Saved Successfully",

                message:"The maintenance ticket has been updated."

            });

        }

        else{

            alert(data.message);

        }

    }

    catch(error){

        console.error(error);

        alert("Unable to update ticket.");

    }

}

// ==========================================
// UPDATE TICKET
// ==========================================

async function updateTicket(start = false, complete = false) {

    const buttons = document.querySelectorAll(".ticket-btn");

    buttons.forEach(btn => btn.disabled = true);

    try {

        const response = await fetch(

            `/api/engineer/ticket/${currentTicketId}`,

            {

                method: "PUT",

                headers: {

                    "Content-Type": "application/json"

                },

                body: JSON.stringify({

                    status:
                        document.getElementById("ticketStatus").value,

                    engineer_notes:
                        document.getElementById("engineerNotes").value,

                    work_done:
                        document.getElementById("workDone").value,

                    spare_parts:
                        document.getElementById("spareParts").value,

                    start_work: start,

                    complete_work: complete

                })

            }

        );

        const data = await response.json();

        if (!response.ok) {

            throw new Error(data.detail || "Unable to update ticket.");

        }

        if (start) {

            document.getElementById("ticketStatus").value = "In Progress";

            showSuccess({

                title: "Maintenance Started",

                message: "The maintenance work has started."

            });

            return;

        }

        if (complete) {

            showSuccess({

                title: "Maintenance Completed",

                message: "The department has been notified.",

                buttonText: "Return Dashboard",

                onClose() {

                    navigate("engineerDashboard");

                }

            });

            return;

        }

        showSuccess({

            title: "Changes Saved",

            message: "Ticket updated successfully."

        });

    }

    catch (error) {

        console.error(error);

        showSuccess({

            title: "Operation Failed",

            message: error.message || "Unable to update the maintenance ticket."

        });

    }

    finally {

        buttons.forEach(btn => btn.disabled = false);

    }

}
// ==========================================
// START WORK
// ==========================================

function startWork(){

    updateTicket(true, false);

}

// ==========================================
// COMPLETE REPAIR
// ==========================================

function completeWork(){

    updateTicket(false, true);

}

// ==========================================
// GLOBAL FUNCTIONS
// ==========================================

window.startWork = startWork;
window.completeWork = completeWork;
window.saveTicketChanges = saveTicketChanges;
window.openTicket = openTicket;