let centralStoreData = { summary: {}, requests: [], low_stock: [], out_of_stock: [], catalogue: [] };
let centralStoreTab = "requests";

function storeEscape(value) {
    const node = document.createElement("div");
    node.textContent = String(value ?? "");
    return node.innerHTML;
}

function renderCentralStore() {
    pageContent.innerHTML = `
        <main class="central-store-page">
            <section class="store-hero">
                <div><span class="store-eyebrow"><i data-lucide="warehouse"></i> Hospital-wide supply hub</span><h1>Central Store</h1><p>Review engineering requests, prepare stock and coordinate delivery from one queue.</p></div>
                <button type="button" class="store-primary" onclick="openCatalogueEditor()"><i data-lucide="package-plus"></i>Add catalogue item</button>
            </section>
            <section class="store-kpis" aria-label="Central Store summary">
                <article><span class="is-blue"><i data-lucide="inbox"></i></span><div><small>New requests</small><strong id="storeKpiNew">—</strong></div></article>
                <article><span class="is-violet"><i data-lucide="activity"></i></span><div><small>Active requests</small><strong id="storeKpiActive">—</strong></div></article>
                <article><span class="is-amber"><i data-lucide="triangle-alert"></i></span><div><small>Low stock</small><strong id="storeKpiLow">—</strong></div></article>
                <article><span class="is-red"><i data-lucide="package-x"></i></span><div><small>Out of stock</small><strong id="storeKpiOut">—</strong></div></article>
            </section>
            <section class="store-workspace">
                <header class="store-tabs">
                    <button class="is-active" data-store-tab="requests" onclick="setCentralStoreTab('requests',this)"><i data-lucide="clipboard-list"></i>Engineer requests <b id="storeRequestCount">0</b></button>
                    <button data-store-tab="low" onclick="setCentralStoreTab('low',this)"><i data-lucide="chart-no-axes-column-decreasing"></i>Low stock</button>
                    <button data-store-tab="out" onclick="setCentralStoreTab('out',this)"><i data-lucide="package-x"></i>Out of stock</button>
                    <button data-store-tab="catalogue" onclick="setCentralStoreTab('catalogue',this)"><i data-lucide="library-big"></i>Master catalogue</button>
                    <button class="store-refresh" type="button" onclick="loadCentralStore(true)" aria-label="Refresh"><i data-lucide="refresh-cw"></i></button>
                </header>
                <div id="centralStorePanel" class="store-panel"><div class="store-loading"><i data-lucide="loader-circle"></i>Loading Central Store…</div></div>
            </section>
        </main>`;
    if (window.lucide) lucide.createIcons();
    loadCentralStore();
}

async function loadCentralStore(showToast = false) {
    try {
        const response = await fetch("/api/central-store/dashboard", { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "Unable to load Central Store.");
        centralStoreData = data;
        const summary = data.summary || {};
        [["storeKpiNew", summary.new_requests], ["storeKpiActive", summary.active_requests], ["storeKpiLow", summary.low_stock], ["storeKpiOut", summary.out_of_stock], ["storeRequestCount", (data.requests || []).length]].forEach(([id, value]) => {
            const element = document.getElementById(id); if (element) element.textContent = value ?? 0;
        });
        renderCentralStorePanel();
        if (showToast) BioTrackToast.success("Store refreshed", "The request and stock queues are up to date.");
    } catch (error) {
        const panel = document.getElementById("centralStorePanel");
        if (panel) panel.innerHTML = `<div class="store-empty"><i data-lucide="wifi-off"></i><h3>Central Store is unavailable</h3><p>${storeEscape(error.message)}</p></div>`;
        BioTrackToast.error("Unable to load store", error.message);
        if (window.lucide) lucide.createIcons();
    }
}

function setCentralStoreTab(tab, button) {
    centralStoreTab = tab;
    document.querySelectorAll("[data-store-tab]").forEach(item => item.classList.toggle("is-active", item === button));
    renderCentralStorePanel();
}

function storeStatusClass(value) { return String(value || "").toLowerCase().replaceAll(" ", "-"); }

function centralStoreRequestActions(request) {
    const id = Number(request.id);
    if (request.status === "Submitted") return `<button onclick="processStoreRequest(${id},'Approve')"><i data-lucide="check"></i>Approve</button><button class="is-danger" onclick="processStoreRequest(${id},'Reject')">Reject</button>`;
    if (request.status === "Awaiting Procurement") return `<button onclick="processStoreRequest(${id},'MarkReady')"><i data-lucide="package-check"></i>Mark sourced & ready</button><button class="is-danger" onclick="processStoreRequest(${id},'Reject')">Reject</button>`;
    if (request.status === "Ready") return `<button onclick="processStoreRequest(${id},'DispatchWardBoy')"><i data-lucide="truck"></i>Call Ward Boy</button><button class="is-secondary" onclick="processStoreRequest(${id},'ReadyForPickup')"><i data-lucide="hand"></i>Engineer pickup</button>`;
    if (request.status === "Dispatched") return `<span class="store-action-note"><i data-lucide="truck"></i>${request.delivery_task?.status === "Accepted" ? `With ${storeEscape(request.delivery_task.assigned_to || "Ward Boy")}` : "Waiting for Ward Boy"}</span>`;
    if (request.status === "Awaiting Engineer Confirmation") return '<span class="store-action-note"><i data-lucide="badge-check"></i>Delivered · awaiting engineer</span>';
    return `<span class="store-action-note"><i data-lucide="${request.status === "Completed" ? "circle-check-big" : "circle-x"}"></i>${storeEscape(request.status)}</span>`;
}

function renderCentralStorePanel() {
    const panel = document.getElementById("centralStorePanel");
    if (!panel) return;
    if (centralStoreTab === "requests") {
        const requests = centralStoreData.requests || [];
        panel.innerHTML = requests.length ? `<div class="store-request-grid">${requests.map(request => `
            <article class="store-request-card">
                <header><div><small>${storeEscape(request.request_number)} · ${storeEscape(request.service_team)}</small><h3>${storeEscape(request.item_name)}</h3></div><span class="store-status is-${storeStatusClass(request.status)}">${storeEscape(request.status)}</span></header>
                <div class="store-request-facts"><span><b>${Number(request.quantity)} ${storeEscape(request.unit)}</b> requested</span><span>${storeEscape(request.request_type)} item</span><span>${storeEscape(request.priority)} priority</span><span>${storeEscape(request.request_reason)}</span></div>
                <p class="store-requester"><i data-lucide="user-round"></i><b>${storeEscape(request.requested_by_name)}</b> · ${storeEscape(request.delivery_location)}</p>
                ${request.specification ? `<p class="store-spec">${storeEscape(request.specification)}</p>` : ""}
                <footer>${centralStoreRequestActions(request)}</footer>
            </article>`).join("")}</div>` : '<div class="store-empty"><i data-lucide="inbox"></i><h3>No engineer requests</h3><p>New internal and external spare-part requests will appear here.</p></div>';
    } else if (["low", "out"].includes(centralStoreTab)) {
        const rows = centralStoreTab === "low" ? centralStoreData.low_stock || [] : centralStoreData.out_of_stock || [];
        panel.innerHTML = storeStockTable(rows, centralStoreTab === "low" ? "No low-stock engineering items" : "No out-of-stock engineering items");
    } else {
        panel.innerHTML = storeCatalogueTable(centralStoreData.catalogue || []);
    }
    if (window.lucide) lucide.createIcons();
}

function storeStockTable(rows, emptyText) {
    if (!rows.length) return `<div class="store-empty"><i data-lucide="badge-check"></i><h3>${emptyText}</h3><p>All engineering teams are currently above this threshold.</p></div>`;
    return `<div class="store-table-wrap"><table><thead><tr><th>Team</th><th>Code</th><th>Spare part</th><th>Available</th><th>Minimum</th><th>Location</th></tr></thead><tbody>${rows.map(item => `<tr><td><span class="store-team">${storeEscape(item.service_team)}</span></td><td>${storeEscape(item.bpk_number)}</td><td><b>${storeEscape(item.item_name)}</b></td><td>${Number(item.available_stock)} ${storeEscape(item.unit)}</td><td>${Number(item.minimum_stock)}</td><td>${storeEscape(item.location)}</td></tr>`).join("")}</tbody></table></div>`;
}

function storeCatalogueTable(rows) {
    if (!rows.length) return '<div class="store-empty"><i data-lucide="library-big"></i><h3>The catalogue is empty</h3><p>Add the first hospital-wide spare part.</p></div>';
    return `<div class="store-table-wrap"><table><thead><tr><th>Code</th><th>Spare part</th><th>Stock</th><th>Min / Max</th><th>Bin</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(item => `<tr><td>${storeEscape(item.item_code)}</td><td><b>${storeEscape(item.item_name)}</b><small>${storeEscape(item.category || "Uncategorised")}</small></td><td><b>${Number(item.current_stock)}</b> ${storeEscape(item.unit)}</td><td>${Number(item.minimum_stock)} / ${Number(item.maximum_stock)}</td><td>${storeEscape(item.location)}${item.rack ? ` · ${storeEscape(item.rack)}` : ""}</td><td><span class="store-stock-state is-${storeStatusClass(item.stock_state)}">${storeEscape(item.stock_state)}</span></td><td><button class="store-icon-btn" onclick="openCatalogueEditor(${Number(item.id)})" aria-label="Edit ${storeEscape(item.item_name)}"><i data-lucide="pencil"></i></button></td></tr>`).join("")}</tbody></table></div>`;
}

async function processStoreRequest(requestId, action) {
    const labels = { Approve: "Approve this request?", MarkReady: "Confirm the item is sourced and ready?", DispatchWardBoy: "Send this delivery to the Ward Boy queue?", ReadyForPickup: "Mark this order ready for engineer pickup?", Reject: "Reject this request?" };
    if (!window.confirm(labels[action] || "Continue?")) return;
    try {
        const response = await fetch(`/api/central-store/requests/${requestId}/action`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, notes: "" }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "Unable to update request.");
        BioTrackToast.success("Request updated", `Status changed to ${data.request.status}.`);
        await loadCentralStore();
    } catch (error) { BioTrackToast.error("Request not updated", error.message); }
}

function openCatalogueEditor(itemId = null) {
    const item = itemId ? (centralStoreData.catalogue || []).find(entry => entry.id === itemId) : null;
    const modal = document.createElement("div");
    modal.id = "catalogueEditor";
    modal.className = "store-modal-backdrop";
    modal.innerHTML = `<section class="store-modal" role="dialog" aria-modal="true" aria-labelledby="catalogueTitle"><header><div><span>${item ? "Update stock record" : "New master item"}</span><h2 id="catalogueTitle">${item ? "Edit catalogue item" : "Add catalogue item"}</h2></div><button onclick="closeCatalogueEditor()" aria-label="Close"><i data-lucide="x"></i></button></header><form id="catalogueForm" onsubmit="saveCatalogueItem(event,${item ? Number(item.id) : "null"})"><div class="store-form-grid">${storeCatalogueField("item_code", "Item code", item?.item_code, true)}${storeCatalogueField("item_name", "Spare-part name", item?.item_name, true)}${storeCatalogueField("category", "Category", item?.category)}${storeCatalogueField("manufacturer", "Manufacturer", item?.manufacturer)}${storeCatalogueField("supplier", "Supplier", item?.supplier)}${storeCatalogueField("unit", "Unit", item?.unit || "pieces", true)}${storeCatalogueField("current_stock", "Current stock", item?.current_stock ?? 0, true, "number", "0")}${storeCatalogueField("minimum_stock", "Minimum stock", item?.minimum_stock ?? 5, true, "number", "0")}${storeCatalogueField("maximum_stock", "Maximum stock", item?.maximum_stock ?? 100, true, "number", "0")}${storeCatalogueField("purchase_price", "Unit price (₹)", item?.purchase_price ?? 0, true, "number", "0", "0.01")}${storeCatalogueField("location", "Store location", item?.location || "Central Store", true)}${storeCatalogueField("rack", "Rack / bin", item?.rack)}</div><footer><button type="button" class="is-ghost" onclick="closeCatalogueEditor()">Cancel</button><button class="store-primary" type="submit"><i data-lucide="save"></i>Save item</button></footer></form></section>`;
    modal.addEventListener("click", event => { if (event.target === modal) closeCatalogueEditor(); });
    document.body.appendChild(modal);
    if (window.lucide) lucide.createIcons();
}

function storeCatalogueField(name, label, value = "", required = false, type = "text", min = "", step = "") {
    return `<label><span>${label}${required ? " *" : ""}</span><input name="${name}" type="${type}" value="${storeEscape(value)}" ${required ? "required" : ""} ${min !== "" ? `min="${min}"` : ""} ${step ? `step="${step}"` : ""}></label>`;
}

function closeCatalogueEditor() { document.getElementById("catalogueEditor")?.remove(); }

async function saveCatalogueItem(event, itemId) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    ["current_stock", "minimum_stock", "maximum_stock"].forEach(key => values[key] = Number(values[key]));
    values.purchase_price = Number(values.purchase_price); values.active = true;
    try {
        const response = await fetch(itemId ? `/api/central-store/catalog/${itemId}` : "/api/central-store/catalog", { method: itemId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "Unable to save catalogue item.");
        closeCatalogueEditor(); BioTrackToast.success("Catalogue saved", "The master stock record is now available."); await loadCentralStore();
    } catch (error) { BioTrackToast.error("Item not saved", error.message); }
}
