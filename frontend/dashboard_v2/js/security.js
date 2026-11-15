// Shared output-encoding helpers for HTML assembled by dashboard views.
(function registerSecurityHelpers(global) {
    "use strict";

    let sessionExpiryInProgress = false;

    function normalizedDashboardRole(role) {
        const value = String(role || "").trim().toLowerCase();
        if (value === "manager") return "admin";
        if (value === "bme") return "engineer";
        return value;
    }

    global.clearDashboardIdentity = function clearDashboardIdentity() {
        ["role", "department", "username", "name"].forEach(key => localStorage.removeItem(key));
        sessionStorage.removeItem("qrMaintenancePrefill");
    };

    global.expireDashboardSession = async function expireDashboardSession(message = "") {
        if (sessionExpiryInProgress) return false;
        sessionExpiryInProgress = true;
        const notice = message === "User not found."
            ? "Your previous account session is no longer valid. Please sign in again."
            : (message || "Your session has expired. Please sign in again.");
        sessionStorage.setItem("biotrackLoginNotice", notice);
        global.clearDashboardIdentity();
        try {
            await fetch("/api/logout", { method: "POST" });
        } catch (error) {
            console.warn("Unable to clear the server session", error);
        }
        global.location.replace("/");
        return false;
    };

    global.validateDashboardSession = async function validateDashboardSession() {
        try {
            const response = await fetch("/api/auth/me", { cache: "no-store" });
            const profile = await response.json().catch(() => ({}));
            if (response.status === 401) {
                return global.expireDashboardSession(profile.detail);
            }
            if (!response.ok) {
                console.warn("Session validation is temporarily unavailable.");
                return true;
            }

            const dashboardRole = normalizedDashboardRole(profile.role);
            localStorage.setItem("role", dashboardRole);
            localStorage.setItem("department", profile.department || "");
            localStorage.setItem("username", profile.username || "");
            localStorage.setItem("name", profile.name || profile.username || "");
            return true;
        } catch (error) {
            console.warn("Unable to validate the current session", error);
            return true;
        }
    };

    global.escapeHTML = function escapeHTML(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    };
})(window);
