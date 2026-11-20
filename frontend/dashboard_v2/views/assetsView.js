
let assetsCache = [];
let filteredAssets = [];
let selectedAssetServiceTeam = "";
let selectedAssetIds = new Set();
let pendingAssetImportTeam = "";
const assetsPagination = { page: 1, pageSize: 25 };

function canManageAssetQR() {
    const role = String(localStorage.getItem("role") || "").toLowerCase();
    return ["admin", "manager", "engineer", "bme", "electrical", "it"].includes(role);
}

function isAssetAdministrator() {
    const role = String(localStorage.getItem("role") || "").toLowerCase();
    return role === "admin" || role === "manager";
}

function assetRoleServiceTeam() {
    const role = String(localStorage.getItem("role") || "").toLowerCase();
    if (role === "electrical") return "Electrical";
    if (role === "it") return "IT";
    if (role === "engineer" || role === "bme") return "Biomedical";
    return "";
}

function assetRegistryCopy() {
    const role = String(localStorage.getItem("role") || "").toLowerCase();
    if (role === "electrical") return { badge: "Electrical Asset Registry", description: "Manage electrical equipment, maintenance ownership, QR records and lifecycle information from one place." };
    if (role === "it") return { badge: "IT Asset Registry", description: "Manage IT equipment, infrastructure, QR records and lifecycle information from one place." };
    if (role === "engineer" || role === "bme") return { badge: "Biomedical Asset Registry", description: "Manage biomedical devices, preventive maintenance, QR records and equipment history from one place." };
    return { badge: "Hospital Asset Registry", description: "Manage Biomedical, Electrical and IT assets across the hospital with team ownership, lifecycle information, QR records and maintenance history." };
}

function renderAssets() {

    const registryCopy = assetRegistryCopy();
    selectedAssetServiceTeam = isAssetAdministrator() ? "" : assetRoleServiceTeam();
    selectedAssetIds = new Set();

    pageContent.innerHTML = `
        <div class="asset-page">
            <section class="asset-hero">
                <div class="asset-hero-left">
                    <div class="asset-hero-eyebrow">
                        <span class="asset-badge"><i data-lucide="activity"></i>${registryCopy.badge}</span>
                        <span class="asset-live-state"><span></span>Live inventory</span>
                    </div>
                    <h1>Asset Management</h1>
                    <p>${registryCopy.description}</p>
                </div>

                <div class="asset-hero-right">
                    <div class="quick-actions-card" aria-label="Asset quick actions">
                        <span class="asset-action-label">Quick actions</span>
                        <div class="asset-actions">
                            <button id="addAssetBtn" class="btn-primary hero-btn">
                                <i data-lucide="plus"></i><span>Add asset</span>
                            </button>
                            ${canManageAssetQR() ? `<button id="assetQrBtn" class="btn-secondary hero-btn">
                                <i data-lucide="qr-code"></i><span>Generate QR</span>
                            </button>` : ""}
                            ${canManageAssetQR() ? `<button id="assetRelocationRequestsBtn" class="btn-secondary hero-btn">
                                <i data-lucide="route"></i><span>Relocations</span>
                            </button>` : ""}
                            <button id="importExcelBtn" class="btn-secondary hero-btn">
                                <i data-lucide="file-up"></i><span>Import</span>
                            </button>
                            <button id="exportAssetBtn" class="btn-secondary hero-btn">
                                <i data-lucide="download"></i><span>Export</span>
                            </button>
                        </div>
                        <input id="excelFileInput" type="file" accept=".xlsx,.xls" hidden>
                    </div>
                </div>
            </section>

            ${isAssetAdministrator() ? `
                <section class="asset-mode-switcher" aria-label="Asset service-team mode">
                    <div>
                        <span>Service team scope</span>
                        <strong id="assetModeTitle">All engineering assets</strong>
                    </div>
                    <div class="asset-mode-options" role="tablist" aria-label="Filter assets by service team">
                        <button type="button" class="is-active" data-asset-team="" role="tab" aria-selected="true"><i data-lucide="layers-3"></i>All assets</button>
                        <button type="button" data-asset-team="Biomedical" role="tab" aria-selected="false"><i data-lucide="heart-pulse"></i>Biomedical</button>
                        <button type="button" data-asset-team="Electrical" role="tab" aria-selected="false"><i data-lucide="zap"></i>Electrical</button>
                        <button type="button" data-asset-team="IT" role="tab" aria-selected="false"><i data-lucide="server"></i>IT</button>
                    </div>
                </section>
            ` : ""}

            <section class="asset-kpis" aria-label="Asset overview">
                <article class="asset-card total-card">
                    <div class="asset-card-top"><div class="asset-card-icon"><i data-lucide="package-open"></i></div><span class="asset-kpi-mode">All teams</span></div>
                    <div class="asset-card-content"><h4>Total assets</h4><h2 id="totalAssets">0</h2><p>Registered inventory</p></div>
                </article>
                <article class="asset-card active-card">
                    <div class="asset-card-top"><div class="asset-card-icon"><i data-lucide="circle-check-big"></i></div><span class="asset-kpi-mode">All teams</span></div>
                    <div class="asset-card-content"><h4>Active assets</h4><h2 id="activeAssets">0</h2><p>Ready for service</p></div>
                </article>
                <article class="asset-card pm-card">
                    <div class="asset-card-top"><div class="asset-card-icon"><i data-lucide="calendar-clock"></i></div><span class="asset-kpi-mode">All teams</span></div>
                    <div class="asset-card-content"><h4>PM due</h4><h2 id="pmDue">0</h2><p>Needs scheduling</p></div>
                </article>
                <article class="asset-card calibration-card">
                    <div class="asset-card-top"><div class="asset-card-icon"><i data-lucide="flask-conical"></i></div><span class="asset-kpi-mode">All teams</span></div>
                    <div class="asset-card-content"><h4>Calibration due</h4><h2 id="calibrationDue">0</h2><p>Quality checks due</p></div>
                </article>
                <article class="asset-card warranty-card">
                    <div class="asset-card-top"><div class="asset-card-icon"><i data-lucide="shield-alert"></i></div><span class="asset-kpi-mode">All teams</span></div>
                    <div class="asset-card-content"><h4>Warranty</h4><h2 id="warrantyDue">0</h2><p>Expiring soon</p></div>
                </article>
                <article class="asset-card critical-card">
                    <div class="asset-card-top"><div class="asset-card-icon"><i data-lucide="siren"></i></div><span class="asset-kpi-mode">All teams</span></div>
                    <div class="asset-card-content"><h4>Critical assets</h4><h2 id="criticalAssets">0</h2><p>Life-support equipment</p></div>
                </article>
            </section>

            <section class="asset-registry-panel" aria-labelledby="assetRegistryTitle">
                <header class="asset-registry-header">
                    <div>
                        <span class="asset-section-kicker">Equipment registry</span>
                        <h2 id="assetRegistryTitle">Hospital asset directory</h2>
                        <p>Search, filter and open the complete equipment record.</p>
                    </div>
                    <div class="asset-result-count" aria-live="polite">
                        <span></span><strong id="assetResultCount">0</strong><small>matching records</small>
                    </div>
                </header>

                <div class="asset-toolbar">
                    <label class="asset-search-wrap" for="assetSearch">
                        <i data-lucide="search"></i>
                        <span class="sr-only">Search equipment</span>
                        <input id="assetSearch" type="search" placeholder="Search by equipment, code, model or maker" class="asset-search" autocomplete="off">
                    </label>
                    <div class="asset-filter-group">
                        <label><span>Department</span><select id="assetDepartmentFilter"><option>All Departments</option></select></label>
                        <label><span>Status</span><select id="assetStatusFilter"><option>All Status</option></select></label>
                        <label><span>Category</span><select id="assetCategoryFilter"><option>All Categories</option></select></label>
                    </div>
                </div>

                ${isAssetAdministrator() ? `
                    <section class="asset-bulk-toolbar" aria-label="Bulk asset actions">
                        <div class="asset-bulk-summary">
                            <span class="asset-bulk-icon"><i data-lucide="list-checks"></i></span>
                            <span><strong id="assetSelectionCount">0 selected</strong><small>Use bulk tools to review or clean the registry.</small></span>
                        </div>
                        <div class="asset-bulk-actions">
                            <button type="button" id="assetSelectFilteredBtn" class="asset-bulk-secondary"><i data-lucide="check-check"></i> Select all</button>
                            <button type="button" id="assetClearSelectionBtn" class="asset-bulk-secondary" disabled><i data-lucide="x"></i> Deselect all</button>
                            <button type="button" id="assetFindDuplicatesBtn" class="asset-bulk-secondary"><i data-lucide="copy-check"></i> Find duplicates</button>
                            <button type="button" id="assetDeleteSelectedBtn" class="asset-bulk-danger" disabled><i data-lucide="trash-2"></i> Delete selected</button>
                        </div>
                    </section>
                ` : ""}

                <div class="asset-table-container">
                    <table class="asset-table">
                        <thead><tr>
                            ${isAssetAdministrator() ? '<th class="asset-select-column"><input id="assetSelectPage" type="checkbox" aria-label="Select all assets on this page"></th>' : ""}
                            <th>Asset code</th><th>Equipment</th><th>Department</th><th>Service team</th>
                            <th>Manufacturer</th><th>Model</th><th>Status</th><th>QR record</th><th><span class="sr-only">Action</span></th>
                        </tr></thead>
                        <tbody id="assetTableBody">
                            <tr><td colspan="${isAssetAdministrator() ? 10 : 9}" class="empty-table">
                                <span class="empty-table-icon"><i data-lucide="package-search"></i></span>
                                <strong>No assets found</strong><small>Import an Excel sheet or add an asset to begin.</small>
                            </td></tr>
                        </tbody>
                    </table>
                </div>
                <div id="assetsPagination" class="table-pagination"></div>
            </section>
        </div>
    `;
    initializeAssetImport();
    initializeAddAsset();
    initializeAssetQR();
    initializeAssetRelocations();
    initializeAssetModeSwitcher();
    initializeAssetFilters();
    initializeAssetBulkActions();
    loadAssets();
}

function initializeAssetQR() {
    const button = document.getElementById("assetQrBtn");
    if (button) button.onclick = () => openAssetQRGenerator();
}

function initializeAssetRelocations() {
    const button = document.getElementById("assetRelocationRequestsBtn");
    if (button) button.onclick = () => window.AssetRelocation?.openQueue();
}

// ==========================================
// INITIALIZE IMPORT BUTTON
// ==========================================

function openAssetImportDialog(excelInput) {
    closeAssetManagementDialog();
    const overlay = document.createElement("div");
    overlay.id = "assetManagementOverlay";
    overlay.className = "asset-management-overlay";
    overlay.innerHTML = `
        <section class="asset-management-dialog asset-import-dialog" role="dialog" aria-modal="true" aria-labelledby="assetImportTitle" aria-describedby="assetImportDescription">
            <header><span><i data-lucide="file-spreadsheet"></i></span><div><h2 id="assetImportTitle">Import assets</h2><p id="assetImportDescription">Select the engineering team that will own every asset in this spreadsheet.</p></div><button type="button" class="asset-management-close" aria-label="Close"><i data-lucide="x"></i></button></header>
            <div class="asset-import-form">
                <label for="assetImportTeam"><span>Import team</span><select id="assetImportTeam"><option value="">Select a team</option><option value="Biomedical">Biomedical</option><option value="Electrical">Electrical</option><option value="IT">IT</option></select></label>
                <p class="asset-import-help"><i data-lucide="info"></i><span>The selected team is applied to all valid rows in the Excel file.</span></p>
            </div>
            <footer><button type="button" class="asset-dialog-secondary" id="cancelAssetImport">Cancel</button><button type="button" class="asset-dialog-primary" id="continueAssetImport" disabled><i data-lucide="file-up"></i> Choose spreadsheet</button></footer>
        </section>
    `;
    document.body.appendChild(overlay);
    document.body.classList.add("asset-management-dialog-open");

    const teamSelect = overlay.querySelector("#assetImportTeam");
    const continueButton = overlay.querySelector("#continueAssetImport");
    const closeDialog = () => {
        pendingAssetImportTeam = "";
        closeAssetManagementDialog();
    };

    overlay.querySelector(".asset-management-close").onclick = closeDialog;
    overlay.querySelector("#cancelAssetImport").onclick = closeDialog;
    overlay.addEventListener("click", event => { if (event.target === overlay) closeDialog(); });
    teamSelect.onchange = () => { continueButton.disabled = !teamSelect.value; };
    continueButton.onclick = () => {
        if (!teamSelect.value) return;
        pendingAssetImportTeam = teamSelect.value;
        closeAssetManagementDialog();
        excelInput.click();
    };
    if (window.lucide) lucide.createIcons();
    teamSelect.focus();
}

function initializeAssetImport() {

    const importButton = document.getElementById("importExcelBtn");
    const excelInput = document.getElementById("excelFileInput");

    if (!importButton || !excelInput) return;

    importButton.onclick = () => {
        pendingAssetImportTeam = "";
        if (isAssetAdministrator()) {
            openAssetImportDialog(excelInput);
            return;
        }
        excelInput.click();

    };

    excelInput.onchange = async () => {

        if (!excelInput.files.length) return;

        const formData = new FormData();

        formData.append("file", excelInput.files[0]);
        const selectedTeam = pendingAssetImportTeam;
        const uploadUrl = selectedTeam
            ? `/api/assets/upload?service_team=${encodeURIComponent(selectedTeam)}`
            : "/api/assets/upload";

        try {

            importButton.disabled = true;
            importButton.textContent = "Importing...";

            const response = await fetch(uploadUrl, {

                method: "POST",
                body: formData

            });

            const result = await response.json();

            if (!response.ok || result.success === false) {
                const detail = Array.isArray(result.detail)
                    ? result.detail.map(item => item.msg || String(item)).join("\n")
                    : result.detail || result.message || "The spreadsheet could not be imported.";
                throw new Error(detail);
            }

            BioTrackToast.success(
                "Asset import complete",
                `${result.imported} imported · ${result.skipped} skipped · ${result.errors} errors`,
                { duration: 7000 },
            );

            await loadAssets();

        }

        catch (error) {

            console.error(error);

            BioTrackToast.error("Asset import failed", error.message || "The spreadsheet could not be imported.");

        }

        finally {

            importButton.disabled = false;
            importButton.innerHTML = '<i data-lucide="file-up"></i><span>Import</span>';
            if (window.lucide) lucide.createIcons();

            excelInput.value = "";
            pendingAssetImportTeam = "";

        }

    };

}
// ==========================================
// INITIALIZE ADD ASSET BUTTON
// ==========================================

function initializeAddAsset() {

    const addButton = document.getElementById("addAssetBtn");

    if (!addButton) return;

    addButton.onclick = () => {

        navigate("assetForm");

    };

}
// ==========================================
// LOAD ASSETS
// ==========================================

async function loadAssets() {

    try {

        const response = await fetch("/api/assets/");

        const assets = await response.json();

        assetsCache = Array.isArray(assets) ? assets : [];
        const availableIds = new Set(assetsCache.map(asset => Number(asset.id)));
        selectedAssetIds = new Set([...selectedAssetIds].filter(id => availableIds.has(id)));
        populateAssetFilters(assetsCache);
        applyAssetFilters();

    }

    catch (error) {

        console.error(error);

        BioTrackToast.error("Assets unavailable", "Unable to load the asset registry.");

    }

}

function initializeAssetFilters() {
    ["assetSearch", "assetDepartmentFilter", "assetStatusFilter", "assetCategoryFilter"]
        .forEach((id) => {
            const element = document.getElementById(id);
            if (!element) return;
            element.addEventListener(element.tagName === "INPUT" ? "input" : "change", applyAssetFilters);
        });
}

function initializeAssetBulkActions() {
    if (!isAssetAdministrator()) return;

    document.getElementById("assetSelectFilteredBtn")?.addEventListener("click", () => {
        filteredAssets.forEach(asset => selectedAssetIds.add(Number(asset.id)));
        populateAssetTable(filteredAssets);
    });
    document.getElementById("assetClearSelectionBtn")?.addEventListener("click", () => {
        selectedAssetIds.clear();
        populateAssetTable(filteredAssets);
    });
    document.getElementById("assetFindDuplicatesBtn")?.addEventListener("click", openAssetDuplicateReview);
    document.getElementById("assetDeleteSelectedBtn")?.addEventListener("click", () => {
        openAssetDeleteDialog([...selectedAssetIds], "Delete selected assets?");
    });
    document.getElementById("assetSelectPage")?.addEventListener("change", event => {
        toggleVisibleAssetSelection(event.target.checked);
    });
    updateAssetBulkControls();
}

function getVisibleAssetPageItems() {
    return TablePagination.pageItems(filteredAssets, assetsPagination);
}

function toggleAssetSelection(assetId, selected) {
    const id = Number(assetId);
    if (selected) selectedAssetIds.add(id);
    else selectedAssetIds.delete(id);
    updateAssetBulkControls();
}

function toggleVisibleAssetSelection(selected) {
    getVisibleAssetPageItems().forEach(asset => {
        const id = Number(asset.id);
        if (selected) selectedAssetIds.add(id);
        else selectedAssetIds.delete(id);
    });
    populateAssetTable(filteredAssets);
}

function updateAssetBulkControls() {
    if (!isAssetAdministrator()) return;
    const count = selectedAssetIds.size;
    const selectionLabel = document.getElementById("assetSelectionCount");
    if (selectionLabel) selectionLabel.textContent = `${count} selected`;
    const clearButton = document.getElementById("assetClearSelectionBtn");
    const deleteButton = document.getElementById("assetDeleteSelectedBtn");
    if (clearButton) clearButton.disabled = count === 0;
    if (deleteButton) deleteButton.disabled = count === 0;

    const selectPage = document.getElementById("assetSelectPage");
    if (selectPage) {
        const visibleIds = getVisibleAssetPageItems().map(asset => Number(asset.id));
        const selectedVisible = visibleIds.filter(id => selectedAssetIds.has(id)).length;
        selectPage.checked = visibleIds.length > 0 && selectedVisible === visibleIds.length;
        selectPage.indeterminate = selectedVisible > 0 && selectedVisible < visibleIds.length;
    }
}

function initializeAssetModeSwitcher() {
    document.querySelectorAll(".asset-mode-options button").forEach((button) => {
        button.addEventListener("click", () => {
            selectedAssetServiceTeam = button.dataset.assetTeam || "";
            document.querySelectorAll(".asset-mode-options button").forEach((option) => {
                const active = option === button;
                option.classList.toggle("is-active", active);
                option.setAttribute("aria-selected", String(active));
            });
            assetsPagination.page = 1;
            applyAssetFilters();
        });
    });
}

function populateAssetFilters(assets) {
    const setup = (id, values, allLabel) => {
        const select = document.getElementById(id);
        if (!select) return;
        select.innerHTML = `<option value="">${escapeHTML(allLabel)}</option>${values
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b))
            .map((value) => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`)
            .join("")}`;
    };

    setup("assetDepartmentFilter", [...new Set(assets.map(asset => asset.department))], "All Departments");
    setup("assetStatusFilter", [...new Set(assets.map(asset => asset.status))], "All Status");
    setup("assetCategoryFilter", [...new Set(assets.map(asset => asset.classification || asset.category))], "All Categories");
}

function applyAssetFilters() {
    const search = (document.getElementById("assetSearch")?.value || "").trim().toLowerCase();
    const department = document.getElementById("assetDepartmentFilter")?.value || "";
    const status = document.getElementById("assetStatusFilter")?.value || "";
    const category = document.getElementById("assetCategoryFilter")?.value || "";

    filteredAssets = assetsCache.filter((asset) => {
        const searchable = [
            asset.equipment_no,
            asset.equipment_name,
            asset.department,
            asset.service_team,
            asset.manufacturer,
            asset.model,
            asset.classification || asset.category,
        ].filter(Boolean).join(" ").toLowerCase();

        return (!search || searchable.includes(search))
            && (!department || asset.department === department)
            && (!selectedAssetServiceTeam || asset.service_team === selectedAssetServiceTeam)
            && (!status || asset.status === status)
            && (!category || (asset.classification || asset.category) === category);
    });

    assetsPagination.page = 1;
    populateAssetTable(filteredAssets);
    updateAssetKPIs(
        assetsCache.filter(asset => !selectedAssetServiceTeam || asset.service_team === selectedAssetServiceTeam)
    );
}


// ==========================================
// POPULATE TABLE
// ==========================================

function populateAssetTable(assets) {

    const table = document.getElementById("assetTableBody");
    const resultCount = document.getElementById("assetResultCount");

    if (!table) return;
    if (resultCount) resultCount.textContent = String(assets.length);

    if (assets.length === 0) {

        table.innerHTML = `
            <tr>
                <td colspan="${isAssetAdministrator() ? 10 : 9}" class="empty-table">
                    <span class="empty-table-icon"><i data-lucide="search-x"></i></span>
                    <strong>No matching assets</strong>
                    <small>Try adjusting the search or filters above.</small>
                </td>
            </tr>
        `;

        TablePagination.render(
            document.getElementById("assetsPagination"),
            assetsPagination,
            0,
            () => populateAssetTable(filteredAssets),
            "assets"
        );

        updateAssetBulkControls();
        if (window.lucide) lucide.createIcons();

        return;

    }

    table.innerHTML = "";

    const pageItems = TablePagination.pageItems(assets, assetsPagination);

    pageItems.forEach(asset => {

        const statusValue = String(asset.status || "Unknown");
        const statusTone = /active|operational|working|available/i.test(statusValue)
            ? "is-active"
            : /repair|breakdown|inactive|out of service/i.test(statusValue)
                ? "is-alert"
                : /maintenance|service|due|pending/i.test(statusValue)
                    ? "is-warning"
                    : "is-neutral";

        table.innerHTML += `
            <tr class="asset-data-row">

                ${isAssetAdministrator() ? `<td class="asset-select-column"><input type="checkbox" ${selectedAssetIds.has(Number(asset.id)) ? "checked" : ""} onchange="toggleAssetSelection(${Number(asset.id)}, this.checked)" aria-label="Select ${escapeHTML(asset.equipment_name || asset.asset_code || "asset")}"></td>` : ""}

                <td><span class="asset-code">${escapeHTML(asset.equipment_no ?? "—")}</span></td>

                <td><div class="asset-name-cell"><span class="asset-name-icon"><i data-lucide="monitor-cog"></i></span><span><strong>${escapeHTML(asset.equipment_name || "Unnamed equipment")}</strong><small>${escapeHTML(asset.classification || asset.category || "General equipment")}</small></span></div></td>

                <td><span class="asset-department-cell"><i data-lucide="map-pin"></i>${escapeHTML(asset.department || "Unassigned")}</span></td>

                <td><span class="asset-team-badge is-${String(asset.service_team || "Biomedical").toLowerCase()}">${escapeHTML(asset.service_team || "Biomedical")}</span></td>

                <td>${escapeHTML(asset.manufacturer || "—")}</td>

                <td>${escapeHTML(asset.model || "—")}</td>

                <td><span class="asset-status-badge ${statusTone}"><span></span>${escapeHTML(statusValue)}</span></td>

                <td>${asset.qr_generated || canManageAssetQR() ? `<button type="button" class="asset-qr-table-button ${asset.qr_generated ? "is-ready" : ""}" onclick="openAssetQRGenerator(${Number(asset.id)})"><i data-lucide="qr-code"></i><span>${asset.qr_generated ? "View QR" : "Generate"}</span></button>` : '<span class="asset-qr-unavailable">Not generated</span>'}</td>

                <td>

                    <button
                        class="btn-open-asset"
                        aria-label="Open ${escapeHTML(asset.equipment_name || asset.equipment_no || "asset")}"
                        onclick="openAssetPage(${Number(asset.id)})">
                        <i data-lucide="arrow-up-right"></i><span>Open</span>
                    </button>

                </td>

            </tr>
        `;

    });

    TablePagination.render(
        document.getElementById("assetsPagination"),
        assetsPagination,
        assets.length,
        () => populateAssetTable(filteredAssets),
        "assets"
    );

    updateAssetBulkControls();

    if (window.lucide) lucide.createIcons();

}

function normalizeAssetDuplicateValue(value) {
    const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
    return ["", "-", "na", "n/a", "none", "null", "unknown"].includes(normalized) ? "" : normalized;
}

function findDuplicateAssetGroups() {
    const parent = new Map(assetsCache.map(asset => [Number(asset.id), Number(asset.id)]));
    const reasonsByPair = [];
    const find = id => {
        const current = parent.get(id);
        if (current === id) return id;
        const root = find(current);
        parent.set(id, root);
        return root;
    };
    const union = (left, right) => {
        const leftRoot = find(left);
        const rightRoot = find(right);
        if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
    };

    const duplicateMaps = [
        ["Asset code", asset => normalizeAssetDuplicateValue(asset.asset_code)],
        ["Equipment number", asset => normalizeAssetDuplicateValue(asset.equipment_no)],
        ["Serial number", asset => normalizeAssetDuplicateValue(asset.serial_number)],
    ];

    duplicateMaps.forEach(([label, keyFor]) => {
        const groups = new Map();
        assetsCache.forEach(asset => {
            const key = keyFor(asset);
            if (!key) return;
            const matches = groups.get(key) || [];
            matches.push(Number(asset.id));
            groups.set(key, matches);
        });
        groups.forEach(ids => {
            if (ids.length < 2) return;
            ids.slice(1).forEach(id => union(ids[0], id));
            reasonsByPair.push({ ids, label });
        });
    });

    // When identifiers are missing, an exact match across the descriptive
    // equipment fields is presented as a possible duplicate for manual review.
    const detailGroups = new Map();
    assetsCache.forEach(asset => {
        if (normalizeAssetDuplicateValue(asset.serial_number) || normalizeAssetDuplicateValue(asset.equipment_no)) return;
        const parts = [asset.equipment_name, asset.manufacturer, asset.model, asset.department, asset.location]
            .map(normalizeAssetDuplicateValue);
        if (!parts[0] || !parts[2] || parts.filter(Boolean).length < 3) return;
        const key = parts.join("|");
        const matches = detailGroups.get(key) || [];
        matches.push(Number(asset.id));
        detailGroups.set(key, matches);
    });
    detailGroups.forEach(ids => {
        if (ids.length < 2) return;
        ids.slice(1).forEach(id => union(ids[0], id));
        reasonsByPair.push({ ids, label: "Matching equipment details" });
    });

    const components = new Map();
    assetsCache.forEach(asset => {
        const id = Number(asset.id);
        const root = find(id);
        const component = components.get(root) || [];
        component.push(asset);
        components.set(root, component);
    });

    return [...components.values()]
        .filter(group => group.length > 1)
        .map(group => {
            const groupIds = new Set(group.map(asset => Number(asset.id)));
            const reasons = [...new Set(reasonsByPair
                .filter(entry => entry.ids.some(id => groupIds.has(id)))
                .map(entry => entry.label))];
            return {
                assets: group.sort((a, b) => Number(a.id) - Number(b.id)),
                reasons,
            };
        })
        .sort((a, b) => Number(a.assets[0].id) - Number(b.assets[0].id));
}

function closeAssetManagementDialog() {
    document.getElementById("assetManagementOverlay")?.remove();
    document.body.classList.remove("asset-management-dialog-open");
}

function openAssetDuplicateReview() {
    const groups = findDuplicateAssetGroups();
    if (!groups.length) {
        BioTrackToast.success("No duplicates found", "Asset codes, equipment numbers and serial numbers are unique.");
        return;
    }

    closeAssetManagementDialog();
    const overlay = document.createElement("div");
    overlay.id = "assetManagementOverlay";
    overlay.className = "asset-management-overlay";
    overlay.innerHTML = `
        <section class="asset-management-dialog asset-duplicate-dialog" role="dialog" aria-modal="true" aria-labelledby="assetDuplicateTitle">
            <header><span><i data-lucide="copy-check"></i></span><div><h2 id="assetDuplicateTitle">Review duplicate assets</h2><p>BioTrack will keep the oldest record in each group. Uncheck anything that should remain.</p></div><button type="button" class="asset-management-close" aria-label="Close"><i data-lucide="x"></i></button></header>
            <div class="asset-duplicate-list">
                ${groups.map((group, groupIndex) => `
                    <article class="asset-duplicate-group">
                        <div class="asset-duplicate-group-heading"><strong>Duplicate group ${groupIndex + 1}</strong><span>${escapeHTML(group.reasons.join(" · "))}</span></div>
                        ${group.assets.map((asset, index) => `
                            <label class="asset-duplicate-row ${index === 0 ? "is-kept" : ""}">
                                <input type="checkbox" class="asset-duplicate-choice" value="${Number(asset.id)}" ${index === 0 ? "disabled" : "checked"}>
                                <span><strong>${escapeHTML(asset.equipment_name || "Unnamed equipment")}</strong><small>${escapeHTML(asset.asset_code || asset.equipment_no || `Asset ${asset.id}`)} · ${escapeHTML(asset.serial_number || "No serial number")} · ${escapeHTML(asset.service_team || "Biomedical")}</small></span>
                                <em>${index === 0 ? "Keep" : "Remove"}</em>
                            </label>
                        `).join("")}
                    </article>
                `).join("")}
            </div>
            <footer><button type="button" class="asset-dialog-secondary" id="cancelDuplicateReview">Cancel</button><button type="button" class="asset-dialog-danger" id="removeDuplicateAssets"><i data-lucide="trash-2"></i> Remove selected duplicates</button></footer>
        </section>
    `;
    document.body.appendChild(overlay);
    document.body.classList.add("asset-management-dialog-open");
    overlay.querySelector(".asset-management-close").onclick = closeAssetManagementDialog;
    overlay.querySelector("#cancelDuplicateReview").onclick = closeAssetManagementDialog;
    overlay.addEventListener("click", event => { if (event.target === overlay) closeAssetManagementDialog(); });
    overlay.querySelector("#removeDuplicateAssets").onclick = () => {
        const duplicateIds = [...overlay.querySelectorAll(".asset-duplicate-choice:checked")]
            .map(input => Number(input.value));
        if (!duplicateIds.length) {
            BioTrackToast.warning("No duplicates selected", "Select at least one duplicate record to remove.");
            return;
        }
        closeAssetManagementDialog();
        openAssetDeleteDialog(duplicateIds, "Remove selected duplicates?");
    };
    if (window.lucide) lucide.createIcons();
}

function openAssetDeleteDialog(assetIds, title = "Delete selected assets?") {
    const ids = [...new Set(assetIds.map(Number).filter(Boolean))];
    if (!ids.length) return;
    const assets = ids.map(id => assetsCache.find(asset => Number(asset.id) === id)).filter(Boolean);

    closeAssetManagementDialog();
    const overlay = document.createElement("div");
    overlay.id = "assetManagementOverlay";
    overlay.className = "asset-management-overlay";
    overlay.innerHTML = `
        <section class="asset-management-dialog asset-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="assetDeleteTitle" aria-describedby="assetDeleteDescription">
            <div class="asset-delete-icon"><i data-lucide="trash-2"></i></div>
            <h2 id="assetDeleteTitle">${escapeHTML(title)}</h2>
            <p id="assetDeleteDescription">${ids.length} asset record${ids.length === 1 ? "" : "s"} and related PM details will be permanently deleted.</p>
            <div class="asset-delete-preview">${assets.slice(0, 6).map(asset => `<span><strong>${escapeHTML(asset.equipment_name || "Unnamed equipment")}</strong><small>${escapeHTML(asset.asset_code || asset.equipment_no || `Asset ${asset.id}`)}</small></span>`).join("")}${assets.length > 6 ? `<em>+ ${assets.length - 6} more</em>` : ""}</div>
            <footer><button type="button" class="asset-dialog-secondary" id="cancelAssetDelete">Cancel</button><button type="button" class="asset-dialog-danger" id="confirmAssetDelete"><i data-lucide="trash-2"></i> Delete ${ids.length}</button></footer>
        </section>
    `;
    document.body.appendChild(overlay);
    document.body.classList.add("asset-management-dialog-open");
    overlay.querySelector("#cancelAssetDelete").onclick = closeAssetManagementDialog;
    overlay.addEventListener("click", event => { if (event.target === overlay) closeAssetManagementDialog(); });
    overlay.querySelector("#confirmAssetDelete").onclick = () => deleteSelectedAssets(ids);
    if (window.lucide) lucide.createIcons();
}

async function deleteSelectedAssets(assetIds) {
    const button = document.getElementById("confirmAssetDelete");
    if (button) {
        button.disabled = true;
        button.textContent = "Deleting…";
    }
    try {
        const response = await fetch("/api/assets/bulk-delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ asset_ids: assetIds }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) throw new Error(result.detail || "The selected assets could not be deleted.");
        result.deleted_ids.forEach(id => selectedAssetIds.delete(Number(id)));
        closeAssetManagementDialog();
        BioTrackToast.success("Assets deleted", `${result.deleted} asset record${result.deleted === 1 ? " was" : "s were"} removed.`);
        await loadAssets();
    } catch (error) {
        BioTrackToast.error("Assets not deleted", error.message || "The selected assets could not be deleted.");
        if (button) {
            button.disabled = false;
            button.innerHTML = `<i data-lucide="trash-2"></i> Delete ${assetIds.length}`;
            if (window.lucide) lucide.createIcons();
        }
    }
}

async function openAssetQRGenerator(assetId = null) {
    const canGenerate = canManageAssetQR();
    let assets = assetsCache;
    if (!assets.length) {
        try {
            const response = await fetch("/api/assets/", { cache: "no-store" });
            if (!response.ok) throw new Error("Unable to load assets.");
            assets = await response.json();
            assetsCache = Array.isArray(assets) ? assets : [];
        } catch (error) {
            BioTrackToast.error("Assets unavailable", error.message || "Unable to load assets.");
            return;
        }
    }

    const modalRoot = document.createElement("div");
    modalRoot.className = "asset-qr-overlay";
    modalRoot.innerHTML = `
        <section class="asset-qr-dialog" role="dialog" aria-modal="true" aria-labelledby="assetQrTitle">
            <header class="asset-qr-dialog-header"><span><i data-lucide="qr-code"></i></span><div><h2 id="assetQrTitle">Asset QR code</h2><p>Select an asset, then generate a printable equipment QR code.</p></div><button type="button" class="asset-qr-close" aria-label="Close"><i data-lucide="x"></i></button></header>
            <div class="asset-qr-dialog-body">
                <label class="asset-qr-select-label"><span>Hospital asset</span><select id="assetQrSelect"><option value="">Choose an asset</option>${assetsCache.map(asset => `<option value="${Number(asset.id)}" ${Number(asset.id) === Number(assetId) ? "selected" : ""}>${escapeHTML(asset.asset_code || asset.equipment_no || `Asset ${asset.id}`)} — ${escapeHTML(asset.equipment_name || "Equipment")}</option>`).join("")}</select></label>
                <div id="assetQrPreview" class="asset-qr-preview"><span><i data-lucide="scan-line"></i></span><strong>No asset selected</strong><p>Choose an asset to create or view its QR code.</p></div>
            </div>
            <footer class="asset-qr-dialog-footer"><button type="button" class="asset-qr-cancel secondary-btn">${canGenerate ? "Cancel" : "Close"}</button>${canGenerate ? '<button type="button" class="asset-qr-generate primary-btn" disabled><i data-lucide="qr-code"></i><span>Generate QR</span></button>' : ""}</footer>
        </section>`;
    document.body.appendChild(modalRoot);
    document.body.classList.add("asset-qr-open");

    const close = () => { modalRoot.remove(); document.body.classList.remove("asset-qr-open"); };
    const select = modalRoot.querySelector("#assetQrSelect");
    const generate = modalRoot.querySelector(".asset-qr-generate");
    const setGenerateLabel = label => {
        const labelElement = generate?.querySelector("span");
        if (labelElement) labelElement.textContent = label;
    };
    modalRoot.querySelector(".asset-qr-close").onclick = close;
    modalRoot.querySelector(".asset-qr-cancel").onclick = close;
    modalRoot.addEventListener("click", event => { if (event.target === modalRoot) close(); });
    select.onchange = () => {
        if (generate) generate.disabled = !select.value;
        const asset = assetsCache.find(item => Number(item.id) === Number(select.value));
        const preview = modalRoot.querySelector("#assetQrPreview");
        if (asset?.qr_code) {
            preview.innerHTML = `<img src="${escapeHTML(asset.qr_code)}" alt="QR code for ${escapeHTML(asset.equipment_name || "asset")}"><strong>${escapeHTML(asset.asset_code || asset.equipment_no || "Asset QR")}</strong><p>${escapeHTML(asset.equipment_name || "Equipment")}</p><a href="${escapeHTML(asset.qr_code)}" download><i data-lucide="download"></i> Download QR</a>`;
            setGenerateLabel("Regenerate QR");
        } else {
            preview.innerHTML = asset ? `<span><i data-lucide="monitor-cog"></i></span><strong>${escapeHTML(asset.equipment_name || "Equipment")}</strong><p>${escapeHTML(asset.asset_code || asset.equipment_no || "No asset code")} · ${escapeHTML(asset.department || "No department")}</p>` : '<span><i data-lucide="scan-line"></i></span><strong>No asset selected</strong><p>Choose an asset to create or view its QR code.</p>';
            setGenerateLabel("Generate QR");
        }
        if (window.lucide) lucide.createIcons();
    };
    if (generate) generate.onclick = async () => {
        if (!select.value) return;
        generate.disabled = true;
        generate.classList.add("is-loading");
        setGenerateLabel("Generating…");
        try {
            const response = await fetch(`/api/qr/generate/${Number(select.value)}`, { method: "POST" });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.detail || "Unable to generate QR code.");
            const asset = assetsCache.find(item => Number(item.id) === Number(select.value));
            modalRoot.querySelector("#assetQrPreview").innerHTML = `<img src="${escapeHTML(result.qr_url)}?t=${Date.now()}" alt="QR code for ${escapeHTML(asset?.equipment_name || "asset")}"><strong>${escapeHTML(asset?.asset_code || asset?.equipment_no || "Asset QR")}</strong><p>${escapeHTML(asset?.equipment_name || "Equipment")}</p><a href="${escapeHTML(result.qr_url)}" download><i data-lucide="download"></i> Download QR</a>`;
            setGenerateLabel("Regenerate QR");
            const cachedAsset = assetsCache.find(item => Number(item.id) === Number(select.value));
            if (cachedAsset) {
                cachedAsset.qr_generated = true;
                cachedAsset.qr_code = result.qr_url;
            }
            // The generator is shared by the registry and the asset-details page.
            // Registry KPI/table elements do not exist when this modal is opened
            // from Asset Details, so only refresh filters when that view is mounted.
            if (document.getElementById("assetTableBody")) applyAssetFilters();
            BioTrackToast.success("QR code ready", "The equipment QR code was generated successfully.");
        } catch (error) {
            BioTrackToast.error("QR generation failed", error.message || "Unable to generate QR code.");
            setGenerateLabel("Generate QR");
        } finally {
            generate.disabled = false;
            generate.classList.remove("is-loading");
            if (window.lucide) lucide.createIcons();
        }
    };
    if (select.value) select.onchange();
    if (window.lucide) lucide.createIcons();
}


// ==========================================
// UPDATE KPI CARDS
// ==========================================

function updateAssetKPIs(assets) {

    const modeLabel = selectedAssetServiceTeam || "All teams";
    document.querySelectorAll(".asset-kpi-mode").forEach(element => {
        element.textContent = modeLabel;
    });
    const modeTitle = document.getElementById("assetModeTitle");
    if (modeTitle) modeTitle.textContent = selectedAssetServiceTeam
        ? `${selectedAssetServiceTeam} assets`
        : "All engineering assets";

    document.getElementById("totalAssets").textContent =
        assets.length;

    document.getElementById("activeAssets").textContent =
        assets.filter(asset => asset.status === "Active").length;

    document.getElementById("criticalAssets").textContent =
        assets.filter(asset => asset.status === "Critical").length;

    document.getElementById("pmDue").textContent = 0;

    document.getElementById("calibrationDue").textContent = 0;

    document.getElementById("warrantyDue").textContent = 0;

}
