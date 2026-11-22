// ==========================================
// LOAD ASSET PROFILE
// ==========================================

async function loadAssetProfile() {

    try {

        const response = await fetch(

            `/api/assets/${currentAssetId}`

        );

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

    }

    catch (error) {

        console.error(error);

    }

}


// ==========================================
// HERO
// ==========================================

// ==========================================
// ASSET HERO
// ==========================================

function renderAssetHero(asset) {

    const canEdit = typeof canManageAssetQR === "function" && canManageAssetQR();
    const serviceTeam = asset.service_team || "Biomedical";

    document.getElementById("assetProfileHero").innerHTML = `

    <section class="asset-hero">

        <div class="asset-image-card">

            <div class="asset-image-placeholder" aria-hidden="true">
                <i data-lucide="monitor-cog"></i>
                <span>${serviceTeam}</span>
            </div>
            ${asset.image_path ? `
                <img
                    src="${asset.image_path}"
                    alt="${asset.equipment_name || "Hospital asset"}"
                    class="asset-image"
                    onerror="this.remove()">
            ` : ""}

        </div>

        <div class="asset-hero-content">

            <div class="asset-title-row">

                <div>

                    <span class="asset-category">

                        ${serviceTeam} Asset

                    </span>

                    <h1>

                        ${asset.equipment_name}

                    </h1>

                    <p class="asset-code">

                        ${asset.asset_code}

                    </p>

                </div>

                <div class="asset-actions">

                    ${canEdit ? `
                        <button type="button" class="asset-action-btn asset-edit-button" onclick="openAssetEditor(${Number(asset.id)})">
                            <i data-lucide="square-pen"></i>
                            Edit Asset
                        </button>
                        <button type="button" class="asset-action-btn asset-qr-button" onclick="openAssetQRGenerator(${Number(asset.id)})">
                            <i data-lucide="qr-code"></i>
                            ${asset.qr_generated ? "View QR" : "Generate QR"}
                        </button>
                    ` : ""}

                </div>

            </div>

            <div class="asset-summary">

                <div>

                    <label>Status</label>

                    <span class="asset-status-pill">

                        ${asset.status}

                    </span>

                </div>

                <div>

                    <label>Manufacturer</label>

                    <strong>

                        ${asset.manufacturer || "-"}

                    </strong>

                </div>

                <div>

                    <label>Model</label>

                    <strong>

                        ${asset.model || "-"}

                    </strong>

                </div>

                <div>

                    <label>Department</label>

                    <strong>

                        ${asset.department || "-"}

                    </strong>

                </div>

            </div>

        </div>

    </section>

    `;

    if (window.lucide) lucide.createIcons();

}

function assetEditorValue(value) {
    return escapeHTML(value === null || value === undefined ? "" : String(value));
}

function assetEditorTeamOptions(selectedTeam) {
    return ["Biomedical", "Electrical", "IT"]
        .map(team => `<option value="${team}" ${team === selectedTeam ? "selected" : ""}>${team}</option>`)
        .join("");
}

async function openAssetEditor(assetId) {
    if (!(typeof canManageAssetQR === "function" && canManageAssetQR())) return;

    try {
        const response = await fetch(`/api/assets/${assetId}`);
        const asset = await response.json();
        if (!response.ok) throw new Error(asset.detail || "Asset could not be loaded.");

        let dialog = document.getElementById("assetEditDialog");
        if (!dialog) {
            dialog = document.createElement("dialog");
            dialog.id = "assetEditDialog";
            dialog.className = "asset-edit-dialog";
            document.body.appendChild(dialog);
        }

        const adminView = typeof isAssetAdministrator === "function" && isAssetAdministrator();
        dialog.innerHTML = `
            <form id="assetEditForm" class="asset-edit-form">
                <header class="asset-edit-header">
                    <div class="asset-edit-heading">
                        <span class="asset-edit-icon"><i data-lucide="square-pen"></i></span>
                        <div>
                            <small>Asset Management</small>
                            <h2>Edit Asset</h2>
                            <p>Update equipment identity, ownership and lifecycle information.</p>
                        </div>
                    </div>
                    <button type="button" class="asset-edit-close" aria-label="Close asset editor" onclick="document.getElementById('assetEditDialog').close()">
                        <i data-lucide="x"></i>
                    </button>
                </header>

                <div class="asset-edit-body">
                    <section class="asset-edit-section">
                        <div class="asset-edit-section-title">
                            <i data-lucide="badge-info"></i>
                            <div><h3>Identity</h3><p>Core identifiers and service ownership.</p></div>
                        </div>
                        <div class="asset-edit-grid">
                            <label>Service Team
                                <select name="service_team" ${adminView ? "" : "disabled"}>
                                    ${assetEditorTeamOptions(asset.service_team || "Biomedical")}
                                </select>
                            </label>
                            <label>Asset Code <span>*</span>
                                <input name="asset_code" required value="${assetEditorValue(asset.asset_code)}">
                            </label>
                            <label>Equipment Number
                                <input name="equipment_no" value="${assetEditorValue(asset.equipment_no)}">
                            </label>
                            <label class="is-wide">Equipment Name <span>*</span>
                                <input name="equipment_name" required value="${assetEditorValue(asset.equipment_name)}">
                            </label>
                            <label>Classification
                                <input name="classification" value="${assetEditorValue(asset.classification)}">
                            </label>
                            <label>Equipment Type
                                <input name="equipment_type" value="${assetEditorValue(asset.equipment_type)}">
                            </label>
                            <label>Status
                                <select name="status">
                                    ${["Active", "Out of Service", "Under Maintenance", "Retired"].map(status => `<option value="${status}" ${status === asset.status ? "selected" : ""}>${status}</option>`).join("")}
                                </select>
                            </label>
                        </div>
                    </section>

                    <section class="asset-edit-section">
                        <div class="asset-edit-section-title">
                            <i data-lucide="map-pin"></i>
                            <div><h3>Location & equipment</h3><p>Operational placement and manufacturer information.</p></div>
                        </div>
                        <div class="asset-edit-grid">
                            <label>Department<select name="department">${renderHospitalDepartmentOptions(asset.department)}</select></label>
                            <label>Location<input name="location" value="${assetEditorValue(asset.location)}"></label>
                            <label>Manufacturer<input name="manufacturer" value="${assetEditorValue(asset.manufacturer)}"></label>
                            <label>Model<input name="model" value="${assetEditorValue(asset.model)}"></label>
                            <label>Serial Number<input name="serial_number" value="${assetEditorValue(asset.serial_number)}"></label>
                            <label>Manufacturing Year<input name="manufacturing_year" type="number" min="1900" max="2200" value="${assetEditorValue(asset.manufacturing_year)}"></label>
                            <label>Maintained By<input name="maintained_by" value="${assetEditorValue(asset.maintained_by)}"></label>
                            <label class="is-wide">Manufacturer Address<textarea name="manufacturer_address" rows="2">${assetEditorValue(asset.manufacturer_address)}</textarea></label>
                        </div>
                    </section>

                    <section class="asset-edit-section">
                        <div class="asset-edit-section-title">
                            <i data-lucide="receipt-indian-rupee"></i>
                            <div><h3>Purchase & maintenance</h3><p>Commercial details and planned-maintenance settings.</p></div>
                        </div>
                        <div class="asset-edit-grid">
                            <label>Supplier<input name="supplier" value="${assetEditorValue(asset.supplier)}"></label>
                            <label>Warranty<input name="warranty" value="${assetEditorValue(asset.warranty)}"></label>
                            <label>Purchase Date<input name="purchase_date" type="date" value="${assetEditorValue(asset.purchase_date)}"></label>
                            <label>Installation Date<input name="installation_date" type="date" value="${assetEditorValue(asset.installation_date)}"></label>
                            <label>Purchase Value<input name="purchase_value" type="number" min="0" step="0.01" value="${assetEditorValue(asset.purchase_value)}"></label>
                            <label>Tax Amount<input name="tax_amount" type="number" min="0" step="0.01" value="${assetEditorValue(asset.tax_amount)}"></label>
                            <label>PM Frequency (days)<input name="pm_frequency" type="number" min="0" value="${assetEditorValue(asset.pm_frequency)}"></label>
                            <label class="asset-edit-check"><input name="calibration_required" type="checkbox" ${asset.calibration_required ? "checked" : ""}><span>Calibration required</span></label>
                            <label class="is-wide">Remarks<textarea name="remarks" rows="3">${assetEditorValue(asset.remarks)}</textarea></label>
                        </div>
                    </section>
                    <p id="assetEditError" class="asset-edit-error" role="alert"></p>
                </div>

                <footer class="asset-edit-footer">
                    <button type="button" class="asset-edit-cancel" onclick="document.getElementById('assetEditDialog').close()">Cancel</button>
                    <button type="submit" class="asset-edit-save"><i data-lucide="save"></i><span>Save Changes</span></button>
                </footer>
            </form>
        `;

        dialog.querySelector("#assetEditForm").addEventListener("submit", event => saveAssetEdits(event, assetId, asset.service_team));
        if (window.lucide) lucide.createIcons();
        if (!dialog.open) dialog.showModal();
    } catch (error) {
        console.error(error);
        BioTrackToast.error("Asset editor unavailable", error.message || "Asset could not be opened for editing.");
    }
}

async function saveAssetEdits(event, assetId, originalServiceTeam) {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = form.querySelector(".asset-edit-save");
    const errorElement = form.querySelector("#assetEditError");
    const data = new FormData(form);
    const payload = Object.fromEntries(data.entries());
    payload.service_team = payload.service_team || originalServiceTeam;
    payload.calibration_required = form.elements.calibration_required.checked;

    try {
        submitButton.disabled = true;
        submitButton.querySelector("span").textContent = "Saving...";
        errorElement.textContent = "";

        const response = await fetch(`/api/assets/${assetId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || "Asset could not be updated.");

        document.getElementById("assetEditDialog")?.close();
        await loadAssetDetails(assetId);
        BioTrackToast.success("Asset updated", "The equipment details were saved successfully.");
    } catch (error) {
        console.error(error);
        errorElement.textContent = error.message || "Asset could not be updated.";
        BioTrackToast.error("Asset update failed", errorElement.textContent);
    } finally {
        submitButton.disabled = false;
        submitButton.querySelector("span").textContent = "Save Changes";
    }
}
