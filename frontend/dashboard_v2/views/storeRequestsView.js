let engineerStoreData = { catalogue: [], calls: [], requests: [] };
let engineerStoreMode = "Internal";

function renderStoreRequests() {
    pageContent.innerHTML = `<main class="central-store-page engineer-store-page">
        <section class="store-hero is-engineer"><div><span class="store-eyebrow"><i data-lucide="package-plus"></i> Engineering supplies</span><h1>Spare-part requests</h1><p>Request an item already held by Central Store, or submit a new external requirement.</p></div><button class="store-primary" onclick="openSpareRequestEditor()"><i data-lucide="plus"></i>New request</button></section>
        <section class="store-kpis"><article><span class="is-blue"><i data-lucide="send"></i></span><div><small>Submitted</small><strong id="engStoreSubmitted">—</strong></div></article><article><span class="is-violet"><i data-lucide="package-search"></i></span><div><small>In progress</small><strong id="engStoreActive">—</strong></div></article><article><span class="is-amber"><i data-lucide="badge-check"></i></span><div><small>Awaiting confirmation</small><strong id="engStoreConfirm">—</strong></div></article><article><span class="is-green"><i data-lucide="circle-check-big"></i></span><div><small>Completed</small><strong id="engStoreDone">—</strong></div></article></section>
        <section class="store-workspace"><header class="engineer-store-header"><div><span>My team’s queue</span><h2>Requests and deliveries</h2></div><button class="store-refresh" onclick="loadEngineerStore(true)" aria-label="Refresh"><i data-lucide="refresh-cw"></i></button></header><div id="engineerStoreList" class="store-panel"><div class="store-loading"><i data-lucide="loader-circle"></i>Loading requests…</div></div></section>
    </main>`;
    if (window.lucide) lucide.createIcons();
    loadEngineerStore();
}

async function loadEngineerStore(showToast = false) {
    try {
        const [catalogueResponse, callsResponse, requestsResponse] = await Promise.all([fetch("/api/central-store/catalog", { cache: "no-store" }), fetch("/api/central-store/engineer-calls", { cache: "no-store" }), fetch("/api/central-store/my-requests", { cache: "no-store" })]);
        const [catalogue, calls, requests] = await Promise.all([catalogueResponse.json(), callsResponse.json(), requestsResponse.json()]);
        if (!catalogueResponse.ok || !callsResponse.ok || !requestsResponse.ok) throw new Error(catalogue.detail || calls.detail || requests.detail || "Unable to load requests.");
        engineerStoreData = { catalogue, calls, requests };
        const active = new Set(["Awaiting Procurement", "Ready", "Dispatched"]);
        const counters = { engStoreSubmitted: requests.filter(row => row.status === "Submitted").length, engStoreActive: requests.filter(row => active.has(row.status)).length, engStoreConfirm: requests.filter(row => row.status === "Awaiting Engineer Confirmation").length, engStoreDone: requests.filter(row => row.status === "Completed").length };
        Object.entries(counters).forEach(([id, value]) => { const element = document.getElementById(id); if (element) element.textContent = value; });
        renderEngineerStoreList();
        if (showToast) BioTrackToast.success("Requests refreshed", "Your engineering supply queue is up to date.");
    } catch (error) { const list = document.getElementById("engineerStoreList"); if (list) list.innerHTML = `<div class="store-empty"><i data-lucide="wifi-off"></i><h3>Requests unavailable</h3><p>${storeEscape(error.message)}</p></div>`; BioTrackToast.error("Unable to load requests", error.message); if (window.lucide) lucide.createIcons(); }
}

function renderEngineerStoreList() {
    const list = document.getElementById("engineerStoreList"); if (!list) return;
    const rows = engineerStoreData.requests || [];
    list.innerHTML = rows.length ? `<div class="engineer-request-list">${rows.map(request => `<article><span class="engineer-request-icon"><i data-lucide="${request.request_type === "External" ? "shopping-cart" : "package"}"></i></span><div class="engineer-request-main"><small>${storeEscape(request.request_number)} · ${storeEscape(request.request_type)}</small><h3>${storeEscape(request.item_name)}</h3><p>${Number(request.quantity)} ${storeEscape(request.unit)} · ${storeEscape(request.delivery_location)}</p></div><div class="engineer-request-progress"><span class="store-status is-${storeStatusClass(request.status)}">${storeEscape(request.status)}</span>${request.status === "Dispatched" ? `<small>${request.delivery_task?.status === "Accepted" ? "Ward Boy is delivering" : "Waiting for Ward Boy"}</small>` : ""}</div>${request.status === "Awaiting Engineer Confirmation" ? `<button class="store-primary" onclick="confirmSpareReceipt(${Number(request.id)})"><i data-lucide="badge-check"></i>Confirm received</button>` : ""}</article>`).join("")}</div>` : '<div class="store-empty"><i data-lucide="package-plus"></i><h3>No spare-part requests yet</h3><p>Create an internal or external request for Central Store.</p><button class="store-primary" onclick="openSpareRequestEditor()">Create request</button></div>';
    if (window.lucide) lucide.createIcons();
}

function openSpareRequestEditor() {
    engineerStoreMode = "Internal";
    const modal = document.createElement("div"); modal.id = "spareRequestEditor"; modal.className = "store-modal-backdrop";
    modal.innerHTML = `<section class="store-modal spare-request-modal" role="dialog" aria-modal="true" aria-labelledby="requestSpareTitle"><header><div><span>Send to Central Store</span><h2 id="requestSpareTitle">Request spare parts</h2></div><button onclick="closeSpareRequestEditor()" aria-label="Close"><i data-lucide="x"></i></button></header><div class="request-mode-switch"><button class="is-active" type="button" onclick="setSpareRequestMode('Internal',this)"><i data-lucide="warehouse"></i><b>Internal stock</b><small>Choose from Central Store</small></button><button type="button" onclick="setSpareRequestMode('External',this)"><i data-lucide="shopping-cart"></i><b>External item</b><small>Describe a new requirement</small></button></div><form id="spareRequestForm" onsubmit="submitSpareRequest(event)"><div id="spareRequestFields"></div><footer><button type="button" class="is-ghost" onclick="closeSpareRequestEditor()">Cancel</button><button class="store-primary" type="submit"><i data-lucide="send"></i>Send request</button></footer></form></section>`;
    document.body.appendChild(modal); renderSpareRequestFields(); if (window.lucide) lucide.createIcons();
}

function closeSpareRequestEditor() { document.getElementById("spareRequestEditor")?.remove(); }

function setSpareRequestMode(mode, button) { engineerStoreMode = mode; document.querySelectorAll(".request-mode-switch button").forEach(item => item.classList.toggle("is-active", item === button)); renderSpareRequestFields(); }

function renderSpareRequestFields() {
    const container = document.getElementById("spareRequestFields"); if (!container) return;
    const internal = engineerStoreMode === "Internal";
    const catalogueOptions = (engineerStoreData.catalogue || []).map(item => `<option value="${Number(item.id)}">${storeEscape(item.item_name)} — ${Number(item.current_stock)} ${storeEscape(item.unit)} (${storeEscape(item.stock_state)})</option>`).join("");
    const callOptions = (engineerStoreData.calls || []).map(call => `<option value="${Number(call.id)}">${storeEscape(call.ticket)} — ${storeEscape(call.equipment)}</option>`).join("");
    container.innerHTML = `<div class="store-form-grid">${internal ? `<label class="is-wide"><span>Central Store item *</span><select name="central_store_item_id" required><option value="">Select a spare part</option>${catalogueOptions}</select></label><label><span>Request reason *</span><select name="request_reason" required><option>General</option><option>Low Stock</option><option>Out of Stock</option></select></label>` : `<label><span>Spare-part name *</span><input name="item_name" required maxlength="240"></label><label><span>Preferred item code</span><input name="item_code" maxlength="80"></label><label><span>Category</span><input name="category" maxlength="120"></label><label><span>Manufacturer</span><input name="manufacturer" maxlength="160"></label><label class="is-wide"><span>Specification *</span><textarea name="specification" required maxlength="500" placeholder="Model, dimensions, compatibility and technical details"></textarea></label><input type="hidden" name="request_reason" value="External Item">`}<label><span>Quantity *</span><input type="number" name="quantity" min="1" value="1" required></label><label><span>Unit *</span><input name="unit" value="pieces" required></label><label><span>Priority *</span><select name="priority"><option>Low</option><option selected>Medium</option><option>High</option><option>Critical</option></select></label><label><span>Delivery location</span><input name="delivery_location" placeholder="Defaults to your engineering room"></label><label class="is-wide"><span>Related maintenance call</span><select name="linked_request_id"><option value="">No linked call</option>${callOptions}</select></label><label class="is-wide"><span>Notes / purpose</span><textarea name="notes" maxlength="1000" placeholder="Why this item is required"></textarea></label></div>`;
}

async function submitSpareRequest(event) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget));
    const payload = { request_type: engineerStoreMode, central_store_item_id: values.central_store_item_id ? Number(values.central_store_item_id) : null, item_name: values.item_name || "", item_code: values.item_code || "", category: values.category || "", manufacturer: values.manufacturer || "", specification: values.specification || "", quantity: Number(values.quantity), unit: values.unit, request_reason: values.request_reason, priority: values.priority, linked_request_id: values.linked_request_id ? Number(values.linked_request_id) : null, delivery_location: values.delivery_location || "", notes: values.notes || "" };
    try { const response = await fetch("/api/central-store/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.detail || "Unable to send request."); closeSpareRequestEditor(); BioTrackToast.success("Request sent", `${data.request.request_number} is now with Central Store.`); await loadEngineerStore(); } catch (error) { BioTrackToast.error("Request not sent", error.message); }
}

async function confirmSpareReceipt(requestId) {
    if (!window.confirm("Confirm that you received these spare parts?")) return;
    try { const response = await fetch(`/api/central-store/requests/${requestId}/confirm-receipt`, { method: "PATCH" }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.detail || "Unable to confirm receipt."); BioTrackToast.success("Receipt confirmed", "The spare-part request is now complete."); await loadEngineerStore(); } catch (error) { BioTrackToast.error("Receipt not confirmed", error.message); }
}
