// ==========================================
// ASSET DETAILS PAGE
// ==========================================

function renderAssetDetails() {

    const departmentView = isDepartmentAssetDetailsView();

    pageContent.innerHTML = `

    <div class="asset-details-page">

        <div class="asset-details-header">

            <button
                class="btn-secondary"
                onclick="navigate('${departmentView ? "myAssets" : "assets"}')">

                ← Back to ${departmentView ? "My Assets" : "Assets"}

            </button>

            <div>

                <h1>${departmentView ? "Equipment Details" : "Asset Details"}</h1>

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

        if (!response.ok) {
            throw new Error("Asset not found.");
        }

        const asset = await response.json();

        const safeAsset = Object.fromEntries(
            Object.entries(asset).map(([key, value]) => [
                key,
                typeof value === "string" ? escapeHTML(value) : value
            ])
        );

        renderAssetHero(safeAsset);

        if (isDepartmentAssetDetailsView()) {
            renderDepartmentAssetInformation(safeAsset);
            renderDepartmentLastPM(safeAsset);
            clearRestrictedAssetSections();
        } else {
            renderGeneralInformation(safeAsset);
            renderPurchaseInformation(safeAsset);
            renderTechnicalInformation(safeAsset);
            renderMaintenanceOverview(safeAsset);
            renderPMHistory(safeAsset);
            renderAssetTabs(safeAsset);
        }

    }

    catch(error){

        console.error(error);

        if (window.BioTrackToast) {
            BioTrackToast.error("Asset unavailable", error.message || "The equipment details could not be loaded.");
        }

    }

}

function isDepartmentAssetDetailsView() {
    const storedRole = localStorage.getItem("role");
    const role = typeof normalizeDashboardRole === "function"
        ? normalizeDashboardRole(storedRole)
        : String(storedRole || "").trim().toLowerCase();
    return role === "user";
}

function clearRestrictedAssetSections() {
    ["assetPurchaseInfo", "assetTechnicalInfo", "assetPMHistory", "assetTabs", "assetTabContent"]
        .forEach(id => {
            const element = document.getElementById(id);
            if (element) element.replaceChildren();
        });
}

function renderDepartmentAssetInformation(asset) {
    document.getElementById("assetGeneralInfo").innerHTML = `
        <section class="asset-section department-asset-general">
            <div class="asset-section-header">
                <div>
                    <h2>General Information</h2>
                    <p>Essential identification and current location for this equipment.</p>
                </div>
            </div>
            <div class="asset-info-grid">
                <div class="asset-info-card"><span>Equipment Number</span><strong>${asset.equipment_no || "-"}</strong></div>
                <div class="asset-info-card"><span>Asset Code</span><strong>${asset.asset_code || "-"}</strong></div>
                <div class="asset-info-card"><span>Equipment Name</span><strong>${asset.equipment_name || "-"}</strong></div>
                <div class="asset-info-card"><span>Serial Number</span><strong>${asset.serial_number || "-"}</strong></div>
                <div class="asset-info-card"><span>Manufacturer</span><strong>${asset.manufacturer || "-"}</strong></div>
                <div class="asset-info-card"><span>Model</span><strong>${asset.model || "-"}</strong></div>
                <div class="asset-info-card"><span>Department</span><strong>${asset.department || "-"}</strong></div>
                <div class="asset-info-card"><span>Location / Room</span><strong>${asset.location || "-"}</strong></div>
                <div class="asset-info-card"><span>Status</span><strong>${asset.status || "-"}</strong></div>
            </div>
        </section>
    `;
}

function formatAssetDetailDate(value) {
    if (!value) return "Not recorded";
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString("en-GB");
}

function renderDepartmentLastPM(asset) {
    document.getElementById("assetMaintenanceOverview").innerHTML = `
        <section class="asset-section department-last-pm-section">
            <div class="department-last-pm-icon"><i data-lucide="calendar-check-2"></i></div>
            <div>
                <span>Last preventive maintenance completed</span>
                <strong>${formatAssetDetailDate(asset.last_pm_date)}</strong>
                <p>${asset.last_pm_date ? "This is the latest completed PM recorded for this equipment." : "No completed preventive-maintenance visit has been recorded yet."}</p>
            </div>
        </section>
    `;
    if (window.lucide) window.lucide.createIcons();
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

function showAssetPMScheduleDetails(row){
    if(!row)return;
    let dialog=document.getElementById("assetPMScheduleDialog");
    if(!dialog){
        dialog=document.createElement("dialog");
        dialog.id="assetPMScheduleDialog";
        dialog.className="reports-chart-dialog asset-pm-detail-dialog";
        dialog.innerHTML='<form method="dialog"><button class="reports-chart-dialog-close" aria-label="Close visit details">×</button></form><h2>Preventive maintenance visit</h2><dl></dl>';
        dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close();});
        document.body.appendChild(dialog);
    }
    const labels=["Schedule","Scheduled date","Completed date","Service provider","Status"];
    const values=[...row.cells].slice(0,5).map(cell=>cell.textContent.trim()||"—");
    const list=dialog.querySelector("dl");
    list.replaceChildren();
    labels.forEach((label,index)=>{
        const term=document.createElement("dt");
        const value=document.createElement("dd");
        term.textContent=label;
        value.textContent=values[index]||"—";
        list.append(term,value);
    });
    if(!dialog.open)dialog.showModal();
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

    document.querySelectorAll("#assetMaintenanceOverview .btn-view").forEach(button=>{
        button.type="button";
        button.setAttribute("aria-label","View preventive maintenance visit details");
        button.addEventListener("click",()=>showAssetPMScheduleDetails(button.closest("tr")));
    });

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

    document.getElementById("assetTabs").innerHTML = `
        <section class="asset-section asset-documents-section">
            <div class="asset-section-header">
                <div>
                    <h2>Manuals & documents</h2>
                    <p>Equipment manuals, certificates, invoices, service reports, photos and calibration evidence.</p>
                </div>
                <span class="asset-document-compression"><i data-lucide="minimize-2"></i> Auto-compressed below 900 KB</span>
            </div>
            <form id="assetDocumentForm" class="asset-document-form">
                <select id="assetDocumentType" aria-label="Document type">
                    <option>Manual</option><option>Invoice</option><option>Certificate</option>
                    <option>Service Report</option><option>Photo</option><option>Calibration Document</option>
                </select>
                <label><i data-lucide="paperclip"></i><span id="assetDocumentFileName">Choose PDF or image</span><input id="assetDocumentFile" type="file" accept="application/pdf,image/jpeg,image/png" required></label>
                <button type="submit"><i data-lucide="cloud-upload"></i> Compress & upload</button>
            </form>
            <p id="assetDocumentProgress" class="asset-document-progress" role="status"></p>
            <div id="assetDocumentList" class="asset-document-list"><p>Loading asset documents…</p></div>
        </section>`;
    document.getElementById("assetDocumentForm")?.addEventListener("submit", uploadAssetDocument);
    document.getElementById("assetDocumentFile")?.addEventListener("change", event => {
        document.getElementById("assetDocumentFileName").textContent = event.target.files?.[0]?.name || "Choose PDF or image";
    });
    if (window.lucide) window.lucide.createIcons();
    loadAssetDocuments(asset.id);

}

function assetDocumentSize(bytes) {
    const value = Number(bytes || 0);
    if (value < 1024) return `${value} B`;
    return `${(value / 1024).toFixed(value < 10240 ? 1 : 0)} KB`;
}

async function loadAssetDocuments(assetId = currentAssetId) {
    const container = document.getElementById("assetDocumentList");
    if (!container) return;
    try {
        const response = await fetch(`/api/assets/${Number(assetId)}/documents`, { cache: "no-store" });
        const documents = await response.json().catch(() => []);
        if (!response.ok) throw new Error(documents.detail || "Unable to load asset documents.");
        container.innerHTML = documents.length ? documents.map(document => `
            <article class="asset-document-item">
                <span class="asset-document-icon"><i data-lucide="${document.content_type === "application/pdf" ? "file-text" : "image"}"></i></span>
                <div><strong>${escapeHTML(document.document_name)}</strong><small>${escapeHTML(document.document_type)} · ${assetDocumentSize(document.stored_size_bytes)}${document.original_size_bytes > document.stored_size_bytes ? ` · compressed from ${assetDocumentSize(document.original_size_bytes)}` : ""}</small></div>
                <a href="${document.download_url}" download><i data-lucide="download"></i><span>Download</span></a>
                <button type="button" onclick="deleteAssetDocument(${Number(document.id)})" aria-label="Delete ${escapeHTML(document.document_name)}"><i data-lucide="trash-2"></i></button>
            </article>`).join("") : '<div class="asset-document-empty"><i data-lucide="folder-open"></i><strong>No documents uploaded</strong><p>Add the first manual, certificate or service document for this equipment.</p></div>';
    } catch (error) {
        container.innerHTML = `<div class="asset-document-empty is-error"><i data-lucide="circle-alert"></i><strong>Documents unavailable</strong><p>${escapeHTML(error.message)}</p></div>`;
    }
    if (window.lucide) window.lucide.createIcons();
}

async function uploadAssetDocument(event) {
    event.preventDefault();
    const input = document.getElementById("assetDocumentFile");
    const progress = document.getElementById("assetDocumentProgress");
    const button = event.currentTarget.querySelector('button[type="submit"]');
    const file = input?.files?.[0];
    if (!file) return;
    button.disabled = true;
    progress.textContent = "Compressing and storing the document…";
    try {
        const formData = new FormData();
        formData.append("document_type", document.getElementById("assetDocumentType").value);
        formData.append("file", file);
        const response = await fetch(`/api/assets/${Number(currentAssetId)}/documents`, { method: "POST", body: formData });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.detail || "Unable to upload this asset document.");
        progress.textContent = `Stored at ${assetDocumentSize(result.document.stored_size_bytes)}${result.document.original_size_bytes > result.document.stored_size_bytes ? ` (from ${assetDocumentSize(result.document.original_size_bytes)})` : ""}.`;
        event.currentTarget.reset();
        document.getElementById("assetDocumentFileName").textContent = "Choose PDF or image";
        BioTrackToast.success("Document uploaded", "The optimized file is attached to this asset.");
        await loadAssetDocuments();
    } catch (error) {
        progress.textContent = error.message || "Upload failed.";
        BioTrackToast.error("Document not uploaded", progress.textContent);
    } finally {
        button.disabled = false;
    }
}

async function deleteAssetDocument(documentId) {
    if (!window.confirm("Delete this asset document?")) return;
    try {
        const response = await fetch(`/api/assets/documents/${Number(documentId)}`, { method: "DELETE" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.detail || "Unable to delete this asset document.");
        BioTrackToast.success("Document deleted", "The asset document was removed.");
        await loadAssetDocuments();
    } catch (error) {
        BioTrackToast.error("Document not deleted", error.message);
    }
}
