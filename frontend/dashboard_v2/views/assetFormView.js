// ==========================================
// ASSET FORM STATE
// ==========================================

let currentStep = 1;

const assetFormData = {};
// ==========================================
// ASSET REGISTRATION PAGE
// ==========================================

function renderAssetForm() {

    pageContent.innerHTML = `

    <div class="asset-form-page">

        <!-- ==========================================
             PAGE HEADER
        ========================================== -->

        <div class="asset-form-header">

            <button
                class="btn-secondary"
                onclick="navigate('assets')">

                ← Back to Assets

            </button>

            <div class="asset-form-title">

                <span class="asset-badge">

                    Biomedical Asset Registration

                </span>

                <h1>Register New Biomedical Asset</h1>

                <p>

                    Create a complete biomedical equipment record for the hospital asset registry.

                </p>

            </div>

        </div>

        <!-- ==========================================
             PROGRESS BAR
        ========================================== -->

        <div class="asset-progress">

            <div class="progress-step active">

                <span>1</span>

                <p>Basic</p>

            </div>

            <div class="progress-line"></div>

            <div class="progress-step">

                <span>2</span>

                <p>Purchase</p>

            </div>

            <div class="progress-line"></div>

            <div class="progress-step">

                <span>3</span>

                <p>Technical</p>

            </div>

            <div class="progress-line"></div>

            <div class="progress-step">

                <span>4</span>

                <p>Maintenance</p>

            </div>

            <div class="progress-line"></div>

            <div class="progress-step">

                <span>5</span>

                <p>Documents</p>

            </div>

        </div>

        <!-- ==========================================
             FORM CONTAINER
        ========================================== -->

        <div class="asset-form-container">

            <div id="assetFormSection">

            </div>

        </div>

        <!-- ==========================================
             FOOTER
        ========================================== -->

        <div class="asset-form-footer">

            <button
                id="previousStepBtn"
                class="btn-secondary">

                ← Previous

            </button>

            <button
                id="nextStepBtn"
                class="btn-primary">

                Next →

            </button>

        </div>

    </div>

    `;

    renderBasicInformationSection();

    initializeAssetFormNavigation();


}
// ==========================================
// BASIC INFORMATION
// ==========================================

function renderBasicInformationSection() {

    document.getElementById("assetFormSection").innerHTML = `

    <div class="asset-form-card">

        <div class="asset-section-title">

            <h2>Basic Information</h2>

            <p>

                Enter the primary identification details for the equipment.

            </p>

        </div>

        <div class="asset-form-grid">

            <!-- Equipment ID -->

            <div class="form-group">

                <label>
                    Equipment ID <span class="required">*</span>
                </label>

                <input
                    id="equipmentId"
                    type="text"
                    placeholder="Example : LFH-INF-0001">

            </div>

            <!-- Equipment Name -->

            <div class="form-group">

                <label>Equipment Name</label>

                <input
                    id="equipmentName"
                    type="text"
                    placeholder="Example : Infusion Pump">

            </div>

            <!-- Asset Code -->

            <div class="form-group">

                <label>Asset Code</label>

                <input
                    id="assetCode"
                    type="text">

            </div>

            <!-- Asset Category -->

            <div class="form-group">

                <label>Asset Category</label>

                <select id="assetCategory">

                    <option value="">Select Category</option>

                    <option>Patient Monitor</option>
                    <option>Infusion Pump</option>
                    <option>Syringe Pump</option>
                    <option>Defibrillator</option>
                    <option>ECG Machine</option>
                    <option>Ventilator</option>
                    <option>Ultrasound</option>
                    <option>X-Ray</option>
                    <option>Laboratory Equipment</option>
                    <option>Other</option>

                </select>

            </div>

            <!-- Department -->

            <div class="form-group">

                <label>Department</label>

                <input
                    id="department"
                    type="text"
                    placeholder="Example : ICU">

            </div>

            <!-- Location -->

            <div class="form-group">

                <label>Location</label>

                <input
                    id="location"
                    type="text"
                    placeholder="Example : ICU Room 4">

            </div>

            <!-- Room -->

            <div class="form-group">

                <label>Room / Ward</label>

                <input
                    id="room"
                    type="text">

            </div>

            <!-- Status -->

            <div class="form-group">

                <label>Status</label>

                <select id="status">

                    <option>Active</option>
                    <option>Standby</option>
                    <option>Under Repair</option>
                    <option>Out of Service</option>
                    <option>Condemned</option>

                </select>

            </div>

            <!-- Critical Asset -->

            <div class="form-group">

                <label>Critical Asset</label>

                <select id="criticalAsset">

                    <option>No</option>
                    <option>Yes</option>

                </select>

            </div>

            <!-- Equipment Type -->

            <div class="form-group">

                <label>Equipment Type</label>

                <input
                    id="equipmentType"
                    type="text"
                    placeholder="Example : Diagnostic">

            </div>

        </div>

        <div class="form-group full-width">

            <label>Description</label>

            <textarea
                id="description"
                rows="5"
                placeholder="Enter additional information about this equipment..."></textarea>

        </div>

        </div>

    </div>

    `;
    restoreFormValues();
}
// ==========================================
// SHOW CURRENT STEP
// ==========================================

function showCurrentStep() {

    switch (currentStep) {

        case 1:
            renderBasicInformationSection();
            break;

        case 2:
            renderPurchaseInformationSection();
            break;

        case 3:
            renderTechnicalInformationSection();
            break;

        case 4:
            renderWarrantyInformationSection();
            break;

        case 5:
            renderDocumentsSection();
            break;

    }

    updateProgress();

}
// ==========================================
// FORM NAVIGATION
// ==========================================

function initializeAssetFormNavigation() {

    const nextButton = document.getElementById("nextStepBtn");
    const previousButton = document.getElementById("previousStepBtn");

    if (!nextButton || !previousButton) return;

    previousButton.onclick = () => {

        switch (currentStep) {

            case 2:
                savePurchaseInformation();
                break;

            case 3:
                saveTechnicalInformation();
                break;

            case 4:
                saveWarrantyInformation();
                break;

        }

        if (currentStep <= 1) return;

    currentStep--;

    showCurrentStep();

};

    nextButton.onclick = () => {

        switch (currentStep) {

            case 1:
                saveBasicInformation();
                break;

            case 2:
                savePurchaseInformation();
                break;

            case 3:
                saveTechnicalInformation();
                break;

            case 4:
                saveWarrantyInformation();
                break;

        }

        if (currentStep < 5) {

            currentStep++;

            showCurrentStep();

        }

    };

    updateProgress();

}

// ==========================================
// SAVE BASIC INFORMATION
// ==========================================

function saveBasicInformation() {

    assetFormData.equipmentId =
        document.getElementById("equipmentId").value;

    assetFormData.equipmentName =
        document.getElementById("equipmentName").value;

    assetFormData.assetCode =
        document.getElementById("assetCode").value;

    assetFormData.assetCategory =
        document.getElementById("assetCategory").value;

    assetFormData.department =
        document.getElementById("department").value;

    assetFormData.location =
        document.getElementById("location").value;

    assetFormData.room =
        document.getElementById("room").value;

    assetFormData.status =
        document.getElementById("status").value;

    assetFormData.criticalAsset =
        document.getElementById("criticalAsset").value;

    assetFormData.equipmentType =
        document.getElementById("equipmentType").value;

    assetFormData.description =
        document.getElementById("description").value;

    console.log(assetFormData);

}
 
// ==========================================
// PURCHASE INFORMATION
// ==========================================

function renderPurchaseInformationSection() {

    document.getElementById("assetFormSection").innerHTML = `

    <div class="asset-form-card">

        <div class="asset-section-title">

            <h2>Purchase Information</h2>

            <p>

                Enter purchase and supplier details.

            </p>

        </div>

        <div class="asset-form-grid">

            <div class="form-group">

                <label>Purchase Date</label>

                <input
                    id="purchaseDate"
                    type="date">

            </div>

            <div class="form-group">

                <label>Installation Date</label>

                <input
                    id="installationDate"
                    type="date">

            </div>

            <div class="form-group">

                <label>Supplier</label>

                <input
                    id="supplier"
                    type="text"
                    placeholder="Supplier Name">

            </div>

            <div class="form-group">

                <label>Vendor</label>

                <input
                    id="vendor"
                    type="text"
                    placeholder="Vendor Name">

            </div>

            <div class="form-group">

                <label>Purchase Cost</label>

                <input
                    id="purchaseCost"
                    type="number"
                    placeholder="₹">

            </div>

            <div class="form-group">

                <label>GST (%)</label>

                <input
                    id="gst"
                    type="number">

            </div>

            <div class="form-group">

                <label>Invoice Number</label>

                <input
                    id="invoiceNumber"
                    type="text">

            </div>

            <div class="form-group">

                <label>Purchase Order Number</label>

                <input
                    id="poNumber"
                    type="text">

            </div>

            <div class="form-group">

                <label>Tender Number</label>

                <input
                    id="tenderNumber"
                    type="text">

            </div>

            <div class="form-group">

                <label>Funding Source</label>

                <input
                    id="fundingSource"
                    type="text">

            </div>

        </div>

    </div>

    `;

    restoreFormValues();

    }
// ==========================================
// TECHNICAL INFORMATION
// ==========================================

function renderTechnicalInformationSection() {

    document.getElementById("assetFormSection").innerHTML = `

    <div class="asset-form-card">

        <div class="asset-section-title">

            <h2>Technical Information</h2>

            <p>

                Enter equipment technical specifications.

            </p>

        </div>

        <div class="asset-form-grid">

            <div class="form-group">

                <label>Manufacturer</label>

                <input
                    id="manufacturer"
                    type="text">

            </div>

            <div class="form-group">

                <label>Manufacturer Address</label>

                <input
                    id="manufacturerAddress"
                    type="text">

            </div>

            <div class="form-group">

                <label>Model</label>

                <input
                    id="model"
                    type="text">

            </div>

            <div class="form-group">

                <label>Model Number</label>

                <input
                    id="modelNumber"
                    type="text">

            </div>

            <div class="form-group">

                <label>Serial Number</label>

                <input
                    id="serialNumber"
                    type="text">

            </div>

            <div class="form-group">

                <label>Manufacturer Year</label>

                <input
                    id="manufacturerYear"
                    type="number">

            </div>

            <div class="form-group">

                <label>Electrical Rating</label>

                <input
                    id="electricalRating"
                    type="text">

            </div>

            <div class="form-group">

                <label>Power Requirement</label>

                <input
                    id="powerRequirement"
                    type="text">

            </div>

        </div>

    </div>

`;

    restoreFormValues();

}
// ==========================================
// WARRANTY INFORMATION
// ==========================================

function renderWarrantyInformationSection() {

    document.getElementById("assetFormSection").innerHTML = `

    <div class="asset-form-card">

        <div class="asset-section-title">

            <h2>Warranty & Service Contracts</h2>

            <p>

                Enter warranty, AMC and CMC details.

            </p>

        </div>

        <div class="asset-form-grid">

            <div class="form-group">

                <label>Warranty Available</label>

                <select id="warrantyAvailable">

                    <option>No</option>
                    <option>Yes</option>

                </select>

            </div>

            <div class="form-group">

                <label>Warranty Start</label>

                <input
                    id="warrantyStart"
                    type="date">

            </div>

            <div class="form-group">

                <label>Warranty End</label>

                <input
                    id="warrantyEnd"
                    type="date">

            </div>

            <div class="form-group">

                <label>AMC Available</label>

                <select id="amcAvailable">

                    <option>No</option>
                    <option>Yes</option>

                </select>

            </div>

            <div class="form-group">

                <label>AMC Provider</label>

                <input
                    id="amcProvider"
                    type="text">

            </div>

            <div class="form-group">

                <label>AMC Expiry</label>

                <input
                    id="amcExpiry"
                    type="date">

            </div>

            <div class="form-group">

                <label>CMC Available</label>

                <select id="cmcAvailable">

                    <option>No</option>
                    <option>Yes</option>

                </select>

            </div>

            <div class="form-group">

                <label>CMC Provider</label>

                <input
                    id="cmcProvider"
                    type="text">

            </div>

            <div class="form-group">

                <label>CMC Expiry</label>

                <input
                    id="cmcExpiry"
                    type="date">

            </div>

        </div>

    </div>

`;

    restoreFormValues();

}
// ==========================================
// DOCUMENTS & FINAL REVIEW
// ==========================================

function renderDocumentsSection() {

    document.getElementById("assetFormSection").innerHTML = `

    <div class="asset-form-card">

        <div class="asset-section-title">

            <h2>Documents & Images</h2>

            <p>

                Upload equipment related files before saving.

            </p>

        </div>

        <div class="asset-form-grid">

            <div class="form-group">

                <label>Equipment Image</label>

                <input
                    id="equipmentImage"
                    type="file"
                    accept="image/*">

            </div>

            <div class="form-group">

                <label>User Manual</label>

                <input
                    id="manualFile"
                    type="file"
                    accept=".pdf,.doc,.docx">

            </div>

            <div class="form-group">

                <label>Invoice Copy</label>

                <input
                    id="invoiceFile"
                    type="file"
                    accept=".pdf,.jpg,.png">

            </div>

            <div class="form-group">

                <label>Warranty Certificate</label>

                <input
                    id="warrantyFile"
                    type="file">

            </div>

            <div class="form-group">

                <label>Calibration Certificate</label>

                <input
                    id="calibrationFile"
                    type="file">

            </div>

            <div class="form-group">

                <label>Other Documents</label>

                <input
                    id="otherFiles"
                    type="file"
                    multiple>

            </div>

        </div>

        <hr style="margin:40px 0;">

        <div class="asset-section-title">

            <h2>Final Review</h2>

            <p>

                Verify all information before saving.

            </p>

        </div>

        <div id="assetSummary"></div>

        <div style="margin-top:35px;display:flex;gap:15px;flex-wrap:wrap;">

            <button
                id="saveAssetBtn"
                class="btn-primary">

                💾 Save Asset

            </button>

            <button
                id="saveQrBtn"
                class="btn-secondary">

                🏷 Save & Generate QR

            </button>

        </div>

    </div>

    `;

    renderAssetSummary();

    initializeFinalButtons();

    restoreFormValues();

 

    

}
// ==========================================
// REVIEW SUMMARY
// ==========================================

function renderAssetSummary() {

    const container =
        document.getElementById("assetSummary");

    container.innerHTML = `

        <table class="asset-summary-table">

            <tr>

                <td><strong>Equipment ID</strong></td>

                <td>${assetFormData.equipmentId || "-"}</td>

            </tr>

            <tr>

                <td><strong>Equipment Name</strong></td>

                <td>${assetFormData.equipmentName || "-"}</td>

            </tr>

            <tr>

                <td><strong>Department</strong></td>

                <td>${assetFormData.department || "-"}</td>

            </tr>

            <tr>

                <td><strong>Manufacturer</strong></td>

                <td>${assetFormData.manufacturer || "-"}</td>

            </tr>

            <tr>

                <td><strong>Purchase Cost</strong></td>

                <td>${assetFormData.purchaseCost || "-"}</td>

            </tr>

            <tr>

                <td><strong>Warranty End</strong></td>

                <td>${assetFormData.warrantyEnd || "-"}</td>

            </tr>

        </table>

    `;

}
// ==========================================
// FINAL BUTTONS
// ==========================================

function initializeFinalButtons() {

    document
        .getElementById("saveAssetBtn")
        .onclick = saveAsset;

    document
        .getElementById("saveQrBtn")
        .onclick = saveAndGenerateQR;

}
// ==========================================
// SAVE ASSET
// ==========================================

async function saveAsset() {
    saveWarrantyInformation();

    try {

        const response = await fetch("/api/assets/", {

            method: "POST",

            headers: {

                "Content-Type": "application/json"

            },

            body: JSON.stringify(assetFormData)

        });

        const result = await response.json();

        if (result.success) {

            alert("Asset Saved Successfully!");

            navigate("assets");

        }

        else {

            alert("Failed to save asset.");

        }

    }

    catch (error) {

        console.error(error);

        alert("Server Error");

    }

}
// ==========================================
// SAVE & QR
// ==========================================

function saveAndGenerateQR() {

    console.log(assetFormData);

    alert("Asset Saved. QR Generation Coming Next.");

}
// ==========================================
// SAVE PURCHASE INFORMATION
// ==========================================

function savePurchaseInformation() {

    assetFormData.purchaseDate =
        document.getElementById("purchaseDate").value;

    assetFormData.installationDate =
        document.getElementById("installationDate").value;

    assetFormData.supplier =
        document.getElementById("supplier").value;

    assetFormData.vendor =
        document.getElementById("vendor").value;

    assetFormData.purchaseCost =
        document.getElementById("purchaseCost").value;

    assetFormData.gst =
        document.getElementById("gst").value;

    assetFormData.invoiceNumber =
        document.getElementById("invoiceNumber").value;

    assetFormData.poNumber =
        document.getElementById("poNumber").value;

    assetFormData.tenderNumber =
        document.getElementById("tenderNumber").value;

    assetFormData.fundingSource =
        document.getElementById("fundingSource").value;

}
// ==========================================
// SAVE TECHNICAL INFORMATION
// ==========================================

function saveTechnicalInformation() {

    assetFormData.manufacturer =
        document.getElementById("manufacturer").value;

    assetFormData.manufacturerAddress =
        document.getElementById("manufacturerAddress").value;

    assetFormData.model =
        document.getElementById("model").value;

    assetFormData.modelNumber =
        document.getElementById("modelNumber").value;

    assetFormData.serialNumber =
        document.getElementById("serialNumber").value;

    assetFormData.manufacturerYear =
        document.getElementById("manufacturerYear").value;

    assetFormData.electricalRating =
        document.getElementById("electricalRating").value;

    assetFormData.powerRequirement =
        document.getElementById("powerRequirement").value;

}
// ==========================================
// SAVE WARRANTY INFORMATION
// ==========================================

function saveWarrantyInformation() {

    assetFormData.warrantyAvailable =
        document.getElementById("warrantyAvailable").value;

    assetFormData.warrantyStart =
        document.getElementById("warrantyStart").value;

    assetFormData.warrantyEnd =
        document.getElementById("warrantyEnd").value;

    assetFormData.amcAvailable =
        document.getElementById("amcAvailable").value;

    assetFormData.amcProvider =
        document.getElementById("amcProvider").value;

    assetFormData.amcExpiry =
        document.getElementById("amcExpiry").value;

    assetFormData.cmcAvailable =
        document.getElementById("cmcAvailable").value;

    assetFormData.cmcProvider =
        document.getElementById("cmcProvider").value;

    assetFormData.cmcExpiry =
        document.getElementById("cmcExpiry").value;

}


// ==========================================
// UPDATE PROGRESS
// ==========================================

function updateProgress() {

    const steps = document.querySelectorAll(".progress-step");

    steps.forEach((step, index) => {

        step.classList.toggle("active", index < currentStep);

    });

    const previousButton = document.getElementById("previousStepBtn");
    const nextButton = document.getElementById("nextStepBtn");

    if (previousButton) {

        previousButton.style.display =
            currentStep === 1 ? "none" : "inline-flex";

    }

    if (nextButton) {

        nextButton.style.display =
            currentStep === 5 ? "none" : "inline-flex";

    }

}

// ==========================================
// UPDATE FOOTER BUTTONS
// ==========================================

function updateFooterButtons() {

    const nextButton = document.getElementById("nextStepBtn");
    const previousButton = document.getElementById("previousStepBtn");

    if (!nextButton || !previousButton) return;

    if (currentStep === 5) {

        nextButton.style.display = "none";

    } else {

        nextButton.style.display = "inline-flex";

    }

}
// ==========================================
// RESTORE FORM VALUES
// ==========================================

function restoreFormValues() {

    Object.keys(assetFormData).forEach(key => {

        const element = document.getElementById(key);

        if (!element) return;

        if (element.type === "checkbox") {

            element.checked = assetFormData[key];

        }

        else {

            element.value = assetFormData[key] || "";

        }

    });

}   