// ===============================
// Reset Form
// ===============================

document.addEventListener("DOMContentLoaded", () => {

    const resetButton =
        document.querySelector(".clear-btn");

    resetButton.addEventListener("click", () => {

        const inputs =
            document.querySelectorAll(
                "input:not([readonly]), textarea"
            );

        const selects =
            document.querySelectorAll("select");

        inputs.forEach(input => {

            input.value = "";

        });

        selects.forEach(select => {

            select.selectedIndex = 0;

        });
        showToast(
            "Form Cleared Successfully",
            "success"
        );

    });

});
// ===============================
// Searchable Department Selector
// ===============================

document.addEventListener("DOMContentLoaded", () => {

    const searchInput =
        document.getElementById("departmentSearch");

    const dropdown =
        document.getElementById("departmentList");

    const items =
        document.querySelectorAll(".department-item");

    searchInput.addEventListener("focus", () => {

        dropdown.classList.add("show");

    });

    searchInput.addEventListener("input", () => {

        const value =
            searchInput.value.toLowerCase();

        items.forEach(item => {

            const text =
                item.textContent.toLowerCase();

            item.style.display =
                text.includes(value)
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

        if (
            !e.target.closest(".searchable-dropdown")
        ) {

            dropdown.classList.remove("show");

        }

    });

});
// ===============================
// Toast Notification System
// ===============================

function showToast(message, type = "success") {

    const container =
        document.getElementById("toastContainer");

    const toast =
        document.createElement("div");

    toast.className =
        `toast ${type}`;

    toast.innerHTML = `
        <span class="toast-icon">
            ${type === "success" ? "✓" : "✕"}
        </span>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {

        toast.classList.add("removing");

        setTimeout(() => {

            toast.remove();

        }, 300);

    }, 3000);
}
// ===============================
// Form Validation
// ===============================

function validateForm() {

    const requiredFields = [

        document.getElementById(
            "departmentSearch"
        ),

        document.getElementById(
            "locationRoom"
        ),

        document.getElementById(
            "reportedBy"
        ),

        document.getElementById(
            "equipmentIdentifier"
        ),

        document.getElementById(
            "equipmentName"
        ),

        document.getElementById(
            "problemCategory"
        ),

        document.getElementById(
            "failureDescription"
        )

    ];

    let valid = true;

    requiredFields.forEach(field => {

        field.classList.remove(
            "input-error"
        );

        if (
            !field.value ||
            field.value.trim() === ""
        ) {

            field.classList.add(
                "input-error"
            );

            valid = false;

        }

    });

    return valid;

}
// ===============================
// Success Modal
// ===============================

document.addEventListener("DOMContentLoaded", () => {

    const submitButton =
        document.querySelector(".save-btn");

    const modal =
        showSuccess({

            title: "Call Created",

            message: "Maintenance call has been created successfully."

        });

    const newRequestButton =
        document.getElementById("newRequestBtn");

    submitButton.addEventListener("click", async () => {

    if (!validateForm()) {

        showToast(
            "Please complete all required fields",
            "error"
        );

        return;
    }

    try {

        const response =
            await fetch(
                "/api/requests",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        department:
                            document.getElementById(
                                "departmentSearch"
                            ).value,

                        location:
                            document.getElementById(
                                "locationRoom"
                            ).value,

                        reported_by:
                            document.getElementById(
                                "reportedBy"
                            ).value,

                        equipment_identifier:
                            document.getElementById(
                                "equipmentIdentifier"
                            ).value,

                        equipment_name:
                            document.getElementById(
                                "equipmentName"
                            ).value,

                        make_model:
                            document.getElementById(
                                "makeModel"
                            ).value,

                        priority:
                            document.getElementById(
                                "priority"
                            ).value,

                        problem_category:
                            document.getElementById(
                                "problemCategory"
                            ).value,

                        failure_description:
                            document.getElementById(
                                "failureDescription"
                            ).value

                    })

                }
            );

        const data =
            await response.json();

        if (data.success) {

            document
                .getElementById(
                    "ticketNumber"
                )
                .textContent =
                data.ticket_number;
                        document
                .getElementById(
                    "submittedDepartment"
                )
                .textContent =
                document.getElementById(
                    "departmentSearch"
                ).value;

            document
                .getElementById(
                    "submittedTime"
                )
                .textContent =
                new Date().toLocaleString(
                    "en-IN"
                );

            showToast(
            "Request Saved Successfully",
            "success"
            );

            setTimeout(() => {

                modal.classList.add(
                    "show"
                );

            }, 1000);


        }
        else {

            showToast(
                "Failed to save request",
                "error"
            );

        }

    }
    catch (error) {

        console.error(error);

        showToast(
            "Server Connection Error",
            "error"
        );

    }

});

    newRequestButton.addEventListener("click", () => {

        // Close modal

        modal.classList.remove("show");

        // Clear all inputs

        document
            .querySelectorAll(
                "input:not([readonly]), textarea"
            )
            .forEach(field => {

                field.value = "";

                field.classList.remove(
                    "input-error"
                );

            });

        // Reset dropdowns

        document
            .querySelectorAll("select")
            .forEach(select => {

                select.selectedIndex = 0;

            });

        // Close department dropdown

        const departmentList =
            document.getElementById(
                "departmentList"
            );

        if (departmentList) {

            departmentList.classList.remove(
                "show"
            );

        }

        // Scroll to top

        window.scrollTo({

            top: 0,

            behavior: "smooth"

        });

    });

});

// ===============================
// Return To Dashboard
// ===============================

document.addEventListener("DOMContentLoaded", () => {

    const dashboardBtn =
        document.getElementById(
            "dashboardBtn"
        );

    if (dashboardBtn) {

        dashboardBtn.addEventListener(
            "click",
            () => {

                window.location.href =
                    "/static/user_dashboard.html";

            }
        );

    }

});
// ===============================
// Back To Dashboard
// ===============================

document.addEventListener("DOMContentLoaded", () => {

    const backBtn =
        document.getElementById(
            "backToDashboardBtn"
        );

    if (!backBtn) return;

    backBtn.addEventListener("click", () => {

        window.location.href =
            "/static/user_dashboard.html";

    });

});