// ==========================================
// DEPARTMENT INVENTORY MODULE
// ==========================================

const INVENTORY_API = "/api/inventory";
const INVENTORY_TEAMS = ["Biomedical", "Electrical", "IT"];
const INVENTORY_TEAM_META = {
    Biomedical: { icon: "stethoscope", className: "biomedical", description: "Clinical equipment parts" },
    Electrical: { icon: "plug-zap", className: "electrical", description: "Power and electrical spares" },
    IT: { icon: "server-cog", className: "it", description: "Network and computer parts" },
};

let inventoryData = [];
let filteredInventory = [];
let currentInventoryId = null;
let activeInventoryTeam = "all";
const inventoryPagination = { page: 1, pageSize: 25 };

function inventoryRole() {
    return typeof normalizeDashboardRole === "function"
        ? normalizeDashboardRole(localStorage.getItem("role"))
        : String(localStorage.getItem("role") || "").trim().toLowerCase();
}

function isInventoryManager() {
    return inventoryRole() === "admin";
}

function inventoryTeamForRole() {
    const role = inventoryRole();
    if (role === "electrical") return "Electrical";
    if (role === "it") return "IT";
    if (role === "engineer") return "Biomedical";
    return null;
}

function inventoryTeamMeta(team) {
    return INVENTORY_TEAM_META[team] || INVENTORY_TEAM_META.Biomedical;
}

function inventoryNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function inventoryCurrency(value) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(inventoryNumber(value));
}

function inventoryStatus(item) {
    const stock = inventoryNumber(item.available_stock ?? item.current_stock);
    const minimum = inventoryNumber(item.minimum_stock);
    if (stock <= 0) return { key: "out", label: "Out of stock", className: "stock-out" };
    if (stock <= minimum) return { key: "low", label: "Low stock", className: "stock-low" };
    return { key: "available", label: "Available", className: "stock-ok" };
}

function inventoryTeamItems(team = activeInventoryTeam) {
    if (!isInventoryManager()) return [...inventoryData];
    if (!team || team === "all") return [...inventoryData];
    return inventoryData.filter(item => item.service_team === team);
}

// ==========================================
// RENDER
// ==========================================

async function renderInventory() {
    activeInventoryTeam = isInventoryManager() ? "all" : (inventoryTeamForRole() || "Biomedical");
    const team = inventoryTeamForRole();
    const title = isInventoryManager() ? "Engineering inventory hub" : `${team} inventory`;
    const subtitle = isInventoryManager()
        ? "Separate stock rooms for Biomedical, Electrical and IT engineering."
        : `Manage parts and consumables assigned only to the ${team} team.`;

    pageContent.innerHTML = `
        <div class="inventory-page">
            <section class="inventory-hero">
                <div class="inventory-hero-copy">
                    <span class="inventory-eyebrow"><i data-lucide="warehouse"></i> Engineering stores</span>
                    <h1>${escapeHTML(title)}</h1>
                    <p>${escapeHTML(subtitle)}</p>
                </div>
                <div class="inventory-hero-actions">
                    <button class="inventory-button inventory-button-secondary" id="importInventoryBtn" type="button">
                        <i data-lucide="file-up"></i><span>Import Excel</span>
                    </button>
                    <button class="inventory-button inventory-button-secondary" id="exportInventoryBtn" type="button">
                        <i data-lucide="download"></i><span>Export CSV</span>
                    </button>
                    <button class="inventory-button inventory-button-primary" id="addInventoryBtn" type="button">
                        <i data-lucide="plus"></i><span>Add item</span>
                    </button>
                </div>
            </section>

            <section id="inventoryTeamSwitcher" class="inventory-team-switcher" aria-label="Engineering inventory departments"></section>

            <section class="inventory-kpis" aria-label="Inventory summary">
                <article class="inventory-kpi inventory-kpi-total">
                    <div class="inventory-kpi-icon"><i data-lucide="package-open"></i></div>
                    <div><span>Stock lines</span><strong id="inventoryTotalItems">0</strong><small id="inventoryTotalHint">in this inventory</small></div>
                </article>
                <article class="inventory-kpi inventory-kpi-units">
                    <div class="inventory-kpi-icon"><i data-lucide="boxes"></i></div>
                    <div><span>Units on hand</span><strong id="inventoryTotalUnits">0</strong><small>across all stock lines</small></div>
                </article>
                <article class="inventory-kpi inventory-kpi-low">
                    <div class="inventory-kpi-icon"><i data-lucide="triangle-alert"></i></div>
                    <div><span>Needs attention</span><strong id="inventoryLowStock">0</strong><small id="inventoryAlertHint">low or out of stock</small></div>
                </article>
                <article class="inventory-kpi inventory-kpi-value">
                    <div class="inventory-kpi-icon"><i data-lucide="indian-rupee"></i></div>
                    <div><span>Stock value</span><strong id="inventoryValue">₹0</strong><small>current quantity value</small></div>
                </article>
            </section>

            <section class="inventory-registry">
                <header class="inventory-registry-header">
                    <div>
                        <span class="inventory-section-label">Stock register</span>
                        <h2 id="inventoryRegistryTitle">All engineering inventory</h2>
                    </div>
                    <div class="inventory-result-count"><strong id="inventoryResultCount">0</strong><span>items shown</span></div>
                </header>

                <div class="inventory-toolbar">
                    <label class="inventory-search" for="inventorySearch">
                        <i data-lucide="search"></i>
                        <input id="inventorySearch" type="search" placeholder="Search BPK, item, category or manufacturer" autocomplete="off">
                    </label>
                    <label class="inventory-select-wrap" for="inventoryFilter">
                        <span>Status</span>
                        <select id="inventoryFilter">
                            <option value="all">All statuses</option>
                            <option value="available">Available</option>
                            <option value="low">Low stock</option>
                            <option value="out">Out of stock</option>
                        </select>
                    </label>
                    <label class="inventory-select-wrap" for="inventoryCategoryFilter">
                        <span>Category</span>
                        <select id="inventoryCategoryFilter"><option value="all">All categories</option></select>
                    </label>
                </div>

                <div class="inventory-table-wrap">
                    <table class="inventory-table">
                        <thead>
                            <tr>
                                <th>Part / BPK</th>
                                <th>Item</th>
                                <th>Department</th>
                                <th>Category</th>
                                <th class="inventory-number-cell">On hand</th>
                                <th class="inventory-number-cell">Minimum</th>
                                <th>Status</th>
                                <th>Store location</th>
                                <th class="inventory-actions-heading">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="inventoryTableBody"></tbody>
                    </table>
                </div>
                <div id="inventoryPagination" class="table-pagination"></div>
            </section>
        </div>
    `;

    bindInventoryEvents();
    renderInventoryTeamSwitcher();
    await loadInventory();
    if (window.lucide) lucide.createIcons();
}

function bindInventoryEvents() {
    document.getElementById("inventorySearch")?.addEventListener("input", applyInventoryFilters);
    document.getElementById("inventoryFilter")?.addEventListener("change", applyInventoryFilters);
    document.getElementById("inventoryCategoryFilter")?.addEventListener("change", applyInventoryFilters);
    document.getElementById("importInventoryBtn")?.addEventListener("click", importInventoryExcel);
    document.getElementById("exportInventoryBtn")?.addEventListener("click", exportInventoryExcel);
    document.getElementById("addInventoryBtn")?.addEventListener("click", () => openInventoryModal());
}

function renderInventoryTeamSwitcher() {
    const switcher = document.getElementById("inventoryTeamSwitcher");
    if (!switcher) return;

    if (!isInventoryManager()) {
        const team = inventoryTeamForRole() || "Biomedical";
        const meta = inventoryTeamMeta(team);
        switcher.innerHTML = `
            <div class="inventory-team-lock ${meta.className}">
                <span class="inventory-team-icon"><i data-lucide="${meta.icon}"></i></span>
                <div><strong>${team} store</strong><small>${meta.description}</small></div>
                <span class="inventory-private-label"><i data-lucide="lock-keyhole"></i> Team inventory</span>
            </div>`;
        if (window.lucide) lucide.createIcons();
        return;
    }

    const tabs = [
        { team: "all", label: "All departments", icon: "layout-grid", description: "Combined manager view" },
        ...INVENTORY_TEAMS.map(team => ({
            team,
            label: team,
            icon: inventoryTeamMeta(team).icon,
            description: inventoryTeamMeta(team).description,
        })),
    ];

    switcher.innerHTML = tabs.map(tab => {
        const items = tab.team === "all" ? inventoryData : inventoryData.filter(item => item.service_team === tab.team);
        const alerts = items.filter(item => inventoryStatus(item).key !== "available").length;
        const active = tab.team === activeInventoryTeam;
        return `
            <button class="inventory-team-tab ${active ? "active" : ""}" type="button" data-inventory-team="${tab.team}" aria-pressed="${active}">
                <span class="inventory-team-icon"><i data-lucide="${tab.icon}"></i></span>
                <span class="inventory-team-copy"><strong>${tab.label}</strong><small>${tab.description}</small></span>
                <span class="inventory-team-metrics"><b>${items.length}</b><small>${alerts ? `${alerts} alert${alerts === 1 ? "" : "s"}` : "Stock healthy"}</small></span>
            </button>`;
    }).join("");

    switcher.querySelectorAll("[data-inventory-team]").forEach(button => {
        button.addEventListener("click", () => selectInventoryTeam(button.dataset.inventoryTeam));
    });
    if (window.lucide) lucide.createIcons();
}

function selectInventoryTeam(team) {
    if (!isInventoryManager() || !["all", ...INVENTORY_TEAMS].includes(team)) return;
    activeInventoryTeam = team;
    inventoryPagination.page = 1;
    renderInventoryTeamSwitcher();
    refreshInventoryCategoryOptions();
    applyInventoryFilters();
}

// ==========================================
// DATA AND FILTERING
// ==========================================

async function loadInventory() {
    setInventoryLoading(true);
    try {
        const response = await fetch(`${INVENTORY_API}/`);
        const result = await response.json().catch(() => []);
        if (!response.ok) throw new Error(result.detail || "Failed to load inventory.");
        inventoryData = Array.isArray(result) ? result : [];
        renderInventoryTeamSwitcher();
        refreshInventoryCategoryOptions();
        applyInventoryFilters();
    } catch (error) {
        console.error(error);
        inventoryData = [];
        filteredInventory = [];
        updateInventoryKPIs();
        renderInventoryTable([]);
        BioTrackToast.error("Inventory unavailable", error.message || "Unable to load inventory items.");
    } finally {
        setInventoryLoading(false);
    }
}

function setInventoryLoading(loading) {
    const table = document.querySelector(".inventory-registry");
    if (table) table.classList.toggle("is-loading", loading);
    document.querySelectorAll("#importInventoryBtn, #exportInventoryBtn, #addInventoryBtn")
        .forEach(button => { button.disabled = loading; });
}

function refreshInventoryCategoryOptions() {
    const select = document.getElementById("inventoryCategoryFilter");
    if (!select) return;
    const previous = select.value;
    const categories = [...new Set(inventoryTeamItems()
        .map(item => String(item.category || "").trim())
        .filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));
    select.innerHTML = '<option value="all">All categories</option>' + categories
        .map(category => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`)
        .join("");
    select.value = categories.includes(previous) ? previous : "all";
}

function applyInventoryFilters() {
    const search = String(document.getElementById("inventorySearch")?.value || "").trim().toLowerCase();
    const statusFilter = document.getElementById("inventoryFilter")?.value || "all";
    const categoryFilter = document.getElementById("inventoryCategoryFilter")?.value || "all";

    filteredInventory = inventoryTeamItems().filter(item => {
        const haystack = [item.bpk_number, item.item_name, item.category, item.manufacturer, item.location, item.rack]
            .map(value => String(value || "").toLowerCase())
            .join(" ");
        const matchesSearch = !search || haystack.includes(search);
        const matchesStatus = statusFilter === "all" || inventoryStatus(item).key === statusFilter;
        const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
        return matchesSearch && matchesStatus && matchesCategory;
    });

    inventoryPagination.page = 1;
    updateInventoryKPIs();
    updateInventoryRegistryHeader();
    renderInventoryTable(filteredInventory);
}

function updateInventoryKPIs() {
    const items = inventoryTeamItems();
    const totalUnits = items.reduce((sum, item) => sum + inventoryNumber(item.available_stock ?? item.current_stock), 0);
    const lowStock = items.filter(item => inventoryStatus(item).key === "low").length;
    const outOfStock = items.filter(item => inventoryStatus(item).key === "out").length;
    const totalValue = items.reduce((sum, item) => sum + (inventoryNumber(item.current_stock) * inventoryNumber(item.purchase_price)), 0);

    document.getElementById("inventoryTotalItems").textContent = items.length.toLocaleString("en-IN");
    document.getElementById("inventoryTotalUnits").textContent = totalUnits.toLocaleString("en-IN");
    document.getElementById("inventoryLowStock").textContent = (lowStock + outOfStock).toLocaleString("en-IN");
    document.getElementById("inventoryAlertHint").textContent = `${lowStock} low · ${outOfStock} out`;
    document.getElementById("inventoryValue").textContent = inventoryCurrency(totalValue);
    document.getElementById("inventoryTotalHint").textContent = activeInventoryTeam === "all" ? "across 3 departments" : `in ${activeInventoryTeam}`;
}

function updateInventoryRegistryHeader() {
    const title = document.getElementById("inventoryRegistryTitle");
    const count = document.getElementById("inventoryResultCount");
    if (title) title.textContent = activeInventoryTeam === "all" ? "All engineering inventory" : `${activeInventoryTeam} stock register`;
    if (count) count.textContent = filteredInventory.length.toLocaleString("en-IN");
}

function renderInventoryTable(data) {
    const tbody = document.getElementById("inventoryTableBody");
    if (!tbody) return;

    if (!data.length) {
        tbody.innerHTML = `
            <tr><td colspan="9" class="inventory-empty">
                <span><i data-lucide="package-search"></i></span>
                <strong>No inventory items found</strong>
                <small>Try another department or clear the current filters.</small>
            </td></tr>`;
        TablePagination.render(document.getElementById("inventoryPagination"), inventoryPagination, 0, () => renderInventoryTable(filteredInventory), "inventory items");
        if (window.lucide) lucide.createIcons();
        return;
    }

    tbody.innerHTML = TablePagination.pageItems(data, inventoryPagination).map(item => {
        const status = inventoryStatus(item);
        const meta = inventoryTeamMeta(item.service_team);
        return `
            <tr>
                <td data-label="Part / BPK"><span class="inventory-part-code">${escapeHTML(item.bpk_number || "-")}</span></td>
                <td data-label="Item"><div class="inventory-item-name"><strong>${escapeHTML(item.item_name || "-")}</strong><small>${escapeHTML(item.manufacturer || "Manufacturer not set")}</small></div></td>
                <td data-label="Department"><span class="inventory-team-badge ${meta.className}"><i data-lucide="${meta.icon}"></i>${escapeHTML(item.service_team || "Biomedical")}</span></td>
                <td data-label="Category">${escapeHTML(item.category || "Uncategorised")}</td>
                <td data-label="On hand" class="inventory-number-cell"><strong class="inventory-stock-number ${status.className}">${inventoryNumber(item.available_stock ?? item.current_stock)}</strong><small>${inventoryNumber(item.reserved_stock) ? `${inventoryNumber(item.reserved_stock)} reserved` : escapeHTML(item.unit || "units")}</small></td>
                <td data-label="Minimum" class="inventory-number-cell">${inventoryNumber(item.minimum_stock)}</td>
                <td data-label="Status"><span class="stock-badge ${status.className}"><i></i>${status.label}</span></td>
                <td data-label="Store location"><div class="inventory-location"><strong>${escapeHTML(item.location || "Not assigned")}</strong>${item.rack ? `<small>Rack ${escapeHTML(item.rack)}</small>` : ""}</div></td>
                <td data-label="Actions"><div class="action-buttons">
                    <button class="table-btn edit-btn" onclick="editInventory(${Number(item.id)})" type="button" aria-label="Edit ${escapeHTML(item.item_name || item.bpk_number || "inventory item")}" title="Edit item"><i data-lucide="square-pen"></i></button>
                    <button class="table-btn delete-btn" onclick="deleteInventory(${Number(item.id)})" type="button" aria-label="Delete ${escapeHTML(item.item_name || item.bpk_number || "inventory item")}" title="Delete item"><i data-lucide="trash-2"></i></button>
                </div></td>
            </tr>`;
    }).join("");

    TablePagination.render(document.getElementById("inventoryPagination"), inventoryPagination, data.length, () => renderInventoryTable(filteredInventory), "inventory items");
    if (window.lucide) lucide.createIcons();
}

// ==========================================
// ADD / EDIT DIALOG
// ==========================================

function editInventory(id) {
    const item = inventoryData.find(entry => Number(entry.id) === Number(id));
    if (item) openInventoryModal(item);
}

function inventoryFieldValue(value) {
    return escapeHTML(value ?? "");
}

function inventoryTeamOptions(selectedTeam = "Biomedical") {
    return INVENTORY_TEAMS.map(team => `<option value="${team}" ${team === selectedTeam ? "selected" : ""}>${team}</option>`).join("");
}

function openInventoryModal(item = null) {
    closeInventoryModal();
    const editing = Boolean(item);
    currentInventoryId = editing ? Number(item.id) : null;
    const canSelectTeam = isInventoryManager();
    const selectedTeam = item?.service_team || (activeInventoryTeam !== "all" ? activeInventoryTeam : inventoryTeamForRole()) || "Biomedical";

    const overlay = document.createElement("div");
    overlay.id = "inventoryModalOverlay";
    overlay.className = "inventory-modal-overlay";
    overlay.setAttribute("role", "presentation");
    overlay.innerHTML = `
        <section class="inventory-modal" role="dialog" aria-modal="true" aria-labelledby="inventoryModalTitle">
            <form id="inventoryItemForm">
                <header class="modal-header">
                    <div class="modal-header-icon"><i data-lucide="${editing ? "square-pen" : "package-plus"}"></i></div>
                    <div class="modal-header-copy">
                        <span>${editing ? "Update stock record" : "New stock record"}</span>
                        <h2 id="inventoryModalTitle">${editing ? "Edit inventory item" : "Add inventory item"}</h2>
                        <p>Every item belongs to one engineering department inventory.</p>
                    </div>
                    <button class="modal-close" type="button" aria-label="Close inventory form"><i data-lucide="x"></i></button>
                </header>
                <div class="modal-body">
                    <fieldset class="inventory-form-section inventory-form-identity">
                        <legend>Item identity</legend>
                        <div class="form-grid">
                            <div class="form-group"><label for="inv_bpk">BPK number <span>*</span></label><input id="inv_bpk" required maxlength="160" value="${inventoryFieldValue(item?.bpk_number)}" placeholder="e.g. IT-CAT6-001"></div>
                            <div class="form-group"><label for="inv_name">Item name <span>*</span></label><input id="inv_name" required maxlength="240" value="${inventoryFieldValue(item?.item_name)}" placeholder="e.g. CAT6 patch cable"></div>
                            <div class="form-group"><label for="inv_team">Engineering department <span>*</span></label><select id="inv_team" ${canSelectTeam ? "" : "disabled"}>${inventoryTeamOptions(selectedTeam)}</select><small>${canSelectTeam ? "Choose the inventory that owns this stock." : "Your login determines this inventory."}</small></div>
                            <div class="form-group"><label for="inv_category">Category</label><input id="inv_category" maxlength="160" value="${inventoryFieldValue(item?.category)}" placeholder="e.g. Network spare"></div>
                            <div class="form-group"><label for="inv_manufacturer">Manufacturer</label><input id="inv_manufacturer" maxlength="200" value="${inventoryFieldValue(item?.manufacturer)}"></div>
                            <div class="form-group"><label for="inv_supplier">Supplier</label><input id="inv_supplier" maxlength="200" value="${inventoryFieldValue(item?.supplier)}"></div>
                        </div>
                    </fieldset>
                    <fieldset class="inventory-form-section">
                        <legend>Stock levels</legend>
                        <div class="form-grid inventory-form-grid-three">
                            <div class="form-group"><label for="inv_stock">Current stock <span>*</span></label><input id="inv_stock" type="number" min="0" step="1" required value="${inventoryFieldValue(item?.current_stock ?? 0)}"></div>
                            <div class="form-group"><label for="inv_min">Reorder level <span>*</span></label><input id="inv_min" type="number" min="0" step="1" required value="${inventoryFieldValue(item?.minimum_stock ?? 5)}"></div>
                            <div class="form-group"><label for="inv_max">Target stock <span>*</span></label><input id="inv_max" type="number" min="0" step="1" required value="${inventoryFieldValue(item?.maximum_stock ?? 100)}"></div>
                            <div class="form-group"><label for="inv_unit">Unit</label><input id="inv_unit" maxlength="80" placeholder="pieces, boxes, metres" value="${inventoryFieldValue(item?.unit)}"></div>
                            <div class="form-group"><label for="inv_price">Unit price (₹)</label><input id="inv_price" type="number" min="0" step="0.01" value="${inventoryFieldValue(item?.purchase_price ?? 0)}"></div>
                            <div class="form-group"><label for="inv_batch">Batch / lot number</label><input id="inv_batch" maxlength="160" value="${inventoryFieldValue(item?.batch_number)}"></div>
                        </div>
                    </fieldset>
                    <fieldset class="inventory-form-section">
                        <legend>Storage</legend>
                        <div class="form-grid">
                            <div class="form-group"><label for="inv_location">Store location</label><input id="inv_location" maxlength="200" value="${inventoryFieldValue(item?.location)}" placeholder="e.g. IT Store"></div>
                            <div class="form-group"><label for="inv_rack">Rack / bin</label><input id="inv_rack" maxlength="120" value="${inventoryFieldValue(item?.rack)}" placeholder="e.g. Rack B-04"></div>
                            <div class="form-group full-width"><label for="inv_remarks">Remarks</label><textarea id="inv_remarks" rows="3" maxlength="1000" placeholder="Optional notes about compatibility or storage">${inventoryFieldValue(item?.remarks)}</textarea></div>
                        </div>
                    </fieldset>
                </div>
                <footer class="modal-footer">
                    <button class="secondary-btn" type="button" id="cancelInventoryModal">Cancel</button>
                    <button class="success-btn" type="submit" id="saveInventoryButton"><i data-lucide="save"></i><span>${editing ? "Save changes" : "Add item"}</span></button>
                </footer>
            </form>
        </section>`;

    document.body.appendChild(overlay);
    overlay.querySelector(".modal-close").addEventListener("click", closeInventoryModal);
    overlay.querySelector("#cancelInventoryModal").addEventListener("click", closeInventoryModal);
    overlay.querySelector("#inventoryItemForm").addEventListener("submit", event => {
        event.preventDefault();
        void saveInventoryItem(currentInventoryId);
    });
    document.addEventListener("keydown", closeInventoryModalOnEscape);
    if (window.lucide) lucide.createIcons();
    window.setTimeout(() => overlay.querySelector("#inv_bpk")?.focus(), 0);
}

function closeInventoryModalOnEscape(event) {
    if (event.key === "Escape") closeInventoryModal();
}

function closeInventoryModal() {
    document.getElementById("inventoryModalOverlay")?.remove();
    document.removeEventListener("keydown", closeInventoryModalOnEscape);
}

async function saveInventoryItem(id = null) {
    const minimum = Number(document.getElementById("inv_min").value);
    const maximum = Number(document.getElementById("inv_max").value);
    if (maximum < minimum) {
        BioTrackToast.error("Check stock levels", "Target stock must be greater than or equal to the reorder level.");
        document.getElementById("inv_max").focus();
        return;
    }

    const payload = {
        bpk_number: document.getElementById("inv_bpk").value.trim(),
        item_name: document.getElementById("inv_name").value.trim(),
        service_team: document.getElementById("inv_team").value,
        category: document.getElementById("inv_category").value.trim(),
        manufacturer: document.getElementById("inv_manufacturer").value.trim(),
        supplier: document.getElementById("inv_supplier").value.trim(),
        unit: document.getElementById("inv_unit").value.trim(),
        current_stock: Number(document.getElementById("inv_stock").value),
        minimum_stock: minimum,
        maximum_stock: maximum,
        purchase_price: Number(document.getElementById("inv_price").value),
        location: document.getElementById("inv_location").value.trim(),
        rack: document.getElementById("inv_rack").value.trim(),
        remarks: document.getElementById("inv_remarks").value.trim(),
        batch_number: document.getElementById("inv_batch").value.trim(),
    };

    const url = id ? `${INVENTORY_API}/${id}` : `${INVENTORY_API}/`;
    const method = id ? "PUT" : "POST";
    const saveButton = document.getElementById("saveInventoryButton");
    try {
        saveButton.disabled = true;
        saveButton.querySelector("span").textContent = id ? "Saving…" : "Adding…";
        const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) throw new Error(result.detail || "Unable to save this inventory item.");
        closeInventoryModal();
        if (isInventoryManager()) activeInventoryTeam = payload.service_team;
        showInventoryToast(id ? "Inventory item updated." : `Item added to ${payload.service_team} inventory.`);
        await loadInventory();
    } catch (error) {
        BioTrackToast.error("Inventory item not saved", error.message || "Unable to save this inventory item.");
        saveButton.disabled = false;
        saveButton.querySelector("span").textContent = id ? "Save changes" : "Add item";
    }
}

// ==========================================
// DELETE DIALOG
// ==========================================

function deleteInventory(id) {
    const item = inventoryData.find(entry => Number(entry.id) === Number(id));
    if (!item) {
        BioTrackToast.error("Inventory item not found", "Refresh the inventory and try again.");
        return;
    }
    closeInventoryDeleteDialog();
    const overlay = document.createElement("div");
    overlay.id = "inventoryDeleteOverlay";
    overlay.className = "inventory-modal-overlay";
    overlay.setAttribute("role", "presentation");
    overlay.innerHTML = `
        <section class="inventory-modal inventory-delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="inventoryDeleteTitle" aria-describedby="inventoryDeleteDescription">
            <div class="inventory-delete-icon" aria-hidden="true"><i data-lucide="trash-2"></i></div>
            <span class="inventory-delete-team">${escapeHTML(item.service_team || "Biomedical")} inventory</span>
            <h2 id="inventoryDeleteTitle">Delete inventory item?</h2>
            <p id="inventoryDeleteDescription"><strong>${escapeHTML(item.item_name || item.bpk_number)}</strong> will be permanently removed from this department's inventory.</p>
            <div class="inventory-delete-actions">
                <button class="secondary-btn" type="button" id="cancelInventoryDelete">Keep item</button>
                <button class="danger-btn" type="button" id="confirmInventoryDelete"><i data-lucide="trash-2"></i> Delete item</button>
            </div>
        </section>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", event => { if (event.target === overlay) closeInventoryDeleteDialog(); });
    overlay.querySelector("#cancelInventoryDelete").addEventListener("click", closeInventoryDeleteDialog);
    overlay.querySelector("#confirmInventoryDelete").addEventListener("click", () => confirmDeleteInventory(id));
    document.addEventListener("keydown", closeInventoryDeleteOnEscape);
    if (window.lucide) lucide.createIcons();
    overlay.querySelector("#cancelInventoryDelete")?.focus();
}

function closeInventoryDeleteOnEscape(event) {
    if (event.key === "Escape") closeInventoryDeleteDialog();
}

function closeInventoryDeleteDialog() {
    document.getElementById("inventoryDeleteOverlay")?.remove();
    document.removeEventListener("keydown", closeInventoryDeleteOnEscape);
}

async function confirmDeleteInventory(id) {
    const button = document.getElementById("confirmInventoryDelete");
    try {
        button.disabled = true;
        button.textContent = "Deleting…";
        const response = await fetch(`${INVENTORY_API}/${id}`, { method: "DELETE" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) throw new Error(result.detail || "Unable to delete this inventory item.");
        closeInventoryDeleteDialog();
        showInventoryToast("Inventory item deleted.");
        await loadInventory();
    } catch (error) {
        BioTrackToast.error("Inventory item not deleted", error.message || "Unable to delete this inventory item.");
        button.disabled = false;
        button.innerHTML = '<i data-lucide="trash-2"></i> Delete item';
        if (window.lucide) lucide.createIcons();
    }
}

// ==========================================
// IMPORT / EXPORT
// ==========================================

async function importInventoryExcel() {
    const team = isInventoryManager() ? activeInventoryTeam : inventoryTeamForRole();
    if (!team || team === "all") {
        BioTrackToast.info("Choose a department", "Select Biomedical, Electrical or IT before importing a workbook.");
        document.getElementById("inventoryTeamSwitcher")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls";
    input.onchange = async () => {
        if (!input.files.length) return;
        showInventoryLoading(`Importing ${team} inventory…`);
        const formData = new FormData();
        formData.append("file", input.files[0]);
        try {
            const response = await fetch(`${INVENTORY_API}/upload?service_team=${encodeURIComponent(team)}`, { method: "POST", body: formData });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result.success) throw new Error(result.detail || result.message || "The spreadsheet could not be imported.");
            showInventoryToast(`${team} inventory imported: ${result.added} added, ${result.updated} updated.`);
            await loadInventory();
        } catch (error) {
            BioTrackToast.error("Inventory import failed", error.message || "The server could not process the spreadsheet.");
        } finally {
            hideInventoryLoading();
        }
    };
    input.click();
}

function inventoryCsvCell(value) {
    return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function exportInventoryExcel() {
    if (!filteredInventory.length) {
        BioTrackToast.info("Nothing to export", "No items match the current inventory filters.");
        return;
    }
    const rows = [["Department", "BPK Number", "Item Name", "Category", "Manufacturer", "Stock", "Unit", "Minimum Stock", "Location", "Rack", "Unit Price"]];
    filteredInventory.forEach(item => rows.push([
        item.service_team, item.bpk_number, item.item_name, item.category, item.manufacturer,
        item.current_stock, item.unit, item.minimum_stock, item.location, item.rack, item.purchase_price,
    ]));
    const csv = rows.map(row => row.map(inventoryCsvCell).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const teamName = activeInventoryTeam === "all" ? "All-Engineering" : activeInventoryTeam;
    anchor.href = url;
    anchor.download = `BioTrack-${teamName}-Inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    showInventoryToast(`${filteredInventory.length} inventory items exported.`);
}

function showInventoryLoading(message = "Loading…") {
    hideInventoryLoading();
    const overlay = document.createElement("div");
    overlay.id = "inventoryLoading";
    overlay.className = "loading-overlay";
    overlay.innerHTML = `<div class="loading-card"><div class="loading-spinner"></div><h3>${escapeHTML(message)}</h3><p>Please keep this window open.</p></div>`;
    document.body.appendChild(overlay);
}

function hideInventoryLoading() {
    document.getElementById("inventoryLoading")?.remove();
}

function showInventoryToast(message) {
    BioTrackToast.success("Inventory updated", message);
}
