let selectedQRAsset = null;
function renderQR() {

    pageContent.innerHTML = `

    <div class="maintenance-page">

        <!-- ==========================================
             PAGE HEADER
        ========================================== -->

        <section class="maintenance-header">

            <div>

                <div class="page-badge">

                    <i data-lucide="qr-code"></i>

                    QR Management

                </div>

                <div class="maintenance-title">

                    <h1>QR Management</h1>

                    <p>
                        Scan, generate and manage biomedical equipment QR codes.
                    </p>

                </div>

            </div>

            <div class="maintenance-actions">

                <button class="btn-secondary">

                    <i data-lucide="download"></i>

                    Export

                </button>

                <button class="btn-secondary">

                    <i data-lucide="refresh-cw"></i>

                    Refresh

                </button>

                <button id="generateQrBtn" class="btn-primary">

                    <i data-lucide="qr-code"></i>

                    Generate QR

                </button>   

            </div>
            </section>
            <!-- ==========================================
                QR HERO SECTION
            ========================================== -->

            <section class="qr-hero">

                <!-- Generate QR -->

                <div class="qr-hero-card generate">

                    <div class="qr-card-content">

                        <span class="hero-tag">

                            <i data-lucide="qr-code"></i>

                            GENERATE QR CODE

                        </span>

                        <h2>
                            Generate QR
                            <br>
                            for Equipment
                        </h2>

                        <p>
                            Create a secure QR code linked to any biomedical equipment.
                            The QR will store maintenance history, asset details and service logs.
                        </p>

                        <button
                            class="btn-primary"
                            id="generateQrHero"
                            onclick="openGenerateQRModal()">

                            <i data-lucide="plus"></i>

                            Generate New QR

                        </button>
                    <div class="hero-features">

                        <span>

                            <i data-lucide="shield-check"></i>

                            Secure

                        </span>

                        <span>

                            <i data-lucide="link"></i>

                            Asset Linked

                        </span>

                        <span>

                            <i data-lucide="printer"></i>

                            Printable

                        </span>

                    </div>

                    </div>

                    <div class="qr-preview">

                        <img
                            src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=BT-ASSET-00001"
                            alt="QR Preview"
                        >

                        <span>

                            BT-ASSET-00001

                        </span>

                    </div>

                </div>

                <!-- Scan QR -->

                <div class="qr-hero-card scan">

                    <div class="qr-card-content">

                        <span class="hero-tag green">

                            <i data-lucide="scan-line"></i>

                            SCAN QR CODE

                        </span>

                        <h2>

                            Scan QR
                            <br>

                            to View Equipment

                        </h2>

                        <p>

                            Scan an equipment QR code to instantly open its asset profile,
                            maintenance history and preventive maintenance schedule.

                        </p>

                        <button
                            class="btn-primary scan-btn"
                            onclick="openQRScanner()">

                            <i data-lucide="scan-line"></i>

                            Open Scanner

                        </button>

                        <div class="hero-features">

                            <span>

                                <i data-lucide="zap"></i>

                                Fast Scan

                            </span>

                            <span>

                                <i data-lucide="clock-3"></i>

                                Service History

                            </span>

                            <span>

                                <i data-lucide="activity"></i>

                                Live Status

                            </span>

                        </div>

                    </div>

                    <div class="scanner-preview">

                        <i data-lucide="smartphone"></i>

                    </div>

                </div>

            </section>
           
        

    </div>
<!-- ==========================================
     GENERATE QR MODAL
========================================== -->

<div id="generateQRModal" class="qr-modal-overlay">

    <div class="qr-modal">

        <!-- =========================
             HEADER
        ========================== -->

        <div class="qr-modal-header">

            <div class="qr-header-left">

                <div class="qr-header-icon">

                    <i data-lucide="qr-code"></i>

                </div>

                <div>

                    <h2>Generate Equipment QR</h2>

                    <p>Select an asset from the hospital inventory to generate a QR sticker.</p>

                </div>

            </div>

            <button
                class="qr-close-btn"
                onclick="closeGenerateQRModal()">

                <i data-lucide="x"></i>

            </button>

        </div>
        <div class="qr-modal-body">


        <!-- =========================
             TOOLBAR
        ========================== -->

        <div class="qr-modal-toolbar">

            <div class="qr-search-wrapper">

                <i data-lucide="search"></i>

                <input
                    id="generateQRSearch"
                    type="text"
                    placeholder="Search Asset ID, Equipment, Serial Number or Department...">

            </div>

            <div class="qr-total-assets-card">

                <div class="asset-card-icon">

                    <i data-lucide="package"></i>

                </div>

                <div>

                    <span>Total Assets</span>

                    <strong id="assetCount">0</strong>

                </div>

            </div>

        </div>


        <!-- =========================
             TABLE
        ========================== -->

        <div class="qr-table-wrapper">

            <table class="qr-select-table">

                <thead>

                    <tr>

                        <th width="55"></th>

                        <th width="150">Asset ID</th>

                        <th>Equipment</th>

                        <th width="160">Department</th>

                        <th width="180">Manufacturer</th>

                        <th width="130">Status</th>

                        <th width="50"></th>

                    </tr>

                </thead>

                <tbody id="generateQRTable">

                </tbody>

            </table>

        </div>


        <!-- =========================
             FOOTER
        ========================== -->

        <div class="qr-footer">

            <!-- Selected Equipment -->

            <div class="selected-equipment-card">

                <div class="card-title">

                    <i data-lucide="clipboard-list"></i>

                    <span>Selected Equipment</span>

                </div>

                <div id="selectedEquipmentContent">

                    <div class="empty-selection">

                        <h3>No Equipment Selected</h3>

                        <p>Select an equipment from the table above.</p>

                    </div>

                </div>

            </div>


            <!-- Preview -->

            <div class="qr-preview-card">

                <div id="qrPreviewContent">

                    <div class="empty-preview">

                        <i data-lucide="package-search"></i>

                        <h3>No Equipment Selected</h3>

                        <p>Select an equipment from the table to view details and generate QR.</p>

                    </div>

                </div>

            </div>

        </div>


        <!-- =========================
             ACTIONS
        ========================== -->
        
        <div class="qr-modal-actions">
        </div>
            <button
                class="btn-secondary"
                onclick="closeGenerateQRModal()">

                <i data-lucide="x"></i>

                Cancel

            </button>

            <button
                id="generateSelectedQR"
                class="btn-primary"
                disabled>

                <i data-lucide="qr-code"></i>

                Generate QR

            </button>

        </div>

    </div>

</div>      
    `;

    lucide.createIcons();

}
window.renderQR = renderQR;

// ==========================================
// LOAD ASSETS FOR QR
// ==========================================

async function loadGenerateQRAssets() {

    try {

        const response = await fetch("/api/assets/");

        const assets = await response.json();

        renderGenerateQRAssetList(assets);

    }

    catch(error){

        console.error(error);

    }

}
// ==========================================
// RENDER QR ASSET LIST
// ==========================================

function renderGenerateQRAssetList(assets) {

    const table = document.getElementById("generateQRTable");

    if (!table) return;

    document.getElementById("assetCount").textContent = assets.length;

    table.innerHTML = "";

    assets.forEach(asset => {

        table.innerHTML += `

        <tr class="qr-table-row" data-id="${asset.id}">

            <!-- Selection -->

            <td class="qr-select-column">

                <div class="qr-radio"></div>

            </td>

            <!-- Asset ID -->

            <td class="asset-code">

                <strong>${asset.asset_code || "-"}</strong>

            </td>

            <!-- Equipment -->

            <td>

                ${asset.equipment_name || "-"}

            </td>

            <!-- Department -->

            <td>

                ${asset.department || "-"}

            </td>

            <!-- Manufacturer -->

            <td>

                ${asset.manufacturer || "-"}

            </td>

            <!-- Status -->

            <td>

                <span class="status-pill active">

                    <span class="status-dot"></span>

                    ${asset.status || "Active"}

                </span>

            </td>

            <!-- Arrow -->

            <td class="qr-arrow">

                <i data-lucide="chevron-right"></i>

            </td>

        </tr>

        `;

    });

    lucide.createIcons();

    attachQRRowEvents(assets);

}
function attachQRRowEvents(assets) {

    document.querySelectorAll(".qr-table-row").forEach(row => {

        row.onclick = () => {

            document
                .querySelectorAll(".qr-table-row")
                .forEach(r => r.classList.remove("selected"));

            row.classList.add("selected");

            const id = Number(row.dataset.id);

            selectedQRAsset = assets.find(a => a.id === id);

            if (!selectedQRAsset) return;

            document.getElementById("selectedEquipmentContent").innerHTML = `

                <div class="equipment-info">

                    <div>
                        <span>Equipment</span>
                        <strong>${selectedQRAsset.equipment_name || "-"}</strong>
                    </div>

                    <div>
                        <span>Asset ID</span>
                        <strong>${selectedQRAsset.asset_code || "-"}</strong>
                    </div>

                    <div>
                        <span>Department</span>
                        <strong>${selectedQRAsset.department || "-"}</strong>
                    </div>

                    <div>
                        <span>Manufacturer</span>
                        <strong>${selectedQRAsset.manufacturer || "-"}</strong>
                    </div>

                    <div>
                        <span>Status</span>
                        <strong>${selectedQRAsset.status || "Active"}</strong>
                    </div>

                    <div>
                        <span>Location</span>
                        <strong>${selectedQRAsset.location || "-"}</strong>
                    </div>

                </div>

            `;

            document.getElementById("qrPreviewContent").innerHTML = `

                <div class="preview-placeholder">

                    <i data-lucide="qr-code"></i>

                    <h3>${selectedQRAsset.asset_code}</h3>

                    <p>${selectedQRAsset.equipment_name}</p>

                </div>

            `;

            document.getElementById("generateSelectedQR").disabled = false;

            lucide.createIcons();

        };

    });

}
function selectQRAsset(assetId){

    fetch(`/api/assets/${assetId}`)

    .then(res=>res.json())

    .then(asset=>{

        selectedQRAsset = asset;

        document
            .querySelectorAll(".qr-table-row")
            .forEach(row=>row.classList.remove("selected"));

        event.currentTarget.classList.add("selected");

        document.getElementById("selectedAssetName").innerHTML=

            `${asset.asset_code}
            •
            ${asset.equipment_name}`;

        document
            .getElementById("generateSelectedQR")
            .disabled=false;

    });

}
// ==========================================
// GENERATE QR
// ==========================================

async function openQRPreview(assetId){

    try{

        const response = await fetch(`/api/qr/generate/${assetId}`,{
            method:"POST"
        });

        const result = await response.json();

        if(!response.ok){

            alert(result.detail || "Failed to generate QR");

            return;

        }

        document.getElementById("qrPreviewContent").innerHTML = `

            <div class="generated-qr">

                <img
                    src="${result.qr_url}?t=${Date.now()}"
                    alt="QR Code"
                    class="generated-qr-image">

                <h3>${selectedQRAsset.asset_code}</h3>

                <p>${selectedQRAsset.equipment_name}</p>

                <a
                    href="${result.qr_url}"
                    download
                    class="btn-secondary">

                    <i data-lucide="download"></i>

                    Download QR

                </a>

            </div>

        `;

        lucide.createIcons();

    }

    catch(error){

        console.error(error);

        alert("Unable to generate QR.");

    }

}
// ==========================================
// OPEN QR MODAL
// ==========================================

function openGenerateQRModal(){

    const modal = document.getElementById("generateQRModal");

    modal.classList.add("show");

    loadGenerateQRAssets();
    document
    .getElementById("generateSelectedQR")
    .onclick = () => {

        if(!selectedQRAsset){

            alert("Please select an asset.");

            return;

        }

        openQRPreview(selectedQRAsset.id);

    };
    const search=document.getElementById("generateQRSearch");

    search.onkeyup=async()=>{

        const response=await fetch("/api/assets/");

        const assets=await response.json();

        const keyword=search.value.toLowerCase();

        const filtered=assets.filter(asset=>

            (asset.asset_code || "")
            .toLowerCase()
            .includes(keyword)

            ||

            (asset.equipment_name || "")
            .toLowerCase()
            .includes(keyword)

            ||

            (asset.serial_number || "")
            .toLowerCase()
            .includes(keyword)

            ||

            (asset.department || "")
            .toLowerCase()
            .includes(keyword)

        );
    

        renderGenerateQRAssetList(filtered);

    };

    lucide.createIcons();

}

// ==========================================
// CLOSE QR MODAL
// ==========================================

function closeGenerateQRModal(){

    document
        .getElementById("generateQRModal")
        .classList.remove("show");

}

window.openGenerateQRModal = openGenerateQRModal;
window.closeGenerateQRModal = closeGenerateQRModal;
window.renderQR = renderQR;
window.openQRPreview = openQRPreview;