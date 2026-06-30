
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
                type="text"
                placeholder="🔍 Search equipment..."
                class="asset-search"
            >

            <select>

                <option>All Departments</option>

            </select>

            <select>

                <option>All Status</option>

            </select>

            <select>

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

    </div>

    `;
    initializeAssetImport();
    initializeAddAsset();
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

        populateAssetTable(assets);

        updateAssetKPIs(assets);

    }

    catch (error) {

        console.error(error);

    }

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

        return;

    }

    table.innerHTML = "";

    assets.forEach(asset => {

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