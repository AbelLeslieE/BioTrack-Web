// ==========================================
// LOGOUT
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    const logoutButton = document.querySelector(".logout-btn");
    if (!logoutButton) return;

    logoutButton.addEventListener("click", async () => {
        logoutButton.disabled = true;

        try {
            await fetch("/api/logout", {
                method: "POST"
            });
        } finally {
            if (typeof clearDashboardIdentity === "function") {
                clearDashboardIdentity();
            }

            window.location.href = "/";
        }

    });

});
