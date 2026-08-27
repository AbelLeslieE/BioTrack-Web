
let assetsCache = [];
let filteredAssets = [];
const assetsPagination = { page: 1, pageSize: 25 };

function renderAssets() {

    pageContent.innerHTML = `


    <div class="asset-page">

        <!-- ==========================================
             PAGE HEADER
        =========================================== -->



        <div class="asset-hero">

            <div class="asset-hero-left">

                <span class="asset-badge">

                    Biomedical Asset Registry

                </span>

                <h1>

                    Asset Management

                </h1>

                <p>

                    Manage, monitor and track every biomedical device across the hospital.
                    Access lifecycle information, preventive maintenance, QR management,
                    warranty status and equipment history from one place.

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

                    <button
                        id="importExcelBtn"
                        class="btn-secondary hero-btn">

                        📄 Import Excel

                    </button>

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

                        <th>Manufacturer</th>

                        <th>Model</th>

                        <th>Status</th>

                        <th>QR</th>

                        <th>Action</th>

                    </tr>

                </thead>

                <tbody id="assetTableBody">

                    <tr>

                        <td colspan="8" class="empty-table">

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
    initializeAssetFilters();
    loadAssets();
}

// ==========================================
// INITIALIZE IMPORT BUTTON
// ==========================================

function initializeAssetImport() {

    const importButton = document.getElementById("importExcelBtn");
    const excelInput = document.getElementById("excelFileInput");

    if (!importButton || !excelInput) return;

    importButton.onclick = () => {

        excelInput.click();

    };

    excelInput.onchange = async () => {

        if (!excelInput.files.length) return;

        const formData = new FormData();

        formData.append("file", excelInput.files[0]);

        try {

            importButton.disabled = true;
            importButton.textContent = "Importing...";

            const response = await fetch("/api/assets/upload", {

                method: "POST",
                body: formData

            });

            const result = await response.json();

            alert(
                `Imported : ${result.imported}\n` +
                `Skipped : ${result.skipped}\n` +
                `Errors : ${result.errors}`
            );

            await loadAssets();

        }

        catch (error) {

            console.error(error);

            alert("Import failed.");

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

        updateAssetKPIs(assetsCache);

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

function populateAssetFilters(assets) {
    const setup = (id, values, allLabel) => {
        const select = document.getElementById(id);
        if (!select) return;
        select.innerHTML = `<option value="">${allLabel}</option>${values
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b))
            .map((value) => `<option value="${String(value).replaceAll('"', '&quot;')}">${value}</option>`)
            .join("")}`;
    };

    setup("assetDepartmentFilter", [...new Set(assets.map(asset => asset.department))], "All Departments");
    setup("assetStatusFilter", [...new Set(assets.map(asset => asset.status))], "All Status");
    setup("assetCategoryFilter", [...new Set(assets.map(asset => asset.category))], "All Categories");
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
            asset.manufacturer,
            asset.model,
            asset.category,
        ].filter(Boolean).join(" ").toLowerCase();

        return (!search || searchable.includes(search))
            && (!department || asset.department === department)
            && (!status || asset.status === status)
            && (!category || asset.category === category);
    });

    assetsPagination.page = 1;
    populateAssetTable(filteredAssets);
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
                <td colspan="8" class="empty-table">
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

                <td>${asset.equipment_no ?? ""}</td>

                <td>${asset.equipment_name ?? ""}</td>

                <td>${asset.department ?? ""}</td>

                <td>${asset.manufacturer ?? ""}</td>

                <td>${asset.model ?? ""}</td>

                <td>${asset.status ?? ""}</td>

                <td>${asset.qr_generated ? "✅" : "❌"}</td>

                <td>

                    <button
                        class="btn-open-asset"
                        onclick="openAssetPage(${asset.id})">

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

}


// ==========================================
// UPDATE KPI CARDS
// ==========================================

function updateAssetKPIs(assets) {

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
