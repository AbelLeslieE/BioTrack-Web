// ==========================================
// ASSET DETAILS PAGE
// ==========================================

function renderAssetDetails() {

    pageContent.innerHTML = `

    <div class="asset-details-page">

        <div class="asset-details-header">

            <button
                class="btn-secondary"
                onclick="navigate('assets')">

                ← Back to Assets

            </button>

            <div>

                <h1>Asset Details</h1>

                <p>
                    Asset ID :
                    <strong>${currentAssetId}</strong>
                </p>

            </div>

        </div>

        <div id="assetProfileHero"></div>

        <div id="assetGeneralInfo"></div>

        <div id="assetPurchaseInfo"></div>

        <div id="assetTechnicalInfo"></div>

        <div id="assetMaintenanceOverview"></div>

        <div id="assetPMHistory"></div>

        <div id="assetTabs"></div>

        <div id="assetTabContent"></div>

            </div>

    `;

    loadAssetDetails(currentAssetId);

}

// ==========================================
// LOAD ASSET DETAILS
// ==========================================

// ==========================================
// LOAD ASSET DETAILS
// ==========================================

async function loadAssetDetails(assetId) {

    try {

        const response = await fetch(`/api/assets/${assetId}`);

        const asset = await response.json();

        renderAssetHero(asset);

        renderGeneralInformation(asset);

        renderPurchaseInformation(asset);

        renderTechnicalInformation(asset);

        renderMaintenanceOverview(asset);

        renderPMHistory(asset);

        renderAssetTabs(asset);

    }

    catch(error){

        console.error(error);

    }

}
// ==========================================
// GENERAL INFO
// ==========================================

// ==========================================
// GENERAL INFORMATION
// ==========================================

function renderGeneralInformation(asset){

    document.getElementById("assetGeneralInfo").innerHTML = `

    <section class="asset-section">

        <div class="asset-section-header">

            <div>
                <h2>General Information</h2>
                <p>Basic equipment identification and operational details.</p>
            </div>

        </div>

        <div class="asset-info-grid">

            <div class="asset-info-card">
                <span>Equipment Number</span>
                <strong>${asset.equipment_no || "-"}</strong>
            </div>

            <div class="asset-info-card">
                <span>Asset Code</span>
                <strong>${asset.asset_code || "-"}</strong>
            </div>

            <div class="asset-info-card">
                <span>Equipment Name</span>
                <strong>${asset.equipment_name || "-"}</strong>
            </div>

            <div class="asset-info-card">
                <span>Serial Number</span>
                <strong>${asset.serial_number || "-"}</strong>
            </div>

            <div class="asset-info-card">
                <span>Manufacturer</span>
                <strong>${asset.manufacturer || "-"}</strong>
            </div>

            <div class="asset-info-card">
                <span>Model</span>
                <strong>${asset.model || "-"}</strong>
            </div>

            <div class="asset-info-card">
                <span>Department</span>
                <strong>${asset.department || "-"}</strong>
            </div>

            <div class="asset-info-card">
                <span>Location</span>
                <strong>${asset.location || "-"}</strong>
            </div>

            <div class="asset-info-card">
                <span>Status</span>
                <strong>${asset.status || "-"}</strong>
            </div>

            <div class="asset-info-card">
                <span>Equipment Type</span>
                <strong>${asset.equipment_type || "-"}</strong>
            </div>

            <div class="asset-info-card">
                <span>Classification</span>
                <strong>${asset.classification || "-"}</strong>
            </div>

        </div>

    </section>

    `;

}

// ==========================================
// PURCHASE INFORMATION
// ==========================================

function renderPurchaseInformation(asset){

    document.getElementById("assetPurchaseInfo").innerHTML = `

    <section class="asset-section">

        <div class="asset-section-header">

            <div>

                <h2>Purchase Information</h2>

                <p>Procurement and financial information for this asset.</p>

            </div>

        </div>

        <div class="asset-property-grid">

            <div class="asset-property-row">
                <label>Supplier</label>
                <span>${asset.supplier || "-"}</span>
            </div>

            <div class="asset-property-row">
                <label>Purchase Date</label>
                <span>${asset.purchase_date || "-"}</span>
            </div>

            <div class="asset-property-row">
                <label>Installation Date</label>
                <span>${asset.installation_date || "-"}</span>
            </div>

            <div class="asset-property-row">
                <label>Purchase Value</label>
                <span>${asset.purchase_value || "-"}</span>
            </div>

            <div class="asset-property-row">
                <label>Tax Amount</label>
                <span>${asset.tax_amount || "-"}</span>
            </div>

            <div class="asset-property-row">
                <label>Net Value</label>
                <span>${asset.net_value || "-"}</span>
            </div>

            <div class="asset-property-row">
                <label>Warranty</label>
                <span>${asset.warranty || "-"}</span>
            </div>

            <div class="asset-property-row">
                <label>Maintained By</label>
                <span>${asset.maintained_by || "-"}</span>
            </div>

        </div>

    </section>

    `;

}
// ==========================================
// TECHNICAL INFORMATION
// ==========================================

function renderTechnicalInformation(asset){

    document.getElementById("assetTechnicalInfo").innerHTML = `

    <section class="asset-section">

        <div class="asset-section-header">

            <div>

                <h2>Technical Information</h2>

                <p>Technical specifications and classification of this equipment.</p>

            </div>

        </div>

        <div class="asset-property-grid">

            <div class="asset-property-row">
                <label>Equipment Type</label>
                <span>${asset.equipment_type || "-"}</span>
            </div>

            <div class="asset-property-row">
                <label>Classification</label>
                <span>${asset.classification || "-"}</span>
            </div>

            <div class="asset-property-row">
                <label>Manufacturing Year</label>
                <span>${asset.manufacturing_year || "-"}</span>
            </div>

            <div class="asset-property-row">
                <label>Manufacturer</label>
                <span>${asset.manufacturer || "-"}</span>
            </div>

            <div class="asset-property-row">
                <label>Manufacturer Address</label>
                <span>${asset.manufacturer_address || "-"}</span>
            </div>

            <div class="asset-property-row">
                <label>Model</label>
                <span>${asset.model || "-"}</span>
            </div>

            <div class="asset-property-row">
                <label>Serial Number</label>
                <span>${asset.serial_number || "-"}</span>
            </div>

            <div class="asset-property-row">
                <label>Remarks</label>
                <span>${asset.remarks || "-"}</span>
            </div>

        </div>

    </section>

    `;

}
// ==========================================
// MAINTENANCE OVERVIEW
// ==========================================

// ==========================================
// MAINTENANCE OVERVIEW
// ==========================================

function renderMaintenanceOverview(asset){

    document.getElementById("assetMaintenanceOverview").innerHTML = `

    <section class="asset-section">

        <div class="asset-section-header">

            <div>

                <h2>Maintenance Overview</h2>

                <p>Current operational health and maintenance status.</p>

            </div>

        </div>

        <div class="maintenance-grid">

            <div class="maintenance-card status">

                <span class="maintenance-label">
                    Equipment Status
                </span>

                <div class="maintenance-value active">

                    ● Active

                </div>

            </div>

            <div class="maintenance-card">

                <span class="maintenance-label">
                    Last PM
                </span>

                <div class="maintenance-value">

                    --

                </div>

            </div>

            <div class="maintenance-card">

                <span class="maintenance-label">
                    Next PM
                </span>

                <div class="maintenance-value">

                    --

                </div>

            </div>

            <div class="maintenance-card">

                <span class="maintenance-label">
                    Warranty
                </span>

                <div class="maintenance-value">

                    --

                </div>

            </div>

            <div class="maintenance-card">

                <span class="maintenance-label">
                    Calibration
                </span>

                <div class="maintenance-value">

                    --

                </div>

            </div>

            <div class="maintenance-card">

                <span class="maintenance-label">
                    Breakdown Count
                </span>

                <div class="maintenance-value">

                    0

                </div>

            </div>

            <div class="maintenance-card">

                <span class="maintenance-label">
                    Downtime
                </span>

                <div class="maintenance-value">

                    0 Hours

                </div>

            </div>

            <div class="maintenance-card">

                <span class="maintenance-label">
                    Assigned Engineer
                </span>

                <div class="maintenance-value">

                    --

                </div>

            </div>

        </div>

    </section>

    `;

}
// ==========================================
// PM HISTORY
// ==========================================

function renderPMHistory(asset){

    document.getElementById("assetPMHistory").innerHTML = `

    <section class="asset-section">

        <div class="asset-section-header">

            <div>

                <h2>Preventive Maintenance History</h2>

                <p>Scheduled preventive maintenance records for this equipment.</p>

            </div>

        </div>

        <div class="pm-history-table">

            <table>

                <thead>

                    <tr>

                        <th>PM ID</th>

                        <th>Scheduled</th>

                        <th>Completed</th>

                        <th>Engineer</th>

                        <th>Status</th>

                        <th>Report</th>

                    </tr>

                </thead>

                <tbody>

                    <tr>

                        <td>PM-2026-001</td>

                        <td>15 Jan 2026</td>

                        <td>15 Jan 2026</td>

                        <td>N2 Healthcare</td>

                        <td>

                            <span class="status completed">

                                Completed

                            </span>

                        </td>

                        <td>

                            <button class="btn-view">

                                View

                            </button>

                        </td>

                    </tr>

                    <tr>

                        <td>PM-2026-002</td>

                        <td>15 Apr 2026</td>

                        <td>-</td>

                        <td>-</td>

                        <td>

                            <span class="status pending">

                                Pending

                            </span>

                        </td>

                        <td>

                            <button class="btn-view">

                                View

                            </button>

                        </td>

                    </tr>

                    <tr>

                        <td>PM-2026-003</td>

                        <td>15 Jul 2026</td>

                        <td>-</td>

                        <td>-</td>

                        <td>

                            <span class="status upcoming">

                                Upcoming

                            </span>

                        </td>

                        <td>

                            <button class="btn-view">

                                View

                            </button>

                        </td>

                    </tr>

                </tbody>

            </table>

        </div>

    </section>

    `;

}
// ==========================================
// TABS
// ==========================================

function renderAssetTabs(asset){

    document.getElementById("assetTabs").innerHTML = "";

}