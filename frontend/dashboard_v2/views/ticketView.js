// ==========================================
// CURRENT TICKET
// ==========================================

let currentTicketId = null;
let sparePartsInventory = [];
let selectedSpareParts = [];
let sparePartsLocked = false;

// ==========================================
// OPEN TICKET
// ==========================================

function openTicket(ticketId) {

    currentTicketId = ticketId;

    // renderTicket() is invoked by the router and restores the selected ticket
    // from storage, so persist it for calls opened from Call Management too.
    localStorage.setItem("selectedTicket", String(ticketId));

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
                onclick="navigateToEngineerHome()"
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

                <p class="spare-parts-help">
                    Select parts from this department's inventory. Stock is deducted only when the repair is completed.
                </p>

                <div id="sparePartsPicker" class="spare-parts-picker">
                    Loading available spare parts...
                </div>

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

        window.currentTicketServiceTeam = ticket.service_team;

        await initializeSparePartsPicker(ticket.spare_parts, ticket.stock_deducted);

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

                        getSparePartsPayload()

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
                        getSparePartsPayload(),

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

                    navigateToEngineerHome();

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
// INVENTORY-BACKED SPARE PARTS
// ==========================================

async function initializeSparePartsPicker(savedParts, stockDeducted) {
    sparePartsLocked = Boolean(stockDeducted);
    selectedSpareParts = Array.isArray(savedParts)
        ? savedParts.map(part => ({
            inventory_id: Number(part.inventory_id),
            quantity: Number(part.quantity),
        }))
        : [];

    const container = document.getElementById("sparePartsPicker");
    if (!container) return;

    try {
        const response = await fetch(
            `/api/inventory/?service_team=${encodeURIComponent(window.currentTicketServiceTeam || "")}`
        );
        if (!response.ok) throw new Error("Unable to load inventory.");
        sparePartsInventory = await response.json();
        if (!selectedSpareParts.length && !sparePartsLocked) {
            selectedSpareParts = [{ inventory_id: "", quantity: 1 }];
        }
        renderSparePartsPicker();
    } catch (error) {
        container.innerHTML = `<p class="spare-parts-error">${error.message}</p>`;
    }
}

function renderSparePartsPicker() {
    const container = document.getElementById("sparePartsPicker");
    if (!container) return;

    if (sparePartsLocked) {
        container.innerHTML = `
            <p class="spare-parts-locked">Stock has already been deducted for this completed ticket.</p>
            ${selectedSpareParts.map(part => {
                const item = sparePartsInventory.find(entry => entry.id === part.inventory_id);
                return `<div class="spare-part-summary">${item?.item_name || `Item #${part.inventory_id}`} × ${part.quantity}</div>`;
            }).join("") || "<p>No spare parts were used.</p>"}
        `;
        return;
    }

    container.innerHTML = `
        <div class="spare-parts-rows">
            ${selectedSpareParts.map((part, index) => `
                <div class="spare-part-row">
                    <select onchange="setSparePart(${index}, this.value)">
                        <option value="">Select a spare part</option>
                        ${sparePartsInventory.map(item =>
                            `<option value="${item.id}" ${Number(part.inventory_id) === item.id ? "selected" : ""}>${item.item_name} — Available: ${item.current_stock} ${item.unit || ""}</option>`
                        ).join("")}
                    </select>
                    <input type="number" min="1" value="${part.quantity || 1}" aria-label="Quantity" onchange="setSpareQuantity(${index}, this.value)">
                    <button type="button" class="remove-spare-part" onclick="removeSparePart(${index})" aria-label="Remove spare part">Remove</button>
                </div>
            `).join("")}
        </div>
        ${sparePartsInventory.length ? '<button type="button" class="add-spare-part" onclick="addSparePart()">+ Add another spare part</button>' : '<p class="spare-parts-error">No inventory items are available for this department.</p>'}
    `;
}

function setSparePart(index, inventoryId) {
    const item = sparePartsInventory.find(entry => entry.id === Number(inventoryId));
    if (item && Number(item.current_stock || 0) <= 0) {
        selectedSpareParts[index].inventory_id = "";
        renderSparePartsPicker();
        showSparePartsToast(`No stock left for ${item.item_name}.`, "error");
        return;
    }
    selectedSpareParts[index].inventory_id = inventoryId ? Number(inventoryId) : "";
}

function setSpareQuantity(index, quantity) {
    const selectedItem = sparePartsInventory.find(
        item => item.id === Number(selectedSpareParts[index].inventory_id)
    );
    const requested = Math.max(1, Number(quantity) || 1);
    if (selectedItem && requested > Number(selectedItem.current_stock || 0)) {
        selectedSpareParts[index].quantity = Math.max(1, Number(selectedItem.current_stock || 0));
        renderSparePartsPicker();
        showSparePartsToast(
            `Only ${selectedItem.current_stock} ${selectedItem.unit || "item(s)"} of ${selectedItem.item_name} are available.`,
            "error"
        );
        return;
    }
    selectedSpareParts[index].quantity = requested;
}

function addSparePart() {
    selectedSpareParts.push({ inventory_id: "", quantity: 1 });
    renderSparePartsPicker();
}

function removeSparePart(index) {
    selectedSpareParts.splice(index, 1);
    if (!selectedSpareParts.length) selectedSpareParts.push({ inventory_id: "", quantity: 1 });
    renderSparePartsPicker();
}

function getSparePartsPayload() {
    // A ticket may be completed without consuming any spare parts. Blank rows
    // are therefore ignored, while each selected part must still be valid.
    const partsToUse = selectedSpareParts.filter(part => part.inventory_id);
    const requestedByItem = new Map();
    partsToUse.forEach(part => {
        const quantity = Math.max(1, Number(part.quantity));
        requestedByItem.set(
            Number(part.inventory_id),
            (requestedByItem.get(Number(part.inventory_id)) || 0) + quantity
        );
    });
    for (const [inventoryId, quantity] of requestedByItem) {
        const item = sparePartsInventory.find(entry => entry.id === inventoryId);
        if (!item || Number(item.current_stock || 0) <= 0) {
            const itemName = item?.item_name || `Item #${inventoryId}`;
            showSparePartsToast(`No stock left for ${itemName}.`, "error");
            throw new Error(`No stock left for ${itemName}.`);
        }
        if (quantity > Number(item.current_stock || 0)) {
            showSparePartsToast(
                `Only ${item.current_stock} ${item.unit || "item(s)"} of ${item.item_name} are available.`,
                "error"
            );
            throw new Error(`Insufficient stock for ${item.item_name}.`);
        }
    }
    return partsToUse.map(part => ({
        inventory_id: Number(part.inventory_id),
        quantity: Math.max(1, Number(part.quantity)),
    }));
}

function showSparePartsToast(message, type = "error") {
    let toast = document.getElementById("sparePartsToast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "sparePartsToast";
        document.body.appendChild(toast);
    }
    toast.className = `spare-parts-toast ${type}`;
    toast.textContent = message;
    requestAnimationFrame(() => toast.classList.add("show"));
    clearTimeout(window.sparePartsToastTimer);
    window.sparePartsToastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3500);
}

// ==========================================
// GLOBAL FUNCTIONS
// ==========================================

window.startWork = startWork;
window.completeWork = completeWork;
window.saveTicketChanges = saveTicketChanges;
window.openTicket = openTicket;
window.setSparePart = setSparePart;
window.setSpareQuantity = setSpareQuantity;
window.addSparePart = addSparePart;
window.removeSparePart = removeSparePart;
