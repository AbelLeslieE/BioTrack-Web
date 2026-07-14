/* ==========================================================
   BIOTRACK GLOBAL SUCCESS MODAL
========================================================== */

(function () {

    // ==========================================================
    // MODAL ELEMENTS
    // ==========================================================

    let overlay = null;

    let modal = null;

    let titleElement = null;

    let messageElement = null;

    let buttonElement = null;
    
    let closeCallback = null;

    // ==========================================================
    // CREATE MODAL
    // ==========================================================

    function createModal() {

        if (overlay) return;

        overlay = document.createElement("div");

        overlay.className = "success-modal-overlay";

        overlay.innerHTML = `

            <div class="success-modal">

                <div class="success-icon">

                    ✓

                </div>

                <h2></h2>

                <p></p>

                <button type="button">

                    Continue

                </button>

            </div>

        `;

        document.body.appendChild(overlay);

        modal = overlay.querySelector(".success-modal");

        titleElement = modal.querySelector("h2");

        messageElement = modal.querySelector("p");

        buttonElement = modal.querySelector("button");

        // Close button

        buttonElement.addEventListener("click", hideSuccess);

        // Click outside

        overlay.addEventListener("click", (event) => {

            if (event.target === overlay) {

                hideSuccess();

            }

        });

        // ESC key

        document.addEventListener("keydown", (event) => {

            if (
                event.key === "Escape" &&
                overlay.classList.contains("show")
            ) {

                hideSuccess();

            }

        });

    }

    // ==========================================================
    // SHOW
    // ==========================================================

    function showSuccess(options = {}) {

        createModal();

        titleElement.textContent =
            options.title || "Success";

        messageElement.textContent =
            options.message || "Operation completed successfully.";

        buttonElement.textContent =
            options.buttonText || "Continue";

        closeCallback =
            options.onClose || null;

        overlay.classList.add("show");

        buttonElement.focus();

    }
        

    // ==========================================================
    // HIDE
    // ==========================================================

    function hideSuccess() {

        if (!overlay) return;

        overlay.classList.remove("show");

        if (typeof closeCallback === "function") {

            const callback = closeCallback;

            closeCallback = null;

            callback();

        }

    }

   // ==========================================================
    // GLOBAL
    // ==========================================================

    window.showSuccess = showSuccess;

    window.hideSuccess = hideSuccess;

    })();
