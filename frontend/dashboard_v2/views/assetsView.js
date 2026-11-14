
let assetsCache = [];
let filteredAssets = [];
let selectedAssetServiceTeam = "";
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

    pageContent.innerHTML = `


    <div class="asset-page">

        <!-- ==========================================
             PAGE HEADER
        =========================================== -->



        <div class="asset-hero">

            <div class="asset-hero-left">

                <span class="asset-badge">

                    ${registryCopy.badge}

                </span>

                <h1>

                    Asset Management

                </h1>

                <p>

                    ${registryCopy.description}

                </p>

            </div>

            <div class="asset-hero-right">

            <div class="quick-actions-card">

                <div class="quick-actions-header">

                    <h3>Quick Actions</h3>

                    <p>Frequently used asset operations</p>

                </div>

                <div class="asset-actions">

                    <button
                        id="addAssetBtn"
                        class="btn-primary hero-btn">

                        + Add New Asset

                    </button>

                    ${canManageAssetQR() ? `<button
                        id="assetQrBtn"
                        class="btn-secondary hero-btn">

                        <i data-lucide="qr-code"></i> Generate QR

                    </button>` : ""}

                    <button
                        id="importExcelBtn"
                        class="btn-secondary hero-btn">

                        📄 Import Excel

                    </button>

                    ${isAssetAdministrator() ? `
                        <label class="asset-import-team-label" for="assetImportTeam">
                            <span>Excel import team</span>
                            <select id="assetImportTeam">
                                <option value="">Select service team</option>
                                <option value="Biomedical">Biomedical</option>
                                <option value="Electrical">Electrical</option>
                                <option value="IT">IT</option>
                            </select>
                        </label>
                    ` : ""}

                    <button
                        id="exportAssetBtn"
                        class="btn-secondary hero-btn">

                        ⬇ Export

                    </button>

                </div>

                <input
                    id="excelFileInput"
                    type="file"
                    accept=".xlsx,.xls"
                    hidden>

            </div>

        </div>

        </div>


        ${isAssetAdministrator() ? `
            <section class="asset-mode-switcher" aria-label="Asset service-team mode">
                <div>
                    <span>Asset mode</span>
                    <strong id="assetModeTitle">All engineering assets</strong>
                </div>
                <div class="asset-mode-options" role="tablist" aria-label="Filter assets by service team">
                    <button type="button" class="is-active" data-asset-team="" role="tab" aria-selected="true">All</button>
                    <button type="button" data-asset-team="Biomedical" role="tab" aria-selected="false">Biomedical</button>
                    <button type="button" data-asset-team="Electrical" role="tab" aria-selected="false">Electrical</button>
                    <button type="button" data-asset-team="IT" role="tab" aria-selected="false">IT</button>
                </div>
            </section>
        ` : ""}


        <!-- ==========================================
             KPI CARDS
        =========================================== -->

        <div class="asset-kpis">

            <div class="asset-card total-card">

                <div class="asset-card-icon">

                    <i data-lucide="package"></i>

                </div>

                <div class="asset-card-content">

                    <h4>Total Assets</h4>

                    <span class="asset-kpi-mode">All teams</span>

                    <h2 id="totalAssets">0</h2>

                    <p>Hospital Inventory</p>

                </div>

            </div>

            <div class="asset-card active-card">

                <div class="asset-card-icon">

                    <i data-lucide="shield-check"></i>

                </div>

                <div class="asset-card-content">

                    <h4>Active Assets</h4>

                    <span class="asset-kpi-mode">All teams</span>

                    <h2 id="activeAssets">0</h2>

                    <p>Operational Equipment</p>

                </div>

            </div>

            <div class="asset-card pm-card">

                <div class="asset-card-icon">

                    <i data-lucide="calendar-check"></i>

                </div>

                <div class="asset-card-content">

                    <h4>PM Due</h4>

                    <span class="asset-kpi-mode">All teams</span>

                    <h2 id="pmDue">0</h2>

                    <p>Scheduled Maintenance</p>

                </div>

            </div>

            <div class="asset-card calibration-card">

                <div class="asset-card-icon">

                    <i data-lucide="flask-conical"></i>

                </div>

                <div class="asset-card-content">

                    <h4>Calibration Due</h4>

                    <span class="asset-kpi-mode">All teams</span>

                    <h2 id="calibrationDue">0</h2>

                    <p>Calibration Schedule</p>

                </div>

            </div>

            <div class="asset-card warranty-card">

                <div class="asset-card-icon">

                    <i data-lucide="shield"></i>

                </div>

                <div class="asset-card-content">

                    <h4>Warranty</h4>

                    <span class="asset-kpi-mode">All teams</span>

                    <h2 id="warrantyDue">0</h2>

                    <p>Expiring Soon</p>

                </div>

            </div>

            <div class="asset-card critical-card">

                <div class="asset-card-icon">

                    <i data-lucide="heart-pulse"></i>

                </div>

                <div class="asset-card-content">

                    <h4>Critical Assets</h4>

                    <span class="asset-kpi-mode">All teams</span>

                    <h2 id="criticalAssets">0</h2>

                    <p>Life Support</p>

                </div>

            </div>

        </div>


        <!-- ==========================================
             FILTER BAR
        =========================================== -->

        <div class="asset-toolbar">

            <input
                id="assetSearch"
                type="text"
                placeholder="🔍 Search equipment..."
                class="asset-search"
            >

            <select id="assetDepartmentFilter">

                <option>All Departments</option>

            </select>

            <select id="assetStatusFilter">

                <option>All Status</option>

            </select>

            <select id="assetCategoryFilter">

                <option>All Categories</option>

            </select>

        </div>


        <!-- ==========================================
             TABLE
        =========================================== -->

        <div class="asset-table-container">

            <table class="asset-table">

                <thead>

                    <tr>

                        <th>Equipment No</th>

                        <th>Equipment Name</th>

                        <th>Department</th>

                        <th>Service Team</th>

                        <th>Manufacturer</th>

                        <th>Model</th>

                        <th>Status</th>

                        <th>QR</th>

                        <th>Action</th>

                    </tr>

                </thead>

                <tbody id="assetTableBody">

                    <tr>

                        <td colspan="9" class="empty-table">

                            No assets found.

                            <br><br>

                            Import an Excel sheet to begin.

                        </td>

                    </tr>

                </tbody>

            </table>

        </div>

        <div id="assetsPagination" class="table-pagination"></div>

    </div>

    `;
    initializeAssetImport();
    initializeAddAsset();
    initializeAssetQR();
    initializeAssetModeSwitcher();
    initializeAssetFilters();
    loadAssets();
}

function initializeAssetQR() {
    const button = document.getElementById("assetQrBtn");
    if (button) button.onclick = () => openAssetQRGenerator();
}

// ==========================================
// INITIALIZE IMPORT BUTTON
// ==========================================

function initializeAssetImport() {

    const importButton = document.getElementById("importExcelBtn");
    const excelInput = document.getElementById("excelFileInput");

    if (!importButton || !excelInput) return;

    importButton.onclick = () => {

        const teamSelect = document.getElementById("assetImportTeam");
        if (isAssetAdministrator() && !teamSelect?.value) {
            alert("Select Biomedical, Electrical or IT before importing the spreadsheet.");
            teamSelect?.focus();
            return;
        }

        excelInput.click();

    };

    excelInput.onchange = async () => {

        if (!excelInput.files.length) return;

        const formData = new FormData();

        formData.append("file", excelInput.files[0]);
        const selectedTeam = document.getElementById("assetImportTeam")?.value;
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

            alert(
                `Imported : ${result.imported}\n` +
                `Skipped : ${result.skipped}\n` +
                `Errors : ${result.errors}`
            );

            await loadAssets();

        }

        catch (error) {

            console.error(error);

            alert(error.message || "Import failed.");

        }

        finally {

            importButton.disabled = false;
            importButton.innerHTML = "📄 Import Excel";

            excelInput.value = "";

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
        populateAssetFilters(assetsCache);
        applyAssetFilters();

    }

    catch (error) {

        console.error(error);

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

    if (!table) return;

    if (assets.length === 0) {

        table.innerHTML = `
            <tr>
                <td colspan="9" class="empty-table">
                    No assets found.
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

        return;

    }

    table.innerHTML = "";

    const pageItems = TablePagination.pageItems(assets, assetsPagination);

    pageItems.forEach(asset => {

        table.innerHTML += `
            <tr>

                <td>${escapeHTML(asset.equipment_no ?? "")}</td>

                <td>${escapeHTML(asset.equipment_name ?? "")}</td>

                <td>${escapeHTML(asset.department ?? "")}</td>

                <td><span class="asset-team-badge is-${String(asset.service_team || "Biomedical").toLowerCase()}">${escapeHTML(asset.service_team || "Biomedical")}</span></td>

                <td>${escapeHTML(asset.manufacturer ?? "")}</td>

                <td>${escapeHTML(asset.model ?? "")}</td>

                <td>${escapeHTML(asset.status ?? "")}</td>

                <td>${asset.qr_generated || canManageAssetQR() ? `<button type="button" class="asset-qr-table-button ${asset.qr_generated ? "is-ready" : ""}" onclick="openAssetQRGenerator(${Number(asset.id)})"><i data-lucide="qr-code"></i><span>${asset.qr_generated ? "View QR" : "Generate"}</span></button>` : '<span class="asset-qr-unavailable">Not generated</span>'}</td>

                <td>

                    <button
                        class="btn-open-asset"
                        onclick="openAssetPage(${Number(asset.id)})">

                        👁 View Asset

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

    if (window.lucide) lucide.createIcons();

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
            alert(error.message || "Unable to load assets.");
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
    modalRoot.querySelector(".asset-qr-close").onclick = close;
    modalRoot.querySelector(".asset-qr-cancel").onclick = close;
    modalRoot.addEventListener("click", event => { if (event.target === modalRoot) close(); });
    select.onchange = () => {
        if (generate) generate.disabled = !select.value;
        const asset = assetsCache.find(item => Number(item.id) === Number(select.value));
        const preview = modalRoot.querySelector("#assetQrPreview");
        if (asset?.qr_code) {
            preview.innerHTML = `<img src="${escapeHTML(asset.qr_code)}" alt="QR code for ${escapeHTML(asset.equipment_name || "asset")}"><strong>${escapeHTML(asset.asset_code || asset.equipment_no || "Asset QR")}</strong><p>${escapeHTML(asset.equipment_name || "Equipment")}</p><a href="${escapeHTML(asset.qr_code)}" download><i data-lucide="download"></i> Download QR</a>`;
            if (generate) generate.querySelector("span").textContent = "Regenerate QR";
        } else {
            preview.innerHTML = asset ? `<span><i data-lucide="monitor-cog"></i></span><strong>${escapeHTML(asset.equipment_name || "Equipment")}</strong><p>${escapeHTML(asset.asset_code || asset.equipment_no || "No asset code")} · ${escapeHTML(asset.department || "No department")}</p>` : '<span><i data-lucide="scan-line"></i></span><strong>No asset selected</strong><p>Choose an asset to create or view its QR code.</p>';
            if (generate) generate.querySelector("span").textContent = "Generate QR";
        }
        if (window.lucide) lucide.createIcons();
    };
    if (generate) generate.onclick = async () => {
        if (!select.value) return;
        generate.disabled = true;
        generate.classList.add("is-loading");
        generate.querySelector("span").textContent = "Generating…";
        try {
            const response = await fetch(`/api/qr/generate/${Number(select.value)}`, { method: "POST" });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.detail || "Unable to generate QR code.");
            const asset = assetsCache.find(item => Number(item.id) === Number(select.value));
            modalRoot.querySelector("#assetQrPreview").innerHTML = `<img src="${escapeHTML(result.qr_url)}?t=${Date.now()}" alt="QR code for ${escapeHTML(asset?.equipment_name || "asset")}"><strong>${escapeHTML(asset?.asset_code || asset?.equipment_no || "Asset QR")}</strong><p>${escapeHTML(asset?.equipment_name || "Equipment")}</p><a href="${escapeHTML(result.qr_url)}" download><i data-lucide="download"></i> Download QR</a>`;
            generate.querySelector("span").textContent = "Regenerate QR";
            const cachedAsset = assetsCache.find(item => Number(item.id) === Number(select.value));
            if (cachedAsset) {
                cachedAsset.qr_generated = true;
                cachedAsset.qr_code = result.qr_url;
            }
            applyAssetFilters();
        } catch (error) {
            alert(error.message || "Unable to generate QR code.");
            generate.querySelector("span").textContent = "Generate QR";
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
