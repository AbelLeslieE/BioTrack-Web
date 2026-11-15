// ==========================================
// NEW REQUEST PAGE
// Dashboard V2
// ==========================================

// ==========================================
// INITIALIZE PAGE
// ==========================================

function initializeNewRequest() {

    initializeResetButton();

    initializeDepartmentDropdown();

    initializeRequesterFields();

    applyQRMaintenancePrefill();

    initializeSubmitButton();

    initializeModalButtons();

    initializeNavigation();

}

function initializeRequesterFields() {
    const department = document.getElementById("departmentSearch");
    const reportedBy = document.getElementById("reportedBy");
    const role = (localStorage.getItem("role") || "").toLowerCase();
    const assignedDepartment = (localStorage.getItem("department") || "").trim();
    const requesterName = (localStorage.getItem("name") || localStorage.getItem("username") || "").trim();

    if (department && assignedDepartment && role === "user") {
        department.value = assignedDepartment;
        department.readOnly = true;
    }
    if (reportedBy && requesterName) {
        reportedBy.value = requesterName;
        reportedBy.readOnly = true;
    }
}

function getQRMaintenancePrefill() {
    try {
        return JSON.parse(sessionStorage.getItem("qrMaintenancePrefill") || "null");
    } catch (error) {
        console.warn("Unable to read QR maintenance prefill", error);
        sessionStorage.removeItem("qrMaintenancePrefill");
        return null;
    }
}

function applyQRMaintenancePrefill() {
    const prefill = getQRMaintenancePrefill();
    if (!prefill) return;

    const values = {
        departmentSearch: prefill.department,
        locationRoom: prefill.location,
        equipmentIdentifier: prefill.equipment_identifier,
        equipmentName: prefill.equipment_name,
        makeModel: prefill.make_model,
        serviceTeam: prefill.service_team,
    };

    const lockableFields = new Set([
        "departmentSearch",
        "locationRoom",
        "equipmentIdentifier",
        "equipmentName",
        "makeModel",
    ]);

    Object.entries(values).forEach(([id, value]) => {
        const field = document.getElementById(id);
        if (!field) return;

        const suppliedValue = String(value ?? "").trim();
        if (suppliedValue) field.value = suppliedValue;
        field.classList.remove("input-error");

        if (!lockableFields.has(id)) return;
        const isDepartmentAccountField = id === "departmentSearch"
            && (localStorage.getItem("role") || "").toLowerCase() === "user";
        field.readOnly = Boolean(suppliedValue) || isDepartmentAccountField;
        field.classList.toggle("qr-prefill-locked", field.readOnly);
        field.classList.toggle("qr-prefill-missing", !field.readOnly);

        const existingHint = field.parentElement?.querySelector(".qr-missing-field-hint");
        if (existingHint) existingHint.remove();
        if (!field.readOnly) {
            const hint = document.createElement("small");
            hint.className = "qr-missing-field-hint";
            hint.textContent = "Not stored on this asset — please add it.";
            field.insertAdjacentElement("afterend", hint);
        }
    });

    const serviceTeam = document.getElementById("serviceTeam");
    if (serviceTeam) {
        const hasServiceTeam = ["Biomedical", "Electrical", "IT"].includes(prefill.service_team);
        serviceTeam.disabled = hasServiceTeam;
        serviceTeam.classList.toggle("qr-prefill-locked", hasServiceTeam);
        serviceTeam.classList.toggle("qr-prefill-missing", !hasServiceTeam);
        const existingHint = serviceTeam.parentElement?.querySelector(".qr-missing-field-hint");
        if (existingHint) existingHint.remove();
        if (!hasServiceTeam) {
            const hint = document.createElement("small");
            hint.className = "qr-missing-field-hint";
            hint.textContent = "No service team is stored — please select one.";
            serviceTeam.insertAdjacentElement("afterend", hint);
        }
    }

    const problemCategory = document.getElementById("problemCategory");
    if (problemCategory && !problemCategory.value) problemCategory.value = "Breakdown";

    const page = document.querySelector(".page-container");
    if (page && !document.getElementById("qrRequestPrefillBanner")) {
        const banner = document.createElement("div");
        banner.id = "qrRequestPrefillBanner";
        banner.className = "qr-request-prefill-banner";
        banner.innerHTML = '<span aria-hidden="true">✓</span><div><strong>Equipment added from QR scan</strong><p>Recorded equipment values are locked. Missing values are highlighted and can be added before you submit; the failure description is optional.</p></div>';
        page.querySelector(".page-header")?.insertAdjacentElement("afterend", banner);
    }
}

// ==========================================
// RESET BUTTON
// ==========================================

function initializeResetButton() {

    const resetButton =
        document.querySelector(".clear-btn");

    if (!resetButton) return;

    resetButton.addEventListener("click", clearForm);

}

// ==========================================
// CLEAR FORM
// ==========================================

function clearForm() {

    document
        .querySelectorAll("input:not([readonly]), textarea")
        .forEach(field => {

            field.value = "";

            field.classList.remove("input-error");

        });

    document
        .querySelectorAll("select")
        .forEach(select => {

            select.selectedIndex = 0;

        });

    const departmentList =
        document.getElementById("departmentList");

    if (departmentList) {

        departmentList.classList.remove("show");

    }

    showToast(
        "Form Cleared Successfully",
        "success"
    );

    applyQRMaintenancePrefill();

}

// ==========================================
// DEPARTMENT DROPDOWN
// ==========================================

function initializeDepartmentDropdown() {

    const searchInput =
        document.getElementById("departmentSearch");

    const dropdown =
        document.getElementById("departmentList");

    if (!searchInput || !dropdown) return;

    const items =
        document.querySelectorAll(".department-item");

    searchInput.addEventListener("focus", () => {

        dropdown.classList.add("show");

    });

    searchInput.addEventListener("input", () => {

        const value =
            searchInput.value.toLowerCase();

        items.forEach(item => {

            item.style.display =
                item.textContent
                    .toLowerCase()
                    .includes(value)
                    ? "block"
                    : "none";

        });

        dropdown.classList.add("show");

    });

    items.forEach(item => {

        item.addEventListener("click", () => {

            searchInput.value =
                item.textContent;

            dropdown.classList.remove("show");

        });

    });

    document.addEventListener("click", e => {

        if (!e.target.closest(".searchable-dropdown")) {

            dropdown.classList.remove("show");

        }

    });

}

// ==========================================
// FORM VALIDATION
// ==========================================

function validateForm() {

    const fields = [

        "departmentSearch",

        "locationRoom",

        "reportedBy",

        "equipmentIdentifier",

        "equipmentName",

        "problemCategory",

        "serviceTeam" // Biomedical Engineering, Electrical Engineering, or IT

    ];

    let valid = true;

    fields.forEach(id => {

        const field =
            document.getElementById(id);

        if (!field) return;

        field.classList.remove("input-error");

        if (!field.value.trim()) {

            field.classList.add("input-error");

            valid = false;

        }

    });

    return valid;

}

// ==========================================
// SUBMIT BUTTON
// ==========================================

function initializeSubmitButton() {

    const submitButton =
        document.getElementById("submitRequestBtn");

    if (!submitButton) return;

    // Prevent duplicate event listeners
    submitButton.replaceWith(submitButton.cloneNode(true));

    const newButton =
        document.getElementById("submitRequestBtn");

    newButton.addEventListener("click", submitRequest);

}

// ==========================================
// SUBMIT REQUEST
// ==========================================

async function submitRequest() {

    if (!validateForm()) {

        showToast(
            "Please complete all required fields",
            "error"
        );

        return;

    }

    try {

        const response = await fetch("/api/requests", {

            method: "POST",

            headers: {

                "Content-Type": "application/json"

            },

            body: JSON.stringify({

                department:
                    document.getElementById("departmentSearch").value,

                location:
                    document.getElementById("locationRoom").value,

                reported_by:
                    document.getElementById("reportedBy").value,

                // ==========================================
                // REQUEST OWNER
                // ==========================================

                created_by:
                    localStorage.getItem("username"),

                created_by_role:
                    localStorage.getItem("role"),

                equipment_identifier:
                    document.getElementById("equipmentIdentifier").value,

                equipment_name:
                    document.getElementById("equipmentName").value,

                make_model:
                    document.getElementById("makeModel").value,

                priority:
                    document.getElementById("priority").value,

                problem_category:
                    document.getElementById("problemCategory").value,

                service_team:
                    document.getElementById("serviceTeam").value,

                failure_description:
                    document.getElementById("failureDescription").value

            })

        });

        const data = await response.json();

        if (!response.ok) {

            throw new Error(data.detail || "Unable to save request");

        }

        // ==========================================
        // SUCCESS MODAL
        // ==========================================
        console.log("showSuccess =", typeof showSuccess);
        console.log("Submitting completed");
        showSuccess({

            title: "Request Submitted",

            message: `Your maintenance request (${data.ticket_number}) has been submitted successfully.`,

            buttonText: "Create Another Request",

            onClose() {

                sessionStorage.removeItem("qrMaintenancePrefill");

                document.getElementById("qrRequestPrefillBanner")?.remove();

                ["locationRoom", "equipmentIdentifier", "equipmentName", "makeModel"]
                    .forEach(id => {
                        const field = document.getElementById(id);
                        if (field) field.readOnly = false;
                    });

                const serviceTeam = document.getElementById("serviceTeam");
                if (serviceTeam) serviceTeam.disabled = false;

                clearForm();

                const firstField =
                    document.getElementById("departmentSearch");

                if (firstField) {

                    firstField.focus();

                }

            }

        });

        

    }

    catch (error) {

        console.error(error);

        showToast(

            error.message,

            "error"

        );

    }

}



function initializeModalButtons() {

    // Global success modal handles its own closing.
    // No page-specific modal logic is required.

}

// ==========================================
// NAVIGATION
// ==========================================

function initializeNavigation() {

    // Navigation is now handled through callbacks passed to
    // showSuccess() when required.

}
// ==========================================
// TOAST
// ==========================================

function showToast(message, type = "success") {

    const container =
        document.getElementById("toastContainer");

    if (!container) return;

    const toast =
        document.createElement("div");

    toast.className =
        `toast ${type}`;

    toast.innerHTML = `

        <span>

            ${type === "success" ? "✓" : "✕"}

        </span>

        <span>${message}</span>

    `;

    container.appendChild(toast);

    setTimeout(() => {

        toast.remove();

    }, 3000);

}
