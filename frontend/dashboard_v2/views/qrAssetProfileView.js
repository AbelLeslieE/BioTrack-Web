let currentQRProfile = null;

function qrProfileEscape(value) {
    return escapeHTML(value === null || value === undefined ? "" : String(value));
}

function qrProfileDate(value) {
    if (!value) return "Not recorded";
    const parsed = new Date(`${value}`.length === 10 ? `${value}T00:00:00` : value);
    return Number.isNaN(parsed.getTime()) ? qrProfileEscape(value) : parsed.toLocaleDateString();
}

function qrProfileValue(value) {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return qrProfileEscape(value);
}

function renderQRAssetProfile() {
    pageContent.innerHTML = `
        <section class="qr-profile-page" aria-labelledby="qrProfileTitle">
            <header class="qr-profile-topbar">
                <button type="button" class="qr-profile-back" onclick="navigate('qr')"><i data-lucide="arrow-left"></i> Scan another asset</button>
                <span><i data-lucide="shield-check"></i> Secure role-aware equipment record</span>
            </header>
            <div id="qrProfileContent" class="qr-profile-loading">
                <span class="qr-profile-spinner"></span>
                <strong>Loading scanned equipment…</strong>
            </div>
        </section>`;
    if (window.lucide) lucide.createIcons();
    loadQRAssetProfile();
}

async function loadQRAssetProfile() {
    const container = document.getElementById("qrProfileContent");
    if (!container || !currentQRAssetId) return;
    try {
        const response = await fetch(`/api/qr/profile/${currentQRAssetId}`);
        const profile = await response.json();
        if (!response.ok) throw new Error(profile.detail || "This equipment cannot be opened in your portal.");
        currentQRProfile = profile;
        container.className = "qr-profile-content";
        container.innerHTML = `
            ${renderQRProfileHero(profile)}
            ${profile.view === "department" ? renderDepartmentQRProfile(profile) : ""}
            ${profile.view === "engineer" ? renderEngineerQRProfile(profile) : ""}
            ${profile.view === "admin" ? renderAdminQRProfile(profile) : ""}`;
        if (window.lucide) lucide.createIcons();
    } catch (error) {
        console.error(error);
        container.className = "qr-profile-error";
        container.innerHTML = `<i data-lucide="circle-alert"></i><h2>Unable to open equipment</h2><p>${qrProfileEscape(error.message)}</p><button onclick="navigate('qr')">Return to scanner</button>`;
        if (window.lucide) lucide.createIcons();
    }
}

function renderQRProfileHero(profile) {
    const asset = profile.asset;
    const viewLabels = { admin: "Administrator equipment record", engineer: "Engineering service record", department: "Department equipment" };
    return `
        <section class="qr-profile-hero">
            <div class="qr-profile-image">
                <div class="qr-profile-image-fallback"><i data-lucide="monitor-cog"></i><span>${qrProfileEscape(asset.service_team || "Hospital asset")}</span></div>
                ${asset.image_path ? `<img src="${qrProfileEscape(asset.image_path)}" alt="${qrProfileEscape(asset.equipment_name || "Equipment")}" onerror="this.remove()">` : ""}
            </div>
            <div class="qr-profile-hero-copy">
                <span class="qr-profile-eyebrow"><i data-lucide="qr-code"></i> ${viewLabels[profile.view]}</span>
                <h1 id="qrProfileTitle">${qrProfileEscape(asset.equipment_name || "Equipment")}</h1>
                <p>${qrProfileEscape(asset.asset_code || asset.equipment_no || "No asset identifier")} ${asset.model ? `· ${qrProfileEscape(asset.model)}` : ""}</p>
                <div class="qr-profile-hero-tags">
                    <span><i data-lucide="activity"></i>${qrProfileEscape(asset.status || "Unknown status")}</span>
                    ${asset.location ? `<span><i data-lucide="map-pin"></i>${qrProfileEscape(asset.location)}</span>` : ""}
                </div>
            </div>
            <div class="qr-profile-role-badge"><i data-lucide="badge-check"></i><strong>${profile.view === "admin" ? "Full details" : profile.view === "engineer" ? "Engineering view" : "Department view"}</strong><small>Access limited by your signed-in role</small></div>
        </section>`;
}

function renderDepartmentQRProfile(profile) {
    const asset = profile.asset;
    const canStartCall = Boolean(profile.actions?.can_start_maintenance_call);
    return `
        <section class="qr-profile-section">
            <div class="qr-profile-heading"><div><span>Equipment information</span><h2>Scanned equipment details</h2><p>Use this record to identify the equipment${canStartCall ? " and request engineering support" : ""}.</p></div><i data-lucide="building-2"></i></div>
            <div class="qr-profile-facts is-department">
                ${qrProfileFact("Equipment name", asset.equipment_name, "monitor")}
                ${qrProfileFact("Model", asset.model, "cpu")}
                ${qrProfileFact("Serial number", asset.serial_number, "barcode")}
                ${qrProfileFact("Department", asset.department, "building-2")}
                ${qrProfileFact("Location", asset.location, "map-pin")}
                ${qrProfileFact("Last preventive maintenance", qrProfileDate(profile.maintenance.last_pm_date), "calendar-check")}
            </div>
            ${canStartCall ? `
                <div class="qr-profile-callout">
                    <span><i data-lucide="wrench"></i></span>
                    <div><h3>Does this equipment need attention?</h3><p>Start a maintenance call with the asset identity, serial number, model and location filled automatically. The failure description is optional.</p></div>
                    <button type="button" onclick="startQRMaintenanceCall()"><i data-lucide="phone-call"></i> Start Maintenance Call</button>
                </div>` : `
                <div class="qr-profile-callout is-restricted" role="alert">
                    <span><i data-lucide="shield-alert"></i></span>
                    <div><h3>This is not an asset of your department</h3><p>You can view its identification details because you scanned the equipment QR code, but you cannot register a maintenance call for it. Contact the owning department if support is needed.</p></div>
                </div>`}
        </section>`;
}

function renderEngineerQRProfile(profile) {
    const asset = profile.asset;
    const maintenance = profile.maintenance;
    return `
        <section class="qr-profile-section">
            <div class="qr-profile-heading"><div><span>Engineering overview</span><h2>Equipment and maintenance status</h2><p>Review identity, purchase and maintenance history before servicing this asset.</p></div><i data-lucide="wrench"></i></div>
            <div class="qr-profile-facts">
                ${qrProfileFact("Equipment ID", asset.equipment_no || asset.asset_code, "scan-barcode")}
                ${qrProfileFact("Model", asset.model, "cpu")}
                ${qrProfileFact("Serial number", asset.serial_number, "barcode")}
                ${qrProfileFact("Manufacturer", asset.manufacturer, "factory")}
                ${qrProfileFact("Location", asset.location, "map-pin")}
                ${qrProfileFact("Purchase date", qrProfileDate(asset.purchase_date), "shopping-bag")}
            </div>
        </section>
        ${renderQRMaintenanceOverview(maintenance)}
        <section class="qr-profile-section qr-engineer-pm-action">
            <div><span>Preventive maintenance</span><h2>Complete this PM visit</h2><p>Only confirm after the preventive-maintenance work has actually been completed on this equipment.</p></div>
            <button type="button" onclick="openQRPMConfirmation(${Number(asset.id)})"><i data-lucide="calendar-check-2"></i> Update Preventive Maintenance</button>
        </section>
        ${renderQRHistoryTables(maintenance)}`;
}

function renderAdminQRProfile(profile) {
    const asset = profile.asset;
    const fields = [
        ["Asset code", asset.asset_code], ["Equipment number", asset.equipment_no], ["Equipment name", asset.equipment_name],
        ["Service team", asset.service_team], ["Classification", asset.classification], ["Equipment type", asset.equipment_type],
        ["Manufacturer", asset.manufacturer], ["Manufacturer address", asset.manufacturer_address], ["Model", asset.model],
        ["Serial number", asset.serial_number], ["Manufacturing year", asset.manufacturing_year], ["Maintained by", asset.maintained_by],
        ["Department", asset.department], ["Location", asset.location], ["Status", asset.status], ["Supplier", asset.supplier],
        ["Purchase value", asset.purchase_value], ["Tax amount", asset.tax_amount], ["Net value", asset.net_value],
        ["Purchase date", qrProfileDate(asset.purchase_date)], ["Installation date", qrProfileDate(asset.installation_date)],
        ["Warranty", asset.warranty], ["PM frequency", asset.pm_frequency ? `${asset.pm_frequency} days` : null],
        ["Calibration required", asset.calibration_required], ["Remarks", asset.remarks],
        ["QR generated", asset.qr_generated], ["Created", qrProfileDate(asset.created_at)], ["Last updated", qrProfileDate(asset.updated_at)],
    ];
    return `
        <section class="qr-profile-section">
            <div class="qr-profile-heading"><div><span>Complete asset record</span><h2>All equipment details</h2><p>Administrative view includes ownership, procurement, warranty and lifecycle information.</p></div><i data-lucide="layout-list"></i></div>
            <div class="qr-admin-details">${fields.map(([label, value]) => `<div><span>${label}</span><strong>${qrProfileValue(value)}</strong></div>`).join("")}</div>
        </section>
        ${renderQRMaintenanceOverview(profile.maintenance)}
        ${renderQRHistoryTables(profile.maintenance)}`;
}

function qrProfileFact(label, value, icon) {
    return `<article><span><i data-lucide="${icon}"></i></span><div><small>${label}</small><strong>${qrProfileValue(value)}</strong></div></article>`;
}

function renderQRMaintenanceOverview(maintenance) {
    return `
        <section class="qr-profile-section">
            <div class="qr-profile-heading"><div><span>Maintenance overview</span><h2>Service health at a glance</h2></div><i data-lucide="activity"></i></div>
            <div class="qr-maintenance-metrics">
                ${qrProfileMetric("Last PM", qrProfileDate(maintenance.last_pm_date), "calendar-check", "blue")}
                ${qrProfileMetric("Next PM", qrProfileDate(maintenance.next_pm_date), "calendar-clock", "violet")}
                ${qrProfileMetric("PM status", maintenance.pm_status || "Not scheduled", "shield-check", "green")}
                ${qrProfileMetric("Open calls", maintenance.open_maintenance_calls || 0, "wrench", "orange")}
                ${qrProfileMetric("Repairs completed", maintenance.completed_repairs || 0, "badge-check", "cyan")}
            </div>
        </section>`;
}

function qrProfileMetric(label, value, icon, tone) {
    return `<article class="is-${tone}"><span><i data-lucide="${icon}"></i></span><div><small>${label}</small><strong>${qrProfileValue(value)}</strong></div></article>`;
}

function renderQRHistoryTables(maintenance) {
    const repairs = maintenance.repairs || [];
    const history = maintenance.pm_history || [];
    return `
        <div class="qr-history-grid">
            <section class="qr-profile-section"><div class="qr-profile-heading"><div><span>Repair history</span><h2>Maintenance calls</h2></div><i data-lucide="history"></i></div>
                ${repairs.length ? `<div class="qr-history-list">${repairs.map(item => `<article><div><strong>${qrProfileEscape(item.ticket || "Maintenance call")}</strong><span>${qrProfileEscape(item.status || "Unknown")} · ${qrProfileDate(item.completed || item.received)}</span></div><p>${qrProfileEscape(item.work_done || item.engineer_notes || "No repair notes recorded.")}</p></article>`).join("")}</div>` : '<p class="qr-empty-history">No maintenance calls are recorded for this equipment.</p>'}
            </section>
            <section class="qr-profile-section"><div class="qr-profile-heading"><div><span>PM history</span><h2>Completed PM visits</h2></div><i data-lucide="calendar-range"></i></div>
                ${history.length ? `<div class="qr-history-list">${history.map(item => `<article><div><strong>${qrProfileDate(item.completed_date)}</strong><span>${qrProfileEscape(item.engineer_name)}</span></div><p>${qrProfileEscape(item.remarks || "Preventive maintenance completed.")}</p></article>`).join("")}</div>` : '<p class="qr-empty-history">No completed preventive-maintenance visits are recorded yet.</p>'}
            </section>
        </div>`;
}

function startQRMaintenanceCall() {
    if (!currentQRProfile?.actions?.can_start_maintenance_call) return;
    sessionStorage.setItem("qrMaintenancePrefill", JSON.stringify(currentQRProfile.ticket_defaults || {}));
    navigate("newRequest");
}

function openQRPMConfirmation(assetId) {
    if (!currentQRProfile?.actions?.can_complete_pm) return;
    let dialog = document.getElementById("qrPmConfirmDialog");
    if (!dialog) {
        dialog = document.createElement("dialog");
        dialog.id = "qrPmConfirmDialog";
        dialog.className = "qr-pm-confirm-dialog";
        document.body.appendChild(dialog);
    }
    dialog.innerHTML = `<form method="dialog"><span class="qr-pm-confirm-icon"><i data-lucide="calendar-check-2"></i></span><h2>Complete preventive maintenance?</h2><p>Are you sure the preventive-maintenance work has been completed on <strong>${qrProfileEscape(currentQRProfile.asset.equipment_name)}</strong>? This will record today as the last PM date and calculate the next visit.</p><div id="qrPmConfirmError" role="alert"></div><footer><button value="cancel" class="qr-pm-cancel">No, go back</button><button value="default" type="button" class="qr-pm-confirm" onclick="confirmQRPMCompletion(${Number(assetId)})">Yes, PM is complete</button></footer></form>`;
    if (window.lucide) lucide.createIcons();
    if (!dialog.open) dialog.showModal();
}

async function confirmQRPMCompletion(assetId) {
    const dialog = document.getElementById("qrPmConfirmDialog");
    const button = dialog?.querySelector(".qr-pm-confirm");
    const errorElement = dialog?.querySelector("#qrPmConfirmError");
    try {
        button.disabled = true;
        button.textContent = "Updating…";
        errorElement.textContent = "";
        const response = await fetch(`/api/qr/profile/${assetId}/complete-pm`, { method: "POST" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || "Preventive maintenance could not be updated.");
        dialog.close();
        await loadQRAssetProfile();
    } catch (error) {
        console.error(error);
        errorElement.textContent = error.message;
    } finally {
        button.disabled = false;
        button.textContent = "Yes, PM is complete";
    }
}

window.renderQRAssetProfile = renderQRAssetProfile;
window.startQRMaintenanceCall = startQRMaintenanceCall;
window.openQRPMConfirmation = openQRPMConfirmation;
window.confirmQRPMCompletion = confirmQRPMCompletion;
