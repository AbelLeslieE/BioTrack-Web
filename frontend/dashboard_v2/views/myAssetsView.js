let departmentAssets = [];
let filteredDepartmentAssets = [];
const departmentAssetsPagination = { page: 1, pageSize: 10 };

async function renderMyAssets() {
    pageContent.innerHTML = `
        <div class="department-module-page">
            <header class="department-module-header">
                <div>
                    <span class="department-module-kicker"><i data-lucide="building-2"></i> Department Assets</span>
                    <h1>My Assets</h1>
                    <p id="myAssetsDescription">View the equipment assigned to your department.</p>
                </div>
                <div class="department-module-actions">
                    <button id="refreshMyAssets" class="department-action-button"><i data-lucide="refresh-cw"></i> Refresh</button>
                </div>
            </header>

            <section class="department-summary-grid">
                <article class="department-summary-card"><span>Total Assets</span><strong id="myAssetsTotal">0</strong></article>
                <article class="department-summary-card is-success"><span>Active</span><strong id="myAssetsActive">0</strong></article>
                <article class="department-summary-card is-warning"><span>Needs Attention</span><strong id="myAssetsAttention">0</strong></article>
            </section>

            <section class="department-toolbar">
                <label class="department-search"><i data-lucide="search"></i><input id="myAssetsSearch" type="search" placeholder="Search asset ID, equipment, manufacturer or location..."></label>
                <select id="myAssetsStatus" aria-label="Filter assets by status"><option value="">All Statuses</option></select>
                <select id="myAssetsType" aria-label="Filter assets by type"><option value="">All Types</option></select>
            </section>

            <section class="department-table-card">
                <table class="department-table">
                    <thead><tr><th>Asset ID</th><th>Equipment</th><th>Type</th><th>Manufacturer / Model</th><th>Location</th><th>Status</th><th></th></tr></thead>
                    <tbody id="myAssetsBody"><tr><td colspan="7">Loading department assets...</td></tr></tbody>
                </table>
            </section>
            <div id="myAssetsPagination" class="table-pagination"></div>
        </div>
    `;

    document.getElementById("refreshMyAssets").addEventListener("click", loadMyAssets);
    document.getElementById("myAssetsSearch").addEventListener("input", applyMyAssetsFilters);
    document.getElementById("myAssetsStatus").addEventListener("change", applyMyAssetsFilters);
    document.getElementById("myAssetsType").addEventListener("change", applyMyAssetsFilters);
    if (window.lucide) lucide.createIcons();
    await loadMyAssets();
}

async function loadMyAssets() {
    const body = document.getElementById("myAssetsBody");
    try {
        const response = await fetch("/api/assets/department/mine");
        if (!response.ok) throw new Error("Unable to load your department's assets.");
        departmentAssets = await response.json();
        if (!Array.isArray(departmentAssets)) departmentAssets = [];
        populateMyAssetsFilters();
        updateMyAssetsSummary();
        applyMyAssetsFilters(false);
    } catch (error) {
        console.error(error);
        if (body) body.innerHTML = `<tr><td colspan="7">${error.message}</td></tr>`;
    }
}

function populateMyAssetsFilters() {
    const configure = (id, values, label) => {
        const select = document.getElementById(id);
        if (!select) return;
        const previous = select.value;
        const options = [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
        select.innerHTML = `<option value="">${label}</option>${options.map(value => `<option value="${escapeMyAssetsHtml(value)}">${escapeMyAssetsHtml(value)}</option>`).join("")}`;
        if (options.includes(previous)) select.value = previous;
    };
    configure("myAssetsStatus", departmentAssets.map(asset => asset.status), "All Statuses");
    configure("myAssetsType", departmentAssets.map(asset => asset.classification || asset.equipment_type), "All Types");
}

function updateMyAssetsSummary() {
    const active = departmentAssets.filter(asset => (asset.status || "").toLowerCase() === "active").length;
    document.getElementById("myAssetsTotal").textContent = departmentAssets.length;
    document.getElementById("myAssetsActive").textContent = active;
    document.getElementById("myAssetsAttention").textContent = departmentAssets.length - active;
}

function applyMyAssetsFilters(resetPage = true) {
    const search = (document.getElementById("myAssetsSearch")?.value || "").trim().toLowerCase();
    const status = document.getElementById("myAssetsStatus")?.value || "";
    const type = document.getElementById("myAssetsType")?.value || "";
    filteredDepartmentAssets = departmentAssets.filter(asset => {
        const searchable = [asset.asset_code, asset.equipment_no, asset.equipment_name, asset.classification, asset.equipment_type, asset.manufacturer, asset.model, asset.location]
            .filter(Boolean).join(" ").toLowerCase();
        return (!search || searchable.includes(search))
            && (!status || asset.status === status)
            && (!type || (asset.classification || asset.equipment_type) === type);
    });
    if (resetPage) departmentAssetsPagination.page = 1;
    renderMyAssetsTable();
}

function renderMyAssetsTable() {
    const body = document.getElementById("myAssetsBody");
    if (!body) return;
    if (!filteredDepartmentAssets.length) {
        body.innerHTML = '<tr><td colspan="7">No assets match your search or filters.</td></tr>';
        TablePagination.render(document.getElementById("myAssetsPagination"), departmentAssetsPagination, 0, renderMyAssetsTable, "assets");
        return;
    }
    const assets = TablePagination.pageItems(filteredDepartmentAssets, departmentAssetsPagination);
    body.innerHTML = assets.map(asset => `
        <tr>
            <td><strong>${escapeMyAssetsHtml(asset.asset_code || asset.equipment_no || "-")}</strong></td>
            <td>${escapeMyAssetsHtml(asset.equipment_name || "-")}</td>
            <td>${escapeMyAssetsHtml(asset.classification || asset.equipment_type || "-")}</td>
            <td>${escapeMyAssetsHtml([asset.manufacturer, asset.model].filter(Boolean).join(" / ") || "-")}</td>
            <td>${escapeMyAssetsHtml(asset.location || "-")}</td>
            <td><span class="department-status ${departmentStatusClass(asset.status)}">${escapeMyAssetsHtml(asset.status || "Unknown")}</span></td>
            <td><button class="department-view-button" data-asset-id="${asset.id}">View</button></td>
        </tr>
    `).join("");
    body.querySelectorAll("[data-asset-id]").forEach(button => button.addEventListener("click", () => {
        currentAssetId = Number(button.dataset.assetId);
        navigate("assetDetails");
    }));
    TablePagination.render(document.getElementById("myAssetsPagination"), departmentAssetsPagination, filteredDepartmentAssets.length, renderMyAssetsTable, "assets");
}

function departmentStatusClass(status) {
    return (status || "unknown").toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
}

function escapeMyAssetsHtml(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
