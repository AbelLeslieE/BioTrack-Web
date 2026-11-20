// ==========================================
// CURRENT TICKET
// ==========================================

let currentTicketId = null;
let sparePartsInventory = [];
let selectedSpareParts = [];
let sparePartsLocked = false;
let sparePartsReserved = false;
let ticketTechnicians = [];

function renderWardBoyTransport(ticket) {
    const tasks = Array.isArray(ticket.ward_boy_tasks) ? ticket.ward_boy_tasks : [];
    const pickup = tasks.find(task => task.movement_type === "Pickup");
    const returnTask = tasks.find(task => task.movement_type === "Return");
    const repairCompleted = ["Completed", "Closed"].includes(ticket.status);
    const taskRows = tasks.map(task => `
        <article class="ticket-transport-job">
            <span class="ticket-transport-job-icon"><i data-lucide="${task.movement_type === "Return" ? "undo-2" : "package-open"}"></i></span>
            <div>
                <strong>${escapeHTML(task.movement_type)} transport</strong>
                <p>${escapeHTML(task.source_location)} <i data-lucide="arrow-right"></i> ${escapeHTML(task.destination_location)}</p>
                ${task.assigned_to ? `<small>Assigned to ${escapeHTML(task.assigned_to)}</small>` : ""}
            </div>
            <span class="ticket-transport-status is-${String(task.status || "pending").toLowerCase()}">${escapeHTML(task.status)}</span>
        </article>`).join("");

    return `
        <div class="ticket-card full ticket-transport-card">
            <div class="ticket-transport-heading">
                <span><i data-lucide="truck"></i></span>
                <div><h2>Ward Boy Transport</h2><p>Arrange equipment movement between the ward and the ${escapeHTML(ticket.service_team)} team.</p></div>
            </div>
            <div class="ticket-transport-list">${taskRows || '<p class="ticket-transport-empty">No Ward Boy transport has been requested for this call.</p>'}</div>
            <div class="ticket-transport-actions">
                ${!pickup ? `<button type="button" class="ticket-transport-button is-pickup" onclick="requestWardBoyTransport('Pickup')"><i data-lucide="package-plus"></i> Request equipment pickup</button>` : ""}
                ${repairCompleted && !returnTask ? `<button type="button" class="ticket-transport-button is-return" onclick="requestWardBoyTransport('Return')"><i data-lucide="truck"></i> Request return to ward</button>` : ""}
                ${!repairCompleted && !returnTask ? `<label class="ticket-return-choice"><input type="checkbox" id="wardBoyReturnAfterRepair"><span><i data-lucide="square-check-big"></i></span><div><strong>Return with a Ward Boy after repair</strong><small>Create the return job automatically when this call is completed.</small></div></label>` : ""}
            </div>
        </div>`;
}

async function createWardBoyTransport(movementType) {
    const response = await fetch("/api/ward-boy/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: Number(currentTicketId), movement_type: movementType }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || "Unable to create the transport job.");
    return data.task;
}

async function requestWardBoyTransport(movementType) {
    try {
        await createWardBoyTransport(movementType);
        BioTrackToast.success(
            movementType === "Return" ? "Return transport requested" : "Pickup requested",
            "The job is now visible in the Ward Boy portal."
        );
        await loadTicket();
    } catch (error) {
        BioTrackToast.error("Transport not requested", error.message || "Unable to create the Ward Boy job.");
    }
}

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
                        <strong>${escapeHTML(ticket.equipment)}</strong>
                    </div>

                    <div class="info-item">
                        <label>Equipment ID</label>
                        <strong>${escapeHTML(ticket.equipment_id)}</strong>
                    </div>

                    <div class="info-item">
                        <label>Department</label>
                        <strong>${escapeHTML(ticket.department)}</strong>
                    </div>

                    <div class="info-item">
                        <label>Location</label>
                        <strong>${escapeHTML(ticket.location)}</strong>
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
                        <strong>${escapeHTML(ticket.ticket)}</strong>
                    </div>

                    <div class="info-item">
                        <label>Reported By</label>
                        <strong>${escapeHTML(ticket.reported_by)}</strong>
                    </div>

                    <div class="info-item">
                        <label>Received</label>
                        <strong>${escapeHTML(ticket.received)}</strong>
                    </div>

                    <div class="info-item">
                        <label>Priority</label>
                        <strong>${escapeHTML(ticket.priority)}</strong>
                    </div>

                    <div class="info-item ticket-downtime-item">
                        <label>Downtime</label>
                        <div class="ticket-downtime-value">
                            ${isMaintenanceAdmin() ? `
                                <button
                                    type="button"
                                    class="ticket-downtime-trigger"
                                    data-ticket="${escapeHTML(ticket.ticket)}"
                                    data-hours="${Number(ticket.downtime || 0)}"
                                    onclick="handleDowntimeSecretClick(this.dataset.ticket, Number(this.dataset.hours))"
                                    aria-label="Downtime ${formatDowntime(ticket.downtime)}"
                                >
                                    ${formatDowntime(ticket.downtime)}
                                </button>
                            ` : `<strong>${formatDowntime(ticket.downtime)}</strong>`}
                        </div>
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

                <div class="ticket-assignment-panel">
                    <div><span><i data-lucide="user-round-cog"></i></span><div><strong>Assigned technician</strong><small>Assignment moves a new call into the Assigned board column.</small></div></div>
                    <select id="ticketTechnician"><option value="">Loading technicians…</option></select>
                    <button type="button" onclick="saveTicketAssignment()"><i data-lucide="user-check"></i> Assign</button>
                </div>

            </div>

            <!-- =========================== -->

            ${renderWardBoyTransport(ticket)}

            <!-- =========================== -->

            <div class="ticket-card full">

                <h2>Failure Description</h2>

                <div class="ticket-text">

                    ${escapeHTML(ticket.description || "-")}

                </div>

            </div>

            <!-- =========================== -->

            <div class="ticket-card full">

                <h2>Engineer Notes</h2>

                <textarea
                    id="engineerNotes"
                    class="ticket-textarea"
                >${escapeHTML(ticket.notes || "")}</textarea>

            </div>

            <!-- =========================== -->

            <div class="ticket-card full">

                <h2>Work Performed</h2>

                <textarea
                    id="workDone"
                    class="ticket-textarea"
                >${escapeHTML(ticket.work_done || "")}</textarea>

            </div>

            <!-- =========================== -->

            <div class="ticket-card full">

                <h2>Spare Parts Used</h2>

                <p class="spare-parts-help">
                    Selected parts are reserved when progress is saved. Completion converts the reservation into inventory consumption.
                </p>

                <div class="ticket-parts-cost"><span><i data-lucide="receipt-indian-rupee"></i> Repair parts cost</span><strong id="ticketPartsCost">${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(ticket.parts_cost || 0)}</strong><small id="ticketReservationState">${ticket.parts_reserved ? "Parts reserved for this repair" : ticket.stock_deducted ? "Inventory deducted" : "No parts reserved"}</small></div>

                <div id="sparePartsPicker" class="spare-parts-picker">
                    Loading available spare parts...
                </div>

            </div>

            <div class="ticket-card full ticket-attachments-card">
                <div class="ticket-attachments-heading"><div><h2>Attachments & evidence</h2><p>Manuals, invoices, certificates, service reports, photos and calibration documents.</p></div><span><i data-lucide="minimize-2"></i> Auto-compressed below 900 KB</span></div>
                <form id="ticketAttachmentForm" class="ticket-attachment-form">
                    <select id="ticketDocumentType" aria-label="Document type"><option>Service Report</option><option>Photo</option><option>Manual</option><option>Invoice</option><option>Certificate</option><option>Calibration Document</option></select>
                    <label><i data-lucide="paperclip"></i><span id="ticketAttachmentFileName">Choose PDF or image</span><input id="ticketAttachmentFile" type="file" accept="application/pdf,image/jpeg,image/png" required></label>
                    <button type="submit"><i data-lucide="cloud-upload"></i> Optimize & upload</button>
                </form>
                <p id="ticketAttachmentProgress" class="ticket-attachment-progress" role="status"></p>
                <div id="ticketAttachmentList" class="ticket-attachment-list"><p>Loading attachments…</p></div>
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

        await Promise.all([
            initializeSparePartsPicker(ticket.spare_parts, ticket.stock_deducted, ticket.parts_reserved),
            initializeTicketAssignment(ticket),
            loadTicketAttachments(),
        ]);

        document.getElementById("ticketAttachmentForm")?.addEventListener("submit", uploadTicketAttachment);
        document.getElementById("ticketAttachmentFile")?.addEventListener("change", event => {
            document.getElementById("ticketAttachmentFileName").textContent = event.target.files?.[0]?.name || "Choose PDF or image";
        });

        if (window.lucide) lucide.createIcons();

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

            await loadTicket();

            showSuccess({

                title:"Changes Saved Successfully",

                message:"The maintenance ticket has been updated."

            });

        }

        else{

            BioTrackToast.error("Ticket not updated", data.message || "Unable to update the ticket.");

        }

    }

    catch(error){

        console.error(error);

        BioTrackToast.error("Ticket not updated", error.message || "Unable to update the ticket.");

    }

}

// ==========================================
// UPDATE TICKET
// ==========================================

async function updateTicket(start = false, complete = false) {

    const buttons = document.querySelectorAll(".ticket-btn");
    const shouldRequestReturn = complete && Boolean(document.getElementById("wardBoyReturnAfterRepair")?.checked);
    let returnTransportCreated = false;

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

            if (shouldRequestReturn) {
                try {
                    await createWardBoyTransport("Return");
                    returnTransportCreated = true;
                } catch (transportError) {
                    BioTrackToast.warning(
                        "Repair completed, transport not created",
                        transportError.message || "Request the Ward Boy return job from this ticket."
                    );
                }
            }

            showSuccess({

                title: "Maintenance Completed",

                message: returnTransportCreated
                    ? "The department was notified and the Ward Boy return job is now available."
                    : "The department has been notified.",

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

async function initializeSparePartsPicker(savedParts, stockDeducted, partsReserved = false) {
    sparePartsLocked = Boolean(stockDeducted);
    sparePartsReserved = Boolean(partsReserved);
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
        if (sparePartsReserved && !sparePartsLocked) {
            selectedSpareParts.forEach(part => {
                const item = sparePartsInventory.find(entry => Number(entry.id) === Number(part.inventory_id));
                if (item) item.available_stock = Number(item.available_stock || 0) + Number(part.quantity || 0);
            });
        }
        if (!selectedSpareParts.length && !sparePartsLocked) {
            selectedSpareParts = [{ inventory_id: "", quantity: 1 }];
        }
        renderSparePartsPicker();
        updateTicketPartsCost();
    } catch (error) {
        container.innerHTML = `<p class="spare-parts-error">${escapeHTML(error.message)}</p>`;
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
                return `<div class="spare-part-summary">${escapeHTML(item?.item_name || `Item #${part.inventory_id}`)} × ${escapeHTML(part.quantity)}</div>`;
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
                            `<option value="${Number(item.id)}" ${Number(part.inventory_id) === item.id ? "selected" : ""}>${escapeHTML(item.item_name)} — Available: ${escapeHTML(item.available_stock ?? item.current_stock)} ${escapeHTML(item.unit || "")} · ${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(item.purchase_price || 0)}</option>`
                        ).join("")}
                    </select>
                    <input type="number" min="1" value="${Math.max(1, Number(part.quantity) || 1)}" aria-label="Quantity" onchange="setSpareQuantity(${index}, this.value)">
                    <button type="button" class="remove-spare-part" onclick="removeSparePart(${index})" aria-label="Remove spare part">Remove</button>
                </div>
            `).join("")}
        </div>
        ${sparePartsInventory.length ? '<button type="button" class="add-spare-part" onclick="addSparePart()">+ Add another spare part</button>' : '<p class="spare-parts-error">No inventory items are available for this department.</p>'}
    `;
}

function setSparePart(index, inventoryId) {
    const item = sparePartsInventory.find(entry => entry.id === Number(inventoryId));
    if (item && Number(item.available_stock ?? item.current_stock ?? 0) <= 0) {
        selectedSpareParts[index].inventory_id = "";
        renderSparePartsPicker();
        showSparePartsToast(`No stock left for ${item.item_name}.`, "error");
        return;
    }
    sparePartsReserved = false;
    selectedSpareParts[index].inventory_id = inventoryId ? Number(inventoryId) : "";
    updateTicketPartsCost();
}

function setSpareQuantity(index, quantity) {
    sparePartsReserved = false;
    const selectedItem = sparePartsInventory.find(
        item => item.id === Number(selectedSpareParts[index].inventory_id)
    );
    const requested = Math.max(1, Number(quantity) || 1);
    if (selectedItem && requested > Number(selectedItem.available_stock ?? selectedItem.current_stock ?? 0)) {
        selectedSpareParts[index].quantity = Math.max(1, Number(selectedItem.available_stock ?? selectedItem.current_stock ?? 0));
        renderSparePartsPicker();
        showSparePartsToast(
            `Only ${selectedItem.available_stock ?? selectedItem.current_stock} ${selectedItem.unit || "item(s)"} of ${selectedItem.item_name} are available.`,
            "error"
        );
        return;
    }
    selectedSpareParts[index].quantity = requested;
    updateTicketPartsCost();
}

function addSparePart() {
    sparePartsReserved = false;
    selectedSpareParts.push({ inventory_id: "", quantity: 1 });
    renderSparePartsPicker();
}

function removeSparePart(index) {
    sparePartsReserved = false;
    selectedSpareParts.splice(index, 1);
    if (!selectedSpareParts.length) selectedSpareParts.push({ inventory_id: "", quantity: 1 });
    renderSparePartsPicker();
    updateTicketPartsCost();
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
        const available = Number(item?.available_stock ?? item?.current_stock ?? 0);
        if (!item || available <= 0) {
            const itemName = item?.item_name || `Item #${inventoryId}`;
            showSparePartsToast(`No stock left for ${itemName}.`, "error");
            throw new Error(`No stock left for ${itemName}.`);
        }
        if (quantity > available) {
            showSparePartsToast(
                `Only ${available} ${item.unit || "item(s)"} of ${item.item_name} are available.`,
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
    const title = type === "error" ? "Stock unavailable" : "Spare parts updated";
    BioTrackToast.show({ title, message, type });
}

function updateTicketPartsCost() {
    const total = selectedSpareParts.reduce((sum, part) => {
        const item = sparePartsInventory.find(entry => Number(entry.id) === Number(part.inventory_id));
        return sum + (Number(item?.purchase_price || 0) * Number(part.quantity || 0));
    }, 0);
    const target = document.getElementById("ticketPartsCost");
    if (target) target.textContent = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(total);
    const state = document.getElementById("ticketReservationState");
    if (state) {
        state.textContent = sparePartsLocked
            ? "Inventory deducted"
            : sparePartsReserved
                ? "Parts reserved for this repair"
                : total > 0
                    ? "Save progress to reserve these parts"
                    : "No parts reserved";
    }
}

async function initializeTicketAssignment(ticket) {
    const select = document.getElementById("ticketTechnician");
    if (!select) return;
    try {
        const response = await fetch(`/api/engineer/technicians?service_team=${encodeURIComponent(ticket.service_team || "")}`);
        if (!response.ok) throw new Error("Unable to load technicians.");
        ticketTechnicians = await response.json();
        select.innerHTML = '<option value="">Unassigned</option>' + ticketTechnicians.map(technician => `<option value="${escapeHTML(technician.username)}" ${technician.username === ticket.assigned_to_username ? "selected" : ""}>${escapeHTML(technician.name)}</option>`).join("");
    } catch (error) {
        select.innerHTML = '<option value="">Technicians unavailable</option>';
    }
}

async function saveTicketAssignment() {
    const select = document.getElementById("ticketTechnician");
    if (!select) return;
    try {
        const response = await fetch(`/api/engineer/ticket/${currentTicketId}/assignment`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: select.value || null }) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.detail || "Unable to update assignment.");
        document.getElementById("ticketStatus").value = result.status;
        BioTrackToast.success("Technician assignment updated", result.assigned_to_name ? `${result.assigned_to_name} owns this repair.` : "This repair is unassigned.");
    } catch (error) { BioTrackToast.error("Assignment not changed", error.message); }
}

function ticketFileSize(bytes) {
    const value = Number(bytes || 0);
    return value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`;
}

async function loadTicketAttachments() {
    const container = document.getElementById("ticketAttachmentList");
    if (!container) return;
    try {
        const response = await fetch(`/api/engineer/ticket/${currentTicketId}/attachments`);
        const items = await response.json().catch(() => []);
        if (!response.ok) throw new Error(items.detail || "Unable to load attachments.");
        container.innerHTML = items.length ? items.map(item => `
            <article class="ticket-attachment-item">
                <span><i data-lucide="${item.content_type === "application/pdf" ? "file-text" : "image"}"></i></span>
                <div><strong>${escapeHTML(item.original_name)}</strong><small>${escapeHTML(item.document_type)} · ${ticketFileSize(item.stored_size_bytes)}${item.original_size_bytes > item.stored_size_bytes ? ` · compressed from ${ticketFileSize(item.original_size_bytes)}` : ""}</small></div>
                <a href="${item.download_url}" download><i data-lucide="download"></i><span>Download</span></a>
                <button type="button" onclick="deleteTicketAttachment(${Number(item.id)})" aria-label="Delete ${escapeHTML(item.original_name)}"><i data-lucide="trash-2"></i></button>
            </article>`).join("") : '<p class="ticket-attachments-empty">No evidence attached to this maintenance call yet.</p>';
        window.lucide?.createIcons();
    } catch (error) { container.innerHTML = `<p class="spare-parts-error">${escapeHTML(error.message)}</p>`; }
}

async function compressTicketImage(file, targetBytes = 850 * 1024) {
    const bitmap = await createImageBitmap(file);
    let width = bitmap.width;
    let height = bitmap.height;
    const maxDimension = 2200;
    if (Math.max(width, height) > maxDimension) {
        const scale = maxDimension / Math.max(width, height);
        width = Math.round(width * scale); height = Math.round(height * scale);
    }
    let blob = file;
    for (let round = 0; round < 4; round += 1) {
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d", { alpha: false }).drawImage(bitmap, 0, 0, width, height);
        for (const quality of [.82, .68, .54, .4]) {
            blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
            if (blob.size <= targetBytes) return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
        }
        width = Math.max(1, Math.round(width * .8)); height = Math.max(1, Math.round(height * .8));
    }
    return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
}

async function uploadTicketAttachment(event) {
    event.preventDefault();
    const input = document.getElementById("ticketAttachmentFile");
    const progress = document.getElementById("ticketAttachmentProgress");
    const button = event.currentTarget.querySelector("button[type=submit]");
    let file = input.files?.[0];
    if (!file) return;
    button.disabled = true;
    progress.textContent = file.type.startsWith("image/") ? "Compressing image to the KB target…" : "Uploading PDF for automatic KB compression…";
    try {
        const originalSize = file.size;
        if (file.type.startsWith("image/")) file = await compressTicketImage(file);
        const formData = new FormData();
        formData.append("document_type", document.getElementById("ticketDocumentType").value);
        formData.append("file", file);
        const response = await fetch(`/api/engineer/ticket/${currentTicketId}/attachments`, { method: "POST", body: formData });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.detail || "Unable to upload this attachment.");
        progress.textContent = `Stored at ${ticketFileSize(result.attachment.stored_size_bytes)}${originalSize > result.attachment.stored_size_bytes ? ` (from ${ticketFileSize(originalSize)})` : ""}.`;
        event.currentTarget.reset();
        document.getElementById("ticketAttachmentFileName").textContent = "Choose PDF or image";
        await loadTicketAttachments();
    } catch (error) { progress.textContent = error.message || "Upload failed."; BioTrackToast.error("Attachment not uploaded", progress.textContent); }
    finally { button.disabled = false; }
}

async function deleteTicketAttachment(id) {
    try {
        const response = await fetch(`/api/engineer/ticket/attachments/${id}`, { method: "DELETE" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.detail || "Unable to delete the attachment.");
        await loadTicketAttachments();
    } catch (error) { BioTrackToast.error("Attachment not deleted", error.message); }
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
window.saveTicketAssignment = saveTicketAssignment;
window.deleteTicketAttachment = deleteTicketAttachment;
