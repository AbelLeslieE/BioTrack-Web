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

    initializeSubmitButton();

    initializeModalButtons();

    initializeNavigation();

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

        "failureDescription"

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