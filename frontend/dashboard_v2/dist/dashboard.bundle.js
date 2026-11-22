/* source: js/toast.js */
(function installBioTrackToasts() {
    "use strict";

    const TYPES = {
        success: { icon: "✓", title: "Success" },
        error: { icon: "!", title: "Something went wrong" },
        warning: { icon: "!", title: "Attention needed" },
        info: { icon: "i", title: "BioTrack" },
    };
    const activeToasts = new Set();

    function ensureRegion() {
        let region = document.getElementById("appToastRegion");
        if (region || !document.body) return region;
        region = document.createElement("div");
        region.id = "appToastRegion";
        region.className = "app-toast-region";
        region.setAttribute("aria-label", "BioTrack notifications");
        region.setAttribute("aria-live", "polite");
        region.setAttribute("aria-relevant", "additions");
        document.body.appendChild(region);
        return region;
    }

    function dismiss(toast) {
        if (!toast || !toast.isConnected || toast.classList.contains("is-leaving")) return;
        toast.classList.add("is-leaving");
        activeToasts.delete(toast);
        window.setTimeout(() => toast.remove(), 240);
    }

    function show({ title, message, type = "info", duration = 5200 } = {}) {
        const normalizedType = Object.hasOwn(TYPES, type) ? type : "info";
        const metadata = TYPES[normalizedType];
        const region = ensureRegion();
        if (!region) {
            document.addEventListener(
                "DOMContentLoaded",
                () => show({ title, message, type: normalizedType, duration }),
                { once: true },
            );
            return null;
        }

        while (activeToasts.size >= 4) dismiss(activeToasts.values().next().value);

        const toast = document.createElement("section");
        toast.className = `app-toast app-toast--${normalizedType}`;
        toast.setAttribute("role", normalizedType === "error" ? "alert" : "status");
        toast.style.setProperty("--toast-duration", `${Math.max(2500, duration)}ms`);

        const icon = document.createElement("span");
        icon.className = "app-toast__icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = metadata.icon;

        const copy = document.createElement("div");
        copy.className = "app-toast__copy";
        const heading = document.createElement("h3");
        heading.className = "app-toast__title";
        heading.textContent = String(title || metadata.title);
        const body = document.createElement("p");
        body.className = "app-toast__message";
        body.textContent = String(message || "");
        copy.append(heading, body);

        const close = document.createElement("button");
        close.className = "app-toast__close";
        close.type = "button";
        close.setAttribute("aria-label", "Dismiss notification");
        close.textContent = "×";
        close.addEventListener("click", () => dismiss(toast));

        const progress = document.createElement("span");
        progress.className = "app-toast__progress";
        progress.setAttribute("aria-hidden", "true");

        toast.append(icon, copy, close, progress);
        region.appendChild(toast);
        activeToasts.add(toast);
        requestAnimationFrame(() => toast.classList.add("is-visible"));

        window.setTimeout(() => dismiss(toast), Math.max(2500, duration));
        return toast;
    }

    const api = {
        show,
        success: (title, message, options = {}) => show({ ...options, title, message, type: "success" }),
        error: (title, message, options = {}) => show({ ...options, title, message, type: "error" }),
        warning: (title, message, options = {}) => show({ ...options, title, message, type: "warning" }),
        info: (title, message, options = {}) => show({ ...options, title, message, type: "info" }),
        dismissAll: () => [...activeToasts].forEach(dismiss),
    };

    window.BioTrackToast = api;
    window.notifyUser = function notifyUser(message, type = "info", title) {
        return show({ title, message, type });
    };

    // Safety net for older modules: native alerts become non-blocking BioTrack
    // notifications, so users never see the browser's "page says" dialog.
    window.alert = function toastInsteadOfAlert(message) {
        const text = String(message || "");
        const type = /failed|failure|error|unable|invalid|not found/i.test(text)
            ? "error"
            : /success|saved|imported|scheduled|updated|completed/i.test(text)
                ? "success"
                : /select|required|please|attention/i.test(text)
                    ? "warning"
                    : "info";
        return show({ message: text, type });
    };
})();
;
/* source: js/csrf.js */
(function installCsrfFetchProtection(global) {
    "use strict";

    const originalFetch = global.fetch.bind(global);
    const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

    function cookieValue(name) {
        const prefix = `${encodeURIComponent(name)}=`;
        const item = document.cookie.split(";").map(value => value.trim()).find(value => value.startsWith(prefix));
        return item ? decodeURIComponent(item.slice(prefix.length)) : "";
    }

    function csrfToken() {
        return cookieValue("__Host-biotrack_csrf") || cookieValue("biotrack_csrf");
    }

    global.fetch = function protectedFetch(input, init = {}) {
        const request = input instanceof Request ? input : null;
        const method = String(init.method || request?.method || "GET").toUpperCase();
        const url = new URL(request?.url || String(input), global.location.href);

        if (url.origin === global.location.origin && unsafeMethods.has(method)) {
            const token = csrfToken();
            if (token) {
                const headers = new Headers(init.headers || request?.headers || undefined);
                headers.set("X-CSRF-Token", token);
                init = { ...init, headers };
            }
        }
        return originalFetch(input, init);
    };
})(window);
;
/* source: dashboard_v2/js/security.js */
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
;
/* source: dashboard_v2/js/hospital_departments.js */
(function exposeHospitalDepartments(global) {
    const departments = [
        "Anaesthesiology and Critical Care",
        "Audiology and Speech Language Pathology",
        "Cardiothoracic Surgery",
        "Dental and Maxillofacial Surgery",
        "Dermatology",
        "ENT (Ear, Nose and Throat)",
        "Gastroenterology",
        "General Medicine",
        "General Surgery",
        "Haemato-Oncology",
        "Heart Care Centre (Cardiology)",
        "Neonatology",
        "Nephrology",
        "Neurology",
        "Neurosurgery",
        "Obstetrics and Gynaecology",
        "Ophthalmology",
        "Orthopaedics and Trauma Surgery",
        "Paediatrics",
        "Physiotherapy",
        "Pathology",
        "Plastic Surgery",
        "Psychiatry",
        "Pulmonology",
        "Radiology",
        "Urology",
        "Research",
    ];

    function escapeOption(value) {
        if (typeof global.escapeHTML === "function") return global.escapeHTML(value);
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    global.HOSPITAL_DEPARTMENTS = Object.freeze(departments.slice());
    global.renderHospitalDepartmentOptions = function renderHospitalDepartmentOptions(
        selectedDepartment = "",
        placeholder = "Select a department",
    ) {
        const selected = String(selectedDepartment || "").trim();
        const knownDepartment = departments.includes(selected);
        const placeholderOption = `<option value="" ${selected ? "" : "selected"} disabled>${escapeOption(placeholder)}</option>`;
        const existingOption = selected && !knownDepartment
            ? `<option value="${escapeOption(selected)}" selected>${escapeOption(selected)} (existing)</option>`
            : "";
        const options = departments.map(department => (
            `<option value="${escapeOption(department)}" ${department === selected ? "selected" : ""}>${escapeOption(department)}</option>`
        )).join("");
        return placeholderOption + existingOption + options;
    };
})(window);
;
/* source: dashboard_v2/js/assetRelocation.js */
(function exposeAssetRelocation(global) {
    "use strict";

    let escapeHandler = null;

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function toast(type, title, message) {
        if (global.BioTrackToast?.[type]) global.BioTrackToast[type](title, message);
    }

    async function responseJson(response) {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            const detail = Array.isArray(payload.detail)
                ? payload.detail.map(item => item.msg || String(item)).join("\n")
                : payload.detail;
            throw new Error(detail || "The relocation request could not be processed.");
        }
        return payload;
    }

    function close() {
        document.getElementById("assetRelocationOverlay")?.remove();
        document.body.classList.remove("asset-management-dialog-open");
        if (escapeHandler) document.removeEventListener("keydown", escapeHandler);
        escapeHandler = null;
    }

    function mount(content) {
        close();
        const overlay = document.createElement("div");
        overlay.id = "assetRelocationOverlay";
        overlay.className = "asset-management-overlay";
        overlay.innerHTML = content;
        document.body.appendChild(overlay);
        document.body.classList.add("asset-management-dialog-open");
        overlay.querySelectorAll("[data-close-relocation]").forEach(button => button.addEventListener("click", close));
        escapeHandler = event => {
            if (event.key === "Escape") close();
        };
        document.addEventListener("keydown", escapeHandler);
        if (global.lucide) global.lucide.createIcons();
        return overlay;
    }

    async function loadMine() {
        const response = await fetch("/api/assets/relocation-requests/mine", { headers: { Accept: "application/json" } });
        return responseJson(response);
    }

    function openRequest(asset) {
        const departmentOptions = typeof global.renderHospitalDepartmentOptions === "function"
            ? global.renderHospitalDepartmentOptions(asset.department || "", "Select destination department")
            : `<option value="${escapeHtml(asset.department || "")}" selected>${escapeHtml(asset.department || "Current department")}</option>`;
        const overlay = mount(`
            <section class="asset-management-dialog relocation-request-dialog" role="dialog" aria-modal="true" aria-labelledby="relocationRequestTitle">
                <header>
                    <span><i data-lucide="route"></i></span>
                    <div><h2 id="relocationRequestTitle">Request asset relocation</h2><p>The ${escapeHtml(asset.service_team || "Biomedical")} engineering team will review this request before the asset record changes.</p></div>
                    <button class="asset-management-close" type="button" data-close-relocation aria-label="Close"><i data-lucide="x"></i></button>
                </header>
                <form id="assetRelocationRequestForm" class="relocation-request-form">
                    <div class="relocation-asset-summary">
                        <span><i data-lucide="monitor-cog"></i></span>
                        <div><strong>${escapeHtml(asset.equipment_name || "Hospital asset")}</strong><small>${escapeHtml(asset.asset_code || asset.equipment_no || `Asset ${asset.id}`)} · ${escapeHtml(asset.service_team || "Biomedical")}</small></div>
                    </div>
                    <div class="relocation-current-location"><span>Current assignment</span><strong>${escapeHtml(asset.department || "Unassigned")} · ${escapeHtml(asset.location || "No room recorded")}</strong></div>
                    <div class="relocation-form-grid">
                        <label>Destination department<select id="relocationTargetDepartment" required>${departmentOptions}</select></label>
                        <label>Destination room / location<input id="relocationTargetLocation" maxlength="255" placeholder="Example: Ward 3 / Room 204"></label>
                    </div>
                    <label>Reason or handling instructions <span>(optional)</span><textarea id="relocationReason" maxlength="2000" placeholder="Explain why the asset should be moved or any precautions for the engineering team."></textarea></label>
                    <p class="relocation-form-note"><i data-lucide="info"></i> The current location remains unchanged until the engineering team approves this request.</p>
                    <footer><button type="button" class="asset-dialog-secondary" data-close-relocation>Cancel</button><button id="submitRelocationRequest" type="submit" class="relocation-primary-button"><i data-lucide="send"></i> Send request</button></footer>
                </form>
            </section>
        `);
        overlay.querySelector("#assetRelocationRequestForm").addEventListener("submit", async event => {
            event.preventDefault();
            const submit = overlay.querySelector("#submitRelocationRequest");
            submit.disabled = true;
            submit.innerHTML = '<span class="relocation-button-spinner" aria-hidden="true"></span> Sending…';
            try {
                await responseJson(await fetch("/api/assets/relocation-requests", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Accept: "application/json" },
                    body: JSON.stringify({
                        asset_id: asset.id,
                        target_department: overlay.querySelector("#relocationTargetDepartment").value,
                        target_location: overlay.querySelector("#relocationTargetLocation").value.trim(),
                        reason: overlay.querySelector("#relocationReason").value.trim(),
                    }),
                }));
                close();
                toast("success", "Relocation request sent", `The ${asset.service_team || "Biomedical"} engineering team has been notified.`);
                await global.loadMyAssets?.();
                await global.BioTrackNotifications?.fetch?.({ allowDesktop: false });
            } catch (error) {
                toast("error", "Request not sent", error.message);
                submit.disabled = false;
                submit.innerHTML = '<i data-lucide="send"></i> Send request';
                global.lucide?.createIcons();
            }
        });
    }

    function queueCard(item) {
        const destination = `${item.target_department || "Unassigned"}${item.target_location ? ` · ${item.target_location}` : ""}`;
        const origin = `${item.from_department || "Unassigned"}${item.from_location ? ` · ${item.from_location}` : ""}`;
        return `
            <article class="relocation-queue-card" data-relocation-request="${item.id}">
                <div class="relocation-queue-heading"><span><i data-lucide="monitor-cog"></i></span><div><strong>${escapeHtml(item.equipment_name || "Hospital asset")}</strong><small>${escapeHtml(item.asset_code || `Asset ${item.asset_id}`)} · ${escapeHtml(item.service_team || "Biomedical")}</small></div><em>Pending</em></div>
                <div class="relocation-route"><div><span>From</span><strong>${escapeHtml(origin)}</strong></div><i data-lucide="arrow-right"></i><div><span>To</span><strong>${escapeHtml(destination)}</strong></div></div>
                <p><strong>Requested by ${escapeHtml(item.requested_by || "Department user")}</strong>${item.reason ? `<br>${escapeHtml(item.reason)}` : "<br>No additional reason supplied."}</p>
                <label>Engineering note <span>(optional)</span><textarea data-relocation-review-note maxlength="2000" placeholder="Add approval or rejection notes for the department."></textarea></label>
                <footer><button type="button" class="relocation-reject-button" data-relocation-decision="reject"><i data-lucide="x"></i> Reject</button><button type="button" class="relocation-primary-button" data-relocation-decision="approve"><i data-lucide="check"></i> Approve & update asset</button></footer>
            </article>
        `;
    }

    async function openQueue() {
        let items;
        try {
            items = await responseJson(await fetch("/api/assets/relocation-requests?status=Pending", { headers: { Accept: "application/json" } }));
        } catch (error) {
            toast("error", "Relocation requests unavailable", error.message);
            return;
        }
        const overlay = mount(`
            <section class="asset-management-dialog relocation-queue-dialog" role="dialog" aria-modal="true" aria-labelledby="relocationQueueTitle">
                <header><span><i data-lucide="route"></i></span><div><h2 id="relocationQueueTitle">Asset relocation requests</h2><p>Approve requests assigned to your engineering service team. Approval updates the asset department and room.</p></div><button class="asset-management-close" type="button" data-close-relocation aria-label="Close"><i data-lucide="x"></i></button></header>
                <div class="relocation-queue-list">${items.length ? items.map(queueCard).join("") : '<div class="relocation-empty-state"><i data-lucide="circle-check-big"></i><strong>No pending relocation requests</strong><p>Your engineering queue is clear.</p></div>'}</div>
            </section>
        `);
        overlay.querySelectorAll("[data-relocation-decision]").forEach(button => button.addEventListener("click", async () => {
            const card = button.closest("[data-relocation-request]");
            const requestId = Number(card.dataset.relocationRequest);
            const decision = button.dataset.relocationDecision;
            card.querySelectorAll("button").forEach(item => item.disabled = true);
            try {
                await responseJson(await fetch(`/api/assets/relocation-requests/${requestId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json", Accept: "application/json" },
                    body: JSON.stringify({ decision, review_note: card.querySelector("[data-relocation-review-note]").value.trim() }),
                }));
                const approved = decision === "approve";
                toast(
                    "success",
                    approved ? "Relocation approved" : "Relocation rejected",
                    approved
                        ? "The asset department and location have been updated."
                        : "The department user has been notified.",
                );
                await global.loadAssets?.();
                await global.BioTrackNotifications?.fetch?.({ allowDesktop: false });
                await openQueue();
            } catch (error) {
                toast("error", "Unable to review request", error.message);
                card.querySelectorAll("button").forEach(item => item.disabled = false);
            }
        }));
    }

    global.AssetRelocation = { close, loadMine, openRequest, openQueue };
    global.closeAssetRelocationDialog = close;
})(window);
;
/* source: dashboard_v2/js/api.js */
// ==========================================
// API URL
// ==========================================

const API = {

    dashboard: "/api/dashboard/v2"

};

async function fetchPaginatedList(endpoint, options = {}, pageSize = 250) {
    const items = [];
    let offset = 0;

    while (true) {
        const url = new URL(endpoint, window.location.origin);
        url.searchParams.set("limit", String(pageSize));
        url.searchParams.set("offset", String(offset));
        const response = await fetch(`${url.pathname}${url.search}`, options);
        const page = await response.json().catch(() => ([]));
        if (!response.ok) {
            throw new Error(page.detail || `Request failed with status ${response.status}.`);
        }
        if (!Array.isArray(page)) {
            throw new Error("The server returned an invalid paginated response.");
        }
        items.push(...page);
        if (page.length < pageSize) return items;
        offset += page.length;
        if (offset >= 100000) {
            throw new Error("The result set is too large to load safely.");
        }
    }
}
// ==========================================
// LOGOUT
// ==========================================

async function logoutUser() {

    await fetch("/api/logout", {
        method: "POST"
    });

}
// ==========================================
// FETCH DASHBOARD
// ==========================================

async function getDashboardData() {

    try {

        const response = await fetch(API.dashboard);

        return await response.json();

    }

    catch (error) {

        console.error(error);

        return null;

    }

}
;
/* source: dashboard_v2/js/pagination.js */
/* Shared client-side pagination for the data tables in BioTrack. */
(function () {
    const PAGE_SIZES = [10, 25, 50, 100];

    function renderPagination(container, state, totalItems, onChange, label = "items") {
        if (!container) return;

        const pageSize = PAGE_SIZES.includes(Number(state.pageSize))
            ? Number(state.pageSize)
            : PAGE_SIZES[0];
        const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
        const page = Math.min(Math.max(1, Number(state.page) || 1), totalPages);

        state.page = page;
        state.pageSize = pageSize;

        if (totalItems === 0) {
            container.innerHTML = "";
            return;
        }

        const start = (page - 1) * pageSize + 1;
        const end = Math.min(page * pageSize, totalItems);
        const pageButtons = [];

        for (let value = Math.max(1, page - 2); value <= Math.min(totalPages, page + 2); value += 1) {
            pageButtons.push(`<button type="button" class="pagination-page ${value === page ? "is-active" : ""}" data-page="${value}" aria-label="Page ${value}">${value}</button>`);
        }

        container.innerHTML = `
            <div class="pagination-summary">Showing ${start}-${end} of ${totalItems} ${label}</div>
            <div class="pagination-controls">
                <label class="pagination-size-label">Rows per page
                    <select class="pagination-size" aria-label="Rows per page">
                        ${PAGE_SIZES.map(size => `<option value="${size}" ${size === pageSize ? "selected" : ""}>${size}</option>`).join("")}
                    </select>
                </label>
                <div class="pagination-pages" aria-label="Pagination">
                    <button type="button" class="pagination-page" data-page="${page - 1}" ${page === 1 ? "disabled" : ""}>Previous</button>
                    ${pageButtons.join("")}
                    <button type="button" class="pagination-page" data-page="${page + 1}" ${page === totalPages ? "disabled" : ""}>Next</button>
                </div>
            </div>
        `;

        container.querySelector(".pagination-size").addEventListener("change", (event) => {
            state.pageSize = Number(event.target.value);
            state.page = 1;
            onChange();
        });

        container.querySelectorAll("[data-page]").forEach((button) => {
            button.addEventListener("click", () => {
                const nextPage = Number(button.dataset.page);
                if (nextPage < 1 || nextPage > totalPages || nextPage === state.page) return;
                state.page = nextPage;
                onChange();
            });
        });
    }

    window.TablePagination = {
        pageItems(items, state) {
            const totalPages = Math.max(1, Math.ceil(items.length / state.pageSize));
            state.page = Math.min(Math.max(1, state.page), totalPages);
            const start = (state.page - 1) * state.pageSize;
            return items.slice(start, start + state.pageSize);
        },
        render: renderPagination,
    };
})();
;
/* source: dashboard_v2/js/logout.js */
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
;
/* source: dashboard_v2/js/dashboard.js */
// Data binding for the hospital-wide administrator dashboard.
async function loadDashboard() {
    if (!document.getElementById("adminTeamGrid")) return;
    const data = await getDashboardData();
    if (!data || !data.summary) {
        renderAdminDashboardError("Dashboard data is temporarily unavailable. Refresh to try again.");
        return;
    }

    const summary = data.summary;
    setAdminDashboardText("adminOpsActiveCalls", summary.active_calls);
    setAdminDashboardText("adminOpsCriticalCalls", summary.critical_calls);
    setAdminDashboardText("adminOpsCompletedToday", summary.completed_today);
    setAdminDashboardText("adminOpsAssets", summary.total_assets);
    setAdminDashboardText("adminOpsActiveDetail", (summary.engineers || 0) + " engineering users across all departments");
    setAdminDashboardText("adminOpsAssetsDetail", (summary.asset_availability_percent ?? 100) + "% currently available");
    setAdminDashboardText("adminOpsActiveDowntime", adminFormatHours(summary.active_downtime_hours));
    setAdminDashboardText("adminOpsAvgDowntime", adminFormatHours(summary.avg_downtime));
    setAdminDashboardText("adminOpsStockHealth", (summary.stock_health_percent ?? 100) + "%");
    setAdminDashboardText("adminOpsPmDue", summary.pm_due || 0);
    setAdminDashboardText("adminOpsAwaitingParts", summary.awaiting_parts || 0);
    setAdminDashboardText("adminOpsAssetAvailability", (summary.asset_availability_percent ?? 100) + "%");
    setAdminDashboardText("adminOpsOldestCall", adminFormatHours(summary.oldest_active_call_hours) + " oldest active call");
    setAdminDashboardText("adminOpsStockDetail", (summary.inventory_alerts || 0) + " low · " + (summary.out_of_stock || 0) + " out of stock");
    setAdminDashboardText("adminOpsPmDetail", (summary.pm_overdue || 0) + " overdue · " + (summary.pm_pending_confirmation || 0) + " awaiting confirmation");
    setAdminDashboardText("adminOpsAssetDetail", (summary.out_of_service_assets || 0) + " out of service");
    setAdminDashboardText("adminLastUpdated", "Updated " + adminFormatDateTime(data.generated_at));
    renderAdminTeams(data.teams || []);
    renderAdminActivity(data.recent_activity || []);
    renderAdminAttention(summary, data.teams || []);
    loadBusinessAdminSummary();
    if (window.lucide) lucide.createIcons();
}

async function loadBusinessAdminSummary() {
    const container = document.getElementById("adminBusinessPending");
    if (!container) return;
    try {
        const response = await fetch("/api/business/admin-summary", { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "Business summary unavailable");
        setAdminDashboardText("adminBusinessBudget", adminMoney(data.allocated_budget));
        setAdminDashboardText("adminBusinessSpend", adminMoney(data.paid_spend));
        setAdminDashboardText("adminBusinessRemaining", adminMoney(data.remaining_budget));
        setAdminDashboardText("adminBusinessPurchases", data.pending_purchase_count || 0);
        setAdminDashboardText("adminBusinessPurchaseAmount", adminMoney(data.pending_purchase_amount) + " awaiting review");
        setAdminDashboardText("adminBusinessInsurance", adminMoney(data.insurance_outstanding));
        setAdminDashboardText("adminBusinessSupplierOutstanding", adminMoney(data.supplier_outstanding));
        setAdminDashboardText("adminBusinessPaymentApprovals", data.pending_payment_approvals || 0);
        const pending = data.recent_pending || [];
        const paymentApprovals = data.recent_pending_payments || [];
        const rows = [...pending.map(item => ({ title: item.item_name, detail: `${item.department} · ${item.request_number}`, amount: item.total_amount })), ...paymentApprovals.map(item => ({ title: `Payment · ${item.vendor_name}`, detail: `${item.invoice_number} · ${item.reference_number}`, amount: item.amount }))];
        container.innerHTML = rows.length ? `<div class="admin-business-pending-heading"><strong>Business approvals awaiting your decision</strong><button type="button" onclick="navigate('businessPortal')">Review all <i data-lucide="arrow-right"></i></button></div>${rows.map(item => `<button type="button" onclick="navigate('businessPortal')"><span><strong>${adminEscape(item.title)}</strong><small>${adminEscape(item.detail)}</small></span><em>${adminMoney(item.amount)}</em><i data-lucide="chevron-right"></i></button>`).join("")}` : `<div class="admin-business-clear"><i data-lucide="circle-check-big"></i><span><strong>No business approvals are waiting</strong><small>The purchase and payment queues are current.</small></span></div>`;
        if (window.lucide) lucide.createIcons();
    } catch (error) {
        container.innerHTML = `<div class="admin-business-clear"><i data-lucide="wifi-off"></i><span><strong>Financial overview unavailable</strong><small>Open the Business Office to try again.</small></span></div>`;
        if (window.lucide) lucide.createIcons();
    }
}

function adminMoney(value) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function setAdminDashboardText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value ?? "0";
}

function renderAdminTeams(teams) {
    const container = document.getElementById("adminTeamGrid");
    if (!container) return;
    const expectedTeams = ["Biomedical", "Electrical", "IT"];
    const teamRows = expectedTeams.map(team => teams.find(item => item.team === team) || { team, active_calls: 0, open_calls: 0, in_progress: 0, awaiting_parts: 0, completed_today: 0, critical_calls: 0, assets: 0, inventory_items: 0, low_stock: 0, engineers: 0 });
    container.innerHTML = teamRows.map(team => {
        const style = adminTeamStyle(team.team);
        const attention = team.critical_calls || team.low_stock || team.awaiting_parts;
        return `
          <article class="admin-team-card is-${style.className}">
            <header class="admin-team-card-header">
              <div class="admin-team-identity"><span class="admin-team-icon">${adminTeamIconSvg(style.className)}</span><div><span>${adminEscape(team.team)} department</span><h3>${adminEscape(team.team)} Services</h3></div></div>
              <span class="admin-team-state ${attention ? "is-attention" : "is-healthy"}">${attention ? "Needs review" : "On track"}</span>
            </header>
            <div class="admin-team-primary"><strong>${team.active_calls || 0}</strong><span>Active maintenance calls</span></div>
            <div class="admin-team-metrics">
              <div><strong>${team.in_progress || 0}</strong><span>In progress</span></div>
              <div><strong>${team.awaiting_parts || 0}</strong><span>Awaiting parts</span></div>
              <div><strong>${team.completed_today || 0}</strong><span>Resolved today</span></div>
            </div>
            <div class="admin-team-footer">
              <span><i data-lucide="monitor-cog"></i> ${team.assets || 0} assets</span>
              <span><i data-lucide="package-search"></i> ${team.low_stock || 0} stock alerts</span>
              <span><i data-lucide="users"></i> ${team.engineers || 0} engineers</span>
            </div>
            <button class="admin-team-action" onclick="navigate('callManagement')">Review calls <i data-lucide="arrow-right"></i></button>
          </article>
        `;
    }).join("");
}

function renderAdminActivity(items) {
    const container = document.getElementById("adminActivityFeed");
    if (!container) return;
    if (!items.length) {
        container.innerHTML = '<div class="admin-empty-state"><i data-lucide="clipboard-check"></i><strong>No maintenance calls yet</strong><p>New activity from all three departments will appear here.</p></div>';
        return;
    }
    container.innerHTML = items.map(item => `
      <article class="admin-activity-row">
        <span class="admin-activity-team is-${adminTeamStyle(item.team).className}">${adminEscape(item.team)}</span>
        <div class="admin-activity-copy"><strong>${adminEscape(item.equipment_name)}</strong><span>${adminEscape(item.ticket_number)} · ${adminEscape(item.department)}</span></div>
        <div class="admin-activity-status"><span class="admin-status-pill is-${adminStatusClass(item.status)}">${adminEscape(item.status)}</span><time>${adminFormatDateTime(item.occurred_at)}</time></div>
      </article>
    `).join("");
}

function renderAdminAttention(summary, teams) {
    const container = document.getElementById("adminAttentionList");
    if (!container) return;
    const items = [];
    if (summary.critical_calls) items.push({ icon: "siren", tone: "red", title: summary.critical_calls + " critical call" + (summary.critical_calls === 1 ? "" : "s"), text: "Prioritize assignment and resolution.", page: "callManagement" });
    if (summary.inventory_alerts) items.push({ icon: "package-x", tone: "orange", title: summary.inventory_alerts + " inventory alert" + (summary.inventory_alerts === 1 ? "" : "s"), text: (summary.out_of_stock || 0) + " items are completely out of stock.", page: "inventory" });
    if (summary.pm_due) items.push({ icon: "calendar-clock", tone: "blue", title: summary.pm_due + " PM visit" + (summary.pm_due === 1 ? "" : "s") + " due", text: (summary.pm_overdue || 0) + " preventive-maintenance visits are overdue.", page: "pm" });
    const awaiting = teams.reduce((total, team) => total + (team.awaiting_parts || 0), 0);
    if (awaiting) items.push({ icon: "clock-3", tone: "violet", title: awaiting + " call" + (awaiting === 1 ? "" : "s") + " awaiting parts", text: "Coordinate supply before service delays increase.", page: "callManagement" });
    if (summary.out_of_service_assets) items.push({ icon: "monitor-x", tone: "red", title: summary.out_of_service_assets + " asset" + (summary.out_of_service_assets === 1 ? "" : "s") + " out of service", text: "Review availability and maintenance status.", page: "assets" });
    if ((summary.oldest_active_call_hours || 0) >= 24) items.push({ icon: "alarm-clock", tone: "orange", title: adminFormatHours(summary.oldest_active_call_hours) + " oldest active call", text: "This request has remained active for more than one day.", page: "callManagement" });
    if (!items.length) items.push({ icon: "circle-check-big", tone: "green", title: "Operations are on track", text: "No critical calls, stock alerts, or PM visits need immediate action." });
    items.push({ icon: "timer-reset", tone: "slate", title: adminFormatHours(summary.avg_downtime) + " average downtime", text: "Based on completed maintenance calls.", page: "reports" });
    container.innerHTML = items.map(item => `<div class="admin-attention-row is-${item.tone}"><span><i data-lucide="${item.icon}"></i></span><div><strong>${adminEscape(item.title)}</strong><p>${adminEscape(item.text)}</p></div>${item.page ? `<button type="button" onclick="navigate('${item.page}')">Review</button>` : ""}</div>`).join("");
}

function renderAdminDashboardError(message) {
    ["adminTeamGrid", "adminActivityFeed", "adminAttentionList"].forEach(id => {
        const container = document.getElementById(id);
        if (container) container.innerHTML = `<div class="admin-empty-state"><i data-lucide="wifi-off"></i><strong>Unable to load operations data</strong><p>${adminEscape(message)}</p></div>`;
    });
    if (window.lucide) lucide.createIcons();
}

function adminTeamStyle(team) {
    const value = String(team || "Biomedical").toLowerCase();
    if (value === "electrical") return { className: "electrical" };
    if (value === "it") return { className: "it" };
    return { className: "biomedical" };
}

function adminTeamIconSvg(team) {
    const shared = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';
    if (team === "electrical") {
        return `<svg ${shared}><path d="M8 2v5M16 2v5M6 7h12v3a6 6 0 0 1-12 0V7Z"/><path d="M12 16v6M9 22h6"/></svg>`;
    }
    if (team === "it") {
        return `<svg ${shared}><rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01M11 7.5h6M11 16.5h6"/></svg>`;
    }
    return `<svg ${shared}><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M7 11h2l1.4-3 3.1 6 1.4-3H18M9 22h6M12 18v4"/></svg>`;
}

function adminStatusClass(value) {
    return String(value || "open").toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
}

function adminFormatDateTime(value) {
    if (!value) return "No timestamp";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Recently";
    return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(date);
}

function adminFormatHours(value) {
    const hours = Number(value || 0);
    return (Number.isInteger(hours) ? hours : hours.toFixed(1)) + " h";
}

if (!window.adminDashboardShortcutsBound) {
    window.adminDashboardShortcutsBound = true;
    document.addEventListener("keydown", event => {
        if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (event.target.closest("input, textarea, select, [contenteditable='true']")) return;
        const shortcuts = { c: "callManagement", a: "assets", i: "inventory", p: "pm", q: "qr", r: "reports", u: "users", s: "settings" };
        const page = shortcuts[String(event.key || "").toLowerCase()];
        if (!page || typeof navigate !== "function") return;
        event.preventDefault();
        navigate(page);
    });
}

function adminEscape(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
;
/* source: dashboard_v2/js/sidebar.js */
// ==========================================
// ROLE BASED SIDEBAR
// ==========================================

const sidebar = document.getElementById("sidebar-nav");

const storedRole = (localStorage.getItem("role") || "").toLowerCase();
const role = storedRole === "manager" ? "admin" : storedRole === "bme" ? "engineer" : storedRole;

// ==========================================
// ADMIN MENU
// ==========================================

const adminMenu = `

<a href="#" class="nav-item active" data-page="dashboard">
    <i data-lucide="layout-dashboard"></i>
    <span>Dashboard</span>
</a>

<a href="#" class="nav-item" data-page="callManagement">
    <i data-lucide="radio-tower"></i>
    <span>Call Management</span>
</a>

<a href="#" class="nav-item" data-page="assets">
    <i data-lucide="monitor-smartphone"></i>
    <span>Assets</span>
</a>

<a href="#" class="nav-item" data-page="pm">
    <i data-lucide="calendar-clock"></i>
    <span>Preventive Maintenance</span>
</a>

<a href="#" class="nav-item" data-page="inventory">
    <i data-lucide="boxes"></i>
    <span>Inventory</span>
</a>

<a href="#" class="nav-item" data-page="centralStore">
    <i data-lucide="warehouse"></i>
    <span>Central Store</span>
</a>

<a href="#" class="nav-item" data-page="vendors">
    <i data-lucide="handshake"></i>
    <span>Vendors & Contracts</span>
</a>

<a href="#" class="nav-item" data-page="businessPortal">
    <i data-lucide="landmark"></i>
    <span>Business Office</span>
</a>

<a href="#" class="nav-item" data-page="users">
    <i data-lucide="users"></i>
    <span>Users</span>
</a>



<a href="#" class="nav-item" data-page="qr">
    <i data-lucide="scan-line"></i>
    <span>QR Scanner</span>
</a>

<a href="#" class="nav-item" data-page="reports">
    <i data-lucide="bar-chart-3"></i>
    <span>Reports</span>
</a>



<a href="#" class="nav-item" data-page="settings">
    <i data-lucide="settings"></i>
    <span>Settings</span>
</a>

`;

// ==========================================
// BIOMEDICAL ENGINEER MENU
// ==========================================

const engineerMenu = `

<a href="#" class="nav-item" data-page="engineerDashboard">
    <i data-lucide="layout-dashboard"></i>
    <span>Dashboard</span>
</a>
<a href="#" class="nav-item" data-page="callManagement">
    <i data-lucide="stethoscope"></i>
    <span>Call Management</span>
</a>
<a href="#" class="nav-item" data-page="pm">
    <i data-lucide="calendar-clock"></i>
    <span>Preventive Maintenance</span>
</a>

<a href="#" class="nav-item" data-page="assets">
    <i data-lucide="monitor-smartphone"></i>
    <span>Assets</span>
</a>

<a href="#" class="nav-item" data-page="inventory">
    <i data-lucide="boxes"></i>
    <span>Inventory & Parts</span>
</a>

<a href="#" class="nav-item" data-page="storeRequests">
    <i data-lucide="package-plus"></i>
    <span>Request Spare Parts</span>
</a>

<a href="#" class="nav-item" data-page="vendors">
    <i data-lucide="handshake"></i>
    <span>Vendors & Contracts</span>
</a>

<a href="#" class="nav-item" data-page="reports">
    <i data-lucide="bar-chart-3"></i>
    <span>Reports</span>
</a>

<a href="#" class="nav-item" data-page="qr">
    <i data-lucide="scan-line"></i>
    <span>QR Scanner</span>
</a>

<a href="#" class="nav-item" data-page="settings">
    <i data-lucide="settings"></i>
    <span>Settings</span>
</a>
`;

// ==========================================
// ELECTRICAL ENGINEER MENU
// ==========================================

const electricalMenu = `

<a href="#" class="nav-item" data-page="electricalDashboard">
    <i data-lucide="zap"></i>
    <span>Electrical Dashboard</span>
</a>

<a href="#" class="nav-item" data-page="callManagement">
    <i data-lucide="plug-zap"></i>
    <span>Electrical Calls</span>
</a>

<a href="#" class="nav-item" data-page="assets">
    <i data-lucide="monitor-smartphone"></i>
    <span>Assets</span>
</a>

<a href="#" class="nav-item" data-page="inventory">
    <i data-lucide="boxes"></i>
    <span>Inventory & Parts</span>
</a>

<a href="#" class="nav-item" data-page="storeRequests">
    <i data-lucide="package-plus"></i>
    <span>Request Spare Parts</span>
</a>

<a href="#" class="nav-item" data-page="vendors">
    <i data-lucide="handshake"></i>
    <span>Vendors & Contracts</span>
</a>

<a href="#" class="nav-item" data-page="settings">
    <i data-lucide="settings"></i>
    <span>Settings</span>
</a>
`;

// ==========================================
// IT DEPARTMENT MENU
// ==========================================

const itMenu = `

<a href="#" class="nav-item" data-page="itDashboard">
    <i data-lucide="monitor-cog"></i>
    <span>IT Dashboard</span>
</a>

<a href="#" class="nav-item" data-page="callManagement">
    <i data-lucide="server-cog"></i>
    <span>IT Calls</span>
</a>

<a href="#" class="nav-item" data-page="assets">
    <i data-lucide="laptop"></i>
    <span>Assets</span>
</a>

<a href="#" class="nav-item" data-page="inventory">
    <i data-lucide="boxes"></i>
    <span>Inventory & Parts</span>
</a>

<a href="#" class="nav-item" data-page="storeRequests">
    <i data-lucide="package-plus"></i>
    <span>Request Spare Parts</span>
</a>

<a href="#" class="nav-item" data-page="vendors">
    <i data-lucide="handshake"></i>
    <span>Vendors & Contracts</span>
</a>

<a href="#" class="nav-item" data-page="settings">
    <i data-lucide="settings"></i>
    <span>Settings</span>
</a>
`;
// ==========================================
// USER MENU
// ==========================================

const userMenu = `

<a href="#" class="nav-item active" data-page="userDashboard">
    <i data-lucide="layout-dashboard"></i>
    <span>Dashboard</span>
</a>

<a href="#" class="nav-item" data-page="newRequest">
    <i data-lucide="plus-circle"></i>
    <span>New Request</span>
</a>

<a href="#" class="nav-item" data-page="myRequests">
    <i data-lucide="clipboard-list"></i>
    <span>My Requests</span>
</a>

<a href="#" class="nav-item" data-page="myAssets">
    <i data-lucide="monitor-smartphone"></i>
    <span>My Assets</span>
</a>

<a href="#" class="nav-item" data-page="departmentPMSchedule">
    <i data-lucide="calendar-clock"></i>
    <span>PM Schedule</span>
</a>

<a href="#" class="nav-item" data-page="qr">
    <i data-lucide="scan-line"></i>
    <span>Scan QR</span>
</a>

<a href="#" class="nav-item" data-page="settings">
    <i data-lucide="settings"></i>
    <span>Settings</span>
</a>

`;

const wardBoyMenu = `
<a href="#" class="nav-item active" data-page="wardBoyDashboard">
    <i data-lucide="truck"></i>
    <span>Transport Jobs</span>
</a>
<a href="#" class="nav-item" data-page="settings">
    <i data-lucide="settings"></i>
    <span>Settings</span>
</a>
`;

const centralStoreMenu = `
<a href="#" class="nav-item active" data-page="centralStore">
    <i data-lucide="warehouse"></i>
    <span>Central Store</span>
</a>
<a href="#" class="nav-item" data-page="settings">
    <i data-lucide="settings"></i>
    <span>Settings</span>
</a>
`;

const businessMenu = `
<a href="#" class="nav-item active" data-page="businessPortal">
    <i data-lucide="landmark"></i>
    <span>Business Office</span>
</a>
<a href="#" class="nav-item" data-page="settings">
    <i data-lucide="settings"></i>
    <span>Settings</span>
</a>
`;

// ==========================================
// LOAD MENU
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    const sidebar = document.getElementById("sidebar-nav");

    if (!sidebar) return;

    switch (role) {

        case "manager":
        case "admin":

            sidebar.innerHTML = adminMenu;
            break;

        case "user":

            sidebar.innerHTML = userMenu;
            break;

        case "engineer":

            sidebar.innerHTML = engineerMenu;
            break;

        case "electrical":

            sidebar.innerHTML = electricalMenu;
            break;

        case "it":

            sidebar.innerHTML = itMenu;
            break;

        case "wardboy":

            sidebar.innerHTML = wardBoyMenu;
            break;

        case "centralstore":

            sidebar.innerHTML = centralStoreMenu;
            break;

        case "business":

            sidebar.innerHTML = businessMenu;
            break;

        default:

            sidebar.innerHTML = "";

    }

    lucide.createIcons();

});

// The sidebar is an on-demand drawer on desktop and mobile.
document.addEventListener("DOMContentLoaded", () => {
    const menuButton = document.querySelector(".menu-toggle");
    const appSidebar = document.querySelector(".sidebar");
    if (!menuButton || !appSidebar) return;
    const backdrop = document.createElement("button");
    backdrop.type = "button";
    backdrop.className = "sidebar-mobile-backdrop";
    backdrop.setAttribute("aria-label", "Close navigation menu");
    document.body.appendChild(backdrop);

    const closeMenu = (restoreFocus = false) => {
        appSidebar.classList.remove("active");
        backdrop.classList.remove("show");
        document.body.classList.remove("mobile-nav-open");
        appSidebar.setAttribute("aria-hidden", "true");
        appSidebar.inert = true;
        menuButton.setAttribute("aria-expanded", "false");
        menuButton.setAttribute("aria-label", "Open navigation menu");
        if (restoreFocus) menuButton.focus();
    };
    const toggleMenu = () => {
        const willOpen = !appSidebar.classList.contains("active");
        appSidebar.classList.toggle("active", willOpen);
        backdrop.classList.toggle("show", willOpen);
        document.body.classList.toggle("mobile-nav-open", willOpen);
        appSidebar.setAttribute("aria-hidden", String(!willOpen));
        appSidebar.inert = !willOpen;
        menuButton.setAttribute("aria-expanded", String(willOpen));
        menuButton.setAttribute("aria-label", willOpen ? "Close navigation menu" : "Open navigation menu");
    };

    closeMenu();
    menuButton.addEventListener("click", toggleMenu);
    backdrop.addEventListener("click", () => closeMenu(true));
    appSidebar.addEventListener("click", event => {
        if (event.target.closest(".nav-item")) closeMenu();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && appSidebar.classList.contains("active")) closeMenu(true);
    });
});
;
/* source: dashboard_v2/js/preferences.js */
(function () {
    "use strict";

    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
    const profilePhotoPattern = /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\r\n]+$/i;

    function isSafeProfilePhoto(source) {
        return typeof source === "string"
            && source.length <= 2100000
            && profilePhotoPattern.test(source);
    }

    function applyBioTrackPreferences() {
        const selectedTheme = localStorage.getItem("biotrack-theme") || "light";
        const useDark = selectedTheme === "dark" || (selectedTheme === "system" && systemTheme.matches);
        document.body.classList.toggle("dark-theme", useDark);
        document.documentElement.style.colorScheme = useDark ? "dark" : "light";

        const density = localStorage.getItem("biotrack-density") || "comfortable";
        document.body.classList.toggle("compact-density", density === "compact");
    }

    function applySavedProfilePhoto() {
        const source = localStorage.getItem(`biotrack-profile-photo:${localStorage.getItem("username") || "user"}`);
        if (!isSafeProfilePhoto(source)) return;
        [document.getElementById("topAvatar"), document.getElementById("sidebarAvatar")].forEach(element => {
            if (!element) return;
            element.style.backgroundImage = `url("${source}")`;
            element.style.backgroundPosition = "center";
            element.style.backgroundSize = "cover";
            element.textContent = "";
        });
    }

    window.applyBioTrackPreferences = applyBioTrackPreferences;
    document.addEventListener("DOMContentLoaded", () => {
        applyBioTrackPreferences();
        window.setTimeout(applySavedProfilePhoto, 0);
    });
    systemTheme.addEventListener("change", () => {
        if ((localStorage.getItem("biotrack-theme") || "light") === "system") applyBioTrackPreferences();
    });
}());
;
/* source: dashboard_v2/js/notifications.js */
(function () {
    "use strict";

    const REFRESH_INTERVAL = 60000;
    const READ_STORAGE_KEY = "biotrack-notification-read";
    const SEEN_STORAGE_KEY = "biotrack-notification-seen";
    const PREFERENCE_KEY = "biotrack-notifications";
    const iconByKind = {
        "critical-call": "siren",
        stock: "package-x",
        maintenance: "calendar-clock",
        asset: "monitor-x",
        request: "clipboard-list",
        relocation: "route",
        "ward-boy": "truck",
    };
    let notifications = [];
    let refreshTimer = null;
    let firstLoadComplete = false;

    function userStorageKey(base) {
        return `${base}:${localStorage.getItem("username") || "anonymous"}`;
    }

    function readStoredSet(key) {
        try {
            const values = JSON.parse(localStorage.getItem(userStorageKey(key)) || "[]");
            return new Set(Array.isArray(values) ? values : []);
        } catch (error) {
            console.warn("Unable to read notification state:", error);
            return new Set();
        }
    }

    function storeSet(key, values) {
        localStorage.setItem(userStorageKey(key), JSON.stringify([...values].slice(-250)));
    }

    function getPreferences() {
        try {
            return {
                inAppNotification: true,
                desktopNotification: false,
                requestUpdates: true,
                pmReminder: true,
                ...JSON.parse(localStorage.getItem(PREFERENCE_KEY) || "{}"),
            };
        } catch (error) {
            return { desktopNotification: false, requestUpdates: true, pmReminder: true };
        }
    }

    function isEnabledForPreference(item, preferences) {
        if (item.kind === "request") return preferences.requestUpdates !== false;
        if (item.kind === "maintenance") return preferences.pmReminder !== false;
        return true;
    }

    function activeNotifications() {
        const preferences = getPreferences();
        if (preferences.inAppNotification === false) return [];
        return notifications.filter(item => isEnabledForPreference(item, preferences));
    }

    function unreadNotifications() {
        const read = readStoredSet(READ_STORAGE_KEY);
        return activeNotifications().filter(item => !read.has(item.id));
    }

    function updateBadge() {
        const badge = document.getElementById("notificationBadge");
        const button = document.querySelector(".notification-btn");
        if (!badge || !button) return;
        const count = unreadNotifications().length;
        badge.textContent = count > 99 ? "99+" : String(count);
        badge.hidden = count === 0;
        button.setAttribute("aria-label", count ? `Open notifications, ${count} unread` : "Open notifications");
    }

    async function fetchNotifications({ allowDesktop = true } = {}) {
        try {
            const response = await fetch("/api/notifications", { headers: { Accept: "application/json" } });
            if (!response.ok) throw new Error(`Notification feed failed (${response.status})`);
            const payload = await response.json();
            notifications = Array.isArray(payload.items) ? payload.items : [];
            updateBadge();
            if (allowDesktop) await notifyNewItems();
            document.dispatchEvent(new CustomEvent("biotrack:notifications-updated", { detail: { items: notifications } }));
            return notifications;
        } catch (error) {
            console.error("Unable to refresh notifications:", error);
            return notifications;
        } finally {
            firstLoadComplete = true;
        }
    }

    async function notifyNewItems() {
        const currentIds = new Set(notifications.map(item => item.id));
        const seen = readStoredSet(SEEN_STORAGE_KEY);
        if (!firstLoadComplete && seen.size === 0) {
            storeSet(SEEN_STORAGE_KEY, currentIds);
            return;
        }
        const preferences = getPreferences();
        if (!preferences.desktopNotification || !("Notification" in window) || Notification.permission !== "granted") {
            storeSet(SEEN_STORAGE_KEY, new Set([...seen, ...currentIds]));
            return;
        }
        const newItems = notifications.filter(item => !seen.has(item.id) && isEnabledForPreference(item, preferences));
        for (const item of newItems.slice(0, 3)) {
            await showSystemNotification(item.title, item.message, item.page, item.id);
        }
        storeSet(SEEN_STORAGE_KEY, new Set([...seen, ...currentIds]));
    }

    async function showSystemNotification(title, body, page = "", tag = "biotrack") {
        const options = {
            body,
            icon: "/static/assets/icons/biotrack-192.png",
            badge: "/static/assets/icons/biotrack-192.png",
            tag: `biotrack-${tag}`,
            renotify: true,
            data: { page },
        };
        try {
            if ("serviceWorker" in navigator) {
                const registration = await navigator.serviceWorker.ready;
                await registration.showNotification(title, options);
            } else {
                new Notification(title, options);
            }
        } catch (error) {
            console.warn("Unable to display desktop notification:", error);
        }
    }

    async function enableDesktopNotifications() {
        if (!("Notification" in window)) return { enabled: false, message: "This browser does not support desktop notifications." };
        const permission = await Notification.requestPermission();
        const preferences = getPreferences();
        preferences.desktopNotification = permission === "granted";
        localStorage.setItem(PREFERENCE_KEY, JSON.stringify(preferences));
        if (permission === "granted") {
            await showSystemNotification("BioTrack notifications enabled", "You will receive operational alerts while BioTrack is running.", "dashboard", "enabled");
            return { enabled: true, message: "Desktop alerts are enabled." };
        }
        return { enabled: false, message: "Notification permission was not granted." };
    }

    function markRead(id) {
        const read = readStoredSet(READ_STORAGE_KEY);
        read.add(id);
        storeSet(READ_STORAGE_KEY, read);
        updateBadge();
    }

    function markAllRead() {
        const read = readStoredSet(READ_STORAGE_KEY);
        activeNotifications().forEach(item => read.add(item.id));
        storeSet(READ_STORAGE_KEY, read);
        updateBadge();
    }

    function formatRelativeTime(value) {
        const timestamp = new Date(value).getTime();
        if (!Number.isFinite(timestamp)) return "Recently";
        const elapsed = Math.max(Date.now() - timestamp, 0);
        const minutes = Math.floor(elapsed / 60000);
        if (minutes < 1) return "Just now";
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }

    async function renderPanel(panel) {
        await fetchNotifications({ allowDesktop: false });
        panel.replaceChildren();
        panel.classList.add("is-notification-center");

        const read = readStoredSet(READ_STORAGE_KEY);
        const items = activeNotifications();
        const header = document.createElement("div");
        header.className = "notification-center-header";
        const heading = document.createElement("div");
        heading.innerHTML = "<strong>Notifications</strong><span>Live hospital operations</span>";
        const markButton = document.createElement("button");
        markButton.type = "button";
        markButton.textContent = "Mark all read";
        markButton.disabled = !items.some(item => !read.has(item.id));
        markButton.addEventListener("click", () => {
            markAllRead();
            renderPanel(panel);
        });
        header.append(heading, markButton);
        panel.appendChild(header);

        const preferences = getPreferences();
        if (!preferences.desktopNotification || !("Notification" in window) || Notification.permission !== "granted") {
            const permissionCard = document.createElement("div");
            permissionCard.className = "notification-permission-card";
            permissionCard.innerHTML = '<span><i data-lucide="bell-ring"></i></span><div><strong>Receive desktop alerts</strong><p>Get critical calls, stock and maintenance alerts without keeping this panel open.</p></div>';
            const enableButton = document.createElement("button");
            enableButton.type = "button";
            enableButton.textContent = "Enable";
            enableButton.addEventListener("click", async () => {
                enableButton.disabled = true;
                const result = await enableDesktopNotifications();
                permissionCard.querySelector("p").textContent = result.message;
                if (result.enabled) setTimeout(() => renderPanel(panel), 700);
                else enableButton.disabled = false;
            });
            permissionCard.appendChild(enableButton);
            panel.appendChild(permissionCard);
        }

        const list = document.createElement("div");
        list.className = "notification-center-list";
        if (!items.length) {
            list.innerHTML = '<div class="notification-center-empty"><i data-lucide="circle-check-big"></i><strong>You are all caught up</strong><p>No calls, stock alerts or maintenance reminders need attention.</p></div>';
        } else {
            items.forEach(item => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = `notification-center-item is-${item.priority || "info"}${read.has(item.id) ? " is-read" : ""}`;
                button.innerHTML = `<span class="notification-center-icon"><i data-lucide="${iconByKind[item.kind] || "bell"}"></i></span><span class="notification-center-copy"><strong></strong><small></small><time></time></span><span class="notification-center-dot" aria-label="Unread"></span>`;
                button.querySelector("strong").textContent = item.title;
                button.querySelector("small").textContent = item.message;
                button.querySelector("time").textContent = formatRelativeTime(item.created_at);
                button.addEventListener("click", () => {
                    markRead(item.id);
                    panel.hidden = true;
                    document.querySelector(".notification-btn")?.setAttribute("aria-expanded", "false");
                    if (item.page && typeof window.navigate === "function") window.navigate(item.page);
                });
                list.appendChild(button);
            });
        }
        panel.appendChild(list);

        const footer = document.createElement("div");
        footer.className = "notification-center-footer";
        footer.innerHTML = '<span><i data-lucide="refresh-cw"></i> Updates every minute</span>';
        const settingsButton = document.createElement("button");
        settingsButton.type = "button";
        settingsButton.textContent = "Notification settings";
        settingsButton.addEventListener("click", () => {
            panel.hidden = true;
            window.navigate?.("settings");
            setTimeout(() => document.getElementById("notifications")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
        });
        footer.appendChild(settingsButton);
        panel.appendChild(footer);
        if (window.lucide) window.lucide.createIcons();
    }

    function start() {
        fetchNotifications();
        clearInterval(refreshTimer);
        refreshTimer = setInterval(() => fetchNotifications(), REFRESH_INTERVAL);
    }

    document.addEventListener("DOMContentLoaded", start);
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) fetchNotifications();
    });
    document.addEventListener("biotrack:notification-preferences-changed", () => {
        updateBadge();
        fetchNotifications({ allowDesktop: false });
    });
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.addEventListener("message", event => {
            if (event.data?.type === "BIOTRACK_NAVIGATE" && event.data.page) window.navigate?.(event.data.page);
        });
    }

    window.BioTrackNotifications = {
        fetch: fetchNotifications,
        renderPanel,
        enableDesktopNotifications,
        markAllRead,
        updateBadge,
        getItems: () => [...notifications],
    };
}());
;
/* source: dashboard_v2/js/topbarInteractions.js */
// Functional top-bar search, alerts and account menu.
document.addEventListener("DOMContentLoaded", () => {
    const search = document.getElementById("globalNavigationSearch");
    const notification = document.querySelector(".notification-btn");
    const profile = document.querySelector(".profile-button");
    if (!search || !notification || !profile) return;

    const makePopup = (className, label) => {
        const popup = document.createElement("div");
        popup.className = `topbar-popover ${className}`;
        popup.setAttribute("role", "menu");
        popup.setAttribute("aria-label", label);
        popup.hidden = true;
        document.body.appendChild(popup);
        return popup;
    };
    const searchResults = makePopup("topbar-search-results", "Search results");
    const accountMenu = makePopup("topbar-account-menu", "Account menu");
    const alertsPanel = makePopup("topbar-alerts-panel", "Dashboard alerts");
    let activePopup = null;

    const positionPopup = (popup, anchor, alignRight = false) => {
        const rect = anchor.getBoundingClientRect();
        popup.style.top = `${rect.bottom + window.scrollY + 8}px`;
        popup.style.left = alignRight ? "auto" : `${rect.left + window.scrollX}px`;
        popup.style.right = alignRight ? `${window.innerWidth - rect.right - window.scrollX}px` : "auto";
    };
    const closePopups = () => {
        [searchResults, accountMenu, alertsPanel].forEach(popup => { popup.hidden = true; });
        profile.setAttribute("aria-expanded", "false");
        notification.setAttribute("aria-expanded", "false");
        activePopup = null;
    };
    const openPopup = (popup, anchor, alignRight = false) => {
        closePopups();
        popup.hidden = false;
        positionPopup(popup, anchor, alignRight);
        activePopup = popup;
    };
    const addMenuAction = (popup, label, action, iconName) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "topbar-popover-action";
        button.setAttribute("role", "menuitem");
        const icon = document.createElement("i");
        icon.dataset.lucide = iconName;
        const text = document.createElement("span");
        text.textContent = label;
        button.append(icon, text);
        button.addEventListener("click", () => { closePopups(); action(); });
        popup.appendChild(button);
    };
    const homePage = () => {
        const role = (localStorage.getItem("role") || "").toLowerCase();
        return ({ manager: "dashboard", admin: "dashboard", bme: "engineerDashboard", engineer: "engineerDashboard", electrical: "electricalDashboard", it: "itDashboard", user: "userDashboard" })[role] || "dashboard";
    };

    accountMenu.classList.add("is-account-menu");
    addMenuAction(accountMenu, "Settings", () => window.navigate?.("settings"), "settings");
    addMenuAction(accountMenu, "Log out", () => document.querySelector(".logout-btn")?.click(), "log-out");
    profile.addEventListener("click", () => {
        if (!accountMenu.hidden) return closePopups();
        profile.setAttribute("aria-expanded", "true");
        openPopup(accountMenu, profile, true);
        profile.setAttribute("aria-expanded", "true");
        if (window.lucide) window.lucide.createIcons();
    });

    const renderSearchResults = () => {
        const query = search.value.trim().toLowerCase();
        searchResults.replaceChildren();
        if (!query) {
            searchResults.hidden = true;
            activePopup = null;
            return;
        }
        const pages = [...document.querySelectorAll(".nav-item[data-page]")]
            .map(item => ({ page: item.dataset.page, label: item.innerText.trim().replace(/\s+/g, " ") }))
            .filter(item => item.label.toLowerCase().includes(query) || item.page.toLowerCase().includes(query))
            .slice(0, 8);
        if (!pages.length) {
            const empty = document.createElement("p");
            empty.className = "topbar-search-empty";
            empty.textContent = "No matching sections. Try assets, calls, stock, PM, reports, or settings.";
            searchResults.appendChild(empty);
        } else {
            pages.forEach(item => addMenuAction(searchResults, item.label, () => window.navigate?.(item.page), "arrow-up-right"));
        }
        openPopup(searchResults, search);
        if (window.lucide) window.lucide.createIcons();
    };
    search.addEventListener("focus", renderSearchResults);
    search.addEventListener("input", renderSearchResults);
    search.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            const first = searchResults.querySelector("button");
            if (first && !searchResults.hidden) {
                event.preventDefault();
                first.click();
            }
        }
        if (event.key === "Escape") closePopups();
    });

    notification.addEventListener("click", async () => {
        if (!alertsPanel.hidden) return closePopups();
        if (window.BioTrackNotifications) {
            await window.BioTrackNotifications.renderPanel(alertsPanel);
        } else {
            alertsPanel.replaceChildren();
            const description = document.createElement("p");
            description.className = "topbar-search-empty";
            description.textContent = "Notifications are temporarily unavailable. Refresh this page to try again.";
            alertsPanel.append(description);
            addMenuAction(alertsPanel, "Open dashboard", () => window.navigate?.(homePage()), "layout-dashboard");
        }
        openPopup(alertsPanel, notification, true);
        notification.setAttribute("aria-expanded", "true");
        if (window.lucide) window.lucide.createIcons();
    });

    document.addEventListener("click", event => {
        if (event.target.closest(".topbar-popover, .search-box, .profile-button, .notification-btn")) return;
        closePopups();
    });
    document.addEventListener("keydown", event => { if (event.key === "Escape") closePopups(); });
    window.addEventListener("resize", closePopups);
    window.addEventListener("scroll", event => {
        const scrollTarget = event.target;
        if (activePopup && scrollTarget instanceof Element && activePopup.contains(scrollTarget)) return;
        closePopups();
    }, true);
});
;
/* source: dashboard_v2/js/responsive_tables.js */
(() => {
    const content = document.getElementById("page-content");
    if (!content) return;

    const labelRows = table => {
        const headers = Array.from(table.querySelectorAll("thead th"), cell =>
            cell.textContent.replace(/\s+/g, " ").trim()
        );

        if (!headers.length) return;

        table.classList.add("mobile-card-table");
        table.querySelectorAll("tbody tr").forEach(row => {
            Array.from(row.cells).forEach((cell, index) => {
                if (cell.colSpan > 1) {
                    cell.removeAttribute("data-label");
                    return;
                }

                cell.dataset.label = headers[index] || "Details";
            });
        });
    };

    const labelTables = root => {
        if (root.nodeType !== Node.ELEMENT_NODE) return;
        if (root.matches?.("table")) labelRows(root);
        root.querySelectorAll?.("table").forEach(labelRows);
    };

    labelTables(content);

    new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(labelTables);

            if (mutation.type === "childList" && mutation.target.closest?.("tbody")) {
                const table = mutation.target.closest("table");
                if (table) labelRows(table);
            }
        });
    }).observe(content, { childList:true, subtree:true });
})();
;
/* source: dashboard_v2/views/engineerDashboardView.js */
// ==========================================
// ENGINEER DASHBOARD VIEW
// ==========================================

function engineerDashboardView() {

    const role = (localStorage.getItem("role") || "").toLowerCase();
    const discipline = role === "electrical" ? "Electrical" : role === "it" ? "IT" : "Biomedical";

    return `

<section class="engineer-dashboard">

    <!-- ==========================================
    HEADER
    =========================================== -->

    <header class="engineer-header">

        <div>

            <h1>${discipline} Engineer Dashboard</h1>

            <p>

                Monitor your assigned ${discipline.toLowerCase()} maintenance calls and equipment activity.

            </p>

        </div>

        <button
            class="primary-btn"
            onclick="navigate('callManagement')">

            <i data-lucide="clipboard-list"></i>

            Open Call Management

        </button>

    </header>

    <!-- ==========================================
    KPI CARDS
    =========================================== -->

    <section class="engineer-kpis">

        <div class="dashboard-card">

            <div class="card-icon blue">

                <i data-lucide="clipboard-list"></i>

            </div>

            <div>

                <h2 id="assignedCalls">0</h2>

                <span>Assigned Calls</span>

            </div>

        </div>

        <div class="dashboard-card">

            <div class="card-icon orange">

                <i data-lucide="wrench"></i>

            </div>

            <div>

                <h2 id="progressCalls">0</h2>

                <span>In Progress</span>

            </div>

        </div>

        <div class="dashboard-card">

            <div class="card-icon red">

                <i data-lucide="triangle-alert"></i>

            </div>

            <div>

                <h2 id="criticalCalls">0</h2>

                <span>Critical Calls</span>

            </div>

        </div>

        <div class="dashboard-card">

            <div class="card-icon green">

                <i data-lucide="badge-check"></i>

            </div>

            <div>

                <h2 id="completedCalls">0</h2>

                <span>Completed Today</span>

            </div>

        </div>

    </section>

    <!-- ==========================================
    MAIN GRID
    =========================================== -->

    <section class="engineer-grid">

        <!-- LEFT -->

        <div class="engineer-left">

            <!-- Assigned Calls -->

            <div class="dashboard-panel">

                <div class="panel-header">

                    <h2>

                        <i data-lucide="list-checks"></i>

                        Assigned Maintenance Calls

                    </h2>

                </div>

                <div
                    id="assignedList"
                    class="assigned-calls">

                    <div class="loading-card">

                        Loading assigned calls...

                    </div>

                </div>

            </div>

        </div>

        <!-- RIGHT -->

        <div class="engineer-right">

            <!-- Equipment -->

            <div class="dashboard-panel">

                <div class="panel-header">

                    <h2>

                        <i data-lucide="monitor-cog"></i>

                        Equipment Status

                    </h2>

                </div>

                <div class="mini-stats">

                    <div>

                        <h3 id="onlineEquipment">0</h3>

                        <span>Online</span>

                    </div>

                    <div>

                        <h3 id="offlineEquipment">0</h3>

                        <span>Offline</span>

                    </div>

                    <div>

                        <h3 id="pmDueToday">0</h3>

                        <span>PM Due</span>

                    </div>

                </div>

            </div>

            <!-- Activity -->

            <div class="dashboard-panel">

                <div class="panel-header">

                    <h2>

                        <i data-lucide="history"></i>

                        Today's Activity

                    </h2>

                </div>

                <div
                    id="activityFeed"
                    class="activity-feed">

                    <p>No recent activity.</p>

                </div>

            </div>

            <!-- Quick Actions -->

            <div class="dashboard-panel">

                <div class="panel-header">

                    <h2>

                        <i data-lucide="bolt"></i>

                        Quick Actions

                    </h2>

                </div>

                <div class="quick-actions">

                    <button onclick="navigate('callManagement')">

                        <i data-lucide="clipboard-list"></i>

                        Call Management

                    </button>

                    <button onclick="navigate('assets')">

                        <i data-lucide="boxes"></i>

                        Assets

                    </button>

                    <button onclick="navigate('reports')">

                        <i data-lucide="chart-column"></i>

                        Reports

                    </button>

                </div>

            </div>

        </div>

    </section>

</section>

`;

}
window.engineerDashboardView = engineerDashboardView;
;
/* source: dashboard_v2/views/wardBoyDashboardView.js */
let wardBoyTasks = [];
let wardBoyTaskFilter = "available";
let wardBoyRefreshTimer = null;

function wardBoyEscape(value) {
    const element = document.createElement("div");
    element.textContent = String(value ?? "");
    return element.innerHTML;
}

function cleanupWardBoyDashboard() {
    clearInterval(wardBoyRefreshTimer);
    wardBoyRefreshTimer = null;
}

function renderWardBoyDashboard() {
    cleanupWardBoyDashboard();
    pageContent.innerHTML = `
        <div class="ward-boy-page">
            <section class="ward-boy-hero">
                <div class="ward-boy-hero-copy">
                    <span class="ward-boy-eyebrow"><i data-lucide="radio-tower"></i> Hospital transport support</span>
                    <h1>Ward Boy Dispatch</h1>
                    <p>Accept equipment transport and Central Store spare-part deliveries, follow the route, and confirm handover.</p>
                    <span class="ward-boy-live"><i></i> Live job queue</span>
                </div>
                <div class="ward-boy-hero-art" aria-hidden="true"><i data-lucide="truck"></i></div>
                <button type="button" class="ward-boy-refresh" onclick="loadWardBoyDashboard(true)"><i data-lucide="refresh-cw"></i><span>Refresh jobs</span></button>
            </section>

            <section class="ward-boy-kpis" aria-label="Transport summary">
                <article class="is-pending"><span><i data-lucide="package-search"></i></span><div><small>Available jobs</small><strong id="wardBoyPending">—</strong></div></article>
                <article class="is-active"><span><i data-lucide="truck"></i></span><div><small>My active job</small><strong id="wardBoyActive">—</strong></div></article>
                <article class="is-done"><span><i data-lucide="badge-check"></i></span><div><small>Completed today</small><strong id="wardBoyCompleted">—</strong></div></article>
            </section>

            <section class="ward-boy-board">
                <header>
                    <div><span>Transport queue</span><h2>Equipment and spare-part jobs</h2></div>
                    <nav class="ward-boy-filters" aria-label="Filter jobs">
                        <button class="is-active" type="button" data-filter="available" onclick="setWardBoyFilter('available', this)">Available</button>
                        <button type="button" data-filter="active" onclick="setWardBoyFilter('active', this)">My active</button>
                        <button type="button" data-filter="completed" onclick="setWardBoyFilter('completed', this)">Completed</button>
                    </nav>
                </header>
                <div id="wardBoyTaskList" class="ward-boy-task-list">
                    <div class="ward-boy-loading"><i data-lucide="loader-circle"></i><span>Checking for transport jobs…</span></div>
                </div>
            </section>
        </div>`;
    if (window.lucide) lucide.createIcons();
    loadWardBoyDashboard();
    wardBoyRefreshTimer = window.setInterval(() => loadWardBoyDashboard(false, true), 30000);
}

async function loadWardBoyDashboard(showToast = false, quiet = false) {
    try {
        const response = await fetch("/api/ward-boy/dashboard", { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "Unable to load transport jobs.");
        wardBoyTasks = Array.isArray(data.tasks) ? data.tasks : [];
        document.getElementById("wardBoyPending").textContent = data.summary?.pending ?? 0;
        document.getElementById("wardBoyActive").textContent = data.summary?.my_active ?? 0;
        document.getElementById("wardBoyCompleted").textContent = data.summary?.completed_today ?? 0;
        renderWardBoyTasks();
        if (showToast) BioTrackToast.success("Jobs refreshed", "The transport queue is up to date.");
    } catch (error) {
        if (!quiet) BioTrackToast.error("Jobs unavailable", error.message || "Unable to load the transport queue.");
        const list = document.getElementById("wardBoyTaskList");
        if (list) list.innerHTML = '<div class="ward-boy-empty"><i data-lucide="wifi-off"></i><strong>Unable to load jobs</strong><p>Check the connection and refresh again.</p></div>';
        if (window.lucide) lucide.createIcons();
    }
}

function setWardBoyFilter(filter, button) {
    wardBoyTaskFilter = filter;
    document.querySelectorAll(".ward-boy-filters button").forEach(item => item.classList.toggle("is-active", item === button));
    renderWardBoyTasks();
}

function wardBoyFilteredTasks() {
    if (wardBoyTaskFilter === "active") return wardBoyTasks.filter(task => task.status === "Accepted");
    if (wardBoyTaskFilter === "completed") return wardBoyTasks.filter(task => task.status === "Completed");
    return wardBoyTasks.filter(task => task.status === "Pending");
}

function wardBoyTime(value) {
    if (!value) return "Just now";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Recently" : date.toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function renderWardBoyTasks() {
    const list = document.getElementById("wardBoyTaskList");
    if (!list) return;
    const tasks = wardBoyFilteredTasks();
    if (!tasks.length) {
        const copy = wardBoyTaskFilter === "available"
            ? ["No jobs waiting", "New pickup and return requests will appear here automatically."]
            : wardBoyTaskFilter === "active"
                ? ["No active transport", "Accept an available job when you are ready."]
                : ["No completed jobs yet", "Finished deliveries from today will appear here."];
        list.innerHTML = `<div class="ward-boy-empty"><i data-lucide="circle-check-big"></i><strong>${copy[0]}</strong><p>${copy[1]}</p></div>`;
        if (window.lucide) lucide.createIcons();
        return;
    }

    list.innerHTML = tasks.map(task => `
        <article class="ward-boy-task is-${String(task.status || "pending").toLowerCase()}" data-task-kind="${wardBoyEscape(task.task_kind || "equipment")}">
            <header>
                <span class="ward-boy-task-type is-${String(task.movement_type || "pickup").toLowerCase().replaceAll(" ", "-")}"><i data-lucide="${task.task_kind === "store" ? "warehouse" : task.movement_type === "Return" ? "undo-2" : "package-open"}"></i>${wardBoyEscape(task.movement_type)}</span>
                <span class="ward-boy-priority is-${String(task.priority || "medium").toLowerCase()}">${wardBoyEscape(task.priority || "Medium")}</span>
            </header>
            <div class="ward-boy-equipment">
                <span><i data-lucide="${task.task_kind === "store" ? "package-check" : "monitor-cog"}"></i></span>
                <div><small>${wardBoyEscape(task.ticket)}</small><h3>${wardBoyEscape(task.equipment || "Equipment")}</h3><p>${wardBoyEscape(task.equipment_identifier || "No equipment ID")}</p></div>
            </div>
            <div class="ward-boy-route">
                <div><span class="route-dot is-from"></span><small>Collect from</small><strong>${wardBoyEscape(task.source_location)}</strong></div>
                <span class="route-line"></span>
                <div><span class="route-dot is-to"></span><small>Deliver to</small><strong>${wardBoyEscape(task.destination_location)}</strong></div>
            </div>
            <footer>
                <div class="ward-boy-meta"><span><i data-lucide="building-2"></i>${wardBoyEscape(task.department || "Hospital")}</span><span><i data-lucide="clock-3"></i>${wardBoyEscape(wardBoyTime(task.requested_at))}</span></div>
                ${task.status === "Pending" ? `<button type="button" data-ward-task="${Number(task.id)}" onclick="acceptWardBoyTask(${Number(task.id)},'${task.task_kind || "equipment"}')"><i data-lucide="hand"></i> Accept job</button>` : ""}
                ${task.status === "Accepted" ? `<button type="button" data-ward-task="${Number(task.id)}" class="is-complete" onclick="completeWardBoyTask(${Number(task.id)},'${task.task_kind || "equipment"}')"><i data-lucide="badge-check"></i> Mark delivered</button>` : ""}
                ${task.status === "Completed" ? '<span class="ward-boy-delivered"><i data-lucide="circle-check-big"></i> Delivered</span>' : ""}
            </footer>
        </article>`).join("");
    if (window.lucide) lucide.createIcons();
}

async function mutateWardBoyTask(taskId, action, taskKind = "equipment") {
    const buttons = document.querySelectorAll(`button[data-ward-task="${taskId}"]`);
    buttons.forEach(button => { button.disabled = true; });
    try {
        const taskPath = taskKind === "store" ? "store-tasks" : "tasks";
        const response = await fetch(`/api/ward-boy/${taskPath}/${taskId}/${action}`, { method: "PATCH" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "Unable to update this job.");
        BioTrackToast.success(action === "accept" ? "Job accepted" : "Delivery recorded", action === "accept" ? "Follow the route shown on the job card." : taskKind === "store" ? "The engineer must now confirm receipt to complete the request." : "The requester and engineering team can now see the delivery status.");
        wardBoyTaskFilter = action === "accept" ? "active" : "completed";
        document.querySelectorAll(".ward-boy-filters button").forEach(item => item.classList.toggle("is-active", item.dataset.filter === wardBoyTaskFilter));
        await loadWardBoyDashboard();
        window.BioTrackNotifications?.fetch?.({ allowDesktop: false });
    } catch (error) {
        BioTrackToast.error("Job not updated", error.message || "Please refresh and try again.");
    } finally {
        buttons.forEach(button => { button.disabled = false; });
    }
}

function acceptWardBoyTask(taskId, taskKind = "equipment") { return mutateWardBoyTask(taskId, "accept", taskKind); }
function completeWardBoyTask(taskId, taskKind = "equipment") { return mutateWardBoyTask(taskId, "complete", taskKind); }
;
/* source: dashboard_v2/views/dashboardView.js */
// Executive administration dashboard.
function renderDashboard() {
    pageContent.innerHTML = `
      <main class="admin-operations-dashboard">
        <section class="admin-operations-hero">
          <div class="admin-operations-hero-copy">
            <span class="admin-eyebrow"><i data-lucide="activity"></i> Hospital operations control</span>
            <h1>One view of every engineering team.</h1>
            <p>Track maintenance work, asset availability and stock health across Biomedical, Electrical and IT services.</p>
          </div>
          <div class="admin-hero-actions">
            <div class="admin-live-status"><span></span><div><strong>Live operations</strong><small id="adminLastUpdated">Updating now…</small></div></div>
            <button class="admin-primary-action" onclick="navigate('callManagement')"><i data-lucide="clipboard-list"></i> Open call management</button>
          </div>
        </section>

        <section class="admin-summary-grid" aria-label="Hospital maintenance summary">
          <article class="admin-summary-card is-blue"><div class="admin-summary-icon"><i data-lucide="wrench"></i></div><div><span>Active calls</span><strong id="adminOpsActiveCalls">—</strong><small id="adminOpsActiveDetail">Across all departments</small></div></article>
          <article class="admin-summary-card is-red"><div class="admin-summary-icon"><i data-lucide="siren"></i></div><div><span>Critical calls</span><strong id="adminOpsCriticalCalls">—</strong><small>Needs immediate attention</small></div></article>
          <article class="admin-summary-card is-green"><div class="admin-summary-icon"><i data-lucide="circle-check-big"></i></div><div><span>Completed today</span><strong id="adminOpsCompletedToday">—</strong><small>Calls resolved today</small></div></article>
          <article class="admin-summary-card is-violet"><div class="admin-summary-icon"><i data-lucide="boxes"></i></div><div><span>Assets monitored</span><strong id="adminOpsAssets">—</strong><small id="adminOpsAssetsDetail">Across three service teams</small></div></article>
        </section>

        <section class="admin-business-section" aria-labelledby="adminBusinessTitle">
          <div class="admin-section-heading"><div><span class="admin-eyebrow">Business oversight</span><h2 id="adminBusinessTitle">Hospital financial position</h2><p>Budget, supplier liabilities, payments, insurance recovery and purchases requiring administrator supervision.</p></div><button class="admin-quiet-action" onclick="navigate('businessPortal')"><i data-lucide="landmark"></i> Open Business Office</button></div>
          <div class="admin-business-grid">
            <article><span class="is-blue"><i data-lucide="wallet-cards"></i></span><div><small>Allocated budget</small><strong id="adminBusinessBudget">—</strong></div></article>
            <article><span class="is-violet"><i data-lucide="badge-indian-rupee"></i></span><div><small>Paid spend</small><strong id="adminBusinessSpend">—</strong></div></article>
            <article><span class="is-green"><i data-lucide="circle-dollar-sign"></i></span><div><small>Remaining budget</small><strong id="adminBusinessRemaining">—</strong></div></article>
            <article><span class="is-orange"><i data-lucide="clipboard-clock"></i></span><div><small>Purchases to approve</small><strong id="adminBusinessPurchases">—</strong><em id="adminBusinessPurchaseAmount">Awaiting review</em></div></article>
            <article><span class="is-red"><i data-lucide="hourglass"></i></span><div><small>Insurance outstanding</small><strong id="adminBusinessInsurance">—</strong></div></article>
            <article><span class="is-orange"><i data-lucide="receipt"></i></span><div><small>Supplier outstanding</small><strong id="adminBusinessSupplierOutstanding">—</strong></div></article>
            <article><span class="is-red"><i data-lucide="hand-coins"></i></span><div><small>Payments to approve</small><strong id="adminBusinessPaymentApprovals">—</strong></div></article>
          </div>
          <div id="adminBusinessPending" class="admin-business-pending"><div class="admin-dashboard-loading">Loading purchase approvals…</div></div>
        </section>

        <section class="admin-insight-section" aria-labelledby="adminInsightTitle">
          <div class="admin-section-heading"><div><span class="admin-eyebrow">Operations pulse</span><h2 id="adminInsightTitle">Information to know now</h2><p>Live risk, availability, maintenance and supply indicators.</p></div></div>
          <div class="admin-insight-grid" id="adminInsightGrid">
            <button class="admin-insight-card is-blue" type="button" onclick="navigate('callManagement')"><span class="admin-insight-icon"><i data-lucide="timer"></i></span><span><small>Active downtime</small><strong id="adminOpsActiveDowntime">—</strong><em id="adminOpsOldestCall">Oldest active call</em></span><i data-lucide="arrow-up-right"></i></button>
            <button class="admin-insight-card is-slate" type="button" onclick="navigate('reports')"><span class="admin-insight-icon"><i data-lucide="gauge"></i></span><span><small>Average downtime</small><strong id="adminOpsAvgDowntime">—</strong><em>Completed maintenance</em></span><i data-lucide="arrow-up-right"></i></button>
            <button class="admin-insight-card is-orange" type="button" onclick="navigate('inventory')"><span class="admin-insight-icon"><i data-lucide="package-search"></i></span><span><small>Stock health</small><strong id="adminOpsStockHealth">—</strong><em id="adminOpsStockDetail">Checking inventory</em></span><i data-lucide="arrow-up-right"></i></button>
            <button class="admin-insight-card is-violet" type="button" onclick="navigate('pm')"><span class="admin-insight-icon"><i data-lucide="calendar-clock"></i></span><span><small>PM attention</small><strong id="adminOpsPmDue">—</strong><em id="adminOpsPmDetail">Due or overdue</em></span><i data-lucide="arrow-up-right"></i></button>
            <button class="admin-insight-card is-red" type="button" onclick="navigate('callManagement')"><span class="admin-insight-icon"><i data-lucide="boxes"></i></span><span><small>Awaiting parts</small><strong id="adminOpsAwaitingParts">—</strong><em>Calls delayed by supply</em></span><i data-lucide="arrow-up-right"></i></button>
            <button class="admin-insight-card is-green" type="button" onclick="navigate('assets')"><span class="admin-insight-icon"><i data-lucide="activity"></i></span><span><small>Asset availability</small><strong id="adminOpsAssetAvailability">—</strong><em id="adminOpsAssetDetail">Across monitored assets</em></span><i data-lucide="arrow-up-right"></i></button>
          </div>
        </section>

        <section class="admin-shortcut-section" aria-labelledby="adminShortcutTitle">
          <div class="admin-section-heading"><div><span class="admin-eyebrow">Quick access</span><h2 id="adminShortcutTitle">Common administrator shortcuts</h2><p>Open frequently used workspaces directly or use the shown keyboard shortcut.</p></div></div>
          <div class="admin-shortcut-grid">
            <button type="button" onclick="navigate('callManagement')" aria-keyshortcuts="Alt+C"><i data-lucide="clipboard-list"></i><span><strong>Call management</strong><small>Open and active calls</small></span><kbd>Alt C</kbd></button>
            <button type="button" onclick="navigate('assets')" aria-keyshortcuts="Alt+A"><i data-lucide="monitor-cog"></i><span><strong>Asset register</strong><small>Equipment and availability</small></span><kbd>Alt A</kbd></button>
            <button type="button" onclick="navigate('inventory')" aria-keyshortcuts="Alt+I"><i data-lucide="package-search"></i><span><strong>Stock control</strong><small>Low and out-of-stock items</small></span><kbd>Alt I</kbd></button>
            <button type="button" onclick="navigate('pm')" aria-keyshortcuts="Alt+P"><i data-lucide="calendar-clock"></i><span><strong>PM schedule</strong><small>Due preventive maintenance</small></span><kbd>Alt P</kbd></button>
            <button type="button" onclick="navigate('qr')" aria-keyshortcuts="Alt+Q"><i data-lucide="scan-line"></i><span><strong>QR scanner</strong><small>Find an asset quickly</small></span><kbd>Alt Q</kbd></button>
            <button type="button" onclick="navigate('reports')" aria-keyshortcuts="Alt+R"><i data-lucide="bar-chart-3"></i><span><strong>Reports</strong><small>Downtime and performance</small></span><kbd>Alt R</kbd></button>
            <button type="button" onclick="navigate('users')" aria-keyshortcuts="Alt+U"><i data-lucide="users"></i><span><strong>User access</strong><small>Teams and permissions</small></span><kbd>Alt U</kbd></button>
            <button type="button" onclick="navigate('settings')" aria-keyshortcuts="Alt+S"><i data-lucide="settings"></i><span><strong>Settings</strong><small>Profile and security</small></span><kbd>Alt S</kbd></button>
          </div>
        </section>

        <section class="admin-team-section">
          <div class="admin-section-heading"><div><span class="admin-eyebrow">Department activity</span><h2>Service team command center</h2><p>Live workload and resource health for every engineering department.</p></div><button class="admin-quiet-action" onclick="loadDashboard()"><i data-lucide="refresh-cw"></i> Refresh</button></div>
          <div id="adminTeamGrid" class="admin-team-grid"><div class="admin-dashboard-loading">Loading department activity…</div></div>
        </section>

        <section class="admin-operations-grid">
          <article class="admin-panel admin-activity-panel">
            <div class="admin-panel-heading"><div><span class="admin-eyebrow">Live queue</span><h2>Recent maintenance activity</h2></div><button class="admin-link-button" onclick="navigate('callManagement')">View all <i data-lucide="arrow-up-right"></i></button></div>
            <div id="adminActivityFeed" class="admin-activity-feed"><div class="admin-dashboard-loading">Loading activity…</div></div>
          </article>
          <aside class="admin-side-stack">
            <article class="admin-panel admin-attention-panel">
              <div class="admin-panel-heading"><div><span class="admin-eyebrow">Operational attention</span><h2>What needs a look</h2></div></div>
              <div id="adminAttentionList" class="admin-attention-list"><div class="admin-dashboard-loading">Checking operations…</div></div>
            </article>
            <article class="admin-panel admin-quick-panel">
              <span class="admin-eyebrow">Administrator tools</span>
              <h2>Keep work moving</h2>
              <div class="admin-quick-actions">
                <button onclick="navigate('assets')"><i data-lucide="monitor-cog"></i><span>Asset register</span><i data-lucide="arrow-right"></i></button>
                <button onclick="navigate('inventory')"><i data-lucide="package-search"></i><span>Inventory health</span><i data-lucide="arrow-right"></i></button>
                <button onclick="navigate('pm')"><i data-lucide="calendar-clock"></i><span>PM schedule</span><i data-lucide="arrow-right"></i></button>
              </div>
            </article>
          </aside>
        </section>
      </main>
    `;

    if (window.lucide) lucide.createIcons();
    loadDashboard();
    if (window.dashboardRefresh) clearInterval(window.dashboardRefresh);
    window.dashboardRefresh = setInterval(loadDashboard, 30000);
}
;
/* source: dashboard_v2/views/userDashboardView.js */
// Department user dashboard
async function renderUserDashboard() {
    const department = localStorage.getItem("department") || "Your";
    const username = localStorage.getItem("username") || "there";
    pageContent.innerHTML = `
      <main class="user-home-page">
        <section class="user-home-hero">
          <div class="user-home-hero-copy">
            <span class="user-home-eyebrow"><span class="user-home-live-dot"></span> Department workspace</span>
            <h1>Good day, <span>${escapeUserDashboardHtml(username)}</span>.</h1>
            <p>Manage maintenance, equipment and preventive-care schedules for <strong>${escapeUserDashboardHtml(department)}</strong> from one focused workspace.</p>
            <div class="user-home-hero-actions">
              <button class="user-home-primary-action" onclick="navigate('newRequest')"><i data-lucide="plus"></i> Report a problem</button>
              <button class="user-home-secondary-action" onclick="navigate('myAssets')"><i data-lucide="monitor-smartphone"></i> View my assets</button>
            </div>
          </div>
          <div class="user-home-hero-panel"><span>Today</span><strong id="userHomeDate">—</strong><small><i data-lucide="shield-check"></i> BioTrack is online</small></div>
        </section>
        <section class="user-home-metrics" aria-label="Department overview">
          <button class="user-home-metric is-blue" onclick="navigate('myRequests')"><span class="user-home-metric-icon"><i data-lucide="clipboard-list"></i></span><span><small>Open requests</small><strong id="userHomeOpen">—</strong><em>View requests <i data-lucide="arrow-up-right"></i></em></span></button>
          <button class="user-home-metric is-orange" onclick="navigate('myRequests')"><span class="user-home-metric-icon"><i data-lucide="loader-circle"></i></span><span><small>In progress</small><strong id="userHomeProgress">—</strong><em>Track progress <i data-lucide="arrow-up-right"></i></em></span></button>
          <button class="user-home-metric is-purple" onclick="navigate('myAssets')"><span class="user-home-metric-icon"><i data-lucide="monitor-smartphone"></i></span><span><small>Department assets</small><strong id="userHomeAssets">—</strong><em>Open asset list <i data-lucide="arrow-up-right"></i></em></span></button>
          <button class="user-home-metric is-green" onclick="navigate('departmentPMSchedule')"><span class="user-home-metric-icon"><i data-lucide="calendar-clock"></i></span><span><small>PM due / overdue</small><strong id="userHomePM">—</strong><em>View schedule <i data-lucide="arrow-up-right"></i></em></span></button>
        </section>
        <section class="user-home-grid">
          <article class="user-home-card user-home-requests-card">
            <div class="user-home-card-heading"><div><span class="user-home-section-label">Maintenance</span><h2>Your recent requests</h2></div><button class="user-home-text-button" onclick="navigate('myRequests')">View all <i data-lucide="arrow-right"></i></button></div>
            <div id="userHomeRequests" class="user-home-request-list"><div class="user-home-loading">Loading your recent requests…</div></div>
          </article>
          <aside class="user-home-side-stack">
            <article class="user-home-card user-home-pm-card">
              <div class="user-home-card-heading"><div><span class="user-home-section-label">Preventive care</span><h2>Next PM visit</h2></div><i data-lucide="calendar-check" class="user-home-heading-icon"></i></div>
              <div id="userHomeNextPM" class="user-home-pm-empty">Loading PM schedule…</div>
              <button class="user-home-outline-button" onclick="navigate('departmentPMSchedule')">Open PM schedule <i data-lucide="arrow-right"></i></button>
            </article>
            <article class="user-home-card user-home-actions-card">
              <div class="user-home-card-heading"><div><span class="user-home-section-label">Shortcuts</span><h2>Quick actions</h2></div></div>
              <div class="user-home-action-grid">
                <button onclick="navigate('newRequest')"><i data-lucide="plus-circle"></i><span>New request</span></button>
                <button onclick="navigate('qr')"><i data-lucide="scan-line"></i><span>Scan QR</span></button>
                <button onclick="navigate('myAssets')"><i data-lucide="monitor-smartphone"></i><span>My assets</span></button>
                <button onclick="navigate('departmentPMSchedule')"><i data-lucide="calendar-clock"></i><span>PM schedule</span></button>
              </div>
            </article>
          </aside>
        </section>
        <p id="userHomeUpdated" class="user-home-updated">Loading department information…</p>
      </main>
    `;
    document.getElementById("userHomeDate").textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "short" }).format(new Date());
    if (window.lucide) lucide.createIcons();
    await loadUserDashboardData();
}

async function loadUserDashboardData() {
    const [requestResult, assetsResult, pmResult] = await Promise.all([
        userDashboardFetch("/api/user/my-requests"),
        userDashboardFetch("/api/assets/department/mine"),
        userDashboardFetch("/api/user/pm-schedule"),
    ]);
    const data = requestResult && !Array.isArray(requestResult) ? requestResult : { summary: {}, requests: [] };
    const requests = Array.isArray(data.requests) ? data.requests : [];
    const assets = Array.isArray(assetsResult) ? assetsResult : [];
    const schedules = Array.isArray(pmResult) ? pmResult : [];
    const summary = data.summary || {};
    setUserDashboardValue("userHomeOpen", summary.open ?? requests.filter(item => item.status === "Open").length);
    setUserDashboardValue("userHomeProgress", summary.in_progress ?? requests.filter(item => item.status === "In Progress").length);
    setUserDashboardValue("userHomeAssets", assets.length);
    setUserDashboardValue("userHomePM", schedules.filter(item => ["Due", "Overdue"].includes(item.status)).length);
    renderUserDashboardRequests(requests.slice(0, 4));
    renderUserDashboardNextPM(schedules);
    const updated = document.getElementById("userHomeUpdated");
    if (updated) updated.textContent = `Updated just now · ${requests.length} request${requests.length === 1 ? "" : "s"} and ${assets.length} department asset${assets.length === 1 ? "" : "s"}`;
    if (window.lucide) lucide.createIcons();
}

async function userDashboardFetch(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        return await response.json();
    } catch (error) {
        console.error(`Dashboard data failed for ${url}:`, error);
        return null;
    }
}

function renderUserDashboardRequests(requests) {
    const container = document.getElementById("userHomeRequests");
    if (!container) return;
    if (!requests.length) {
        container.innerHTML = `<div class="user-home-empty-state"><span><i data-lucide="clipboard-check"></i></span><div><strong>No requests yet</strong><p>Everything is quiet. Report an issue whenever you need support.</p></div><button onclick="navigate('newRequest')">Create request</button></div>`;
        return;
    }
    container.innerHTML = requests.map(item => `
      <button class="user-home-request-row" onclick="openUserDashboardRequest('${escapeUserDashboardHtml(item.ticket)}')">
        <span class="user-home-request-icon"><i data-lucide="wrench"></i></span>
        <span class="user-home-request-copy"><strong>${escapeUserDashboardHtml(item.equipment || "Maintenance request")}</strong><small>${escapeUserDashboardHtml(item.ticket || "-")} · ${formatUserDashboardDate(item.reported_time)}</small></span>
        <span class="user-home-request-meta"><em class="user-home-priority ${userDashboardClass(item.priority)}">${escapeUserDashboardHtml(item.priority || "Normal")}</em><b class="user-home-status ${userDashboardClass(item.status)}">${escapeUserDashboardHtml(item.status || "Open")}</b></span>
        <i data-lucide="chevron-right" class="user-home-row-arrow"></i>
      </button>
    `).join("");
}

function renderUserDashboardNextPM(schedules) {
    const container = document.getElementById("userHomeNextPM");
    if (!container) return;
    const next = schedules.find(item => item.status !== "Completed");
    if (!next) {
        container.innerHTML = `<div class="user-home-pm-empty"><i data-lucide="calendar-plus"></i><div><strong>No PM visit scheduled</strong><p>Your department has no planned preventive-maintenance visits at the moment.</p></div></div>`;
        return;
    }
    container.innerHTML = `<div class="user-home-pm-date"><span>${formatUserDashboardDay(next.scheduled_date)}</span><small>${formatUserDashboardMonth(next.scheduled_date)}</small></div><div class="user-home-pm-copy"><strong>${escapeUserDashboardHtml(next.equipment_name || "Department equipment")}</strong><p>${escapeUserDashboardHtml(next.location || "Department location")}</p><b class="user-home-status ${userDashboardClass(next.status)}">${escapeUserDashboardHtml(next.status || "Upcoming")}</b></div>`;
}

function openUserDashboardRequest(ticket) {
    localStorage.setItem("selectedRequest", ticket);
    navigate("requestDetails");
}

function setUserDashboardValue(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function formatUserDashboardDate(value) {
    if (!value) return "Recently";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Recently" : new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short" }).format(date);
}
function formatUserDashboardDay(value) {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? "—" : String(date.getDate()).padStart(2, "0");
}
function formatUserDashboardMonth(value) {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(undefined, { month: "short" }).format(date);
}
function userDashboardClass(value) {
    return String(value || "unknown").toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
}
function escapeUserDashboardHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
;
/* source: dashboard_v2/views/myAssetsView.js */
let departmentAssets = [];
let filteredDepartmentAssets = [];
let departmentRelocationRequests = [];
const departmentAssetsPagination = { page: 1, pageSize: 10 };

async function renderMyAssets() {
    pageContent.innerHTML = `
        <div class="department-module-page">
            <header class="department-module-header">
                <div>
                    <span class="department-module-kicker"><i data-lucide="building-2"></i> Department Assets</span>
                    <h1>My Assets</h1>
                    <p id="myAssetsDescription">View department equipment and request an engineering-approved move to another department or room.</p>
                </div>
                <div class="department-module-actions">
                    <button id="refreshMyAssets" class="department-action-button"><i data-lucide="refresh-cw"></i> Refresh</button>
                </div>
            </header>

            <section class="department-summary-grid">
                <article class="department-summary-card"><span>Total Assets</span><strong id="myAssetsTotal">0</strong></article>
                <article class="department-summary-card is-success"><span>Active</span><strong id="myAssetsActive">0</strong></article>
                <article class="department-summary-card is-warning"><span>Needs Attention</span><strong id="myAssetsAttention">0</strong></article>
            </section>

            <section class="department-toolbar">
                <label class="department-search"><i data-lucide="search"></i><input id="myAssetsSearch" type="search" placeholder="Search asset ID, equipment, manufacturer or location..."></label>
                <select id="myAssetsStatus" aria-label="Filter assets by status"><option value="">All Statuses</option></select>
                <select id="myAssetsType" aria-label="Filter assets by type"><option value="">All Types</option></select>
            </section>

            <section class="department-table-card">
                <table class="department-table">
                    <thead><tr><th>Asset ID</th><th>Equipment</th><th>Type</th><th>Manufacturer / Model</th><th>Location</th><th>Status</th><th></th></tr></thead>
                    <tbody id="myAssetsBody"><tr><td colspan="7">Loading department assets...</td></tr></tbody>
                </table>
            </section>
            <div id="myAssetsPagination" class="table-pagination"></div>
        </div>
    `;

    document.getElementById("refreshMyAssets").addEventListener("click", loadMyAssets);
    document.getElementById("myAssetsSearch").addEventListener("input", applyMyAssetsFilters);
    document.getElementById("myAssetsStatus").addEventListener("change", applyMyAssetsFilters);
    document.getElementById("myAssetsType").addEventListener("change", applyMyAssetsFilters);
    if (window.lucide) lucide.createIcons();
    await loadMyAssets();
}

async function loadMyAssets() {
    const body = document.getElementById("myAssetsBody");
    try {
        const [response, relocationResponse] = await Promise.all([
            fetch("/api/assets/department/mine"),
            fetch("/api/assets/relocation-requests/mine"),
        ]);
        if (!response.ok) throw new Error("Unable to load your department's assets.");
        if (!relocationResponse.ok) throw new Error("Unable to load relocation requests.");
        departmentAssets = await response.json();
        departmentRelocationRequests = await relocationResponse.json();
        if (!Array.isArray(departmentAssets)) departmentAssets = [];
        if (!Array.isArray(departmentRelocationRequests)) departmentRelocationRequests = [];
        populateMyAssetsFilters();
        updateMyAssetsSummary();
        applyMyAssetsFilters(false);
    } catch (error) {
        console.error(error);
        if (body) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = 7;
            cell.textContent = error instanceof Error ? error.message : "Unable to load assets.";
            row.appendChild(cell);
            body.replaceChildren(row);
        }
    }
}

function populateMyAssetsFilters() {
    const configure = (id, values, label) => {
        const select = document.getElementById(id);
        if (!select) return;
        const previous = select.value;
        const options = [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
        select.innerHTML = `<option value="">${label}</option>${options.map(value => `<option value="${escapeMyAssetsHtml(value)}">${escapeMyAssetsHtml(value)}</option>`).join("")}`;
        if (options.includes(previous)) select.value = previous;
    };
    configure("myAssetsStatus", departmentAssets.map(asset => asset.status), "All Statuses");
    configure("myAssetsType", departmentAssets.map(asset => asset.classification || asset.equipment_type), "All Types");
}

function updateMyAssetsSummary() {
    const active = departmentAssets.filter(asset => (asset.status || "").toLowerCase() === "active").length;
    document.getElementById("myAssetsTotal").textContent = departmentAssets.length;
    document.getElementById("myAssetsActive").textContent = active;
    document.getElementById("myAssetsAttention").textContent = departmentAssets.length - active;
}

function applyMyAssetsFilters(resetPage = true) {
    const search = (document.getElementById("myAssetsSearch")?.value || "").trim().toLowerCase();
    const status = document.getElementById("myAssetsStatus")?.value || "";
    const type = document.getElementById("myAssetsType")?.value || "";
    filteredDepartmentAssets = departmentAssets.filter(asset => {
        const searchable = [asset.asset_code, asset.equipment_no, asset.equipment_name, asset.classification, asset.equipment_type, asset.manufacturer, asset.model, asset.location]
            .filter(Boolean).join(" ").toLowerCase();
        return (!search || searchable.includes(search))
            && (!status || asset.status === status)
            && (!type || (asset.classification || asset.equipment_type) === type);
    });
    if (resetPage) departmentAssetsPagination.page = 1;
    renderMyAssetsTable();
}

function renderMyAssetsTable() {
    const body = document.getElementById("myAssetsBody");
    if (!body) return;
    if (!filteredDepartmentAssets.length) {
        body.innerHTML = '<tr><td colspan="7">No assets match your search or filters.</td></tr>';
        TablePagination.render(document.getElementById("myAssetsPagination"), departmentAssetsPagination, 0, renderMyAssetsTable, "assets");
        return;
    }
    const assets = TablePagination.pageItems(filteredDepartmentAssets, departmentAssetsPagination);
    body.innerHTML = assets.map(asset => {
        const pendingMove = departmentRelocationRequests.find(item => Number(item.asset_id) === Number(asset.id) && item.status === "Pending");
        return `
        <tr>
            <td><strong>${escapeMyAssetsHtml(asset.asset_code || asset.equipment_no || "-")}</strong></td>
            <td>${escapeMyAssetsHtml(asset.equipment_name || "-")}</td>
            <td>${escapeMyAssetsHtml(asset.classification || asset.equipment_type || "-")}</td>
            <td>${escapeMyAssetsHtml([asset.manufacturer, asset.model].filter(Boolean).join(" / ") || "-")}</td>
            <td>${escapeMyAssetsHtml(asset.location || "-")}</td>
            <td><span class="department-status ${departmentStatusClass(asset.status)}">${escapeMyAssetsHtml(asset.status || "Unknown")}</span></td>
            <td><div class="department-asset-actions"><button class="department-view-button" data-asset-id="${asset.id}">View</button><button class="department-relocate-button" data-relocate-asset="${asset.id}" ${pendingMove ? "disabled" : ""}><i data-lucide="route"></i>${pendingMove ? "Move requested" : "Request move"}</button></div></td>
        </tr>
    `;
    }).join("");
    body.querySelectorAll("[data-asset-id]").forEach(button => button.addEventListener("click", () => {
        currentAssetId = Number(button.dataset.assetId);
        navigate("assetDetails");
    }));
    body.querySelectorAll("[data-relocate-asset]").forEach(button => button.addEventListener("click", () => {
        const asset = departmentAssets.find(item => Number(item.id) === Number(button.dataset.relocateAsset));
        if (asset) window.AssetRelocation?.openRequest(asset);
    }));
    if (window.lucide) window.lucide.createIcons();
    TablePagination.render(document.getElementById("myAssetsPagination"), departmentAssetsPagination, filteredDepartmentAssets.length, renderMyAssetsTable, "assets");
}

function departmentStatusClass(status) {
    return (status || "unknown").toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
}

function escapeMyAssetsHtml(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
;
/* source: dashboard_v2/views/departmentPmScheduleView.js */
let departmentPMSchedules = [];
let selectedDepartmentPMScheduleId = null;
let departmentPMCurrentDate = new Date();
let pendingDepartmentPMResponse = null;

async function renderDepartmentPMSchedule() {
    pageContent.innerHTML = `
      <main class="department-pm-page">
        <header class="department-pm-header">
          <div><span class="department-module-kicker"><i data-lucide="calendar-clock"></i> Department maintenance</span><h1>PM Schedule</h1><p>Review upcoming preventive-maintenance visits and let the engineering team know whether the planned date works for your department.</p></div>
          <button id="refreshDepartmentPM" class="department-action-button"><i data-lucide="refresh-cw"></i> Refresh</button>
        </header>
        <section class="department-pm-summary">
          <article><span>Scheduled</span><strong id="departmentPMTotal">0</strong></article>
          <article class="is-green"><span>Approved</span><strong id="departmentPMApproved">0</strong></article>
          <article class="is-red"><span>Needs reply</span><strong id="departmentPMPending">0</strong></article>
        </section>
        <section class="department-pm-workspace">
          <article class="department-pm-calendar-card">
            <div class="department-pm-calendar-toolbar">
              <div class="department-pm-navigation"><button id="departmentPMPrevious" aria-label="Previous month"><i data-lucide="chevron-left"></i></button><h2 id="departmentPMMonth">—</h2><button id="departmentPMNext" aria-label="Next month"><i data-lucide="chevron-right"></i></button></div>
              <button id="departmentPMToday" class="department-pm-today">Today</button>
            </div>
            <div id="departmentPMCalendar" class="department-pm-calendar"></div>
          </article>
          <aside id="departmentPMDetail" class="department-pm-detail"><div class="department-pm-detail-empty"><i data-lucide="calendar-search"></i><strong>Select a scheduled visit</strong><p>Choose a PM event from the calendar to view its details or respond to it.</p></div></aside>
        </section>
      </main>
    `;
    document.getElementById("refreshDepartmentPM").addEventListener("click", loadDepartmentPMSchedule);
    document.getElementById("departmentPMPrevious").addEventListener("click", () => { departmentPMCurrentDate.setMonth(departmentPMCurrentDate.getMonth() - 1); renderDepartmentPMCalendar(); });
    document.getElementById("departmentPMNext").addEventListener("click", () => { departmentPMCurrentDate.setMonth(departmentPMCurrentDate.getMonth() + 1); renderDepartmentPMCalendar(); });
    document.getElementById("departmentPMToday").addEventListener("click", () => { departmentPMCurrentDate = new Date(); renderDepartmentPMCalendar(); });
    if (window.lucide) lucide.createIcons();
    await loadDepartmentPMSchedule();
}

async function loadDepartmentPMSchedule() {
    try {
        const response = await fetch("/api/user/pm-schedule");
        if (!response.ok) throw new Error("Unable to load your department's PM schedule.");
        departmentPMSchedules = await response.json();
        if (!Array.isArray(departmentPMSchedules)) departmentPMSchedules = [];
        const next = departmentPMSchedules.find(item => item.status !== "Completed");
        if (!selectedDepartmentPMScheduleId && next) selectedDepartmentPMScheduleId = next.id;
        updateDepartmentPMSummary();
        renderDepartmentPMCalendar();
        renderDepartmentPMDetail();
    } catch (error) {
        console.error(error);
        document.getElementById("departmentPMDetail").innerHTML = `<div class="department-pm-detail-empty"><strong>Could not load PM schedule</strong><p>${escapeDepartmentPMHtml(error.message)}</p></div>`;
    }
}

function updateDepartmentPMSummary() {
    const total = departmentPMSchedules.length;
    const approved = departmentPMSchedules.filter(item => item.department_response === "Approved").length;
    const pending = departmentPMSchedules.filter(item => item.status !== "Completed" && item.department_response === "Pending").length;
    document.getElementById("departmentPMTotal").textContent = total;
    document.getElementById("departmentPMApproved").textContent = approved;
    document.getElementById("departmentPMPending").textContent = pending;
}

function renderDepartmentPMCalendar() {
    const calendar = document.getElementById("departmentPMCalendar");
    if (!calendar) return;
    const year = departmentPMCurrentDate.getFullYear();
    const month = departmentPMCurrentDate.getMonth();
    document.getElementById("departmentPMMonth").textContent = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(departmentPMCurrentDate);
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const days = new Date(year, month + 1, 0).getDate();
    const cells = [];
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach(day => cells.push(`<div class="department-pm-weekday">${day}</div>`));
    for (let empty = 0; empty < startOffset; empty += 1) cells.push('<div class="department-pm-day is-empty"></div>');
    for (let day = 1; day <= days; day += 1) {
        const key = departmentPMDateKey(new Date(year, month, day));
        const schedules = departmentPMSchedules.filter(item => item.scheduled_date === key);
        const today = departmentPMDateKey(new Date()) === key;
        cells.push(`<div class="department-pm-day ${today ? "is-today" : ""}"><time>${day}</time><div class="department-pm-day-events">${schedules.slice(0, 2).map(item => `<button class="department-pm-event ${departmentPMStatusClass(item.status)} ${item.id === selectedDepartmentPMScheduleId ? "is-selected" : ""}" onclick="selectDepartmentPMSchedule(${item.id})" title="${escapeDepartmentPMHtml(item.equipment_name)}">${escapeDepartmentPMHtml(item.equipment_name || "PM visit")}<span class="department-pm-response-dot ${departmentPMStatusClass(item.department_response)}"></span></button>`).join("")}${schedules.length > 2 ? `<span class="department-pm-more">+${schedules.length - 2} more</span>` : ""}</div></div>`);
    }
    calendar.innerHTML = cells.join("");
    if (window.lucide) lucide.createIcons();
}

function selectDepartmentPMSchedule(id) {
    selectedDepartmentPMScheduleId = id;
    pendingDepartmentPMResponse = null;
    renderDepartmentPMCalendar();
    renderDepartmentPMDetail();
}

function renderDepartmentPMDetail() {
    const panel = document.getElementById("departmentPMDetail");
    if (!panel) return;
    const schedule = departmentPMSchedules.find(item => item.id === selectedDepartmentPMScheduleId);
    if (!schedule) {
        panel.innerHTML = '<div class="department-pm-detail-empty"><i data-lucide="calendar-search"></i><strong>Select a scheduled visit</strong><p>Choose a PM event from the calendar to view its details.</p></div>';
        if (window.lucide) lucide.createIcons();
        return;
    }
    const completed = schedule.status === "Completed";
    const response = schedule.department_response || "Pending";
    const canRespond = !completed;
    panel.innerHTML = `
      <div class="department-pm-detail-top"><span class="department-pm-detail-date">${formatDepartmentPMDate(schedule.scheduled_date)}</span><span class="department-status ${departmentPMStatusClass(schedule.status)}">${escapeDepartmentPMHtml(schedule.status)}</span></div>
      <h2>${escapeDepartmentPMHtml(schedule.equipment_name || "Department equipment")}</h2>
      <p class="department-pm-location"><i data-lucide="map-pin"></i> ${escapeDepartmentPMHtml(schedule.location || "Department location")}</p>
      <dl class="department-pm-facts"><div><dt>Asset ID</dt><dd>${escapeDepartmentPMHtml(schedule.asset_code || "-")}</dd></div><div><dt>PM frequency</dt><dd>Every ${schedule.frequency_days || "-"} days</dd></div></dl>
      ${schedule.remarks ? `<div class="department-pm-remarks"><strong>Engineer notes</strong><p>${escapeDepartmentPMHtml(schedule.remarks)}</p></div>` : ""}
      <div class="department-pm-response-card">
        <span>Department response</span><strong class="department-pm-response-label ${departmentPMStatusClass(response)}">${escapeDepartmentPMHtml(response)}</strong>
        ${schedule.department_response_note ? `<p>${escapeDepartmentPMHtml(schedule.department_response_note)}</p>` : '<p>No note added.</p>'}
      </div>
      ${canRespond ? renderDepartmentPMResponseControls(schedule) : '<p class="department-pm-completed-message"><i data-lucide="circle-check"></i> This PM visit is completed and no longer needs a response.</p>'}
    `;
    if (window.lucide) lucide.createIcons();
}

function renderDepartmentPMResponseControls(schedule) {
    if (pendingDepartmentPMResponse) {
        return `<div class="department-pm-response-form"><strong>${pendingDepartmentPMResponse} this visit</strong><textarea id="departmentPMResponseNote" maxlength="1000" placeholder="Optional note for the biomedical engineer, e.g. department busy on this date.">${escapeDepartmentPMHtml(schedule.department_response_note || "")}</textarea><div><button class="department-pm-cancel" onclick="cancelDepartmentPMResponse()">Cancel</button><button class="department-pm-confirm ${departmentPMStatusClass(pendingDepartmentPMResponse)}" onclick="submitDepartmentPMResponse()">Confirm ${pendingDepartmentPMResponse}</button></div></div>`;
    }
    return `<div class="department-pm-response-actions"><p>Confirm whether this planned visit works for your department. You may include an optional note.</p><button class="department-pm-approve" onclick="chooseDepartmentPMResponse('Approved')"><i data-lucide="check"></i> Approve</button><button class="department-pm-deny" onclick="chooseDepartmentPMResponse('Denied')"><i data-lucide="x"></i> Deny / busy</button></div>`;
}

function chooseDepartmentPMResponse(response) {
    pendingDepartmentPMResponse = response;
    renderDepartmentPMDetail();
}
function cancelDepartmentPMResponse() {
    pendingDepartmentPMResponse = null;
    renderDepartmentPMDetail();
}
async function submitDepartmentPMResponse() {
    const schedule = departmentPMSchedules.find(item => item.id === selectedDepartmentPMScheduleId);
    if (!schedule || !pendingDepartmentPMResponse) return;
    const note = document.getElementById("departmentPMResponseNote")?.value || "";
    try {
        const response = await fetch(`/api/user/pm-schedule/${schedule.id}/response`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ response: pendingDepartmentPMResponse, note }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || "Unable to save your response.");
        const index = departmentPMSchedules.findIndex(item => item.id === schedule.id);
        departmentPMSchedules[index] = result.schedule;
        pendingDepartmentPMResponse = null;
        updateDepartmentPMSummary();
        renderDepartmentPMCalendar();
        renderDepartmentPMDetail();
    } catch (error) {
        BioTrackToast.error("PM schedule unavailable", error.message || "Unable to load the PM schedule.");
    }
}

function departmentPMDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function formatDepartmentPMDate(value) {
    if (!value) return "-";
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(date);
}
function departmentPMStatusClass(value) {
    return String(value || "pending").toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
}
function escapeDepartmentPMHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
;
/* source: dashboard_v2/views/newRequestView.js */
async function renderNewRequest() {
    try {
        const response = await fetch("/static/dashboard_v2/partials/new_request.html");
        if (!response.ok) throw new Error("The maintenance request form could not be loaded.");
        pageContent.innerHTML = await response.text();
        if (window.lucide) lucide.createIcons();
        await initializeNewRequest();
    } catch (error) {
        pageContent.innerHTML = '<div class="request-load-error"><i data-lucide="cloud-alert"></i><h2>Request form unavailable</h2><p></p><button type="button">Try again</button></div>';
        pageContent.querySelector(".request-load-error p").textContent = error.message || "Please check your connection and try again.";
        pageContent.querySelector(".request-load-error button").addEventListener("click", renderNewRequest);
        if (window.lucide) lucide.createIcons();
    }
}
;
/* source: dashboard_v2/views/maintenanceView.js */
// ==========================================
// ROLE-AWARE CALL MANAGEMENT
// ==========================================

let maintenanceCalls = [];
let filteredMaintenanceCalls = [];
let maintenanceStatusMode = "all";
let maintenanceRefreshTimer = null;
let maintenanceViewMode = "board";
let maintenanceTechnicians = [];
const maintenancePagination = { page: 1, pageSize: 25 };
const DOWNTIME_SECRET_CLICK_COUNT = 15;
const DOWNTIME_SECRET_CLICK_WINDOW_MS = 10000;
let downtimeSecretClickState = { ticket: "", count: 0, lastClick: 0 };

const MAINTENANCE_PORTALS = {
    admin: {
        tone: "all", icon: "activity", eyebrow: "Hospital operations control", scope: "All engineering teams",
        description: "Coordinate Biomedical, Electrical and IT maintenance calls from one live service queue.",
    },
    manager: {
        tone: "all", icon: "activity", eyebrow: "Hospital operations control", scope: "All engineering teams",
        description: "Coordinate Biomedical, Electrical and IT maintenance calls from one live service queue.",
    },
    bme: {
        tone: "biomedical", icon: "heart-pulse", eyebrow: "Biomedical service desk", scope: "Biomedical Engineering",
        description: "Prioritise, repair and close biomedical equipment calls with a clear view of downtime and urgency.",
    },
    engineer: {
        tone: "biomedical", icon: "heart-pulse", eyebrow: "Biomedical service desk", scope: "Biomedical Engineering",
        description: "Prioritise, repair and close biomedical equipment calls with a clear view of downtime and urgency.",
    },
    electrical: {
        tone: "electrical", icon: "plug-zap", eyebrow: "Electrical service desk", scope: "Electrical Engineering",
        description: "Track electrical faults, active repairs and service delays across the hospital.",
    },
    it: {
        tone: "it", icon: "server-cog", eyebrow: "IT service desk", scope: "IT Engineering",
        description: "Manage technology incidents, infrastructure repairs and equipment downtime from one queue.",
    },
};

function maintenancePortalConfig() {
    const role = (localStorage.getItem("role") || "manager").trim().toLowerCase();
    return MAINTENANCE_PORTALS[role] || MAINTENANCE_PORTALS.manager;
}

function renderMaintenance() {
    const portal = maintenancePortalConfig();
    maintenanceStatusMode = "all";
    maintenanceCalls = [];
    filteredMaintenanceCalls = [];
    if (maintenanceRefreshTimer) clearInterval(maintenanceRefreshTimer);

    pageContent.innerHTML = `
        <div class="maintenance-page" data-maintenance-portal="${portal.tone}">
            <section class="maintenance-command-hero is-${portal.tone}">
                <div class="maintenance-hero-copy">
                    <div class="maintenance-hero-identity">
                        <span class="maintenance-hero-icon"><i data-lucide="${portal.icon}"></i></span>
                        <div><span class="maintenance-eyebrow">${portal.eyebrow}</span><h1>Call Management</h1></div>
                    </div>
                    <p>${portal.description}</p>
                </div>
                <div class="maintenance-hero-control">
                    <div class="maintenance-live-panel">
                        <span class="maintenance-live-icon"><i data-lucide="radio-tower"></i></span>
                        <div><small>Live service queue</small><strong>${portal.scope}</strong><time id="maintenanceUpdatedAt">Updating now…</time></div>
                        <span class="maintenance-live-dot" aria-label="Live"></span>
                    </div>
                    <button id="refreshMaintenanceButton" class="maintenance-refresh-button" type="button"><i data-lucide="refresh-cw"></i><span>Refresh queue</span></button>
                </div>
            </section>

            <section class="maintenance-kpis" aria-label="Call summary">
                <article class="maintenance-metric is-blue"><span class="maintenance-metric-icon"><i data-lucide="ticket-check"></i></span><div><small>Total requests</small><strong id="totalCalls">0</strong><em>All recorded service calls</em></div></article>
                <article class="maintenance-metric is-cyan"><span class="maintenance-metric-icon"><i data-lucide="radio"></i></span><div><small>Active queue</small><strong id="activeCalls">0</strong><em>Calls still requiring action</em></div></article>
                <article class="maintenance-metric is-orange"><span class="maintenance-metric-icon"><i data-lucide="wrench"></i></span><div><small>In progress</small><strong id="progressCalls">0</strong><em>Repairs currently underway</em></div></article>
                <article class="maintenance-metric is-red"><span class="maintenance-metric-icon"><i data-lucide="siren"></i></span><div><small>Critical priority</small><strong id="criticalCalls">0</strong><em>Active calls needing priority</em></div></article>
                <article class="maintenance-metric is-green"><span class="maintenance-metric-icon"><i data-lucide="circle-check-big"></i></span><div><small>Completed</small><strong id="completedCalls">0</strong><em>Resolved and closed calls</em></div></article>
            </section>

            <section class="maintenance-workspace">
                <header class="maintenance-workspace-header">
                    <div><span class="maintenance-section-kicker"><i data-lucide="list-filter"></i> Service request queue</span><h2>Maintenance calls</h2><p id="maintenanceResultsSummary">Loading service requests…</p></div>
                    <div class="maintenance-header-tools">
                        <div class="maintenance-view-switch" role="group" aria-label="Choose queue view"><button type="button" data-maintenance-view="board" class="is-active"><i data-lucide="columns-3"></i> Board</button><button type="button" data-maintenance-view="list"><i data-lucide="list"></i> List</button></div>
                        <div class="maintenance-downtime-summary"><span><i data-lucide="timer"></i></span><div><small>Total recorded downtime</small><strong id="downtimeHours">0 h</strong></div></div>
                    </div>
                </header>

                <nav class="maintenance-status-tabs" aria-label="Filter calls by workflow status">
                    <button type="button" class="is-active" data-maintenance-tab="all"><i data-lucide="list"></i><span>All</span><em data-maintenance-count="all">0</em></button>
                    <button type="button" data-maintenance-tab="active"><i data-lucide="radio"></i><span>Active</span><em data-maintenance-count="active">0</em></button>
                    <button type="button" data-maintenance-tab="Open"><i data-lucide="inbox"></i><span>Open</span><em data-maintenance-count="Open">0</em></button>
                    <button type="button" data-maintenance-tab="In Progress"><i data-lucide="wrench"></i><span>In progress</span><em data-maintenance-count="In Progress">0</em></button>
                    <button type="button" data-maintenance-tab="Awaiting Parts"><i data-lucide="package-search"></i><span>Awaiting parts</span><em data-maintenance-count="Awaiting Parts">0</em></button>
                    <button type="button" data-maintenance-tab="completed"><i data-lucide="circle-check"></i><span>Completed</span><em data-maintenance-count="completed">0</em></button>
                </nav>

                <div class="maintenance-toolbar">
                    <label class="maintenance-search-field"><i data-lucide="search"></i><span class="sr-only">Search maintenance calls</span><input id="maintenanceSearch" type="search" placeholder="Search ticket, equipment, issue or department…" autocomplete="off"></label>
                    <label class="maintenance-select-field"><i data-lucide="building-2"></i><span class="sr-only">Filter by department</span><select id="maintenanceDepartmentFilter"><option value="">All departments</option></select></label>
                    <label class="maintenance-select-field"><i data-lucide="shield-alert"></i><span class="sr-only">Filter by priority</span><select id="maintenancePriorityFilter"><option value="">All priorities</option><option value="Critical">Critical</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select></label>
                    <button id="clearMaintenanceFilters" class="maintenance-clear-button" type="button"><i data-lucide="filter-x"></i><span>Clear</span></button>
                </div>

                <div id="maintenanceBoardView" class="maintenance-board" aria-label="Technician assignment board"></div>
                <div id="maintenanceListView" class="maintenance-table-card" hidden>
                    <table class="maintenance-table">
                        <thead><tr><th>Request</th><th>Equipment</th><th>Team & department</th><th>Received</th><th>Status</th><th>Downtime</th><th><span class="sr-only">Action</span></th></tr></thead>
                        <tbody id="maintenanceTableBody"><tr><td colspan="7">Loading maintenance calls…</td></tr></tbody>
                    </table>
                </div>
                <div id="maintenancePagination" class="table-pagination" hidden></div>
            </section>
        </div>
    `;

    document.getElementById("refreshMaintenanceButton")?.addEventListener("click", refreshMaintenancePage);
    document.getElementById("maintenanceSearch")?.addEventListener("input", applyMaintenanceFilters);
    document.getElementById("maintenanceDepartmentFilter")?.addEventListener("change", applyMaintenanceFilters);
    document.getElementById("maintenancePriorityFilter")?.addEventListener("change", applyMaintenanceFilters);
    document.getElementById("clearMaintenanceFilters")?.addEventListener("click", clearMaintenanceFilters);
    document.querySelectorAll("[data-maintenance-view]").forEach(button => button.addEventListener("click", () => setMaintenanceView(button.dataset.maintenanceView)));
    document.querySelectorAll("[data-maintenance-tab]").forEach(button => button.addEventListener("click", () => {
        maintenanceStatusMode = button.dataset.maintenanceTab;
        document.querySelectorAll("[data-maintenance-tab]").forEach(tab => tab.classList.toggle("is-active", tab === button));
        applyMaintenanceFilters();
    }));

    window.lucide?.createIcons();
    loadMaintenanceData();
    maintenanceRefreshTimer = setInterval(() => {
        if (document.getElementById("maintenanceTableBody")) loadMaintenanceData({ silent: true });
        else clearInterval(maintenanceRefreshTimer);
    }, 60000);
}

async function loadMaintenanceData({ silent = false } = {}) {
    const refreshButton = document.getElementById("refreshMaintenanceButton");
    if (!silent) showLoading();
    refreshButton?.classList.add("is-loading");
    if (refreshButton) refreshButton.disabled = true;
    try {
        const [response, techniciansResponse] = await Promise.all([
            fetch("/api/engineer/maintenance", { headers: { Accept: "application/json" } }),
            fetch("/api/engineer/technicians", { headers: { Accept: "application/json" } }),
        ]);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "Unable to load maintenance data.");
        maintenanceTechnicians = techniciansResponse.ok ? await techniciansResponse.json() : [];
        maintenanceCalls = Array.isArray(data.calls) ? data.calls : [];
        updateMaintenanceMetrics(data);
        populateMaintenanceFilters(maintenanceCalls);
        updateMaintenanceTabCounts();
        applyMaintenanceFilters(false);
        updateLiveStatus();
    } catch (error) {
        showError(error.message || "Unable to load maintenance requests.");
        window.BioTrackToast?.error?.("Call queue unavailable", error.message || "Unable to load maintenance requests.");
    } finally {
        refreshButton?.classList.remove("is-loading");
        if (refreshButton) refreshButton.disabled = false;
    }
}

function updateMaintenanceMetrics(data) {
    const active = maintenanceCalls.filter(call => !["Completed", "Closed"].includes(call.status)).length;
    const critical = maintenanceCalls.filter(call => call.priority === "Critical" && !["Completed", "Closed"].includes(call.status)).length;
    const values = {
        totalCalls: data.total_calls ?? maintenanceCalls.length,
        activeCalls: active,
        progressCalls: data.inprogress ?? maintenanceCalls.filter(call => call.status === "In Progress").length,
        criticalCalls: critical,
        completedCalls: data.completed ?? maintenanceCalls.filter(call => ["Completed", "Closed"].includes(call.status)).length,
    };
    Object.entries(values).forEach(([id, value]) => {
        const target = document.getElementById(id);
        if (target) target.textContent = Number(value || 0).toLocaleString();
    });
    const downtime = document.getElementById("downtimeHours");
    if (downtime) downtime.textContent = `${Number(data.downtime || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} h`;
}

function populateMaintenanceFilters(calls) {
    const select = document.getElementById("maintenanceDepartmentFilter");
    if (!select) return;
    const previous = select.value;
    const departments = [...new Set(calls.map(call => call.department).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    select.innerHTML = `<option value="">All departments</option>${departments.map(value => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join("")}`;
    if (departments.includes(previous)) select.value = previous;
}

function updateMaintenanceTabCounts() {
    const counts = {
        all: maintenanceCalls.length,
        active: maintenanceCalls.filter(call => !["Completed", "Closed"].includes(call.status)).length,
        Open: maintenanceCalls.filter(call => call.status === "Open").length,
        "In Progress": maintenanceCalls.filter(call => call.status === "In Progress").length,
        "Awaiting Parts": maintenanceCalls.filter(call => call.status === "Awaiting Parts").length,
        completed: maintenanceCalls.filter(call => ["Completed", "Closed"].includes(call.status)).length,
    };
    Object.entries(counts).forEach(([key, value]) => {
        const target = document.querySelector(`[data-maintenance-count="${key}"]`);
        if (target) target.textContent = value.toLocaleString();
    });
}

function maintenanceStatusMatches(status) {
    if (maintenanceStatusMode === "all") return true;
    if (maintenanceStatusMode === "active") return !["Completed", "Closed"].includes(status);
    if (maintenanceStatusMode === "completed") return ["Completed", "Closed"].includes(status);
    return status === maintenanceStatusMode;
}

function applyMaintenanceFilters(resetPage = true) {
    const search = (document.getElementById("maintenanceSearch")?.value || "").trim().toLowerCase();
    const department = document.getElementById("maintenanceDepartmentFilter")?.value || "";
    const priority = document.getElementById("maintenancePriorityFilter")?.value || "";
    filteredMaintenanceCalls = maintenanceCalls.filter(call => {
        const searchable = [call.ticket, call.equipment, call.service_team, call.department, call.location, call.issue, call.description].filter(Boolean).join(" ").toLowerCase();
        return (!search || searchable.includes(search)) && (!department || call.department === department) && (!priority || call.priority === priority) && maintenanceStatusMatches(call.status);
    });
    if (resetPage) maintenancePagination.page = 1;
    if (maintenanceViewMode === "board") renderMaintenanceBoard(filteredMaintenanceCalls);
    else renderMaintenanceTable(filteredMaintenanceCalls);
    const summary = document.getElementById("maintenanceResultsSummary");
    if (summary) summary.textContent = `Showing ${filteredMaintenanceCalls.length.toLocaleString()} of ${maintenanceCalls.length.toLocaleString()} service requests`;
}

function setMaintenanceView(mode) {
    maintenanceViewMode = mode === "list" ? "list" : "board";
    document.querySelectorAll("[data-maintenance-view]").forEach(button => button.classList.toggle("is-active", button.dataset.maintenanceView === maintenanceViewMode));
    const board = document.getElementById("maintenanceBoardView");
    const list = document.getElementById("maintenanceListView");
    const pagination = document.getElementById("maintenancePagination");
    if (board) board.hidden = maintenanceViewMode !== "board";
    if (list) list.hidden = maintenanceViewMode !== "list";
    if (pagination) pagination.hidden = maintenanceViewMode !== "list";
    if (maintenanceViewMode === "board") renderMaintenanceBoard(filteredMaintenanceCalls);
    else renderMaintenanceTable(filteredMaintenanceCalls);
}

function renderMaintenanceBoard(calls) {
    const board = document.getElementById("maintenanceBoardView");
    if (!board) return;
    const columns = [
        { key: "Open", label: "New", icon: "inbox" },
        { key: "Assigned", label: "Assigned", icon: "user-check" },
        { key: "In Progress", label: "In progress", icon: "wrench" },
        { key: "Awaiting Parts", label: "Awaiting parts", icon: "package-search" },
        { key: "Completed", label: "Completed", icon: "circle-check-big" },
    ];
    board.innerHTML = columns.map(column => {
        const items = calls.filter(call => column.key === "Completed" ? ["Completed", "Closed"].includes(call.status) : call.status === column.key);
        return `<section class="maintenance-board-column is-${column.key.toLowerCase().replaceAll(" ", "-")}">
            <header><span><i data-lucide="${column.icon}"></i>${column.label}</span><b>${items.length}</b></header>
            <div class="maintenance-board-stack">${items.map(maintenanceBoardCard).join("") || '<p class="maintenance-board-empty">No calls in this stage</p>'}</div>
        </section>`;
    }).join("");
    window.lucide?.createIcons();
}

function maintenanceBoardCard(call) {
    const technicians = maintenanceTechnicians.filter(item => !item.service_team || item.service_team === call.service_team);
    const options = technicians.map(item => `<option value="${escapeHTML(item.username)}" ${item.username === call.assigned_to_username ? "selected" : ""}>${escapeHTML(item.name)}</option>`).join("");
    const priority = maintenancePriorityMeta(call.priority);
    return `<article class="maintenance-board-card" data-ticket-id="${Number(call.id)}">
        <button type="button" class="maintenance-board-open" onclick="openTicket(${Number(call.id)})">
            <span class="maintenance-board-ticket"><b>${escapeHTML(call.ticket || "New call")}</b><em class="is-${priority.tone}">${escapeHTML(call.priority || "Low")}</em></span>
            <strong>${escapeHTML(call.equipment || "Equipment not specified")}</strong>
            <small><i data-lucide="map-pin"></i>${escapeHTML(call.department || "No department")} · ${escapeHTML(call.location || "No location")}</small>
            <p>${escapeHTML(call.description || call.issue || "No failure description")}</p>
        </button>
        <label><i data-lucide="user-round-cog"></i><select aria-label="Assign ${escapeHTML(call.ticket || "maintenance call")}" onchange="assignMaintenanceTechnician(${Number(call.id)}, this.value)"><option value="">Unassigned</option>${options}</select></label>
    </article>`;
}

async function assignMaintenanceTechnician(ticketId, username) {
    const select = document.querySelector(`[data-ticket-id="${ticketId}"] select`);
    if (select) select.disabled = true;
    try {
        const response = await fetch(`/api/engineer/ticket/${ticketId}/assignment`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: username || null }) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.detail || "Unable to assign this maintenance call.");
        const call = maintenanceCalls.find(item => Number(item.id) === Number(ticketId));
        if (call) {
            call.status = result.status;
            call.assigned_to_username = result.assigned_to_username;
            call.assigned_to_name = result.assigned_to_name;
        }
        applyMaintenanceFilters(false);
        BioTrackToast.success("Technician assignment updated", result.assigned_to_name ? `${result.assigned_to_name} now owns this call.` : "The call is unassigned.");
    } catch (error) {
        BioTrackToast.error("Assignment not changed", error.message);
        if (select) select.disabled = false;
    }
}

function clearMaintenanceFilters() {
    const search = document.getElementById("maintenanceSearch");
    const department = document.getElementById("maintenanceDepartmentFilter");
    const priority = document.getElementById("maintenancePriorityFilter");
    if (search) search.value = "";
    if (department) department.value = "";
    if (priority) priority.value = "";
    maintenanceStatusMode = "all";
    document.querySelectorAll("[data-maintenance-tab]").forEach(tab => tab.classList.toggle("is-active", tab.dataset.maintenanceTab === "all"));
    applyMaintenanceFilters();
}

function renderMaintenanceTable(calls) {
    const tbody = document.getElementById("maintenanceTableBody");
    if (!tbody) return;
    if (!calls.length) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="maintenance-empty-state"><span><i data-lucide="search-x"></i></span><strong>No matching service calls</strong><p>Try another status, priority, department or search term.</p><button type="button" onclick="clearMaintenanceFilters()">Clear filters</button></div></td></tr>`;
        TablePagination.render(document.getElementById("maintenancePagination"), maintenancePagination, 0, () => renderMaintenanceTable(filteredMaintenanceCalls), "tickets");
        window.lucide?.createIcons();
        return;
    }
    const pageItems = TablePagination.pageItems(calls, maintenancePagination);
    tbody.innerHTML = pageItems.map(createMaintenanceRow).join("");
    TablePagination.render(document.getElementById("maintenancePagination"), maintenancePagination, calls.length, () => renderMaintenanceTable(filteredMaintenanceCalls), "tickets");
    window.lucide?.createIcons();
}

function createMaintenanceRow(call) {
    const priority = maintenancePriorityMeta(call.priority);
    const teamIcon = maintenanceTeamIcon(call.service_team);
    const downtimeDisplay = isMaintenanceAdmin()
        ? `<button type="button" class="downtime-value-trigger" data-ticket="${escapeHTML(call.ticket)}" data-hours="${Number(call.downtime || 0)}" onclick="handleDowntimeSecretClick(this.dataset.ticket, Number(this.dataset.hours))" aria-label="Downtime ${formatDowntime(call.downtime)}"><i data-lucide="timer"></i>${formatDowntime(call.downtime)}</button>`
        : `<span class="maintenance-downtime-value"><i data-lucide="timer"></i>${formatDowntime(call.downtime)}</span>`;
    return `
        <tr>
            <td><div class="maintenance-request-cell"><span class="maintenance-priority-icon is-${priority.tone}"><i data-lucide="${priority.icon}"></i></span><div><strong>${escapeHTML(call.ticket || "Unnumbered call")}</strong><small><span class="maintenance-priority-label is-${priority.tone}">${escapeHTML(call.priority || "Low")}</span>${escapeHTML(call.issue || "General service request")}</small></div></div></td>
            <td><div class="maintenance-equipment-cell"><span><i data-lucide="monitor-cog"></i></span><div><strong>${escapeHTML(call.equipment || "Equipment not specified")}</strong><small>${escapeHTML(call.location || "Location not recorded")}</small></div></div></td>
            <td><div class="maintenance-team-cell"><span><i data-lucide="${teamIcon}"></i></span><div><strong>${escapeHTML(call.service_team || "Engineering")}</strong><small>${escapeHTML(call.department || "Department not recorded")}</small></div></div></td>
            <td><div class="maintenance-date-cell"><i data-lucide="calendar-clock"></i><span>${escapeHTML(call.received || "Not recorded")}</span></div></td>
            <td>${getStatusBadge(call.status)}</td>
            <td>${downtimeDisplay}</td>
            <td><button class="maintenance-open-button" type="button" onclick="openTicket(${Number(call.id)})" aria-label="Open ${escapeHTML(call.ticket || "maintenance call")}"><span>Open</span><i data-lucide="arrow-up-right"></i></button></td>
        </tr>`;
}

function maintenancePriorityMeta(priority) {
    return ({ Critical: { tone: "critical", icon: "siren" }, High: { tone: "high", icon: "shield-alert" }, Medium: { tone: "medium", icon: "gauge" }, Low: { tone: "low", icon: "circle-check" } })[priority] || { tone: "low", icon: "circle-check" };
}

function maintenanceTeamIcon(team) {
    if (team === "Electrical") return "plug-zap";
    if (team === "IT") return "server-cog";
    return "heart-pulse";
}

function getStatusBadge(status) {
    const meta = ({
        Open: ["open", "circle-dot"], Assigned: ["assigned", "user-check"], "In Progress": ["progress", "wrench"],
        "Awaiting Parts": ["awaiting", "package-search"], "External Service": ["external", "truck"], Calibration: ["calibration", "gauge"],
        Completed: ["completed", "circle-check-big"], Closed: ["closed", "lock-keyhole"],
    })[status] || ["open", "circle-dot"];
    return `<span class="status ${meta[0]}"><i data-lucide="${meta[1]}"></i>${escapeHTML(status || "Open")}</span>`;
}

function showLoading() {
    const tbody = document.getElementById("maintenanceTableBody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7"><div class="maintenance-loading-state"><span><i data-lucide="loader-circle"></i></span><strong>Loading the live service queue…</strong></div></td></tr>`;
    window.lucide?.createIcons();
}

function showError(message) {
    const tbody = document.getElementById("maintenanceTableBody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7"><div class="maintenance-empty-state is-error"><span><i data-lucide="cloud-alert"></i></span><strong>Service queue unavailable</strong><p>${escapeHTML(message)}</p><button type="button" onclick="refreshMaintenancePage()">Try again</button></div></td></tr>`;
    window.lucide?.createIcons();
}

function formatDowntime(hours) {
    const totalMinutes = Math.floor(Number(hours || 0) * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return h === 0 ? `${m} min` : `${h}h ${m}m`;
}

function isMaintenanceAdmin() {
    const role = (localStorage.getItem("role") || "").trim().toLowerCase();
    return role === "admin" || role === "manager";
}

function handleDowntimeSecretClick(ticket, currentHours) {
    if (!isMaintenanceAdmin()) return;
    const now = Date.now();
    const sequenceExpired = now - downtimeSecretClickState.lastClick > DOWNTIME_SECRET_CLICK_WINDOW_MS;
    if (downtimeSecretClickState.ticket !== ticket || sequenceExpired) downtimeSecretClickState = { ticket, count: 0, lastClick: now };
    downtimeSecretClickState.count += 1;
    downtimeSecretClickState.lastClick = now;
    if (downtimeSecretClickState.count < DOWNTIME_SECRET_CLICK_COUNT) return;
    downtimeSecretClickState = { ticket: "", count: 0, lastClick: 0 };
    openDowntimeEditor(ticket, currentHours);
}

function openDowntimeEditor(ticket, currentHours) {
    if (!isMaintenanceAdmin()) return;
    document.getElementById("downtimeOverrideModal")?.remove();
    const safeHours = Math.max(0, Number(currentHours) || 0);
    let wholeHours = Math.floor(safeHours);
    let minutes = Math.round((safeHours - wholeHours) * 60);
    if (minutes === 60) { wholeHours += 1; minutes = 0; }
    const modal = document.createElement("div");
    modal.id = "downtimeOverrideModal";
    modal.className = "downtime-modal-backdrop";
    modal.innerHTML = `
        <section class="downtime-dialog" role="dialog" aria-modal="true" aria-labelledby="downtimeDialogTitle">
            <form id="downtimeOverrideForm">
                <header><span class="downtime-dialog-icon"><i data-lucide="timer-reset"></i></span><div><small>Administrator control</small><h2 id="downtimeDialogTitle">Change downtime</h2><p>${escapeHTML(ticket)}</p></div><button type="button" class="downtime-dialog-close" aria-label="Close downtime editor" onclick="closeDowntimeEditor()"><i data-lucide="x"></i></button></header>
                <div class="downtime-dialog-body">
                    <div class="downtime-input-grid"><label><span>Hours</span><input id="downtimeHoursInput" type="number" min="0" max="999999" step="1" value="${wholeHours}" required></label><label><span>Minutes</span><input id="downtimeMinutesInput" type="number" min="0" max="59" step="1" value="${minutes}" required></label></div>
                    <p class="downtime-dialog-note"><i data-lucide="info"></i> This replaces the current downtime value directly. No separate change-history entry is created.</p><p id="downtimeDialogError" class="downtime-dialog-error" role="alert"></p>
                </div>
                <footer><button type="button" class="downtime-cancel-btn" onclick="closeDowntimeEditor()">Cancel</button><button type="submit" class="downtime-save-btn"><i data-lucide="check"></i> Save downtime</button></footer>
            </form>
        </section>`;
    modal.querySelector("form").addEventListener("submit", event => saveDowntimeOverride(event, ticket));
    document.body.appendChild(modal);
    document.body.classList.add("has-modal-open");
    window.lucide?.createIcons();
    modal.querySelector("#downtimeHoursInput")?.focus();
}

function closeDowntimeEditor() {
    document.getElementById("downtimeOverrideModal")?.remove();
    document.body.classList.remove("has-modal-open");
}

async function saveDowntimeOverride(event, ticket) {
    event.preventDefault();
    const form = event.currentTarget;
    const error = form.querySelector("#downtimeDialogError");
    const submit = form.querySelector(".downtime-save-btn");
    const hours = Number(form.querySelector("#downtimeHoursInput")?.value);
    const minutes = Number(form.querySelector("#downtimeMinutesInput")?.value);
    if (!Number.isInteger(hours) || hours < 0 || hours > 999999 || !Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
        error.textContent = "Enter whole hours and minutes between 0 and 59.";
        return;
    }
    submit.disabled = true;
    error.textContent = "";
    try {
        const response = await fetch(`/api/requests/${encodeURIComponent(ticket)}/downtime`, {
            method: "PATCH", headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ hours: Number((hours + (minutes / 60)).toFixed(2)) }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.detail || "Unable to change downtime.");
        closeDowntimeEditor();
        showDowntimeFeedback(`Downtime for ${ticket} updated to ${formatDowntime(result.downtime)}.`);
        if (document.getElementById("ticketContainer") && typeof loadTicket === "function") await loadTicket();
        else await loadMaintenanceData();
    } catch (requestError) {
        error.textContent = requestError.message || "Unable to change downtime.";
        submit.disabled = false;
    }
}

function showDowntimeFeedback(message) {
    document.getElementById("downtimeFeedback")?.remove();
    const feedback = document.createElement("div");
    feedback.id = "downtimeFeedback";
    feedback.className = "downtime-feedback";
    feedback.setAttribute("role", "status");
    feedback.innerHTML = `<i data-lucide="circle-check"></i><span>${escapeHTML(message)}</span>`;
    document.body.appendChild(feedback);
    window.lucide?.createIcons();
    requestAnimationFrame(() => feedback.classList.add("is-visible"));
    setTimeout(() => { feedback.classList.remove("is-visible"); setTimeout(() => feedback.remove(), 220); }, 3200);
}

function updateLiveStatus() {
    const target = document.getElementById("maintenanceUpdatedAt");
    if (target) target.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

async function refreshMaintenancePage() {
    await loadMaintenanceData();
}

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && document.getElementById("downtimeOverrideModal")) closeDowntimeEditor();
});
;
/* source: dashboard_v2/views/ticketView.js */
// ==========================================
// CURRENT TICKET
// ==========================================

let currentTicketId = null;
let sparePartsInventory = [];
let selectedSpareParts = [];
let sparePartsLocked = false;
let sparePartsReserved = false;
let ticketTechnicians = [];

function renderWardBoyTransport(ticket) {
    const tasks = Array.isArray(ticket.ward_boy_tasks) ? ticket.ward_boy_tasks : [];
    const pickup = tasks.find(task => task.movement_type === "Pickup");
    const returnTask = tasks.find(task => task.movement_type === "Return");
    const repairCompleted = ["Completed", "Closed"].includes(ticket.status);
    const taskRows = tasks.map(task => `
        <article class="ticket-transport-job">
            <span class="ticket-transport-job-icon"><i data-lucide="${task.movement_type === "Return" ? "undo-2" : "package-open"}"></i></span>
            <div>
                <strong>${escapeHTML(task.movement_type)} transport</strong>
                <p>${escapeHTML(task.source_location)} <i data-lucide="arrow-right"></i> ${escapeHTML(task.destination_location)}</p>
                ${task.assigned_to ? `<small>Assigned to ${escapeHTML(task.assigned_to)}</small>` : ""}
            </div>
            <span class="ticket-transport-status is-${String(task.status || "pending").toLowerCase()}">${escapeHTML(task.status)}</span>
        </article>`).join("");

    return `
        <div class="ticket-card full ticket-transport-card">
            <div class="ticket-transport-heading">
                <span><i data-lucide="truck"></i></span>
                <div><h2>Ward Boy Transport</h2><p>Arrange equipment movement between the ward and the ${escapeHTML(ticket.service_team)} team.</p></div>
            </div>
            <div class="ticket-transport-list">${taskRows || '<p class="ticket-transport-empty">No Ward Boy transport has been requested for this call.</p>'}</div>
            <div class="ticket-transport-actions">
                ${!pickup ? `<button type="button" class="ticket-transport-button is-pickup" onclick="requestWardBoyTransport('Pickup')"><i data-lucide="package-plus"></i> Request equipment pickup</button>` : ""}
                ${repairCompleted && !returnTask ? `<button type="button" class="ticket-transport-button is-return" onclick="requestWardBoyTransport('Return')"><i data-lucide="truck"></i> Request return to ward</button>` : ""}
                ${!repairCompleted && !returnTask ? `<label class="ticket-return-choice"><input type="checkbox" id="wardBoyReturnAfterRepair"><span><i data-lucide="square-check-big"></i></span><div><strong>Return with a Ward Boy after repair</strong><small>Create the return job automatically when this call is completed.</small></div></label>` : ""}
            </div>
        </div>`;
}

async function createWardBoyTransport(movementType) {
    const response = await fetch("/api/ward-boy/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: Number(currentTicketId), movement_type: movementType }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || "Unable to create the transport job.");
    return data.task;
}

async function requestWardBoyTransport(movementType) {
    try {
        await createWardBoyTransport(movementType);
        BioTrackToast.success(
            movementType === "Return" ? "Return transport requested" : "Pickup requested",
            "The job is now visible in the Ward Boy portal."
        );
        await loadTicket();
    } catch (error) {
        BioTrackToast.error("Transport not requested", error.message || "Unable to create the Ward Boy job.");
    }
}

// ==========================================
// OPEN TICKET
// ==========================================

function openTicket(ticketId) {

    currentTicketId = ticketId;

    // renderTicket() is invoked by the router and restores the selected ticket
    // from storage, so persist it for calls opened from Call Management too.
    localStorage.setItem("selectedTicket", String(ticketId));

    navigate("ticket");

}

async function renderTicket() {

    // ==========================================
    // LOAD SELECTED TICKET
    // ==========================================

    currentTicketId = localStorage.getItem("selectedTicket");

    if (!currentTicketId) {

        pageContent.innerHTML = `

            <div class="ticket-page">

                <h2>No ticket selected.</h2>

            </div>

        `;

        return;

    }

    pageContent.innerHTML = `

    <div class="ticket-page">

        <div class="ticket-header">

            <button
                class="back-btn"
                onclick="navigateToEngineerHome()"
            >
                ← Back
            </button>

            <div class="ticket-title">

                <h1>Maintenance Ticket</h1>

                <p>
                    Biomedical Maintenance Request Details
                </p>

            </div>

        </div>

        <div id="ticketContainer">

            Loading Ticket...

        </div>

    </div>

    `;

    await loadTicket();

}

// ==========================================
// LOAD TICKET
// ==========================================

async function loadTicket() {

    const container = document.getElementById("ticketContainer");

    try {

        const res = await fetch(
            `/api/engineer/ticket/${currentTicketId}`
        );

        const ticket = await res.json();

        container.innerHTML = `

        <div class="ticket-grid">

            <!-- =========================== -->
            <!-- EQUIPMENT -->
            <!-- =========================== -->

            <div class="ticket-card">

                <h2>Equipment Information</h2>

                <div class="info-grid">

                    <div class="info-item">
                        <label>Equipment</label>
                        <strong>${escapeHTML(ticket.equipment)}</strong>
                    </div>

                    <div class="info-item">
                        <label>Equipment ID</label>
                        <strong>${escapeHTML(ticket.equipment_id)}</strong>
                    </div>

                    <div class="info-item">
                        <label>Department</label>
                        <strong>${escapeHTML(ticket.department)}</strong>
                    </div>

                    <div class="info-item">
                        <label>Location</label>
                        <strong>${escapeHTML(ticket.location)}</strong>
                    </div>

                </div>

            </div>

            <!-- =========================== -->
            <!-- CALL -->
            <!-- =========================== -->

            <div class="ticket-card">

                <h2>Call Information</h2>

                <div class="info-grid">

                    <div class="info-item">
                        <label>Ticket</label>
                        <strong>${escapeHTML(ticket.ticket)}</strong>
                    </div>

                    <div class="info-item">
                        <label>Reported By</label>
                        <strong>${escapeHTML(ticket.reported_by)}</strong>
                    </div>

                    <div class="info-item">
                        <label>Received</label>
                        <strong>${escapeHTML(ticket.received)}</strong>
                    </div>

                    <div class="info-item">
                        <label>Priority</label>
                        <strong>${escapeHTML(ticket.priority)}</strong>
                    </div>

                    <div class="info-item ticket-downtime-item">
                        <label>Downtime</label>
                        <div class="ticket-downtime-value">
                            ${isMaintenanceAdmin() ? `
                                <button
                                    type="button"
                                    class="ticket-downtime-trigger"
                                    data-ticket="${escapeHTML(ticket.ticket)}"
                                    data-hours="${Number(ticket.downtime || 0)}"
                                    onclick="handleDowntimeSecretClick(this.dataset.ticket, Number(this.dataset.hours))"
                                    aria-label="Downtime ${formatDowntime(ticket.downtime)}"
                                >
                                    ${formatDowntime(ticket.downtime)}
                                </button>
                            ` : `<strong>${formatDowntime(ticket.downtime)}</strong>`}
                        </div>
                    </div>

                </div>

            </div>

            <!-- =========================== -->
            <!-- STATUS -->
            <!-- =========================== -->

            <div class="ticket-card full">

                <h2>Maintenance Progress</h2>

                <div class="ticket-form-grid">

                    <div class="form-group">

                        <label>Status</label>

                        <select
                            id="ticketStatus"
                            class="ticket-input"
                        >

                            <option>Open</option>

                            <option>Assigned</option>

                            <option>In Progress</option>

                            <option>Awaiting Parts</option>

                            <option>External Service</option>

                            <option>Calibration</option>

                            <option>Completed</option>

                            <option>Closed</option>

                        </select>

                    </div>

                </div>

                <div class="ticket-assignment-panel">
                    <div><span><i data-lucide="user-round-cog"></i></span><div><strong>Assigned technician</strong><small>Assignment moves a new call into the Assigned board column.</small></div></div>
                    <select id="ticketTechnician"><option value="">Loading technicians…</option></select>
                    <button type="button" onclick="saveTicketAssignment()"><i data-lucide="user-check"></i> Assign</button>
                </div>

            </div>

            <!-- =========================== -->

            ${renderWardBoyTransport(ticket)}

            <!-- =========================== -->

            <div class="ticket-card full">

                <h2>Failure Description</h2>

                <div class="ticket-text">

                    ${escapeHTML(ticket.description || "-")}

                </div>

            </div>

            <!-- =========================== -->

            <div class="ticket-card full">

                <h2>Engineer Notes</h2>

                <textarea
                    id="engineerNotes"
                    class="ticket-textarea"
                >${escapeHTML(ticket.notes || "")}</textarea>

            </div>

            <!-- =========================== -->

            <div class="ticket-card full">

                <h2>Work Performed</h2>

                <textarea
                    id="workDone"
                    class="ticket-textarea"
                >${escapeHTML(ticket.work_done || "")}</textarea>

            </div>

            <!-- =========================== -->

            <div class="ticket-card full">

                <h2>Spare Parts Used</h2>

                <p class="spare-parts-help">
                    Selected parts are reserved when progress is saved. Completion converts the reservation into inventory consumption.
                </p>

                <div class="ticket-parts-cost"><span><i data-lucide="receipt-indian-rupee"></i> Repair parts cost</span><strong id="ticketPartsCost">${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(ticket.parts_cost || 0)}</strong><small id="ticketReservationState">${ticket.parts_reserved ? "Parts reserved for this repair" : ticket.stock_deducted ? "Inventory deducted" : "No parts reserved"}</small></div>

                <div id="sparePartsPicker" class="spare-parts-picker">
                    Loading available spare parts...
                </div>

            </div>

            <div class="ticket-card full ticket-attachments-card">
                <div class="ticket-attachments-heading"><div><h2>Attachments & evidence</h2><p>Manuals, invoices, certificates, service reports, photos and calibration documents.</p></div><span><i data-lucide="minimize-2"></i> Auto-compressed below 900 KB</span></div>
                <form id="ticketAttachmentForm" class="ticket-attachment-form">
                    <select id="ticketDocumentType" aria-label="Document type"><option>Service Report</option><option>Photo</option><option>Manual</option><option>Invoice</option><option>Certificate</option><option>Calibration Document</option></select>
                    <label><i data-lucide="paperclip"></i><span id="ticketAttachmentFileName">Choose PDF or image</span><input id="ticketAttachmentFile" type="file" accept="application/pdf,image/jpeg,image/png" required></label>
                    <button type="submit"><i data-lucide="cloud-upload"></i> Optimize & upload</button>
                </form>
                <p id="ticketAttachmentProgress" class="ticket-attachment-progress" role="status"></p>
                <div id="ticketAttachmentList" class="ticket-attachment-list"><p>Loading attachments…</p></div>
            </div>

            <!-- =========================== -->

            <div class="ticket-actions">

                <button
                    class="ticket-btn secondary"
                    onclick="startWork()"
                >
                    ▶ Start Work
                </button>

                <button
                    class="ticket-btn success"
                    onclick="completeWork()"
                >
                    ✔ Complete Repair
                </button>

                <button
                    class="ticket-btn primary"
                    onclick="saveTicketChanges()"
                >
                    💾 Save Progress
                </button>

            </div>

        </div>

        `;

        document.getElementById("ticketStatus").value =
            ticket.status;

        window.currentTicketServiceTeam = ticket.service_team;

        await Promise.all([
            initializeSparePartsPicker(ticket.spare_parts, ticket.stock_deducted, ticket.parts_reserved),
            initializeTicketAssignment(ticket),
            loadTicketAttachments(),
        ]);

        document.getElementById("ticketAttachmentForm")?.addEventListener("submit", uploadTicketAttachment);
        document.getElementById("ticketAttachmentFile")?.addEventListener("change", event => {
            document.getElementById("ticketAttachmentFileName").textContent = event.target.files?.[0]?.name || "Choose PDF or image";
        });

        if (window.lucide) lucide.createIcons();

    }

    catch (err) {

        console.error(err);

        container.innerHTML = "Unable to load ticket.";

    }

}
// ==========================================
// SAVE TICKET
// ==========================================

async function saveTicketChanges(){

    try{

        const response = await fetch(

            `/api/engineer/ticket/${currentTicketId}`,

            {

                method:"PUT",

                headers:{

                    "Content-Type":"application/json"

                },

                body:JSON.stringify({

                    status:

                        document.getElementById("ticketStatus").value,

                    engineer_notes:

                        document.getElementById("engineerNotes").value,

                    work_done:

                        document.getElementById("workDone").value,

                    spare_parts:

                        getSparePartsPayload()

                })

            }

        );

        const data = await response.json();

        if(data.success){

            await loadTicket();

            showSuccess({

                title:"Changes Saved Successfully",

                message:"The maintenance ticket has been updated."

            });

        }

        else{

            BioTrackToast.error("Ticket not updated", data.message || "Unable to update the ticket.");

        }

    }

    catch(error){

        console.error(error);

        BioTrackToast.error("Ticket not updated", error.message || "Unable to update the ticket.");

    }

}

// ==========================================
// UPDATE TICKET
// ==========================================

async function updateTicket(start = false, complete = false) {

    const buttons = document.querySelectorAll(".ticket-btn");
    const shouldRequestReturn = complete && Boolean(document.getElementById("wardBoyReturnAfterRepair")?.checked);
    let returnTransportCreated = false;

    buttons.forEach(btn => btn.disabled = true);

    try {

        const response = await fetch(

            `/api/engineer/ticket/${currentTicketId}`,

            {

                method: "PUT",

                headers: {

                    "Content-Type": "application/json"

                },

                body: JSON.stringify({

                    status:
                        document.getElementById("ticketStatus").value,

                    engineer_notes:
                        document.getElementById("engineerNotes").value,

                    work_done:
                        document.getElementById("workDone").value,

                    spare_parts:
                        getSparePartsPayload(),

                    start_work: start,

                    complete_work: complete

                })

            }

        );

        const data = await response.json();

        if (!response.ok) {

            throw new Error(data.detail || "Unable to update ticket.");

        }

        if (start) {

            document.getElementById("ticketStatus").value = "In Progress";

            showSuccess({

                title: "Maintenance Started",

                message: "The maintenance work has started."

            });

            return;

        }

        if (complete) {

            if (shouldRequestReturn) {
                try {
                    await createWardBoyTransport("Return");
                    returnTransportCreated = true;
                } catch (transportError) {
                    BioTrackToast.warning(
                        "Repair completed, transport not created",
                        transportError.message || "Request the Ward Boy return job from this ticket."
                    );
                }
            }

            showSuccess({

                title: "Maintenance Completed",

                message: returnTransportCreated
                    ? "The department was notified and the Ward Boy return job is now available."
                    : "The department has been notified.",

                buttonText: "Return Dashboard",

                onClose() {

                    navigateToEngineerHome();

                }

            });

            return;

        }

        showSuccess({

            title: "Changes Saved",

            message: "Ticket updated successfully."

        });

    }

    catch (error) {

        console.error(error);

        showSuccess({

            title: "Operation Failed",

            message: error.message || "Unable to update the maintenance ticket."

        });

    }

    finally {

        buttons.forEach(btn => btn.disabled = false);

    }

}
// ==========================================
// START WORK
// ==========================================

function startWork(){

    updateTicket(true, false);

}

// ==========================================
// COMPLETE REPAIR
// ==========================================

function completeWork(){

    updateTicket(false, true);

}

// ==========================================
// INVENTORY-BACKED SPARE PARTS
// ==========================================

async function initializeSparePartsPicker(savedParts, stockDeducted, partsReserved = false) {
    sparePartsLocked = Boolean(stockDeducted);
    sparePartsReserved = Boolean(partsReserved);
    selectedSpareParts = Array.isArray(savedParts)
        ? savedParts.map(part => ({
            inventory_id: Number(part.inventory_id),
            quantity: Number(part.quantity),
        }))
        : [];

    const container = document.getElementById("sparePartsPicker");
    if (!container) return;

    try {
        const response = await fetch(
            `/api/inventory/?service_team=${encodeURIComponent(window.currentTicketServiceTeam || "")}`
        );
        if (!response.ok) throw new Error("Unable to load inventory.");
        sparePartsInventory = await response.json();
        if (sparePartsReserved && !sparePartsLocked) {
            selectedSpareParts.forEach(part => {
                const item = sparePartsInventory.find(entry => Number(entry.id) === Number(part.inventory_id));
                if (item) item.available_stock = Number(item.available_stock || 0) + Number(part.quantity || 0);
            });
        }
        if (!selectedSpareParts.length && !sparePartsLocked) {
            selectedSpareParts = [{ inventory_id: "", quantity: 1 }];
        }
        renderSparePartsPicker();
        updateTicketPartsCost();
    } catch (error) {
        container.innerHTML = `<p class="spare-parts-error">${escapeHTML(error.message)}</p>`;
    }
}

function renderSparePartsPicker() {
    const container = document.getElementById("sparePartsPicker");
    if (!container) return;

    if (sparePartsLocked) {
        container.innerHTML = `
            <p class="spare-parts-locked">Stock has already been deducted for this completed ticket.</p>
            ${selectedSpareParts.map(part => {
                const item = sparePartsInventory.find(entry => entry.id === part.inventory_id);
                return `<div class="spare-part-summary">${escapeHTML(item?.item_name || `Item #${part.inventory_id}`)} × ${escapeHTML(part.quantity)}</div>`;
            }).join("") || "<p>No spare parts were used.</p>"}
        `;
        return;
    }

    container.innerHTML = `
        <div class="spare-parts-rows">
            ${selectedSpareParts.map((part, index) => `
                <div class="spare-part-row">
                    <select onchange="setSparePart(${index}, this.value)">
                        <option value="">Select a spare part</option>
                        ${sparePartsInventory.map(item =>
                            `<option value="${Number(item.id)}" ${Number(part.inventory_id) === item.id ? "selected" : ""}>${escapeHTML(item.item_name)} — Available: ${escapeHTML(item.available_stock ?? item.current_stock)} ${escapeHTML(item.unit || "")} · ${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(item.purchase_price || 0)}</option>`
                        ).join("")}
                    </select>
                    <input type="number" min="1" value="${Math.max(1, Number(part.quantity) || 1)}" aria-label="Quantity" onchange="setSpareQuantity(${index}, this.value)">
                    <button type="button" class="remove-spare-part" onclick="removeSparePart(${index})" aria-label="Remove spare part">Remove</button>
                </div>
            `).join("")}
        </div>
        ${sparePartsInventory.length ? '<button type="button" class="add-spare-part" onclick="addSparePart()">+ Add another spare part</button>' : '<p class="spare-parts-error">No inventory items are available for this department.</p>'}
    `;
}

function setSparePart(index, inventoryId) {
    const item = sparePartsInventory.find(entry => entry.id === Number(inventoryId));
    if (item && Number(item.available_stock ?? item.current_stock ?? 0) <= 0) {
        selectedSpareParts[index].inventory_id = "";
        renderSparePartsPicker();
        showSparePartsToast(`No stock left for ${item.item_name}.`, "error");
        return;
    }
    sparePartsReserved = false;
    selectedSpareParts[index].inventory_id = inventoryId ? Number(inventoryId) : "";
    updateTicketPartsCost();
}

function setSpareQuantity(index, quantity) {
    sparePartsReserved = false;
    const selectedItem = sparePartsInventory.find(
        item => item.id === Number(selectedSpareParts[index].inventory_id)
    );
    const requested = Math.max(1, Number(quantity) || 1);
    if (selectedItem && requested > Number(selectedItem.available_stock ?? selectedItem.current_stock ?? 0)) {
        selectedSpareParts[index].quantity = Math.max(1, Number(selectedItem.available_stock ?? selectedItem.current_stock ?? 0));
        renderSparePartsPicker();
        showSparePartsToast(
            `Only ${selectedItem.available_stock ?? selectedItem.current_stock} ${selectedItem.unit || "item(s)"} of ${selectedItem.item_name} are available.`,
            "error"
        );
        return;
    }
    selectedSpareParts[index].quantity = requested;
    updateTicketPartsCost();
}

function addSparePart() {
    sparePartsReserved = false;
    selectedSpareParts.push({ inventory_id: "", quantity: 1 });
    renderSparePartsPicker();
}

function removeSparePart(index) {
    sparePartsReserved = false;
    selectedSpareParts.splice(index, 1);
    if (!selectedSpareParts.length) selectedSpareParts.push({ inventory_id: "", quantity: 1 });
    renderSparePartsPicker();
    updateTicketPartsCost();
}

function getSparePartsPayload() {
    // A ticket may be completed without consuming any spare parts. Blank rows
    // are therefore ignored, while each selected part must still be valid.
    const partsToUse = selectedSpareParts.filter(part => part.inventory_id);
    const requestedByItem = new Map();
    partsToUse.forEach(part => {
        const quantity = Math.max(1, Number(part.quantity));
        requestedByItem.set(
            Number(part.inventory_id),
            (requestedByItem.get(Number(part.inventory_id)) || 0) + quantity
        );
    });
    for (const [inventoryId, quantity] of requestedByItem) {
        const item = sparePartsInventory.find(entry => entry.id === inventoryId);
        const available = Number(item?.available_stock ?? item?.current_stock ?? 0);
        if (!item || available <= 0) {
            const itemName = item?.item_name || `Item #${inventoryId}`;
            showSparePartsToast(`No stock left for ${itemName}.`, "error");
            throw new Error(`No stock left for ${itemName}.`);
        }
        if (quantity > available) {
            showSparePartsToast(
                `Only ${available} ${item.unit || "item(s)"} of ${item.item_name} are available.`,
                "error"
            );
            throw new Error(`Insufficient stock for ${item.item_name}.`);
        }
    }
    return partsToUse.map(part => ({
        inventory_id: Number(part.inventory_id),
        quantity: Math.max(1, Number(part.quantity)),
    }));
}

function showSparePartsToast(message, type = "error") {
    const title = type === "error" ? "Stock unavailable" : "Spare parts updated";
    BioTrackToast.show({ title, message, type });
}

function updateTicketPartsCost() {
    const total = selectedSpareParts.reduce((sum, part) => {
        const item = sparePartsInventory.find(entry => Number(entry.id) === Number(part.inventory_id));
        return sum + (Number(item?.purchase_price || 0) * Number(part.quantity || 0));
    }, 0);
    const target = document.getElementById("ticketPartsCost");
    if (target) target.textContent = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(total);
    const state = document.getElementById("ticketReservationState");
    if (state) {
        state.textContent = sparePartsLocked
            ? "Inventory deducted"
            : sparePartsReserved
                ? "Parts reserved for this repair"
                : total > 0
                    ? "Save progress to reserve these parts"
                    : "No parts reserved";
    }
}

async function initializeTicketAssignment(ticket) {
    const select = document.getElementById("ticketTechnician");
    if (!select) return;
    try {
        const response = await fetch(`/api/engineer/technicians?service_team=${encodeURIComponent(ticket.service_team || "")}`);
        if (!response.ok) throw new Error("Unable to load technicians.");
        ticketTechnicians = await response.json();
        select.innerHTML = '<option value="">Unassigned</option>' + ticketTechnicians.map(technician => `<option value="${escapeHTML(technician.username)}" ${technician.username === ticket.assigned_to_username ? "selected" : ""}>${escapeHTML(technician.name)}</option>`).join("");
    } catch (error) {
        select.innerHTML = '<option value="">Technicians unavailable</option>';
    }
}

async function saveTicketAssignment() {
    const select = document.getElementById("ticketTechnician");
    if (!select) return;
    try {
        const response = await fetch(`/api/engineer/ticket/${currentTicketId}/assignment`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: select.value || null }) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.detail || "Unable to update assignment.");
        document.getElementById("ticketStatus").value = result.status;
        BioTrackToast.success("Technician assignment updated", result.assigned_to_name ? `${result.assigned_to_name} owns this repair.` : "This repair is unassigned.");
    } catch (error) { BioTrackToast.error("Assignment not changed", error.message); }
}

function ticketFileSize(bytes) {
    const value = Number(bytes || 0);
    return value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`;
}

async function loadTicketAttachments() {
    const container = document.getElementById("ticketAttachmentList");
    if (!container) return;
    try {
        const response = await fetch(`/api/engineer/ticket/${currentTicketId}/attachments`);
        const items = await response.json().catch(() => []);
        if (!response.ok) throw new Error(items.detail || "Unable to load attachments.");
        container.innerHTML = items.length ? items.map(item => `
            <article class="ticket-attachment-item">
                <span><i data-lucide="${item.content_type === "application/pdf" ? "file-text" : "image"}"></i></span>
                <div><strong>${escapeHTML(item.original_name)}</strong><small>${escapeHTML(item.document_type)} · ${ticketFileSize(item.stored_size_bytes)}${item.original_size_bytes > item.stored_size_bytes ? ` · compressed from ${ticketFileSize(item.original_size_bytes)}` : ""}</small></div>
                <a href="${item.download_url}" download><i data-lucide="download"></i><span>Download</span></a>
                <button type="button" onclick="deleteTicketAttachment(${Number(item.id)})" aria-label="Delete ${escapeHTML(item.original_name)}"><i data-lucide="trash-2"></i></button>
            </article>`).join("") : '<p class="ticket-attachments-empty">No evidence attached to this maintenance call yet.</p>';
        window.lucide?.createIcons();
    } catch (error) { container.innerHTML = `<p class="spare-parts-error">${escapeHTML(error.message)}</p>`; }
}

async function compressTicketImage(file, targetBytes = 850 * 1024) {
    const bitmap = await createImageBitmap(file);
    let width = bitmap.width;
    let height = bitmap.height;
    const maxDimension = 2200;
    if (Math.max(width, height) > maxDimension) {
        const scale = maxDimension / Math.max(width, height);
        width = Math.round(width * scale); height = Math.round(height * scale);
    }
    let blob = file;
    for (let round = 0; round < 4; round += 1) {
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d", { alpha: false }).drawImage(bitmap, 0, 0, width, height);
        for (const quality of [.82, .68, .54, .4]) {
            blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
            if (blob.size <= targetBytes) return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
        }
        width = Math.max(1, Math.round(width * .8)); height = Math.max(1, Math.round(height * .8));
    }
    return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
}

async function uploadTicketAttachment(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = document.getElementById("ticketAttachmentFile");
    const progress = document.getElementById("ticketAttachmentProgress");
    const button = form.querySelector("button[type=submit]");
    let file = input.files?.[0];
    if (!file) return;
    button.disabled = true;
    progress.textContent = file.type.startsWith("image/") ? "Compressing image to the KB target…" : "Uploading PDF for automatic KB compression…";
    try {
        const originalSize = file.size;
        if (file.type.startsWith("image/")) file = await compressTicketImage(file);
        const formData = new FormData();
        formData.append("document_type", document.getElementById("ticketDocumentType").value);
        formData.append("file", file);
        const response = await fetch(`/api/engineer/ticket/${currentTicketId}/attachments`, { method: "POST", body: formData });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.detail || "Unable to upload this attachment.");
        progress.textContent = `Stored at ${ticketFileSize(result.attachment.stored_size_bytes)}${originalSize > result.attachment.stored_size_bytes ? ` (from ${ticketFileSize(originalSize)})` : ""}.`;
        form.reset();
        document.getElementById("ticketAttachmentFileName").textContent = "Choose PDF or image";
        await loadTicketAttachments();
    } catch (error) { progress.textContent = error.message || "Upload failed."; BioTrackToast.error("Attachment not uploaded", progress.textContent); }
    finally { button.disabled = false; }
}

async function deleteTicketAttachment(id) {
    try {
        const response = await fetch(`/api/engineer/ticket/attachments/${id}`, { method: "DELETE" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.detail || "Unable to delete the attachment.");
        await loadTicketAttachments();
    } catch (error) { BioTrackToast.error("Attachment not deleted", error.message); }
}

// ==========================================
// GLOBAL FUNCTIONS
// ==========================================

window.startWork = startWork;
window.completeWork = completeWork;
window.saveTicketChanges = saveTicketChanges;
window.openTicket = openTicket;
window.setSparePart = setSparePart;
window.setSpareQuantity = setSpareQuantity;
window.addSparePart = addSparePart;
window.removeSparePart = removeSparePart;
window.saveTicketAssignment = saveTicketAssignment;
window.deleteTicketAttachment = deleteTicketAttachment;
;
/* source: dashboard_v2/views/assetsView.js */

let assetsCache = [];
let filteredAssets = [];
let selectedAssetServiceTeam = "";
let selectedAssetIds = new Set();
let pendingAssetImportTeam = "";
const assetsPagination = { page: 1, pageSize: 25 };

function canManageAssetQR() {
    const role = String(localStorage.getItem("role") || "").toLowerCase();
    return ["admin", "manager", "engineer", "bme", "electrical", "it"].includes(role);
}

function isAssetAdministrator() {
    const role = String(localStorage.getItem("role") || "").toLowerCase();
    return role === "admin" || role === "manager";
}

function assetRoleServiceTeam() {
    const role = String(localStorage.getItem("role") || "").toLowerCase();
    if (role === "electrical") return "Electrical";
    if (role === "it") return "IT";
    if (role === "engineer" || role === "bme") return "Biomedical";
    return "";
}

function assetRegistryCopy() {
    const role = String(localStorage.getItem("role") || "").toLowerCase();
    if (role === "electrical") return { badge: "Electrical Asset Registry", description: "Manage electrical equipment, maintenance ownership, QR records and lifecycle information from one place." };
    if (role === "it") return { badge: "IT Asset Registry", description: "Manage IT equipment, infrastructure, QR records and lifecycle information from one place." };
    if (role === "engineer" || role === "bme") return { badge: "Biomedical Asset Registry", description: "Manage biomedical devices, preventive maintenance, QR records and equipment history from one place." };
    return { badge: "Hospital Asset Registry", description: "Manage Biomedical, Electrical and IT assets across the hospital with team ownership, lifecycle information, QR records and maintenance history." };
}

function renderAssets() {

    const registryCopy = assetRegistryCopy();
    selectedAssetServiceTeam = isAssetAdministrator() ? "" : assetRoleServiceTeam();
    selectedAssetIds = new Set();

    pageContent.innerHTML = `
        <div class="asset-page">
            <section class="asset-hero">
                <div class="asset-hero-left">
                    <div class="asset-hero-eyebrow">
                        <span class="asset-badge"><i data-lucide="activity"></i>${registryCopy.badge}</span>
                        <span class="asset-live-state"><span></span>Live inventory</span>
                    </div>
                    <h1>Asset Management</h1>
                    <p>${registryCopy.description}</p>
                </div>

                <div class="asset-hero-right">
                    <div class="quick-actions-card" aria-label="Asset quick actions">
                        <span class="asset-action-label">Quick actions</span>
                        <div class="asset-actions">
                            <button id="addAssetBtn" class="btn-primary hero-btn">
                                <i data-lucide="plus"></i><span>Add asset</span>
                            </button>
                            ${canManageAssetQR() ? `<button id="assetQrBtn" class="btn-secondary hero-btn">
                                <i data-lucide="qr-code"></i><span>Generate QR</span>
                            </button>` : ""}
                            ${canManageAssetQR() ? `<button id="assetRelocationRequestsBtn" class="btn-secondary hero-btn">
                                <i data-lucide="route"></i><span>Relocations</span>
                            </button>` : ""}
                            <button id="importExcelBtn" class="btn-secondary hero-btn">
                                <i data-lucide="file-up"></i><span>Import</span>
                            </button>
                            <button id="exportAssetBtn" class="btn-secondary hero-btn">
                                <i data-lucide="download"></i><span>Export</span>
                            </button>
                        </div>
                        <input id="excelFileInput" type="file" accept=".xlsx,.xls" hidden>
                    </div>
                </div>
            </section>

            ${isAssetAdministrator() ? `
                <section class="asset-mode-switcher" aria-label="Asset service-team mode">
                    <div>
                        <span>Service team scope</span>
                        <strong id="assetModeTitle">All engineering assets</strong>
                    </div>
                    <div class="asset-mode-options" role="tablist" aria-label="Filter assets by service team">
                        <button type="button" class="is-active" data-asset-team="" role="tab" aria-selected="true"><i data-lucide="layers-3"></i>All assets</button>
                        <button type="button" data-asset-team="Biomedical" role="tab" aria-selected="false"><i data-lucide="heart-pulse"></i>Biomedical</button>
                        <button type="button" data-asset-team="Electrical" role="tab" aria-selected="false"><i data-lucide="zap"></i>Electrical</button>
                        <button type="button" data-asset-team="IT" role="tab" aria-selected="false"><i data-lucide="server"></i>IT</button>
                    </div>
                </section>
            ` : ""}

            <section class="asset-kpis" aria-label="Asset overview">
                <article class="asset-card total-card">
                    <div class="asset-card-top"><div class="asset-card-icon"><i data-lucide="package-open"></i></div><span class="asset-kpi-mode">All teams</span></div>
                    <div class="asset-card-content"><h4>Total assets</h4><h2 id="totalAssets">0</h2><p>Registered inventory</p></div>
                </article>
                <article class="asset-card active-card">
                    <div class="asset-card-top"><div class="asset-card-icon"><i data-lucide="circle-check-big"></i></div><span class="asset-kpi-mode">All teams</span></div>
                    <div class="asset-card-content"><h4>Active assets</h4><h2 id="activeAssets">0</h2><p>Ready for service</p></div>
                </article>
                <article class="asset-card pm-card">
                    <div class="asset-card-top"><div class="asset-card-icon"><i data-lucide="calendar-clock"></i></div><span class="asset-kpi-mode">All teams</span></div>
                    <div class="asset-card-content"><h4>PM due</h4><h2 id="pmDue">0</h2><p>Needs scheduling</p></div>
                </article>
                <article class="asset-card calibration-card">
                    <div class="asset-card-top"><div class="asset-card-icon"><i data-lucide="flask-conical"></i></div><span class="asset-kpi-mode">All teams</span></div>
                    <div class="asset-card-content"><h4>Calibration due</h4><h2 id="calibrationDue">0</h2><p>Quality checks due</p></div>
                </article>
                <article class="asset-card warranty-card">
                    <div class="asset-card-top"><div class="asset-card-icon"><i data-lucide="shield-alert"></i></div><span class="asset-kpi-mode">All teams</span></div>
                    <div class="asset-card-content"><h4>Warranty</h4><h2 id="warrantyDue">0</h2><p>Expiring soon</p></div>
                </article>
                <article class="asset-card critical-card">
                    <div class="asset-card-top"><div class="asset-card-icon"><i data-lucide="siren"></i></div><span class="asset-kpi-mode">All teams</span></div>
                    <div class="asset-card-content"><h4>Critical assets</h4><h2 id="criticalAssets">0</h2><p>Life-support equipment</p></div>
                </article>
            </section>

            <section class="asset-registry-panel" aria-labelledby="assetRegistryTitle">
                <header class="asset-registry-header">
                    <div>
                        <span class="asset-section-kicker">Equipment registry</span>
                        <h2 id="assetRegistryTitle">Hospital asset directory</h2>
                        <p>Search, filter and open the complete equipment record.</p>
                    </div>
                    <div class="asset-result-count" aria-live="polite">
                        <span></span><strong id="assetResultCount">0</strong><small>matching records</small>
                    </div>
                </header>

                <div class="asset-toolbar">
                    <label class="asset-search-wrap" for="assetSearch">
                        <i data-lucide="search"></i>
                        <span class="sr-only">Search equipment</span>
                        <input id="assetSearch" type="search" placeholder="Search by equipment, code, model or maker" class="asset-search" autocomplete="off">
                    </label>
                    <div class="asset-filter-group">
                        <label><span>Department</span><select id="assetDepartmentFilter"><option>All Departments</option></select></label>
                        <label><span>Status</span><select id="assetStatusFilter"><option>All Status</option></select></label>
                        <label><span>Category</span><select id="assetCategoryFilter"><option>All Categories</option></select></label>
                    </div>
                </div>

                ${isAssetAdministrator() ? `
                    <section class="asset-bulk-toolbar" aria-label="Bulk asset actions">
                        <div class="asset-bulk-summary">
                            <span class="asset-bulk-icon"><i data-lucide="list-checks"></i></span>
                            <span><strong id="assetSelectionCount">0 selected</strong><small>Use bulk tools to review or clean the registry.</small></span>
                        </div>
                        <div class="asset-bulk-actions">
                            <button type="button" id="assetSelectFilteredBtn" class="asset-bulk-secondary"><i data-lucide="check-check"></i> Select all</button>
                            <button type="button" id="assetClearSelectionBtn" class="asset-bulk-secondary" disabled><i data-lucide="x"></i> Deselect all</button>
                            <button type="button" id="assetFindDuplicatesBtn" class="asset-bulk-secondary"><i data-lucide="copy-check"></i> Find duplicates</button>
                            <button type="button" id="assetDeleteSelectedBtn" class="asset-bulk-danger" disabled><i data-lucide="trash-2"></i> Delete selected</button>
                        </div>
                    </section>
                ` : ""}

                <div class="asset-table-container">
                    <table class="asset-table">
                        <thead><tr>
                            ${isAssetAdministrator() ? '<th class="asset-select-column"><input id="assetSelectPage" type="checkbox" aria-label="Select all assets on this page"></th>' : ""}
                            <th>Asset code</th><th>Equipment</th><th>Department</th><th>Service team</th>
                            <th>Manufacturer</th><th>Model</th><th>Status</th><th>QR record</th><th><span class="sr-only">Action</span></th>
                        </tr></thead>
                        <tbody id="assetTableBody">
                            <tr><td colspan="${isAssetAdministrator() ? 10 : 9}" class="empty-table">
                                <span class="empty-table-icon"><i data-lucide="package-search"></i></span>
                                <strong>No assets found</strong><small>Import an Excel sheet or add an asset to begin.</small>
                            </td></tr>
                        </tbody>
                    </table>
                </div>
                <div id="assetsPagination" class="table-pagination"></div>
            </section>
        </div>
    `;
    initializeAssetImport();
    initializeAddAsset();
    initializeAssetQR();
    initializeAssetRelocations();
    initializeAssetModeSwitcher();
    initializeAssetFilters();
    initializeAssetBulkActions();
    loadAssets();
}

function initializeAssetQR() {
    const button = document.getElementById("assetQrBtn");
    if (button) button.onclick = () => openAssetQRGenerator();
}

function initializeAssetRelocations() {
    const button = document.getElementById("assetRelocationRequestsBtn");
    if (button) button.onclick = () => window.AssetRelocation?.openQueue();
}

// ==========================================
// INITIALIZE IMPORT BUTTON
// ==========================================

function openAssetImportDialog(excelInput) {
    closeAssetManagementDialog();
    const overlay = document.createElement("div");
    overlay.id = "assetManagementOverlay";
    overlay.className = "asset-management-overlay";
    overlay.innerHTML = `
        <section class="asset-management-dialog asset-import-dialog" role="dialog" aria-modal="true" aria-labelledby="assetImportTitle" aria-describedby="assetImportDescription">
            <header><span><i data-lucide="file-spreadsheet"></i></span><div><h2 id="assetImportTitle">Import assets</h2><p id="assetImportDescription">Select the engineering team that will own every asset in this spreadsheet.</p></div><button type="button" class="asset-management-close" aria-label="Close"><i data-lucide="x"></i></button></header>
            <div class="asset-import-form">
                <label for="assetImportTeam"><span>Import team</span><select id="assetImportTeam"><option value="">Select a team</option><option value="Biomedical">Biomedical</option><option value="Electrical">Electrical</option><option value="IT">IT</option></select></label>
                <p class="asset-import-help"><i data-lucide="info"></i><span>The selected team is applied to all valid rows in the Excel file.</span></p>
            </div>
            <footer><button type="button" class="asset-dialog-secondary" id="cancelAssetImport">Cancel</button><button type="button" class="asset-dialog-primary" id="continueAssetImport" disabled><i data-lucide="file-up"></i> Choose spreadsheet</button></footer>
        </section>
    `;
    document.body.appendChild(overlay);
    document.body.classList.add("asset-management-dialog-open");

    const teamSelect = overlay.querySelector("#assetImportTeam");
    const continueButton = overlay.querySelector("#continueAssetImport");
    const closeDialog = () => {
        pendingAssetImportTeam = "";
        closeAssetManagementDialog();
    };

    overlay.querySelector(".asset-management-close").onclick = closeDialog;
    overlay.querySelector("#cancelAssetImport").onclick = closeDialog;
    teamSelect.onchange = () => { continueButton.disabled = !teamSelect.value; };
    continueButton.onclick = () => {
        if (!teamSelect.value) return;
        pendingAssetImportTeam = teamSelect.value;
        closeAssetManagementDialog();
        excelInput.click();
    };
    if (window.lucide) lucide.createIcons();
    teamSelect.focus();
}

function initializeAssetImport() {

    const importButton = document.getElementById("importExcelBtn");
    const excelInput = document.getElementById("excelFileInput");

    if (!importButton || !excelInput) return;

    importButton.onclick = () => {
        pendingAssetImportTeam = "";
        if (isAssetAdministrator()) {
            openAssetImportDialog(excelInput);
            return;
        }
        excelInput.click();

    };

    excelInput.onchange = async () => {

        if (!excelInput.files.length) return;

        const formData = new FormData();

        formData.append("file", excelInput.files[0]);
        const selectedTeam = pendingAssetImportTeam;
        const uploadUrl = selectedTeam
            ? `/api/assets/upload?service_team=${encodeURIComponent(selectedTeam)}`
            : "/api/assets/upload";

        try {

            importButton.disabled = true;
            importButton.textContent = "Importing...";

            const response = await fetch(uploadUrl, {

                method: "POST",
                body: formData

            });

            const result = await response.json();

            if (!response.ok || result.success === false) {
                const detail = Array.isArray(result.detail)
                    ? result.detail.map(item => item.msg || String(item)).join("\n")
                    : result.detail || result.message || "The spreadsheet could not be imported.";
                throw new Error(detail);
            }

            BioTrackToast.success(
                "Asset import complete",
                `${result.imported} imported · ${result.skipped} skipped · ${result.errors} errors`,
                { duration: 7000 },
            );

            await loadAssets();

        }

        catch (error) {

            console.error(error);

            BioTrackToast.error("Asset import failed", error.message || "The spreadsheet could not be imported.");

        }

        finally {

            importButton.disabled = false;
            importButton.innerHTML = '<i data-lucide="file-up"></i><span>Import</span>';
            if (window.lucide) lucide.createIcons();

            excelInput.value = "";
            pendingAssetImportTeam = "";

        }

    };

}
// ==========================================
// INITIALIZE ADD ASSET BUTTON
// ==========================================

function initializeAddAsset() {

    const addButton = document.getElementById("addAssetBtn");

    if (!addButton) return;

    addButton.onclick = () => {

        navigate("assetForm");

    };

}
// ==========================================
// LOAD ASSETS
// ==========================================

async function loadAssets() {

    try {

        const assets = await fetchPaginatedList("/api/assets/");

        assetsCache = Array.isArray(assets) ? assets : [];
        const availableIds = new Set(assetsCache.map(asset => Number(asset.id)));
        selectedAssetIds = new Set([...selectedAssetIds].filter(id => availableIds.has(id)));
        populateAssetFilters(assetsCache);
        applyAssetFilters();

    }

    catch (error) {

        console.error(error);

        BioTrackToast.error("Assets unavailable", "Unable to load the asset registry.");

    }

}

function initializeAssetFilters() {
    ["assetSearch", "assetDepartmentFilter", "assetStatusFilter", "assetCategoryFilter"]
        .forEach((id) => {
            const element = document.getElementById(id);
            if (!element) return;
            element.addEventListener(element.tagName === "INPUT" ? "input" : "change", applyAssetFilters);
        });
}

function initializeAssetBulkActions() {
    if (!isAssetAdministrator()) return;

    document.getElementById("assetSelectFilteredBtn")?.addEventListener("click", () => {
        filteredAssets.forEach(asset => selectedAssetIds.add(Number(asset.id)));
        populateAssetTable(filteredAssets);
    });
    document.getElementById("assetClearSelectionBtn")?.addEventListener("click", () => {
        selectedAssetIds.clear();
        populateAssetTable(filteredAssets);
    });
    document.getElementById("assetFindDuplicatesBtn")?.addEventListener("click", openAssetDuplicateReview);
    document.getElementById("assetDeleteSelectedBtn")?.addEventListener("click", () => {
        openAssetDeleteDialog([...selectedAssetIds], "Delete selected assets?");
    });
    document.getElementById("assetSelectPage")?.addEventListener("change", event => {
        toggleVisibleAssetSelection(event.target.checked);
    });
    updateAssetBulkControls();
}

function getVisibleAssetPageItems() {
    return TablePagination.pageItems(filteredAssets, assetsPagination);
}

function toggleAssetSelection(assetId, selected) {
    const id = Number(assetId);
    if (selected) selectedAssetIds.add(id);
    else selectedAssetIds.delete(id);
    updateAssetBulkControls();
}

function toggleVisibleAssetSelection(selected) {
    getVisibleAssetPageItems().forEach(asset => {
        const id = Number(asset.id);
        if (selected) selectedAssetIds.add(id);
        else selectedAssetIds.delete(id);
    });
    populateAssetTable(filteredAssets);
}

function updateAssetBulkControls() {
    if (!isAssetAdministrator()) return;
    const count = selectedAssetIds.size;
    const selectionLabel = document.getElementById("assetSelectionCount");
    if (selectionLabel) selectionLabel.textContent = `${count} selected`;
    const clearButton = document.getElementById("assetClearSelectionBtn");
    const deleteButton = document.getElementById("assetDeleteSelectedBtn");
    if (clearButton) clearButton.disabled = count === 0;
    if (deleteButton) deleteButton.disabled = count === 0;

    const selectPage = document.getElementById("assetSelectPage");
    if (selectPage) {
        const visibleIds = getVisibleAssetPageItems().map(asset => Number(asset.id));
        const selectedVisible = visibleIds.filter(id => selectedAssetIds.has(id)).length;
        selectPage.checked = visibleIds.length > 0 && selectedVisible === visibleIds.length;
        selectPage.indeterminate = selectedVisible > 0 && selectedVisible < visibleIds.length;
    }
}

function initializeAssetModeSwitcher() {
    document.querySelectorAll(".asset-mode-options button").forEach((button) => {
        button.addEventListener("click", () => {
            selectedAssetServiceTeam = button.dataset.assetTeam || "";
            document.querySelectorAll(".asset-mode-options button").forEach((option) => {
                const active = option === button;
                option.classList.toggle("is-active", active);
                option.setAttribute("aria-selected", String(active));
            });
            assetsPagination.page = 1;
            applyAssetFilters();
        });
    });
}

function populateAssetFilters(assets) {
    const setup = (id, values, allLabel) => {
        const select = document.getElementById(id);
        if (!select) return;
        select.innerHTML = `<option value="">${escapeHTML(allLabel)}</option>${values
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b))
            .map((value) => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`)
            .join("")}`;
    };

    setup("assetDepartmentFilter", [...new Set(assets.map(asset => asset.department))], "All Departments");
    setup("assetStatusFilter", [...new Set(assets.map(asset => asset.status))], "All Status");
    setup("assetCategoryFilter", [...new Set(assets.map(asset => asset.classification || asset.category))], "All Categories");
}

function applyAssetFilters() {
    const search = (document.getElementById("assetSearch")?.value || "").trim().toLowerCase();
    const department = document.getElementById("assetDepartmentFilter")?.value || "";
    const status = document.getElementById("assetStatusFilter")?.value || "";
    const category = document.getElementById("assetCategoryFilter")?.value || "";

    filteredAssets = assetsCache.filter((asset) => {
        const searchable = [
            asset.equipment_no,
            asset.equipment_name,
            asset.department,
            asset.service_team,
            asset.manufacturer,
            asset.model,
            asset.classification || asset.category,
        ].filter(Boolean).join(" ").toLowerCase();

        return (!search || searchable.includes(search))
            && (!department || asset.department === department)
            && (!selectedAssetServiceTeam || asset.service_team === selectedAssetServiceTeam)
            && (!status || asset.status === status)
            && (!category || (asset.classification || asset.category) === category);
    });

    assetsPagination.page = 1;
    populateAssetTable(filteredAssets);
    updateAssetKPIs(
        assetsCache.filter(asset => !selectedAssetServiceTeam || asset.service_team === selectedAssetServiceTeam)
    );
}


// ==========================================
// POPULATE TABLE
// ==========================================

function populateAssetTable(assets) {

    const table = document.getElementById("assetTableBody");
    const resultCount = document.getElementById("assetResultCount");

    if (!table) return;
    if (resultCount) resultCount.textContent = String(assets.length);

    if (assets.length === 0) {

        table.innerHTML = `
            <tr>
                <td colspan="${isAssetAdministrator() ? 10 : 9}" class="empty-table">
                    <span class="empty-table-icon"><i data-lucide="search-x"></i></span>
                    <strong>No matching assets</strong>
                    <small>Try adjusting the search or filters above.</small>
                </td>
            </tr>
        `;

        TablePagination.render(
            document.getElementById("assetsPagination"),
            assetsPagination,
            0,
            () => populateAssetTable(filteredAssets),
            "assets"
        );

        updateAssetBulkControls();
        if (window.lucide) lucide.createIcons();

        return;

    }

    table.innerHTML = "";

    const pageItems = TablePagination.pageItems(assets, assetsPagination);

    pageItems.forEach(asset => {

        const statusValue = String(asset.status || "Unknown");
        const statusTone = /active|operational|working|available/i.test(statusValue)
            ? "is-active"
            : /repair|breakdown|inactive|out of service/i.test(statusValue)
                ? "is-alert"
                : /maintenance|service|due|pending/i.test(statusValue)
                    ? "is-warning"
                    : "is-neutral";

        table.innerHTML += `
            <tr class="asset-data-row">

                ${isAssetAdministrator() ? `<td class="asset-select-column"><input type="checkbox" ${selectedAssetIds.has(Number(asset.id)) ? "checked" : ""} onchange="toggleAssetSelection(${Number(asset.id)}, this.checked)" aria-label="Select ${escapeHTML(asset.equipment_name || asset.asset_code || "asset")}"></td>` : ""}

                <td><span class="asset-code">${escapeHTML(asset.equipment_no ?? "—")}</span></td>

                <td><div class="asset-name-cell"><span class="asset-name-icon"><i data-lucide="monitor-cog"></i></span><span><strong>${escapeHTML(asset.equipment_name || "Unnamed equipment")}</strong><small>${escapeHTML(asset.classification || asset.category || "General equipment")}</small></span></div></td>

                <td><span class="asset-department-cell"><i data-lucide="map-pin"></i>${escapeHTML(asset.department || "Unassigned")}</span></td>

                <td><span class="asset-team-badge is-${String(asset.service_team || "Biomedical").toLowerCase()}">${escapeHTML(asset.service_team || "Biomedical")}</span></td>

                <td>${escapeHTML(asset.manufacturer || "—")}</td>

                <td>${escapeHTML(asset.model || "—")}</td>

                <td><span class="asset-status-badge ${statusTone}"><span></span>${escapeHTML(statusValue)}</span></td>

                <td>${asset.qr_generated || canManageAssetQR() ? `<button type="button" class="asset-qr-table-button ${asset.qr_generated ? "is-ready" : ""}" onclick="openAssetQRGenerator(${Number(asset.id)})"><i data-lucide="qr-code"></i><span>${asset.qr_generated ? "View QR" : "Generate"}</span></button>` : '<span class="asset-qr-unavailable">Not generated</span>'}</td>

                <td>

                    <button
                        class="btn-open-asset"
                        aria-label="Open ${escapeHTML(asset.equipment_name || asset.equipment_no || "asset")}"
                        onclick="openAssetPage(${Number(asset.id)})">
                        <i data-lucide="arrow-up-right"></i><span>Open</span>
                    </button>

                </td>

            </tr>
        `;

    });

    TablePagination.render(
        document.getElementById("assetsPagination"),
        assetsPagination,
        assets.length,
        () => populateAssetTable(filteredAssets),
        "assets"
    );

    updateAssetBulkControls();

    if (window.lucide) lucide.createIcons();

}

function normalizeAssetDuplicateValue(value) {
    const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
    return ["", "-", "na", "n/a", "none", "null", "unknown"].includes(normalized) ? "" : normalized;
}

function findDuplicateAssetGroups() {
    const parent = new Map(assetsCache.map(asset => [Number(asset.id), Number(asset.id)]));
    const reasonsByPair = [];
    const find = id => {
        const current = parent.get(id);
        if (current === id) return id;
        const root = find(current);
        parent.set(id, root);
        return root;
    };
    const union = (left, right) => {
        const leftRoot = find(left);
        const rightRoot = find(right);
        if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
    };

    const duplicateMaps = [
        ["Asset code", asset => normalizeAssetDuplicateValue(asset.asset_code)],
        ["Equipment number", asset => normalizeAssetDuplicateValue(asset.equipment_no)],
        ["Serial number", asset => normalizeAssetDuplicateValue(asset.serial_number)],
    ];

    duplicateMaps.forEach(([label, keyFor]) => {
        const groups = new Map();
        assetsCache.forEach(asset => {
            const key = keyFor(asset);
            if (!key) return;
            const matches = groups.get(key) || [];
            matches.push(Number(asset.id));
            groups.set(key, matches);
        });
        groups.forEach(ids => {
            if (ids.length < 2) return;
            ids.slice(1).forEach(id => union(ids[0], id));
            reasonsByPair.push({ ids, label });
        });
    });

    // When identifiers are missing, an exact match across the descriptive
    // equipment fields is presented as a possible duplicate for manual review.
    const detailGroups = new Map();
    assetsCache.forEach(asset => {
        if (normalizeAssetDuplicateValue(asset.serial_number) || normalizeAssetDuplicateValue(asset.equipment_no)) return;
        const parts = [asset.equipment_name, asset.manufacturer, asset.model, asset.department, asset.location]
            .map(normalizeAssetDuplicateValue);
        if (!parts[0] || !parts[2] || parts.filter(Boolean).length < 3) return;
        const key = parts.join("|");
        const matches = detailGroups.get(key) || [];
        matches.push(Number(asset.id));
        detailGroups.set(key, matches);
    });
    detailGroups.forEach(ids => {
        if (ids.length < 2) return;
        ids.slice(1).forEach(id => union(ids[0], id));
        reasonsByPair.push({ ids, label: "Matching equipment details" });
    });

    const components = new Map();
    assetsCache.forEach(asset => {
        const id = Number(asset.id);
        const root = find(id);
        const component = components.get(root) || [];
        component.push(asset);
        components.set(root, component);
    });

    return [...components.values()]
        .filter(group => group.length > 1)
        .map(group => {
            const groupIds = new Set(group.map(asset => Number(asset.id)));
            const reasons = [...new Set(reasonsByPair
                .filter(entry => entry.ids.some(id => groupIds.has(id)))
                .map(entry => entry.label))];
            return {
                assets: group.sort((a, b) => Number(a.id) - Number(b.id)),
                reasons,
            };
        })
        .sort((a, b) => Number(a.assets[0].id) - Number(b.assets[0].id));
}

function closeAssetManagementDialog() {
    document.getElementById("assetManagementOverlay")?.remove();
    document.body.classList.remove("asset-management-dialog-open");
}

function openAssetDuplicateReview() {
    const groups = findDuplicateAssetGroups();
    if (!groups.length) {
        BioTrackToast.success("No duplicates found", "Asset codes, equipment numbers and serial numbers are unique.");
        return;
    }

    closeAssetManagementDialog();
    const overlay = document.createElement("div");
    overlay.id = "assetManagementOverlay";
    overlay.className = "asset-management-overlay";
    overlay.innerHTML = `
        <section class="asset-management-dialog asset-duplicate-dialog" role="dialog" aria-modal="true" aria-labelledby="assetDuplicateTitle">
            <header><span><i data-lucide="copy-check"></i></span><div><h2 id="assetDuplicateTitle">Review duplicate assets</h2><p>BioTrack will keep the oldest record in each group. Uncheck anything that should remain.</p></div><button type="button" class="asset-management-close" aria-label="Close"><i data-lucide="x"></i></button></header>
            <div class="asset-duplicate-list">
                ${groups.map((group, groupIndex) => `
                    <article class="asset-duplicate-group">
                        <div class="asset-duplicate-group-heading"><strong>Duplicate group ${groupIndex + 1}</strong><span>${escapeHTML(group.reasons.join(" · "))}</span></div>
                        ${group.assets.map((asset, index) => `
                            <label class="asset-duplicate-row ${index === 0 ? "is-kept" : ""}">
                                <input type="checkbox" class="asset-duplicate-choice" value="${Number(asset.id)}" ${index === 0 ? "disabled" : "checked"}>
                                <span><strong>${escapeHTML(asset.equipment_name || "Unnamed equipment")}</strong><small>${escapeHTML(asset.asset_code || asset.equipment_no || `Asset ${asset.id}`)} · ${escapeHTML(asset.serial_number || "No serial number")} · ${escapeHTML(asset.service_team || "Biomedical")}</small></span>
                                <em>${index === 0 ? "Keep" : "Remove"}</em>
                            </label>
                        `).join("")}
                    </article>
                `).join("")}
            </div>
            <footer><button type="button" class="asset-dialog-secondary" id="cancelDuplicateReview">Cancel</button><button type="button" class="asset-dialog-danger" id="removeDuplicateAssets"><i data-lucide="trash-2"></i> Remove selected duplicates</button></footer>
        </section>
    `;
    document.body.appendChild(overlay);
    document.body.classList.add("asset-management-dialog-open");
    overlay.querySelector(".asset-management-close").onclick = closeAssetManagementDialog;
    overlay.querySelector("#cancelDuplicateReview").onclick = closeAssetManagementDialog;
    overlay.querySelector("#removeDuplicateAssets").onclick = () => {
        const duplicateIds = [...overlay.querySelectorAll(".asset-duplicate-choice:checked")]
            .map(input => Number(input.value));
        if (!duplicateIds.length) {
            BioTrackToast.warning("No duplicates selected", "Select at least one duplicate record to remove.");
            return;
        }
        closeAssetManagementDialog();
        openAssetDeleteDialog(duplicateIds, "Remove selected duplicates?");
    };
    if (window.lucide) lucide.createIcons();
}

function openAssetDeleteDialog(assetIds, title = "Delete selected assets?") {
    const ids = [...new Set(assetIds.map(Number).filter(Boolean))];
    if (!ids.length) return;
    const assets = ids.map(id => assetsCache.find(asset => Number(asset.id) === id)).filter(Boolean);

    closeAssetManagementDialog();
    const overlay = document.createElement("div");
    overlay.id = "assetManagementOverlay";
    overlay.className = "asset-management-overlay";
    overlay.innerHTML = `
        <section class="asset-management-dialog asset-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="assetDeleteTitle" aria-describedby="assetDeleteDescription">
            <div class="asset-delete-icon"><i data-lucide="trash-2"></i></div>
            <h2 id="assetDeleteTitle">${escapeHTML(title)}</h2>
            <p id="assetDeleteDescription">${ids.length} asset record${ids.length === 1 ? "" : "s"} and related PM details will be permanently deleted.</p>
            <div class="asset-delete-preview">${assets.slice(0, 6).map(asset => `<span><strong>${escapeHTML(asset.equipment_name || "Unnamed equipment")}</strong><small>${escapeHTML(asset.asset_code || asset.equipment_no || `Asset ${asset.id}`)}</small></span>`).join("")}${assets.length > 6 ? `<em>+ ${assets.length - 6} more</em>` : ""}</div>
            <footer><button type="button" class="asset-dialog-secondary" id="cancelAssetDelete">Cancel</button><button type="button" class="asset-dialog-danger" id="confirmAssetDelete"><i data-lucide="trash-2"></i> Delete ${ids.length}</button></footer>
        </section>
    `;
    document.body.appendChild(overlay);
    document.body.classList.add("asset-management-dialog-open");
    overlay.querySelector("#cancelAssetDelete").onclick = closeAssetManagementDialog;
    overlay.addEventListener("click", event => { if (event.target === overlay) closeAssetManagementDialog(); });
    overlay.querySelector("#confirmAssetDelete").onclick = () => deleteSelectedAssets(ids);
    if (window.lucide) lucide.createIcons();
}

async function deleteSelectedAssets(assetIds) {
    const button = document.getElementById("confirmAssetDelete");
    if (button) {
        button.disabled = true;
        button.textContent = "Deleting…";
    }
    try {
        const response = await fetch("/api/assets/bulk-delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ asset_ids: assetIds }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) throw new Error(result.detail || "The selected assets could not be deleted.");
        result.deleted_ids.forEach(id => selectedAssetIds.delete(Number(id)));
        closeAssetManagementDialog();
        BioTrackToast.success("Assets deleted", `${result.deleted} asset record${result.deleted === 1 ? " was" : "s were"} removed.`);
        await loadAssets();
    } catch (error) {
        BioTrackToast.error("Assets not deleted", error.message || "The selected assets could not be deleted.");
        if (button) {
            button.disabled = false;
            button.innerHTML = `<i data-lucide="trash-2"></i> Delete ${assetIds.length}`;
            if (window.lucide) lucide.createIcons();
        }
    }
}

async function openAssetQRGenerator(assetId = null) {
    const canGenerate = canManageAssetQR();
    let assets = assetsCache;
    const selectedAssetIsMissing = assetId && !assets.some(asset => Number(asset.id) === Number(assetId));
    if (!assets.length || selectedAssetIsMissing) {
        try {
            assets = await fetchPaginatedList("/api/assets/", { cache: "no-store" });
            assetsCache = Array.isArray(assets) ? assets : [];
        } catch (error) {
            BioTrackToast.error("Assets unavailable", error.message || "Unable to load assets.");
            return;
        }
    }

    const modalRoot = document.createElement("div");
    modalRoot.className = "asset-qr-overlay";
    modalRoot.innerHTML = `
        <section class="asset-qr-dialog" role="dialog" aria-modal="true" aria-labelledby="assetQrTitle">
            <header class="asset-qr-dialog-header"><span><i data-lucide="qr-code"></i></span><div><h2 id="assetQrTitle">Asset QR code</h2><p>Select an asset, then generate a printable equipment QR code.</p></div><button type="button" class="asset-qr-close" aria-label="Close"><i data-lucide="x"></i></button></header>
            <div class="asset-qr-dialog-body">
                <label class="asset-qr-select-label"><span>Hospital asset</span><select id="assetQrSelect"><option value="">Choose an asset</option>${assetsCache.map(asset => `<option value="${Number(asset.id)}" ${Number(asset.id) === Number(assetId) ? "selected" : ""}>${escapeHTML(asset.asset_code || asset.equipment_no || `Asset ${asset.id}`)} — ${escapeHTML(asset.equipment_name || "Equipment")}</option>`).join("")}</select></label>
                <div id="assetQrPreview" class="asset-qr-preview"><span><i data-lucide="scan-line"></i></span><strong>No asset selected</strong><p>Choose an asset to create or view its QR code.</p></div>
            </div>
            <footer class="asset-qr-dialog-footer"><button type="button" class="asset-qr-cancel secondary-btn">${canGenerate ? "Cancel" : "Close"}</button>${canGenerate ? '<button type="button" class="asset-qr-generate primary-btn" disabled><i data-lucide="qr-code"></i><span>Generate QR</span></button>' : ""}</footer>
        </section>`;
    document.body.appendChild(modalRoot);
    document.body.classList.add("asset-qr-open");

    const close = () => { modalRoot.remove(); document.body.classList.remove("asset-qr-open"); };
    const select = modalRoot.querySelector("#assetQrSelect");
    const generate = modalRoot.querySelector(".asset-qr-generate");
    const setGenerateLabel = label => {
        const labelElement = generate?.querySelector("span");
        if (labelElement) labelElement.textContent = label;
    };
    modalRoot.querySelector(".asset-qr-close").onclick = close;
    modalRoot.querySelector(".asset-qr-cancel").onclick = close;
    modalRoot.addEventListener("click", event => { if (event.target === modalRoot) close(); });
    select.onchange = () => {
        if (generate) generate.disabled = !select.value;
        const asset = assetsCache.find(item => Number(item.id) === Number(select.value));
        const preview = modalRoot.querySelector("#assetQrPreview");
        if (asset?.qr_code) {
            preview.innerHTML = `<img src="${escapeHTML(asset.qr_code)}" alt="QR code for ${escapeHTML(asset.equipment_name || "asset")}"><strong>${escapeHTML(asset.asset_code || asset.equipment_no || "Asset QR")}</strong><p>${escapeHTML(asset.equipment_name || "Equipment")}</p><a href="${escapeHTML(asset.qr_code)}" download><i data-lucide="download"></i> Download QR</a>`;
            setGenerateLabel("Regenerate QR");
        } else {
            preview.innerHTML = asset ? `<span><i data-lucide="monitor-cog"></i></span><strong>${escapeHTML(asset.equipment_name || "Equipment")}</strong><p>${escapeHTML(asset.asset_code || asset.equipment_no || "No asset code")} · ${escapeHTML(asset.department || "No department")}</p>` : '<span><i data-lucide="scan-line"></i></span><strong>No asset selected</strong><p>Choose an asset to create or view its QR code.</p>';
            setGenerateLabel("Generate QR");
        }
        if (window.lucide) lucide.createIcons();
    };
    if (generate) generate.onclick = async () => {
        if (!select.value) return;
        generate.disabled = true;
        generate.classList.add("is-loading");
        setGenerateLabel("Generating…");
        try {
            const response = await fetch(`/api/qr/generate/${Number(select.value)}`, { method: "POST" });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.detail || "Unable to generate QR code.");
            const asset = assetsCache.find(item => Number(item.id) === Number(select.value));
            modalRoot.querySelector("#assetQrPreview").innerHTML = `<img src="${escapeHTML(result.qr_url)}?t=${Date.now()}" alt="QR code for ${escapeHTML(asset?.equipment_name || "asset")}"><strong>${escapeHTML(asset?.asset_code || asset?.equipment_no || "Asset QR")}</strong><p>${escapeHTML(asset?.equipment_name || "Equipment")}</p><a href="${escapeHTML(result.qr_url)}" download><i data-lucide="download"></i> Download QR</a>`;
            setGenerateLabel("Regenerate QR");
            const cachedAsset = assetsCache.find(item => Number(item.id) === Number(select.value));
            if (cachedAsset) {
                cachedAsset.qr_generated = true;
                cachedAsset.qr_code = result.qr_url;
            }
            // The generator is shared by the registry and the asset-details page.
            // Registry KPI/table elements do not exist when this modal is opened
            // from Asset Details, so only refresh filters when that view is mounted.
            if (document.getElementById("assetTableBody")) applyAssetFilters();
            BioTrackToast.success("QR code ready", "The equipment QR code was generated successfully.");
        } catch (error) {
            BioTrackToast.error("QR generation failed", error.message || "Unable to generate QR code.");
            setGenerateLabel("Generate QR");
        } finally {
            generate.disabled = false;
            generate.classList.remove("is-loading");
            if (window.lucide) lucide.createIcons();
        }
    };
    if (select.value) select.onchange();
    if (window.lucide) lucide.createIcons();
}


// ==========================================
// UPDATE KPI CARDS
// ==========================================

function updateAssetKPIs(assets) {

    const modeLabel = selectedAssetServiceTeam || "All teams";
    document.querySelectorAll(".asset-kpi-mode").forEach(element => {
        element.textContent = modeLabel;
    });
    const modeTitle = document.getElementById("assetModeTitle");
    if (modeTitle) modeTitle.textContent = selectedAssetServiceTeam
        ? `${selectedAssetServiceTeam} assets`
        : "All engineering assets";

    document.getElementById("totalAssets").textContent =
        assets.length;

    document.getElementById("activeAssets").textContent =
        assets.filter(asset => asset.status === "Active").length;

    document.getElementById("criticalAssets").textContent =
        assets.filter(asset => asset.status === "Critical").length;

    document.getElementById("pmDue").textContent = 0;

    document.getElementById("calibrationDue").textContent = 0;

    document.getElementById("warrantyDue").textContent = 0;

}
;
/* source: dashboard_v2/views/assetFormView.js */
// ==========================================
// ASSET FORM STATE
// ==========================================

let currentStep = 1;

const assetFormData = {};

function currentAssetServiceTeam() {
    const role = String(localStorage.getItem("role") || "").toLowerCase();
    if (role === "electrical") return "Electrical";
    if (role === "it") return "IT";
    if (role === "engineer" || role === "bme") return "Biomedical";
    return assetFormData.service_team || "";
}
// ==========================================
// ASSET REGISTRATION PAGE
// ==========================================

function renderAssetForm() {

    const adminView = isAssetAdministrator();
    const serviceTeam = currentAssetServiceTeam();

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

                    ${adminView ? "Multi-team Asset Registration" : `${serviceTeam} Asset Registration`}

                </span>

                <h1>Register New ${adminView ? "Hospital" : serviceTeam} Asset</h1>

                <p>

                    Create a complete equipment record with the correct engineering service-team ownership.

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

            <div class="form-group">
                <label>Service Team <span class="required">*</span></label>
                ${isAssetAdministrator() ? `
                    <select id="service_team">
                        <option value="">Select Service Team</option>
                        <option value="Biomedical">Biomedical</option>
                        <option value="Electrical">Electrical</option>
                        <option value="IT">IT</option>
                    </select>
                ` : `
                    <input id="service_team" type="text" value="${currentAssetServiceTeam()}" disabled>
                `}
            </div>

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
                    <option>Electrical Panel</option>
                    <option>Generator</option>
                    <option>UPS</option>
                    <option>HVAC</option>
                    <option>Server</option>
                    <option>Network Device</option>
                    <option>Computer</option>
                    <option>Other</option>

                </select>

            </div>

            <!-- Department -->

            <div class="form-group">

                <label>Department</label>

                <select id="department">
                    ${renderHospitalDepartmentOptions()}
                </select>

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
                if (saveBasicInformation() === false) return;
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

    assetFormData.service_team =
        document.getElementById("service_team")?.value || currentAssetServiceTeam();

    if (!assetFormData.service_team) {
        BioTrackToast.warning("Select a service team", "Choose Biomedical, Electrical or IT for this asset.");
        document.getElementById("service_team")?.focus();
        return false;
    }

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

    return true;

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
                    accept="application/pdf,image/jpeg,image/png">

            </div>

            <div class="form-group">

                <label>Invoice Copy</label>

                <input
                    id="invoiceFile"
                    type="file"
                    accept="application/pdf,image/jpeg,image/png">

            </div>

            <div class="form-group">

                <label>Warranty Certificate</label>

                <input
                    id="warrantyFile"
                    type="file"
                    accept="application/pdf,image/jpeg,image/png">

            </div>

            <div class="form-group">

                <label>Calibration Certificate</label>

                <input
                    id="calibrationFile"
                    type="file"
                    accept="application/pdf,image/jpeg,image/png">

            </div>

            <div class="form-group">

                <label>Other Documents</label>

                <input
                    id="otherFiles"
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
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

                <td><strong>Service Team</strong></td>

                <td>${escapeHTML(assetFormData.service_team || "-")}</td>

            </tr>

            <tr>

                <td><strong>Equipment ID</strong></td>

                <td>${escapeHTML(assetFormData.equipmentId || "-")}</td>

            </tr>

            <tr>

                <td><strong>Equipment Name</strong></td>

                <td>${escapeHTML(assetFormData.equipmentName || "-")}</td>

            </tr>

            <tr>

                <td><strong>Department</strong></td>

                <td>${escapeHTML(assetFormData.department || "-")}</td>

            </tr>

            <tr>

                <td><strong>Manufacturer</strong></td>

                <td>${escapeHTML(assetFormData.manufacturer || "-")}</td>

            </tr>

            <tr>

                <td><strong>Purchase Cost</strong></td>

                <td>${escapeHTML(assetFormData.purchaseCost || "-")}</td>

            </tr>

            <tr>

                <td><strong>Warranty End</strong></td>

                <td>${escapeHTML(assetFormData.warrantyEnd || "-")}</td>

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

function setAssetSaveState(saving, generateQR = false) {
    const saveButton = document.getElementById("saveAssetBtn");
    const qrButton = document.getElementById("saveQrBtn");

    if (saveButton) {
        saveButton.disabled = saving;
        saveButton.textContent = saving && !generateQR ? "Saving asset…" : "💾 Save Asset";
    }
    if (qrButton) {
        qrButton.disabled = saving;
        qrButton.textContent = saving && generateQR ? "Saving & generating…" : "🏷 Save & Generate QR";
    }
}

function collectAssetRegistrationFiles() {
    const fields = [
        ["equipmentImage", "Photo"],
        ["manualFile", "Manual"],
        ["invoiceFile", "Invoice"],
        ["warrantyFile", "Certificate"],
        ["calibrationFile", "Calibration Document"],
        ["otherFiles", "Service Report"]
    ];
    return fields.flatMap(([id, documentType]) =>
        Array.from(document.getElementById(id)?.files || []).map(file => ({ file, documentType }))
    );
}

async function uploadAssetRegistrationFiles(assetId, uploads) {
    const failures = [];
    for (const upload of uploads) {
        const formData = new FormData();
        formData.append("document_type", upload.documentType);
        formData.append("file", upload.file);
        try {
            const response = await fetch(`/api/assets/${assetId}/documents`, {
                method: "POST",
                body: formData
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.detail || "Upload failed.");
        } catch (error) {
            failures.push(upload.file.name);
        }
    }
    return failures;
}

function showAssetUploadWarning(failures) {
    if (!failures.length) return;
    BioTrackToast.warning(
        "Asset saved with pending files",
        `${failures.length} attachment${failures.length === 1 ? "" : "s"} could not be uploaded. Add ${failures.length === 1 ? "it" : "them"} from the asset details page.`
    );
}

async function persistAsset(generateQR = false) {
    saveWarrantyInformation();
    const pendingUploads = collectAssetRegistrationFiles();
    let createdAssetId = null;
    setAssetSaveState(true, generateQR);

    try {
        const response = await fetch("/api/assets/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(assetFormData)
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok || !result.success) {
            throw new Error(result.detail || "Failed to save the asset.");
        }

        createdAssetId = Number(result.asset_id);
        const uploadFailures = await uploadAssetRegistrationFiles(createdAssetId, pendingUploads);
        if (generateQR) {
            const qrResponse = await fetch(`/api/qr/generate/${createdAssetId}`, {
                method: "POST"
            });
            const qrResult = await qrResponse.json().catch(() => ({}));
            if (!qrResponse.ok || !qrResult.success) {
                throw new Error(qrResult.detail || "The QR code could not be generated.");
            }

            BioTrackToast.success("Asset and QR saved", "The equipment record and printable QR code are ready.");
            showAssetUploadWarning(uploadFailures);
            navigate("assets");
            window.setTimeout(() => {
                if (typeof openAssetQRGenerator === "function") openAssetQRGenerator(createdAssetId);
            }, 0);
            return;
        }

        BioTrackToast.success("Asset saved", "The equipment record was added successfully.");
        showAssetUploadWarning(uploadFailures);
        navigate("assets");
    } catch (error) {
        if (createdAssetId) {
            BioTrackToast.warning("Asset saved; QR pending", error.message || "Generate the QR code from Asset Management.");
            navigate("assets");
        } else {
            console.error(error);
            BioTrackToast.error("Asset not saved", error.message || "The asset could not be saved.");
        }
    } finally {
        setAssetSaveState(false, generateQR);
    }
}

function saveAsset() {
    return persistAsset(false);
}

// ==========================================
// SAVE & QR
// ==========================================

function saveAndGenerateQR() {
    return persistAsset(true);
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
;
/* source: dashboard_v2/views/assetProfileView.js */
// ==========================================
// ASSET PROFILE VIEW
// ==========================================

function renderAssetDetails() {

    pageContent.innerHTML = `

    <div class="asset-profile-page">

        <!-- ==========================================
             TOP BAR
        ========================================== -->

        <div class="asset-profile-top">

            <button
                class="btn-secondary"
                onclick="navigate('assets')">

                ← Back to Assets

            </button>

            <div class="asset-profile-actions">

                <button class="btn-secondary">

                    Edit Asset

                </button>

                <button class="btn-primary">

                    Generate QR

                </button>

            </div>

        </div>


        <!-- ==========================================
             HERO
        ========================================== -->

        <div id="assetProfileHero">

            Loading asset...

        </div>


        <!-- ==========================================
             TABS
        ========================================== -->

        <div class="asset-profile-tabs">

            <button class="tab-btn active">
                Overview
            </button>

            <button class="tab-btn">
                Maintenance
            </button>

            <button class="tab-btn">
                PM
            </button>

            <button class="tab-btn">
                Calibration
            </button>

            <button class="tab-btn">
                Documents
            </button>

            <button class="tab-btn">
                Warranty
            </button>

        </div>


        <!-- ==========================================
             CONTENT
        ========================================== -->

        <div id="assetProfileContent">

        </div>

    </div>

    `;

    loadAssetProfile();

}
;
/* source: dashboard_v2/views/assetDetailsView.js */
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
    const form = event.currentTarget;
    const input = document.getElementById("assetDocumentFile");
    const typeSelect = document.getElementById("assetDocumentType");
    const fileName = document.getElementById("assetDocumentFileName");
    const progress = document.getElementById("assetDocumentProgress");
    const button = form.querySelector('button[type="submit"]');
    const file = input?.files?.[0];
    if (!file) return;
    const documentType = typeSelect.value;
    button.disabled = true;
    progress.textContent = "Compressing and storing the document…";
    try {
        const formData = new FormData();
        formData.append("document_type", documentType);
        formData.append("file", file);
        const response = await fetch(`/api/assets/${Number(currentAssetId)}/documents`, { method: "POST", body: formData });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.detail || "Unable to upload this asset document.");
        progress.textContent = `Stored at ${assetDocumentSize(result.document.stored_size_bytes)}${result.document.original_size_bytes > result.document.stored_size_bytes ? ` (from ${assetDocumentSize(result.document.original_size_bytes)})` : ""}.`;
        form.reset();
        fileName.textContent = "Choose PDF or image";
        BioTrackToast.success(
            documentType === "Photo" ? "Equipment photo updated" : "Document uploaded",
            documentType === "Photo" ? "This photo is now used for the equipment profile." : "The optimized file is attached to this asset."
        );
        await loadAssetDocuments();
        if (documentType === "Photo" && typeof loadAssetProfile === "function") {
            await loadAssetProfile();
        }
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
;
/* source: dashboard_v2/views/maintenanceModuleView.js */
// ==========================================
// MAINTENANCE MODULE
// ==========================================

function renderMaintenanceModule() {

    pageContent.innerHTML = `

    <div class="maintenance-module-page">

        <h1>Maintenance</h1>

        <p>
            This page will contain the Biomedical Engineer maintenance workflow.
        </p>

    </div>

    `;

}
;
/* source: dashboard_v2/views/inventoryView.js */
// ==========================================
// DEPARTMENT INVENTORY MODULE
// ==========================================

const INVENTORY_API = "/api/inventory";
const INVENTORY_TEAMS = ["Biomedical", "Electrical", "IT"];
const INVENTORY_TEAM_META = {
    Biomedical: { icon: "stethoscope", className: "biomedical", description: "Clinical equipment parts" },
    Electrical: { icon: "plug-zap", className: "electrical", description: "Power and electrical spares" },
    IT: { icon: "server-cog", className: "it", description: "Network and computer parts" },
};

let inventoryData = [];
let filteredInventory = [];
let currentInventoryId = null;
let activeInventoryTeam = "all";
const inventoryPagination = { page: 1, pageSize: 25 };

function inventoryRole() {
    return typeof normalizeDashboardRole === "function"
        ? normalizeDashboardRole(localStorage.getItem("role"))
        : String(localStorage.getItem("role") || "").trim().toLowerCase();
}

function isInventoryManager() {
    return inventoryRole() === "admin";
}

function inventoryTeamForRole() {
    const role = inventoryRole();
    if (role === "electrical") return "Electrical";
    if (role === "it") return "IT";
    if (role === "engineer") return "Biomedical";
    return null;
}

function inventoryTeamMeta(team) {
    return INVENTORY_TEAM_META[team] || INVENTORY_TEAM_META.Biomedical;
}

function inventoryNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function inventoryCurrency(value) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(inventoryNumber(value));
}

function inventoryStatus(item) {
    const stock = inventoryNumber(item.available_stock ?? item.current_stock);
    const minimum = inventoryNumber(item.minimum_stock);
    if (stock <= 0) return { key: "out", label: "Out of stock", className: "stock-out" };
    if (stock <= minimum) return { key: "low", label: "Low stock", className: "stock-low" };
    return { key: "available", label: "Available", className: "stock-ok" };
}

function inventoryTeamItems(team = activeInventoryTeam) {
    if (!isInventoryManager()) return [...inventoryData];
    if (!team || team === "all") return [...inventoryData];
    return inventoryData.filter(item => item.service_team === team);
}

// ==========================================
// RENDER
// ==========================================

async function renderInventory() {
    activeInventoryTeam = isInventoryManager() ? "all" : (inventoryTeamForRole() || "Biomedical");
    const team = inventoryTeamForRole();
    const title = isInventoryManager() ? "Engineering inventory hub" : `${team} inventory`;
    const subtitle = isInventoryManager()
        ? "Separate stock rooms for Biomedical, Electrical and IT engineering."
        : `Manage parts and consumables assigned only to the ${team} team.`;

    pageContent.innerHTML = `
        <div class="inventory-page">
            <section class="inventory-hero">
                <div class="inventory-hero-copy">
                    <span class="inventory-eyebrow"><i data-lucide="warehouse"></i> Engineering stores</span>
                    <h1>${escapeHTML(title)}</h1>
                    <p>${escapeHTML(subtitle)}</p>
                </div>
                <div class="inventory-hero-actions">
                    <button class="inventory-button inventory-button-secondary" id="importInventoryBtn" type="button">
                        <i data-lucide="file-up"></i><span>Import Excel</span>
                    </button>
                    <button class="inventory-button inventory-button-secondary" id="exportInventoryBtn" type="button">
                        <i data-lucide="download"></i><span>Export CSV</span>
                    </button>
                    <button class="inventory-button inventory-button-primary" id="addInventoryBtn" type="button">
                        <i data-lucide="plus"></i><span>Add item</span>
                    </button>
                </div>
            </section>

            <section id="inventoryTeamSwitcher" class="inventory-team-switcher" aria-label="Engineering inventory departments"></section>

            <section class="inventory-kpis" aria-label="Inventory summary">
                <article class="inventory-kpi inventory-kpi-total">
                    <div class="inventory-kpi-icon"><i data-lucide="package-open"></i></div>
                    <div><span>Stock lines</span><strong id="inventoryTotalItems">0</strong><small id="inventoryTotalHint">in this inventory</small></div>
                </article>
                <article class="inventory-kpi inventory-kpi-units">
                    <div class="inventory-kpi-icon"><i data-lucide="boxes"></i></div>
                    <div><span>Units on hand</span><strong id="inventoryTotalUnits">0</strong><small>across all stock lines</small></div>
                </article>
                <article class="inventory-kpi inventory-kpi-low">
                    <div class="inventory-kpi-icon"><i data-lucide="triangle-alert"></i></div>
                    <div><span>Needs attention</span><strong id="inventoryLowStock">0</strong><small id="inventoryAlertHint">low or out of stock</small></div>
                </article>
                <article class="inventory-kpi inventory-kpi-value">
                    <div class="inventory-kpi-icon"><i data-lucide="indian-rupee"></i></div>
                    <div><span>Stock value</span><strong id="inventoryValue">₹0</strong><small>current quantity value</small></div>
                </article>
            </section>

            <section class="inventory-registry">
                <header class="inventory-registry-header">
                    <div>
                        <span class="inventory-section-label">Stock register</span>
                        <h2 id="inventoryRegistryTitle">All engineering inventory</h2>
                    </div>
                    <div class="inventory-result-count"><strong id="inventoryResultCount">0</strong><span>items shown</span></div>
                </header>

                <div class="inventory-toolbar">
                    <label class="inventory-search" for="inventorySearch">
                        <i data-lucide="search"></i>
                        <input id="inventorySearch" type="search" placeholder="Search BPK, item, category or manufacturer" autocomplete="off">
                    </label>
                    <label class="inventory-select-wrap" for="inventoryFilter">
                        <span>Status</span>
                        <select id="inventoryFilter">
                            <option value="all">All statuses</option>
                            <option value="available">Available</option>
                            <option value="low">Low stock</option>
                            <option value="out">Out of stock</option>
                        </select>
                    </label>
                    <label class="inventory-select-wrap" for="inventoryCategoryFilter">
                        <span>Category</span>
                        <select id="inventoryCategoryFilter"><option value="all">All categories</option></select>
                    </label>
                </div>

                <div class="inventory-table-wrap">
                    <table class="inventory-table">
                        <thead>
                            <tr>
                                <th>Part / BPK</th>
                                <th>Item</th>
                                <th>Department</th>
                                <th>Category</th>
                                <th class="inventory-number-cell">On hand</th>
                                <th class="inventory-number-cell">Minimum</th>
                                <th>Status</th>
                                <th>Store location</th>
                                <th class="inventory-actions-heading">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="inventoryTableBody"></tbody>
                    </table>
                </div>
                <div id="inventoryPagination" class="table-pagination"></div>
            </section>
        </div>
    `;

    bindInventoryEvents();
    renderInventoryTeamSwitcher();
    await loadInventory();
    if (window.lucide) lucide.createIcons();
}

function bindInventoryEvents() {
    document.getElementById("inventorySearch")?.addEventListener("input", applyInventoryFilters);
    document.getElementById("inventoryFilter")?.addEventListener("change", applyInventoryFilters);
    document.getElementById("inventoryCategoryFilter")?.addEventListener("change", applyInventoryFilters);
    document.getElementById("importInventoryBtn")?.addEventListener("click", importInventoryExcel);
    document.getElementById("exportInventoryBtn")?.addEventListener("click", exportInventoryExcel);
    document.getElementById("addInventoryBtn")?.addEventListener("click", () => openInventoryModal());
}

function renderInventoryTeamSwitcher() {
    const switcher = document.getElementById("inventoryTeamSwitcher");
    if (!switcher) return;

    if (!isInventoryManager()) {
        const team = inventoryTeamForRole() || "Biomedical";
        const meta = inventoryTeamMeta(team);
        switcher.innerHTML = `
            <div class="inventory-team-lock ${meta.className}">
                <span class="inventory-team-icon"><i data-lucide="${meta.icon}"></i></span>
                <div><strong>${team} store</strong><small>${meta.description}</small></div>
                <span class="inventory-private-label"><i data-lucide="lock-keyhole"></i> Team inventory</span>
            </div>`;
        if (window.lucide) lucide.createIcons();
        return;
    }

    const tabs = [
        { team: "all", label: "All departments", icon: "layout-grid", description: "Combined manager view" },
        ...INVENTORY_TEAMS.map(team => ({
            team,
            label: team,
            icon: inventoryTeamMeta(team).icon,
            description: inventoryTeamMeta(team).description,
        })),
    ];

    switcher.innerHTML = tabs.map(tab => {
        const items = tab.team === "all" ? inventoryData : inventoryData.filter(item => item.service_team === tab.team);
        const alerts = items.filter(item => inventoryStatus(item).key !== "available").length;
        const active = tab.team === activeInventoryTeam;
        return `
            <button class="inventory-team-tab ${active ? "active" : ""}" type="button" data-inventory-team="${tab.team}" aria-pressed="${active}">
                <span class="inventory-team-icon"><i data-lucide="${tab.icon}"></i></span>
                <span class="inventory-team-copy"><strong>${tab.label}</strong><small>${tab.description}</small></span>
                <span class="inventory-team-metrics"><b>${items.length}</b><small>${alerts ? `${alerts} alert${alerts === 1 ? "" : "s"}` : "Stock healthy"}</small></span>
            </button>`;
    }).join("");

    switcher.querySelectorAll("[data-inventory-team]").forEach(button => {
        button.addEventListener("click", () => selectInventoryTeam(button.dataset.inventoryTeam));
    });
    if (window.lucide) lucide.createIcons();
}

function selectInventoryTeam(team) {
    if (!isInventoryManager() || !["all", ...INVENTORY_TEAMS].includes(team)) return;
    activeInventoryTeam = team;
    inventoryPagination.page = 1;
    renderInventoryTeamSwitcher();
    refreshInventoryCategoryOptions();
    applyInventoryFilters();
}

// ==========================================
// DATA AND FILTERING
// ==========================================

async function loadInventory() {
    setInventoryLoading(true);
    try {
        const response = await fetch(`${INVENTORY_API}/`);
        const result = await response.json().catch(() => []);
        if (!response.ok) throw new Error(result.detail || "Failed to load inventory.");
        inventoryData = Array.isArray(result) ? result : [];
        renderInventoryTeamSwitcher();
        refreshInventoryCategoryOptions();
        applyInventoryFilters();
    } catch (error) {
        console.error(error);
        inventoryData = [];
        filteredInventory = [];
        updateInventoryKPIs();
        renderInventoryTable([]);
        BioTrackToast.error("Inventory unavailable", error.message || "Unable to load inventory items.");
    } finally {
        setInventoryLoading(false);
    }
}

function setInventoryLoading(loading) {
    const table = document.querySelector(".inventory-registry");
    if (table) table.classList.toggle("is-loading", loading);
    document.querySelectorAll("#importInventoryBtn, #exportInventoryBtn, #addInventoryBtn")
        .forEach(button => { button.disabled = loading; });
}

function refreshInventoryCategoryOptions() {
    const select = document.getElementById("inventoryCategoryFilter");
    if (!select) return;
    const previous = select.value;
    const categories = [...new Set(inventoryTeamItems()
        .map(item => String(item.category || "").trim())
        .filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));
    select.innerHTML = '<option value="all">All categories</option>' + categories
        .map(category => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`)
        .join("");
    select.value = categories.includes(previous) ? previous : "all";
}

function applyInventoryFilters() {
    const search = String(document.getElementById("inventorySearch")?.value || "").trim().toLowerCase();
    const statusFilter = document.getElementById("inventoryFilter")?.value || "all";
    const categoryFilter = document.getElementById("inventoryCategoryFilter")?.value || "all";

    filteredInventory = inventoryTeamItems().filter(item => {
        const haystack = [item.bpk_number, item.item_name, item.category, item.manufacturer, item.location, item.rack]
            .map(value => String(value || "").toLowerCase())
            .join(" ");
        const matchesSearch = !search || haystack.includes(search);
        const matchesStatus = statusFilter === "all" || inventoryStatus(item).key === statusFilter;
        const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
        return matchesSearch && matchesStatus && matchesCategory;
    });

    inventoryPagination.page = 1;
    updateInventoryKPIs();
    updateInventoryRegistryHeader();
    renderInventoryTable(filteredInventory);
}

function updateInventoryKPIs() {
    const items = inventoryTeamItems();
    const totalUnits = items.reduce((sum, item) => sum + inventoryNumber(item.available_stock ?? item.current_stock), 0);
    const lowStock = items.filter(item => inventoryStatus(item).key === "low").length;
    const outOfStock = items.filter(item => inventoryStatus(item).key === "out").length;
    const totalValue = items.reduce((sum, item) => sum + (inventoryNumber(item.current_stock) * inventoryNumber(item.purchase_price)), 0);

    document.getElementById("inventoryTotalItems").textContent = items.length.toLocaleString("en-IN");
    document.getElementById("inventoryTotalUnits").textContent = totalUnits.toLocaleString("en-IN");
    document.getElementById("inventoryLowStock").textContent = (lowStock + outOfStock).toLocaleString("en-IN");
    document.getElementById("inventoryAlertHint").textContent = `${lowStock} low · ${outOfStock} out`;
    document.getElementById("inventoryValue").textContent = inventoryCurrency(totalValue);
    document.getElementById("inventoryTotalHint").textContent = activeInventoryTeam === "all" ? "across 3 departments" : `in ${activeInventoryTeam}`;
}

function updateInventoryRegistryHeader() {
    const title = document.getElementById("inventoryRegistryTitle");
    const count = document.getElementById("inventoryResultCount");
    if (title) title.textContent = activeInventoryTeam === "all" ? "All engineering inventory" : `${activeInventoryTeam} stock register`;
    if (count) count.textContent = filteredInventory.length.toLocaleString("en-IN");
}

function renderInventoryTable(data) {
    const tbody = document.getElementById("inventoryTableBody");
    if (!tbody) return;

    if (!data.length) {
        tbody.innerHTML = `
            <tr><td colspan="9" class="inventory-empty">
                <span><i data-lucide="package-search"></i></span>
                <strong>No inventory items found</strong>
                <small>Try another department or clear the current filters.</small>
            </td></tr>`;
        TablePagination.render(document.getElementById("inventoryPagination"), inventoryPagination, 0, () => renderInventoryTable(filteredInventory), "inventory items");
        if (window.lucide) lucide.createIcons();
        return;
    }

    tbody.innerHTML = TablePagination.pageItems(data, inventoryPagination).map(item => {
        const status = inventoryStatus(item);
        const meta = inventoryTeamMeta(item.service_team);
        return `
            <tr>
                <td data-label="Part / BPK"><span class="inventory-part-code">${escapeHTML(item.bpk_number || "-")}</span></td>
                <td data-label="Item"><div class="inventory-item-name"><strong>${escapeHTML(item.item_name || "-")}</strong><small>${escapeHTML(item.manufacturer || "Manufacturer not set")}</small></div></td>
                <td data-label="Department"><span class="inventory-team-badge ${meta.className}"><i data-lucide="${meta.icon}"></i>${escapeHTML(item.service_team || "Biomedical")}</span></td>
                <td data-label="Category">${escapeHTML(item.category || "Uncategorised")}</td>
                <td data-label="On hand" class="inventory-number-cell"><strong class="inventory-stock-number ${status.className}">${inventoryNumber(item.available_stock ?? item.current_stock)}</strong><small>${inventoryNumber(item.reserved_stock) ? `${inventoryNumber(item.reserved_stock)} reserved` : escapeHTML(item.unit || "units")}</small></td>
                <td data-label="Minimum" class="inventory-number-cell">${inventoryNumber(item.minimum_stock)}</td>
                <td data-label="Status"><span class="stock-badge ${status.className}"><i></i>${status.label}</span></td>
                <td data-label="Store location"><div class="inventory-location"><strong>${escapeHTML(item.location || "Not assigned")}</strong>${item.rack ? `<small>Rack ${escapeHTML(item.rack)}</small>` : ""}</div></td>
                <td data-label="Actions"><div class="action-buttons">
                    <button class="table-btn edit-btn" onclick="editInventory(${Number(item.id)})" type="button" aria-label="Edit ${escapeHTML(item.item_name || item.bpk_number || "inventory item")}" title="Edit item"><i data-lucide="square-pen"></i></button>
                    <button class="table-btn delete-btn" onclick="deleteInventory(${Number(item.id)})" type="button" aria-label="Delete ${escapeHTML(item.item_name || item.bpk_number || "inventory item")}" title="Delete item"><i data-lucide="trash-2"></i></button>
                </div></td>
            </tr>`;
    }).join("");

    TablePagination.render(document.getElementById("inventoryPagination"), inventoryPagination, data.length, () => renderInventoryTable(filteredInventory), "inventory items");
    if (window.lucide) lucide.createIcons();
}

// ==========================================
// ADD / EDIT DIALOG
// ==========================================

function editInventory(id) {
    const item = inventoryData.find(entry => Number(entry.id) === Number(id));
    if (item) openInventoryModal(item);
}

function inventoryFieldValue(value) {
    return escapeHTML(value ?? "");
}

function inventoryTeamOptions(selectedTeam = "Biomedical") {
    return INVENTORY_TEAMS.map(team => `<option value="${team}" ${team === selectedTeam ? "selected" : ""}>${team}</option>`).join("");
}

function openInventoryModal(item = null) {
    closeInventoryModal();
    const editing = Boolean(item);
    currentInventoryId = editing ? Number(item.id) : null;
    const canSelectTeam = isInventoryManager();
    const selectedTeam = item?.service_team || (activeInventoryTeam !== "all" ? activeInventoryTeam : inventoryTeamForRole()) || "Biomedical";

    const overlay = document.createElement("div");
    overlay.id = "inventoryModalOverlay";
    overlay.className = "inventory-modal-overlay";
    overlay.setAttribute("role", "presentation");
    overlay.innerHTML = `
        <section class="inventory-modal" role="dialog" aria-modal="true" aria-labelledby="inventoryModalTitle">
            <form id="inventoryItemForm">
                <header class="modal-header">
                    <div class="modal-header-icon"><i data-lucide="${editing ? "square-pen" : "package-plus"}"></i></div>
                    <div class="modal-header-copy">
                        <span>${editing ? "Update stock record" : "New stock record"}</span>
                        <h2 id="inventoryModalTitle">${editing ? "Edit inventory item" : "Add inventory item"}</h2>
                        <p>Every item belongs to one engineering department inventory.</p>
                    </div>
                    <button class="modal-close" type="button" aria-label="Close inventory form"><i data-lucide="x"></i></button>
                </header>
                <div class="modal-body">
                    <fieldset class="inventory-form-section inventory-form-identity">
                        <legend>Item identity</legend>
                        <div class="form-grid">
                            <div class="form-group"><label for="inv_bpk">BPK number <span>*</span></label><input id="inv_bpk" required maxlength="160" value="${inventoryFieldValue(item?.bpk_number)}" placeholder="e.g. IT-CAT6-001"></div>
                            <div class="form-group"><label for="inv_name">Item name <span>*</span></label><input id="inv_name" required maxlength="240" value="${inventoryFieldValue(item?.item_name)}" placeholder="e.g. CAT6 patch cable"></div>
                            <div class="form-group"><label for="inv_team">Engineering department <span>*</span></label><select id="inv_team" ${canSelectTeam ? "" : "disabled"}>${inventoryTeamOptions(selectedTeam)}</select><small>${canSelectTeam ? "Choose the inventory that owns this stock." : "Your login determines this inventory."}</small></div>
                            <div class="form-group"><label for="inv_category">Category</label><input id="inv_category" maxlength="160" value="${inventoryFieldValue(item?.category)}" placeholder="e.g. Network spare"></div>
                            <div class="form-group"><label for="inv_manufacturer">Manufacturer</label><input id="inv_manufacturer" maxlength="200" value="${inventoryFieldValue(item?.manufacturer)}"></div>
                            <div class="form-group"><label for="inv_supplier">Supplier</label><input id="inv_supplier" maxlength="200" value="${inventoryFieldValue(item?.supplier)}"></div>
                        </div>
                    </fieldset>
                    <fieldset class="inventory-form-section">
                        <legend>Stock levels</legend>
                        <div class="form-grid inventory-form-grid-three">
                            <div class="form-group"><label for="inv_stock">Current stock <span>*</span></label><input id="inv_stock" type="number" min="0" step="1" required value="${inventoryFieldValue(item?.current_stock ?? 0)}"></div>
                            <div class="form-group"><label for="inv_min">Reorder level <span>*</span></label><input id="inv_min" type="number" min="0" step="1" required value="${inventoryFieldValue(item?.minimum_stock ?? 5)}"></div>
                            <div class="form-group"><label for="inv_max">Target stock <span>*</span></label><input id="inv_max" type="number" min="0" step="1" required value="${inventoryFieldValue(item?.maximum_stock ?? 100)}"></div>
                            <div class="form-group"><label for="inv_unit">Unit</label><input id="inv_unit" maxlength="80" placeholder="pieces, boxes, metres" value="${inventoryFieldValue(item?.unit)}"></div>
                            <div class="form-group"><label for="inv_price">Unit price (₹)</label><input id="inv_price" type="number" min="0" step="0.01" value="${inventoryFieldValue(item?.purchase_price ?? 0)}"></div>
                            <div class="form-group"><label for="inv_batch">Batch / lot number</label><input id="inv_batch" maxlength="160" value="${inventoryFieldValue(item?.batch_number)}"></div>
                        </div>
                    </fieldset>
                    <fieldset class="inventory-form-section">
                        <legend>Storage</legend>
                        <div class="form-grid">
                            <div class="form-group"><label for="inv_location">Store location</label><input id="inv_location" maxlength="200" value="${inventoryFieldValue(item?.location)}" placeholder="e.g. IT Store"></div>
                            <div class="form-group"><label for="inv_rack">Rack / bin</label><input id="inv_rack" maxlength="120" value="${inventoryFieldValue(item?.rack)}" placeholder="e.g. Rack B-04"></div>
                            <div class="form-group full-width"><label for="inv_remarks">Remarks</label><textarea id="inv_remarks" rows="3" maxlength="1000" placeholder="Optional notes about compatibility or storage">${inventoryFieldValue(item?.remarks)}</textarea></div>
                        </div>
                    </fieldset>
                </div>
                <footer class="modal-footer">
                    <button class="secondary-btn" type="button" id="cancelInventoryModal">Cancel</button>
                    <button class="success-btn" type="submit" id="saveInventoryButton"><i data-lucide="save"></i><span>${editing ? "Save changes" : "Add item"}</span></button>
                </footer>
            </form>
        </section>`;

    document.body.appendChild(overlay);
    overlay.querySelector(".modal-close").addEventListener("click", closeInventoryModal);
    overlay.querySelector("#cancelInventoryModal").addEventListener("click", closeInventoryModal);
    overlay.querySelector("#inventoryItemForm").addEventListener("submit", event => {
        event.preventDefault();
        void saveInventoryItem(currentInventoryId);
    });
    document.addEventListener("keydown", closeInventoryModalOnEscape);
    if (window.lucide) lucide.createIcons();
    window.setTimeout(() => overlay.querySelector("#inv_bpk")?.focus(), 0);
}

function closeInventoryModalOnEscape(event) {
    if (event.key === "Escape") closeInventoryModal();
}

function closeInventoryModal() {
    document.getElementById("inventoryModalOverlay")?.remove();
    document.removeEventListener("keydown", closeInventoryModalOnEscape);
}

async function saveInventoryItem(id = null) {
    const minimum = Number(document.getElementById("inv_min").value);
    const maximum = Number(document.getElementById("inv_max").value);
    if (maximum < minimum) {
        BioTrackToast.error("Check stock levels", "Target stock must be greater than or equal to the reorder level.");
        document.getElementById("inv_max").focus();
        return;
    }

    const payload = {
        bpk_number: document.getElementById("inv_bpk").value.trim(),
        item_name: document.getElementById("inv_name").value.trim(),
        service_team: document.getElementById("inv_team").value,
        category: document.getElementById("inv_category").value.trim(),
        manufacturer: document.getElementById("inv_manufacturer").value.trim(),
        supplier: document.getElementById("inv_supplier").value.trim(),
        unit: document.getElementById("inv_unit").value.trim(),
        current_stock: Number(document.getElementById("inv_stock").value),
        minimum_stock: minimum,
        maximum_stock: maximum,
        purchase_price: Number(document.getElementById("inv_price").value),
        location: document.getElementById("inv_location").value.trim(),
        rack: document.getElementById("inv_rack").value.trim(),
        remarks: document.getElementById("inv_remarks").value.trim(),
        batch_number: document.getElementById("inv_batch").value.trim(),
    };

    const url = id ? `${INVENTORY_API}/${id}` : `${INVENTORY_API}/`;
    const method = id ? "PUT" : "POST";
    const saveButton = document.getElementById("saveInventoryButton");
    try {
        saveButton.disabled = true;
        saveButton.querySelector("span").textContent = id ? "Saving…" : "Adding…";
        const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) throw new Error(result.detail || "Unable to save this inventory item.");
        closeInventoryModal();
        if (isInventoryManager()) activeInventoryTeam = payload.service_team;
        showInventoryToast(id ? "Inventory item updated." : `Item added to ${payload.service_team} inventory.`);
        await loadInventory();
    } catch (error) {
        BioTrackToast.error("Inventory item not saved", error.message || "Unable to save this inventory item.");
        saveButton.disabled = false;
        saveButton.querySelector("span").textContent = id ? "Save changes" : "Add item";
    }
}

// ==========================================
// DELETE DIALOG
// ==========================================

function deleteInventory(id) {
    const item = inventoryData.find(entry => Number(entry.id) === Number(id));
    if (!item) {
        BioTrackToast.error("Inventory item not found", "Refresh the inventory and try again.");
        return;
    }
    closeInventoryDeleteDialog();
    const overlay = document.createElement("div");
    overlay.id = "inventoryDeleteOverlay";
    overlay.className = "inventory-modal-overlay";
    overlay.setAttribute("role", "presentation");
    overlay.innerHTML = `
        <section class="inventory-modal inventory-delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="inventoryDeleteTitle" aria-describedby="inventoryDeleteDescription">
            <div class="inventory-delete-icon" aria-hidden="true"><i data-lucide="trash-2"></i></div>
            <span class="inventory-delete-team">${escapeHTML(item.service_team || "Biomedical")} inventory</span>
            <h2 id="inventoryDeleteTitle">Delete inventory item?</h2>
            <p id="inventoryDeleteDescription"><strong>${escapeHTML(item.item_name || item.bpk_number)}</strong> will be permanently removed from this department's inventory.</p>
            <div class="inventory-delete-actions">
                <button class="secondary-btn" type="button" id="cancelInventoryDelete">Keep item</button>
                <button class="danger-btn" type="button" id="confirmInventoryDelete"><i data-lucide="trash-2"></i> Delete item</button>
            </div>
        </section>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", event => { if (event.target === overlay) closeInventoryDeleteDialog(); });
    overlay.querySelector("#cancelInventoryDelete").addEventListener("click", closeInventoryDeleteDialog);
    overlay.querySelector("#confirmInventoryDelete").addEventListener("click", () => confirmDeleteInventory(id));
    document.addEventListener("keydown", closeInventoryDeleteOnEscape);
    if (window.lucide) lucide.createIcons();
    overlay.querySelector("#cancelInventoryDelete")?.focus();
}

function closeInventoryDeleteOnEscape(event) {
    if (event.key === "Escape") closeInventoryDeleteDialog();
}

function closeInventoryDeleteDialog() {
    document.getElementById("inventoryDeleteOverlay")?.remove();
    document.removeEventListener("keydown", closeInventoryDeleteOnEscape);
}

async function confirmDeleteInventory(id) {
    const button = document.getElementById("confirmInventoryDelete");
    try {
        button.disabled = true;
        button.textContent = "Deleting…";
        const response = await fetch(`${INVENTORY_API}/${id}`, { method: "DELETE" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) throw new Error(result.detail || "Unable to delete this inventory item.");
        closeInventoryDeleteDialog();
        showInventoryToast("Inventory item deleted.");
        await loadInventory();
    } catch (error) {
        BioTrackToast.error("Inventory item not deleted", error.message || "Unable to delete this inventory item.");
        button.disabled = false;
        button.innerHTML = '<i data-lucide="trash-2"></i> Delete item';
        if (window.lucide) lucide.createIcons();
    }
}

// ==========================================
// IMPORT / EXPORT
// ==========================================

async function importInventoryExcel() {
    const team = isInventoryManager() ? activeInventoryTeam : inventoryTeamForRole();
    if (!team || team === "all") {
        BioTrackToast.info("Choose a department", "Select Biomedical, Electrical or IT before importing a workbook.");
        document.getElementById("inventoryTeamSwitcher")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls";
    input.onchange = async () => {
        if (!input.files.length) return;
        showInventoryLoading(`Importing ${team} inventory…`);
        const formData = new FormData();
        formData.append("file", input.files[0]);
        try {
            const response = await fetch(`${INVENTORY_API}/upload?service_team=${encodeURIComponent(team)}`, { method: "POST", body: formData });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result.success) throw new Error(result.detail || result.message || "The spreadsheet could not be imported.");
            showInventoryToast(`${team} inventory imported: ${result.added} added, ${result.updated} updated.`);
            await loadInventory();
        } catch (error) {
            BioTrackToast.error("Inventory import failed", error.message || "The server could not process the spreadsheet.");
        } finally {
            hideInventoryLoading();
        }
    };
    input.click();
}

function inventoryCsvCell(value) {
    return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function exportInventoryExcel() {
    if (!filteredInventory.length) {
        BioTrackToast.info("Nothing to export", "No items match the current inventory filters.");
        return;
    }
    const rows = [["Department", "BPK Number", "Item Name", "Category", "Manufacturer", "Stock", "Unit", "Minimum Stock", "Location", "Rack", "Unit Price"]];
    filteredInventory.forEach(item => rows.push([
        item.service_team, item.bpk_number, item.item_name, item.category, item.manufacturer,
        item.current_stock, item.unit, item.minimum_stock, item.location, item.rack, item.purchase_price,
    ]));
    const csv = rows.map(row => row.map(inventoryCsvCell).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const teamName = activeInventoryTeam === "all" ? "All-Engineering" : activeInventoryTeam;
    anchor.href = url;
    anchor.download = `BioTrack-${teamName}-Inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    showInventoryToast(`${filteredInventory.length} inventory items exported.`);
}

function showInventoryLoading(message = "Loading…") {
    hideInventoryLoading();
    const overlay = document.createElement("div");
    overlay.id = "inventoryLoading";
    overlay.className = "loading-overlay";
    overlay.innerHTML = `<div class="loading-card"><div class="loading-spinner"></div><h3>${escapeHTML(message)}</h3><p>Please keep this window open.</p></div>`;
    document.body.appendChild(overlay);
}

function hideInventoryLoading() {
    document.getElementById("inventoryLoading")?.remove();
}

function showInventoryToast(message) {
    BioTrackToast.success("Inventory updated", message);
}
;
/* source: dashboard_v2/views/centralStoreView.js */
let centralStoreData = { summary: {}, requests: [], low_stock: [], out_of_stock: [], catalogue: [] };
let centralStoreTab = "requests";

function storeEscape(value) {
    const node = document.createElement("div");
    node.textContent = String(value ?? "");
    return node.innerHTML;
}

function renderCentralStore() {
    pageContent.innerHTML = `
        <main class="central-store-page">
            <section class="store-hero">
                <div><span class="store-eyebrow"><i data-lucide="warehouse"></i> Hospital-wide supply hub</span><h1>Central Store</h1><p>Review engineering requests, prepare stock and coordinate delivery from one queue.</p></div>
                <button type="button" class="store-primary" onclick="openCatalogueEditor()"><i data-lucide="package-plus"></i>Add catalogue item</button>
            </section>
            <section class="store-kpis" aria-label="Central Store summary">
                <article><span class="is-blue"><i data-lucide="inbox"></i></span><div><small>New requests</small><strong id="storeKpiNew">—</strong></div></article>
                <article><span class="is-violet"><i data-lucide="activity"></i></span><div><small>Active requests</small><strong id="storeKpiActive">—</strong></div></article>
                <article><span class="is-amber"><i data-lucide="triangle-alert"></i></span><div><small>Low stock</small><strong id="storeKpiLow">—</strong></div></article>
                <article><span class="is-red"><i data-lucide="package-x"></i></span><div><small>Out of stock</small><strong id="storeKpiOut">—</strong></div></article>
            </section>
            <section class="store-workspace">
                <header class="store-tabs">
                    <button class="is-active" data-store-tab="requests" onclick="setCentralStoreTab('requests',this)"><i data-lucide="clipboard-list"></i>Engineer requests <b id="storeRequestCount">0</b></button>
                    <button data-store-tab="low" onclick="setCentralStoreTab('low',this)"><i data-lucide="chart-no-axes-column-decreasing"></i>Low stock</button>
                    <button data-store-tab="out" onclick="setCentralStoreTab('out',this)"><i data-lucide="package-x"></i>Out of stock</button>
                    <button data-store-tab="catalogue" onclick="setCentralStoreTab('catalogue',this)"><i data-lucide="library-big"></i>Master catalogue</button>
                    <button class="store-refresh" type="button" onclick="loadCentralStore(true)" aria-label="Refresh"><i data-lucide="refresh-cw"></i></button>
                </header>
                <div id="centralStorePanel" class="store-panel"><div class="store-loading"><i data-lucide="loader-circle"></i>Loading Central Store…</div></div>
            </section>
        </main>`;
    if (window.lucide) lucide.createIcons();
    loadCentralStore();
}

async function loadCentralStore(showToast = false) {
    try {
        const response = await fetch("/api/central-store/dashboard", { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "Unable to load Central Store.");
        centralStoreData = data;
        const summary = data.summary || {};
        [["storeKpiNew", summary.new_requests], ["storeKpiActive", summary.active_requests], ["storeKpiLow", summary.low_stock], ["storeKpiOut", summary.out_of_stock], ["storeRequestCount", (data.requests || []).length]].forEach(([id, value]) => {
            const element = document.getElementById(id); if (element) element.textContent = value ?? 0;
        });
        renderCentralStorePanel();
        if (showToast) BioTrackToast.success("Store refreshed", "The request and stock queues are up to date.");
    } catch (error) {
        const panel = document.getElementById("centralStorePanel");
        if (panel) panel.innerHTML = `<div class="store-empty"><i data-lucide="wifi-off"></i><h3>Central Store is unavailable</h3><p>${storeEscape(error.message)}</p></div>`;
        BioTrackToast.error("Unable to load store", error.message);
        if (window.lucide) lucide.createIcons();
    }
}

function setCentralStoreTab(tab, button) {
    centralStoreTab = tab;
    document.querySelectorAll("[data-store-tab]").forEach(item => item.classList.toggle("is-active", item === button));
    renderCentralStorePanel();
}

function storeStatusClass(value) { return String(value || "").toLowerCase().replaceAll(" ", "-"); }

function centralStoreRequestActions(request) {
    const id = Number(request.id);
    if (request.status === "Submitted") return `<button onclick="processStoreRequest(${id},'Approve')"><i data-lucide="check"></i>Approve</button><button class="is-danger" onclick="processStoreRequest(${id},'Reject')">Reject</button>`;
    if (request.status === "Awaiting Procurement") return `<button onclick="processStoreRequest(${id},'MarkReady')"><i data-lucide="package-check"></i>Mark sourced & ready</button><button class="is-danger" onclick="processStoreRequest(${id},'Reject')">Reject</button>`;
    if (request.status === "Ready") return `<button onclick="processStoreRequest(${id},'DispatchWardBoy')"><i data-lucide="truck"></i>Call Ward Boy</button><button class="is-secondary" onclick="processStoreRequest(${id},'ReadyForPickup')"><i data-lucide="hand"></i>Engineer pickup</button>`;
    if (request.status === "Dispatched") return `<span class="store-action-note"><i data-lucide="truck"></i>${request.delivery_task?.status === "Accepted" ? `With ${storeEscape(request.delivery_task.assigned_to || "Ward Boy")}` : "Waiting for Ward Boy"}</span>`;
    if (request.status === "Awaiting Engineer Confirmation") return '<span class="store-action-note"><i data-lucide="badge-check"></i>Delivered · awaiting engineer</span>';
    return `<span class="store-action-note"><i data-lucide="${request.status === "Completed" ? "circle-check-big" : "circle-x"}"></i>${storeEscape(request.status)}</span>`;
}

function renderCentralStorePanel() {
    const panel = document.getElementById("centralStorePanel");
    if (!panel) return;
    if (centralStoreTab === "requests") {
        const requests = centralStoreData.requests || [];
        panel.innerHTML = requests.length ? `<div class="store-request-grid">${requests.map(request => `
            <article class="store-request-card">
                <header><div><small>${storeEscape(request.request_number)} · ${storeEscape(request.service_team)}</small><h3>${storeEscape(request.item_name)}</h3></div><span class="store-status is-${storeStatusClass(request.status)}">${storeEscape(request.status)}</span></header>
                <div class="store-request-facts"><span><b>${Number(request.quantity)} ${storeEscape(request.unit)}</b> requested</span><span>${storeEscape(request.request_type)} item</span><span>${storeEscape(request.priority)} priority</span><span>${storeEscape(request.request_reason)}</span></div>
                <p class="store-requester"><i data-lucide="user-round"></i><b>${storeEscape(request.requested_by_name)}</b> · ${storeEscape(request.delivery_location)}</p>
                ${request.specification ? `<p class="store-spec">${storeEscape(request.specification)}</p>` : ""}
                <footer>${centralStoreRequestActions(request)}</footer>
            </article>`).join("")}</div>` : '<div class="store-empty"><i data-lucide="inbox"></i><h3>No engineer requests</h3><p>New internal and external spare-part requests will appear here.</p></div>';
    } else if (["low", "out"].includes(centralStoreTab)) {
        const rows = centralStoreTab === "low" ? centralStoreData.low_stock || [] : centralStoreData.out_of_stock || [];
        panel.innerHTML = storeStockTable(rows, centralStoreTab === "low" ? "No low-stock engineering items" : "No out-of-stock engineering items");
    } else {
        panel.innerHTML = storeCatalogueTable(centralStoreData.catalogue || []);
    }
    if (window.lucide) lucide.createIcons();
}

function storeStockTable(rows, emptyText) {
    if (!rows.length) return `<div class="store-empty"><i data-lucide="badge-check"></i><h3>${emptyText}</h3><p>All engineering teams are currently above this threshold.</p></div>`;
    return `<div class="store-table-wrap"><table><thead><tr><th>Team</th><th>Code</th><th>Spare part</th><th>Available</th><th>Minimum</th><th>Location</th></tr></thead><tbody>${rows.map(item => `<tr><td><span class="store-team">${storeEscape(item.service_team)}</span></td><td>${storeEscape(item.bpk_number)}</td><td><b>${storeEscape(item.item_name)}</b></td><td>${Number(item.available_stock)} ${storeEscape(item.unit)}</td><td>${Number(item.minimum_stock)}</td><td>${storeEscape(item.location)}</td></tr>`).join("")}</tbody></table></div>`;
}

function storeCatalogueTable(rows) {
    if (!rows.length) return '<div class="store-empty"><i data-lucide="library-big"></i><h3>The catalogue is empty</h3><p>Add the first hospital-wide spare part.</p></div>';
    return `<div class="store-table-wrap"><table><thead><tr><th>Code</th><th>Spare part</th><th>Stock</th><th>Min / Max</th><th>Bin</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(item => `<tr><td>${storeEscape(item.item_code)}</td><td><b>${storeEscape(item.item_name)}</b><small>${storeEscape(item.category || "Uncategorised")}</small></td><td><b>${Number(item.current_stock)}</b> ${storeEscape(item.unit)}</td><td>${Number(item.minimum_stock)} / ${Number(item.maximum_stock)}</td><td>${storeEscape(item.location)}${item.rack ? ` · ${storeEscape(item.rack)}` : ""}</td><td><span class="store-stock-state is-${storeStatusClass(item.stock_state)}">${storeEscape(item.stock_state)}</span></td><td><button class="store-icon-btn" onclick="openCatalogueEditor(${Number(item.id)})" aria-label="Edit ${storeEscape(item.item_name)}"><i data-lucide="pencil"></i></button></td></tr>`).join("")}</tbody></table></div>`;
}

async function processStoreRequest(requestId, action) {
    const labels = { Approve: "Approve this request?", MarkReady: "Confirm the item is sourced and ready?", DispatchWardBoy: "Send this delivery to the Ward Boy queue?", ReadyForPickup: "Mark this order ready for engineer pickup?", Reject: "Reject this request?" };
    if (!window.confirm(labels[action] || "Continue?")) return;
    try {
        const response = await fetch(`/api/central-store/requests/${requestId}/action`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, notes: "" }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "Unable to update request.");
        BioTrackToast.success("Request updated", `Status changed to ${data.request.status}.`);
        await loadCentralStore();
    } catch (error) { BioTrackToast.error("Request not updated", error.message); }
}

function openCatalogueEditor(itemId = null) {
    const item = itemId ? (centralStoreData.catalogue || []).find(entry => entry.id === itemId) : null;
    const modal = document.createElement("div");
    modal.id = "catalogueEditor";
    modal.className = "store-modal-backdrop";
    modal.innerHTML = `<section class="store-modal" role="dialog" aria-modal="true" aria-labelledby="catalogueTitle"><header><div><span>${item ? "Update stock record" : "New master item"}</span><h2 id="catalogueTitle">${item ? "Edit catalogue item" : "Add catalogue item"}</h2></div><button onclick="closeCatalogueEditor()" aria-label="Close"><i data-lucide="x"></i></button></header><form id="catalogueForm" onsubmit="saveCatalogueItem(event,${item ? Number(item.id) : "null"})"><div class="store-form-grid">${storeCatalogueField("item_code", "Item code", item?.item_code, true)}${storeCatalogueField("item_name", "Spare-part name", item?.item_name, true)}${storeCatalogueField("category", "Category", item?.category)}${storeCatalogueField("manufacturer", "Manufacturer", item?.manufacturer)}${storeCatalogueField("supplier", "Supplier", item?.supplier)}${storeCatalogueField("unit", "Unit", item?.unit || "pieces", true)}${storeCatalogueField("current_stock", "Current stock", item?.current_stock ?? 0, true, "number", "0")}${storeCatalogueField("minimum_stock", "Minimum stock", item?.minimum_stock ?? 5, true, "number", "0")}${storeCatalogueField("maximum_stock", "Maximum stock", item?.maximum_stock ?? 100, true, "number", "0")}${storeCatalogueField("purchase_price", "Unit price (₹)", item?.purchase_price ?? 0, true, "number", "0", "0.01")}${storeCatalogueField("location", "Store location", item?.location || "Central Store", true)}${storeCatalogueField("rack", "Rack / bin", item?.rack)}</div><footer><button type="button" class="is-ghost" onclick="closeCatalogueEditor()">Cancel</button><button class="store-primary" type="submit"><i data-lucide="save"></i>Save item</button></footer></form></section>`;
    document.body.appendChild(modal);
    if (window.lucide) lucide.createIcons();
}

function storeCatalogueField(name, label, value = "", required = false, type = "text", min = "", step = "") {
    return `<label><span>${label}${required ? " *" : ""}</span><input name="${name}" type="${type}" value="${storeEscape(value)}" ${required ? "required" : ""} ${min !== "" ? `min="${min}"` : ""} ${step ? `step="${step}"` : ""}></label>`;
}

function closeCatalogueEditor() { document.getElementById("catalogueEditor")?.remove(); }

async function saveCatalogueItem(event, itemId) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    ["current_stock", "minimum_stock", "maximum_stock"].forEach(key => values[key] = Number(values[key]));
    values.purchase_price = Number(values.purchase_price); values.active = true;
    try {
        const response = await fetch(itemId ? `/api/central-store/catalog/${itemId}` : "/api/central-store/catalog", { method: itemId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "Unable to save catalogue item.");
        closeCatalogueEditor(); BioTrackToast.success("Catalogue saved", "The master stock record is now available."); await loadCentralStore();
    } catch (error) { BioTrackToast.error("Item not saved", error.message); }
}
;
/* source: dashboard_v2/views/businessView.js */
let businessData = null;
let businessActiveTab = "overview";
const businessQuoteDefaultWeights = { price: 40, warranty: 30, delivery: 20, payment_terms: 10 };
let businessQuoteWeights = { ...businessQuoteDefaultWeights };

function renderBusinessPortal() {
    pageContent.innerHTML = `
      <main class="business-page">
        <section class="business-hero">
          <div><span class="business-eyebrow"><i data-lucide="landmark"></i> Hospital Business Office</span><h1>Finance and payer operations</h1><p>Control institutional budgets, purchases, payments and aggregate insurance settlements in one auditable workspace.</p></div>
          <div class="business-hero-actions"><span><i data-lucide="shield-check"></i> No patient billing data</span><button type="button" onclick="downloadBusinessReport()"><i data-lucide="download"></i> Export report</button></div>
        </section>

        <nav class="business-tabs" aria-label="Business Office sections">
          ${businessTabButton("overview", "layout-dashboard", "Overview")}
          ${businessTabButton("purchases", "shopping-cart", "Purchases")}
          ${businessTabButton("suppliers", "handshake", "Vendors & invoices")}
          ${businessTabButton("budgets", "wallet-cards", "Budgets & payments")}
          ${businessTabButton("insurance", "shield-plus", "Insurance operations")}
          ${businessTabButton("reports", "file-chart-column", "Reports")}
        </nav>
        <div id="businessWorkspace" class="business-workspace"><div class="business-loading"><span></span><strong>Preparing the Business Office</strong><p>Calculating the latest institutional finance position.</p></div></div>
      </main>
      <div id="businessModal"></div>`;
    if (window.lucide) lucide.createIcons();
    loadBusinessPortal();
}

function businessTabButton(tab, icon, label) {
    return `<button type="button" class="${businessActiveTab === tab ? "is-active" : ""}" data-business-tab="${tab}" onclick="showBusinessTab('${tab}')"><i data-lucide="${icon}"></i><span>${label}</span></button>`;
}

async function loadBusinessPortal() {
    try {
        const response = await fetch("/api/business/dashboard", { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.detail || "The Business Office data could not be loaded.");
        businessData = payload;
        showBusinessTab(businessActiveTab);
    } catch (error) {
        const workspace = document.getElementById("businessWorkspace");
        if (workspace) workspace.innerHTML = `<div class="business-empty"><i data-lucide="wifi-off"></i><strong>Business data is unavailable</strong><p>${businessEscape(error.message)}</p><button type="button" onclick="loadBusinessPortal()">Try again</button></div>`;
        if (window.lucide) lucide.createIcons();
    }
}

function showBusinessTab(tab) {
    businessActiveTab = tab;
    document.querySelectorAll("[data-business-tab]").forEach(button => button.classList.toggle("is-active", button.dataset.businessTab === tab));
    if (!businessData) return;
    const renderers = { overview: renderBusinessOverview, purchases: renderBusinessPurchases, suppliers: renderBusinessSuppliers, budgets: renderBusinessBudgets, insurance: renderBusinessInsurance, reports: renderBusinessReports };
    const workspace = document.getElementById("businessWorkspace");
    if (workspace) workspace.innerHTML = (renderers[tab] || renderBusinessOverview)();
    if (window.lucide) lucide.createIcons();
}

function renderBusinessOverview() {
    const summary = businessData.summary || {};
    const operations = businessData.operational_values || {};
    const categories = businessData.spend_by_category || [];
    const maxCategory = Math.max(...categories.map(item => Number(item.amount || 0)), 1);
    return `
      <section class="business-summary-grid">
        ${businessMetric("wallet", "Allocated budget", summary.allocated_budget, "blue")}
        ${businessMetric("badge-indian-rupee", "Paid spend", summary.paid_spend, "violet")}
        ${businessMetric("circle-dollar-sign", "Available budget", summary.available_budget, Number(summary.available_budget) < 0 ? "red" : "green")}
        ${businessMetric("clipboard-clock", "Pending purchases", summary.pending_purchase_amount, "orange", `${summary.pending_purchase_count || 0} awaiting approval`)}
        ${businessMetric("hand-coins", "Claims received", summary.claims_received, "teal")}
        ${businessMetric("hourglass", "Insurance outstanding", summary.claims_outstanding, "red")}
        ${businessMetric("receipt", "Supplier outstanding", summary.supplier_outstanding, Number(summary.overdue_supplier_amount) > 0 ? "red" : "orange", `${businessMoney(summary.overdue_supplier_amount)} overdue`)}
      </section>
      <section class="business-overview-grid">
        <article class="business-panel">
          <header><div><span class="business-eyebrow">Budget execution</span><h2>Where the hospital stands</h2></div><button type="button" onclick="showBusinessTab('budgets')">Open budgets <i data-lucide="arrow-up-right"></i></button></header>
          <div class="business-budget-position">
            ${businessPosition("Approved commitments", summary.committed_spend, summary.allocated_budget, "orange")}
            ${businessPosition("Payments completed", summary.paid_spend, summary.allocated_budget, "blue")}
            ${businessPosition("Funds still available", summary.available_budget, summary.allocated_budget, "green")}
          </div>
        </article>
        <article class="business-panel">
          <header><div><span class="business-eyebrow">Spend profile</span><h2>Paid expense by category</h2></div></header>
          <div class="business-category-list">${categories.length ? categories.slice(0, 6).map(item => `<div><span><strong>${businessEscape(item.category)}</strong><em>${businessMoney(item.amount)}</em></span><i><b style="width:${Math.max(4, Number(item.amount || 0) / maxCategory * 100)}%"></b></i></div>`).join("") : businessInlineEmpty("No paid expenses have been posted yet.")}</div>
        </article>
      </section>
      <section class="business-panel">
        <header><div><span class="business-eyebrow">Recorded hospital value</span><h2>Assets, stores and external service costs</h2><p>Read-only values calculated from the existing operational registers.</p></div></header>
        <div class="business-value-grid">
          ${businessValue("monitor-cog", "Registered asset value", operations.registered_asset_value)}
          ${businessValue("boxes", "Engineering inventory", operations.department_inventory_value)}
          ${businessValue("warehouse", "Central Store stock", operations.central_store_value)}
          ${businessValue("handshake", "Vendor service cost", operations.vendor_service_cost)}
        </div>
      </section>
      <section class="business-privacy-note"><i data-lucide="shield-check"></i><div><strong>Purposefully separate from patient billing</strong><p>${businessEscape(businessData.privacy_boundary)}</p></div></section>`;
}

function renderBusinessPurchases() {
    const purchases = businessData.purchases || [];
    const pending = purchases.filter(item => item.status === "Submitted");
    const role = String(localStorage.getItem("role") || "").toLowerCase();
    const isManager = ["manager", "admin"].includes(role);
    return `
      <section class="business-section-heading"><div><span class="business-eyebrow">Purchase control</span><h2>Requests and approvals</h2><p>Every payment starts with a costed request and an administrator decision.</p></div><button class="business-primary" type="button" onclick="openBusinessForm('purchase')"><i data-lucide="plus"></i> New purchase request</button></section>
      ${isManager && pending.length ? `<section class="business-review-banner"><span><i data-lucide="clipboard-check"></i></span><div><strong>${pending.length} purchase ${pending.length === 1 ? "request needs" : "requests need"} your review</strong><p>${businessMoney(pending.reduce((sum, item) => sum + Number(item.total_amount || 0), 0))} is awaiting an approval decision.</p></div></section>` : ""}
      <section class="business-panel business-table-panel"><div class="business-table-scroll"><table class="business-table"><thead><tr><th>Request</th><th>Item and department</th><th>Cost</th><th>Requested by</th><th>Status</th><th>Action</th></tr></thead><tbody>
        ${purchases.length ? purchases.map(item => `<tr><td><strong>${businessEscape(item.request_number)}</strong><small>${businessDate(item.requested_at)}</small></td><td><strong>${businessEscape(item.item_name)}</strong><small>${businessEscape(item.department)} · ${businessEscape(item.category)}</small></td><td><strong>${businessMoney(item.total_amount)}</strong><small>${businessNumber(item.quantity)} ${businessEscape(item.unit)} × ${businessMoney(item.unit_cost)}</small></td><td><strong>${businessEscape(item.requested_by)}</strong><small>${businessEscape(item.priority)} priority</small></td><td><span class="business-status is-${businessStatusClass(item.status)}">${businessEscape(item.status)}</span></td><td>${businessPurchaseActions(item, isManager)}</td></tr>`).join("") : businessTableEmpty(6, "No purchase requests", "Create a request to start the approval and payment workflow.")}
      </tbody></table></div></section>`;
}

function businessPurchaseActions(item, isManager) {
    const quotation = ["Submitted", "Approved"].includes(item.status) ? `<button class="business-row-action" type="button" onclick="openQuotationComparison(${item.id})">Quotations</button>` : "";
    if (item.status === "Submitted" && isManager) return `<span class="business-action-stack">${quotation}<button class="business-row-action" type="button" onclick="openPurchaseReview(${item.id})">Review</button></span>`;
    const next = { Approved: "Ordered", Ordered: "Received", Received: "Paid" }[item.status];
    if (next === "Paid" && (businessData?.invoices || []).some(invoice => invoice.purchase_id === item.id)) return `<button class="business-row-action" type="button" onclick="showBusinessTab('suppliers')">Open invoices</button>`;
    if (next) return `<span class="business-action-stack">${quotation}<button class="business-row-action" type="button" onclick="openPurchaseStatus(${item.id}, '${next}')">Mark ${next}</button></span>`;
    return quotation || `<span class="business-muted">${item.approved_by ? `By ${businessEscape(item.approved_by)}` : "No action"}</span>`;
}

function renderBusinessSuppliers() {
    const vendors = businessData.vendors || [];
    const invoices = businessData.invoices || [];
    const payments = businessData.payments || [];
    const summary = businessData.summary || {};
    const role = String(localStorage.getItem("role") || "").toLowerCase();
    const isManager = ["manager", "admin"].includes(role);
    return `
      <section class="business-section-heading"><div><span class="business-eyebrow">Supplier finance</span><h2>Vendors, invoices and payments</h2><p>Maintain approved suppliers, verify invoices, approve partial payments and monitor every outstanding balance.</p></div><div class="business-heading-actions"><button type="button" onclick="downloadVendorOutstanding()"><i data-lucide="download"></i> Outstanding report</button><button type="button" onclick="openBusinessForm('invoice')" ${vendors.length ? "" : "disabled"}><i data-lucide="receipt-text"></i> Add invoice</button><button class="business-primary" type="button" onclick="openBusinessForm('vendor')"><i data-lucide="plus"></i> Add vendor</button></div></section>
      <section class="business-insurance-summary">
        <article><span><i data-lucide="building-2"></i></span><div><small>Active vendors</small><strong>${summary.active_vendors || 0}</strong></div></article>
        <article><span><i data-lucide="receipt"></i></span><div><small>Supplier outstanding</small><strong>${businessMoney(summary.supplier_outstanding)}</strong></div></article>
        <article><span><i data-lucide="triangle-alert"></i></span><div><small>Overdue invoices</small><strong>${businessMoney(summary.overdue_supplier_amount)}</strong></div></article>
        <article><span><i data-lucide="clipboard-clock"></i></span><div><small>Payment approvals</small><strong>${summary.pending_payment_approvals || 0}</strong></div></article>
      </section>
      <section class="business-panel business-table-panel"><header><div><h2>Vendor master</h2><p>Supplier identity, contacts, payment terms and current outstanding position.</p></div></header><div class="business-table-scroll"><table class="business-table"><thead><tr><th>Vendor</th><th>Type</th><th>Contact</th><th>Terms</th><th>Outstanding</th><th>Status</th><th>Action</th></tr></thead><tbody>
        ${vendors.length ? vendors.map(item => `<tr><td><strong>${businessEscape(item.vendor_name)}</strong><small>${businessEscape(item.vendor_code)} · ${businessEscape(item.tax_identifier || "No tax ID")}</small></td><td>${businessEscape(item.supplier_type)}</td><td>${businessEscape(item.contact_person || "—")}<small>${businessEscape(item.phone || item.email || "No contact")}</small></td><td>${item.payment_terms_days} days</td><td><strong>${businessMoney(item.outstanding_amount)}</strong></td><td><span class="business-status is-${businessStatusClass(item.status)}">${businessEscape(item.status)}</span></td><td><span class="business-action-stack"><button class="business-row-action" type="button" onclick="openBusinessForm('vendorUpdate', ${item.id})">Edit</button><button class="business-row-action" type="button" onclick="openBusinessDocuments('vendor', ${item.id})">Documents</button></span></td></tr>`).join("") : businessTableEmpty(7, "No vendors configured", "Create the first vendor before collecting quotations or invoices.")}
      </tbody></table></div></section>
      <section class="business-panel business-table-panel"><header><div><h2>Supplier invoices</h2><p>Approved, partially paid, overdue and settled invoices with exact outstanding values.</p></div></header><div class="business-table-scroll"><table class="business-table"><thead><tr><th>Invoice</th><th>Vendor / purchase</th><th>Due date</th><th>Total</th><th>Paid</th><th>Outstanding</th><th>Status</th><th>Action</th></tr></thead><tbody>
        ${invoices.length ? invoices.map(item => `<tr><td><strong>${businessEscape(item.invoice_number)}</strong><small>${businessDate(item.invoice_date)}</small></td><td><strong>${businessEscape(item.vendor_name)}</strong><small>${businessEscape(item.request_number)}</small></td><td>${businessDate(item.due_date)}</td><td>${businessMoney(item.total_amount)}</td><td>${businessMoney(item.paid_amount)}</td><td><strong>${businessMoney(item.outstanding_amount)}</strong></td><td><span class="business-status is-${businessStatusClass(item.status)}">${businessEscape(item.status)}</span></td><td>${businessInvoiceActions(item, isManager)}</td></tr>`).join("") : businessTableEmpty(8, "No supplier invoices", "Record an invoice after a purchase has been approved.")}
      </tbody></table></div></section>
      <section class="business-panel business-table-panel"><header><div><h2>Payment approval queue</h2><p>Every partial payment is separately requested, approved and completed with a bank reference.</p></div></header><div class="business-table-scroll"><table class="business-table"><thead><tr><th>Request</th><th>Vendor / invoice</th><th>Amount</th><th>Requested date</th><th>Requested by</th><th>Status</th><th>Action</th></tr></thead><tbody>
        ${payments.length ? payments.map(item => `<tr><td><strong>${businessEscape(item.reference_number)}</strong></td><td><strong>${businessEscape(item.vendor_name)}</strong><small>${businessEscape(item.invoice_number)}</small></td><td><strong>${businessMoney(item.amount)}</strong></td><td>${businessDate(item.requested_payment_date)}</td><td>${businessEscape(item.requested_by)}</td><td><span class="business-status is-${businessStatusClass(item.status)}">${businessEscape(item.status)}</span></td><td>${businessPaymentActions(item, isManager)}</td></tr>`).join("") : businessTableEmpty(7, "No payment requests", "Approved invoices can be paid in one or more controlled instalments.")}
      </tbody></table></div></section>`;
}

function businessInvoiceActions(item, isManager) {
    const docs = `<button class="business-row-action" type="button" onclick="openBusinessDocuments('invoice', ${item.id})">Documents</button>`;
    if (item.stored_status === "Submitted" && isManager) return `<span class="business-action-stack"><button class="business-row-action" type="button" onclick="openInvoiceReview(${item.id})">Review</button>${docs}</span>`;
    if (["Approved", "Partially Paid"].includes(item.stored_status) && Number(item.outstanding_amount) > 0) return `<span class="business-action-stack"><button class="business-row-action" type="button" onclick="openBusinessForm('payment', ${item.id})">Request payment</button>${docs}</span>`;
    return docs;
}

function businessPaymentActions(item, isManager) {
    if (item.status === "Pending Approval" && isManager) return `<button class="business-row-action" type="button" onclick="openPaymentReview(${item.id})">Review</button>`;
    if (item.status === "Approved") return `<button class="business-row-action" type="button" onclick="openBusinessForm('paymentComplete', ${item.id})">Complete payment</button>`;
    return `<button class="business-row-action" type="button" onclick="openBusinessDocuments('payment', ${item.id})">Documents</button>`;
}

function renderBusinessBudgets() {
    const budgets = businessData.budgets || [];
    const transactions = businessData.transactions || [];
    return `
      <section class="business-section-heading"><div><span class="business-eyebrow">Financial control</span><h2>Budgets and institutional payments</h2><p>Allocated, committed, paid and available values are calculated automatically.</p></div><div class="business-heading-actions"><button type="button" onclick="openBusinessForm('transaction')"><i data-lucide="receipt-indian-rupee"></i> Record transaction</button><button class="business-primary" type="button" onclick="openBusinessForm('budget')"><i data-lucide="plus"></i> Set budget</button></div></section>
      <section class="business-panel business-table-panel"><header><div><h2>Budget execution</h2><p>Commitments exclude purchases that have already been paid, preventing double counting.</p></div></header><div class="business-table-scroll"><table class="business-table"><thead><tr><th>Fiscal year</th><th>Scope</th><th>Allocated</th><th>Committed</th><th>Paid</th><th>Available</th><th>Used</th></tr></thead><tbody>
        ${budgets.length ? budgets.map(item => `<tr><td><strong>${businessEscape(item.fiscal_year)}</strong></td><td><strong>${businessEscape(item.department)}</strong><small>${businessEscape(item.category)}</small></td><td>${businessMoney(item.allocated_amount)}</td><td>${businessMoney(item.committed_amount)}</td><td>${businessMoney(item.actual_spend)}</td><td class="${Number(item.available_amount) < 0 ? "is-negative" : ""}">${businessMoney(item.available_amount)}</td><td><span class="business-utilisation"><i><b style="width:${Math.min(100, Number(item.utilisation_percent || 0))}%"></b></i><em>${businessNumber(item.utilisation_percent)}%</em></span></td></tr>`).join("") : businessTableEmpty(7, "No budgets configured", "Set the first department or hospital-wide budget.")}
      </tbody></table></div></section>
      <section class="business-panel business-table-panel"><header><div><h2>Payment and receipt ledger</h2><p>Purchase payments and insurance receipts are posted automatically; other institutional entries can be recorded manually.</p></div></header><div class="business-table-scroll"><table class="business-table"><thead><tr><th>Reference</th><th>Type</th><th>Description</th><th>Counterparty</th><th>Amount</th><th>Status</th></tr></thead><tbody>
        ${transactions.length ? transactions.map(item => `<tr><td><strong>${businessEscape(item.reference_number)}</strong><small>${businessDate(item.transaction_date)}</small></td><td><span>${businessEscape(item.transaction_type)}</span><small>${businessEscape(item.category)}</small></td><td>${businessEscape(item.description)}</td><td>${businessEscape(item.counterparty || "—")}</td><td><strong>${businessMoney(item.amount)}</strong></td><td><span class="business-status is-${businessStatusClass(item.status)}">${businessEscape(item.status)}</span></td></tr>`).join("") : businessTableEmpty(6, "No transactions posted", "Paid purchases and received insurance claims will appear here automatically.")}
      </tbody></table></div></section>`;
}

function renderBusinessInsurance() {
    const policies = businessData.policies || [];
    const claims = businessData.claims || [];
    return `
      <section class="business-section-heading"><div><span class="business-eyebrow">Payer operations</span><h2>Insurance schemes and settlements</h2><p>Track hospital agreements and aggregate claim batches—never individual patient policies.</p></div><div class="business-heading-actions"><button type="button" onclick="openBusinessForm('policy')"><i data-lucide="shield-plus"></i> Add policy or scheme</button><button class="business-primary" type="button" onclick="openBusinessForm('claim')" ${policies.length ? "" : "disabled"}><i data-lucide="plus"></i> New claim batch</button></div></section>
      <section class="business-insurance-summary">
        <article><span><i data-lucide="shield-check"></i></span><div><small>Active payer agreements</small><strong>${businessData.summary.active_policies || 0}</strong></div></article>
        <article><span><i data-lucide="files"></i></span><div><small>Aggregate claim batches</small><strong>${businessData.summary.claim_batches || 0}</strong></div></article>
        <article><span><i data-lucide="badge-check"></i></span><div><small>Approved by payers</small><strong>${businessMoney(businessData.summary.claims_approved)}</strong></div></article>
        <article><span><i data-lucide="hourglass"></i></span><div><small>Still outstanding</small><strong>${businessMoney(businessData.summary.claims_outstanding)}</strong></div></article>
      </section>
      <section class="business-panel business-table-panel"><header><div><h2>Payer policy and scheme register</h2><p>Hospital-level agreements, submission windows and settlement terms.</p></div></header><div class="business-table-scroll"><table class="business-table"><thead><tr><th>Provider</th><th>Policy / scheme</th><th>Type</th><th>Coverage</th><th>Validity</th><th>Status</th><th>Action</th></tr></thead><tbody>
        ${policies.length ? policies.map(item => `<tr><td><strong>${businessEscape(item.provider_name)}</strong><small>${businessEscape(item.contact_person || "No contact recorded")}</small></td><td><strong>${businessEscape(item.policy_name)}</strong><small>${businessEscape(item.policy_code)}</small></td><td>${businessEscape(item.payer_type)}</td><td>${businessEscape(item.coverage_model)}<small>${item.claim_submission_days}d submit · ${item.payment_due_days}d pay</small></td><td>${businessDate(item.valid_from)}<small>to ${businessDate(item.valid_to)}</small></td><td><span class="business-status is-${businessStatusClass(item.status)}">${businessEscape(item.status)}</span></td><td><button class="business-row-action" type="button" onclick="openBusinessForm('policyUpdate', ${item.id})">Edit</button></td></tr>`).join("") : businessTableEmpty(7, "No payer agreements", "Add the first insurer, TPA, corporate payer or government scheme.")}
      </tbody></table></div></section>
      <section class="business-panel business-table-panel"><header><div><h2>Aggregate claim batches</h2><p>Monitor claimed, approved, received, deducted and outstanding amounts by payer.</p></div></header><div class="business-table-scroll"><table class="business-table"><thead><tr><th>Batch</th><th>Payer</th><th>Claims</th><th>Claimed</th><th>Approved</th><th>Received</th><th>Outstanding</th><th>Status</th><th>Action</th></tr></thead><tbody>
        ${claims.length ? claims.map(item => `<tr><td><strong>${businessEscape(item.batch_reference)}</strong><small>${businessDate(item.service_period_start)} – ${businessDate(item.service_period_end)}</small></td><td><strong>${businessEscape(item.provider_name)}</strong><small>${businessEscape(item.policy_name)}</small></td><td>${businessNumber(item.claim_count)}</td><td>${businessMoney(item.claimed_amount)}</td><td>${businessMoney(item.approved_amount)}</td><td>${businessMoney(item.received_amount)}</td><td><strong>${businessMoney(item.outstanding_amount)}</strong></td><td><span class="business-status is-${businessStatusClass(item.status)}">${businessEscape(item.status)}</span></td><td><button class="business-row-action" type="button" onclick="openBusinessForm('claimUpdate', ${item.id})">Update</button></td></tr>`).join("") : businessTableEmpty(9, "No claim batches", policies.length ? "Record an aggregate payer submission to begin settlement tracking." : "Add a payer agreement before recording claim batches.")}
      </tbody></table></div></section>`;
}

function renderBusinessReports() {
    const summary = businessData.summary || {};
    return `
      <section class="business-section-heading"><div><span class="business-eyebrow">Management reporting</span><h2>Business Office report centre</h2><p>Download a traceable institutional report without exposing patient billing information.</p></div></section>
      <section class="business-report-card"><span><i data-lucide="file-spreadsheet"></i></span><div><h2>Institutional finance register</h2><p>Includes purchase requests, payment and receipt ledger entries, and aggregate payer claim batches with their current status.</p><ul><li><i data-lucide="check"></i> ${businessMoney(summary.paid_spend)} paid spend</li><li><i data-lucide="check"></i> ${summary.pending_purchase_count || 0} pending purchase approvals</li><li><i data-lucide="check"></i> ${businessMoney(summary.claims_outstanding)} insurance outstanding</li></ul></div><button type="button" onclick="downloadBusinessReport()"><i data-lucide="download"></i> Download CSV</button></section>
      <section class="business-report-guidance"><article><i data-lucide="circle-check-big"></i><div><strong>Budget accountability</strong><p>Use allocated, committed, paid and available values to review budget execution.</p></div></article><article><i data-lucide="clipboard-check"></i><div><strong>Purchase supervision</strong><p>Administrator decisions and the later order, receipt and payment milestones remain visible.</p></div></article><article><i data-lucide="shield-check"></i><div><strong>Privacy-safe insurance analysis</strong><p>Only payer contracts and aggregate batch totals are captured; no patient data belongs here.</p></div></article></section>`;
}

function businessMetric(icon, label, value, tone, detail = "") { return `<article class="business-summary-card is-${tone}"><span><i data-lucide="${icon}"></i></span><div><small>${label}</small><strong>${businessMoney(value)}</strong>${detail ? `<em>${detail}</em>` : ""}</div></article>`; }
function businessPosition(label, value, total, tone) { const percent = Number(total) > 0 ? Math.max(0, Math.min(100, Number(value || 0) / Number(total) * 100)) : 0; return `<div><span><strong>${label}</strong><em>${businessMoney(value)}</em></span><i class="is-${tone}"><b style="width:${percent}%"></b></i></div>`; }
function businessValue(icon, label, value) { return `<article><span><i data-lucide="${icon}"></i></span><div><small>${label}</small><strong>${businessMoney(value)}</strong></div></article>`; }
function businessInlineEmpty(message) { return `<div class="business-inline-empty"><i data-lucide="chart-no-axes-column"></i><span>${businessEscape(message)}</span></div>`; }
function businessTableEmpty(colspan, title, message) { return `<tr><td colspan="${colspan}"><div class="business-table-empty"><i data-lucide="inbox"></i><strong>${businessEscape(title)}</strong><p>${businessEscape(message)}</p></div></td></tr>`; }

function openBusinessForm(kind, recordId = null) {
    const modal = document.getElementById("businessModal");
    if (!modal) return;
    const forms = {
        budget: { title: "Set institutional budget", icon: "wallet-cards", body: businessBudgetFields(), submit: "Save budget" },
        purchase: { title: "New purchase request", icon: "shopping-cart", body: businessPurchaseFields(), submit: "Submit for approval" },
        vendor: { title: "Add vendor", icon: "building-2", body: businessVendorFields(), submit: "Save vendor" },
        vendorUpdate: { title: "Edit vendor", icon: "building-2", body: businessVendorFields(recordId), submit: "Update vendor" },
        quotation: { title: "Add supplier quotation", icon: "scale", body: businessQuotationFields(recordId), submit: "Save quotation" },
        invoice: { title: "Record supplier invoice", icon: "receipt-text", body: businessInvoiceFields(), submit: "Submit invoice" },
        payment: { title: "Request partial payment", icon: "hand-coins", body: businessPaymentFields(recordId), submit: "Send for approval" },
        paymentComplete: { title: "Complete approved payment", icon: "badge-check", body: businessPaymentCompletionFields(recordId), submit: "Post payment" },
        transaction: { title: "Record institutional transaction", icon: "receipt-indian-rupee", body: businessTransactionFields(), submit: "Record transaction" },
        policy: { title: "Add payer policy or scheme", icon: "shield-plus", body: businessPolicyFields(), submit: "Save payer agreement" },
        policyUpdate: { title: "Edit payer policy or scheme", icon: "shield-check", body: businessPolicyFields(recordId), submit: "Update payer agreement" },
        claim: { title: "Record aggregate claim batch", icon: "files", body: businessClaimFields(), submit: "Save claim batch" },
        claimUpdate: { title: "Update claim settlement", icon: "badge-indian-rupee", body: businessClaimUpdateFields(recordId), submit: "Update settlement" },
    };
    const config = forms[kind];
    if (!config) return;
    modal.innerHTML = `<div class="business-modal-backdrop" onclick="closeBusinessModal(event)"><section class="business-modal" role="dialog" aria-modal="true" aria-labelledby="businessModalTitle"><header><span><i data-lucide="${config.icon}"></i></span><div><h2 id="businessModalTitle">${config.title}</h2><p>Required fields are marked with an asterisk.</p></div><button type="button" onclick="closeBusinessModal()" aria-label="Close"><i data-lucide="x"></i></button></header><form id="businessForm" data-kind="${kind}" data-record-id="${recordId || ""}" onsubmit="submitBusinessForm(event)"><div class="business-form-grid">${config.body}</div><div id="businessFormError" class="business-form-error" hidden></div><footer><button type="button" onclick="closeBusinessModal()">Cancel</button><button class="business-primary" type="submit"><i data-lucide="check"></i> ${config.submit}</button></footer></form></section></div>`;
    if (window.lucide) lucide.createIcons();
    modal.querySelector("input, select, textarea")?.focus();
}

function businessBudgetFields() { return `${businessField("Fiscal year *", "fiscal_year", "text", businessFiscalYear(), "e.g. 2026-27")}${businessField("Department / scope *", "department", "text", "Hospital-wide")}${businessField("Budget category *", "category", "text", "", "Equipment, maintenance, utilities…")}${businessField("Allocated amount (INR) *", "allocated_amount", "number", "", "", "min=\"0\" step=\"0.01\"")}${businessTextarea("Notes", "notes", "Purpose, restrictions or approval reference", true)}${businessSelect("Status *", "status", [["Active", "Active"], ["Closed", "Closed"]])}`; }
function businessPurchaseFields() { const budgets = businessData?.budgets || []; return `${businessSelect("Budget line", "budget_id", [["", "Not linked"], ...budgets.map(item => [item.id, `${item.fiscal_year} · ${item.department} · ${item.category}`])])}${businessField("Department *", "department", "text", localStorage.getItem("department") || "")}${businessField("Category *", "category", "text", "", "Equipment, supplies, utilities…")}${businessField("Item or service *", "item_name", "text")}${businessTextarea("Specification", "specification", "What exactly is required?")}${businessField("Proposed vendor", "vendor_name", "text")}${businessField("Quantity *", "quantity", "number", "1", "", "min=\"0.01\" step=\"0.01\"")}${businessField("Unit *", "unit", "text", "units")}${businessField("Unit cost (INR) *", "unit_cost", "number", "", "", "min=\"0\" step=\"0.01\"")}${businessSelect("Priority *", "priority", [["Low", "Low"], ["Normal", "Normal"], ["High", "High"], ["Urgent", "Urgent"]], "Normal")}${businessTextarea("Business justification *", "justification", "Why is this purchase needed and what happens if it is delayed?", true)}`; }
function businessVendorFields(id = null) { const item = (businessData?.vendors || []).find(row => row.id === Number(id)) || {}; return `${businessField("Vendor code *", "vendor_code", "text", item.vendor_code || "", "e.g. VEN-001")}${businessField("Vendor name *", "vendor_name", "text", item.vendor_name || "")}${businessField("Supplier type *", "supplier_type", "text", item.supplier_type || "General", "Medical equipment, pharmacy, services…")}${businessField("Tax / GST identifier", "tax_identifier", "text", item.tax_identifier || "")}${businessField("Contact person", "contact_person", "text", item.contact_person || "")}${businessField("Phone", "phone", "tel", item.phone || "")}${businessField("Email", "email", "email", item.email || "")}${businessField("Payment terms (days) *", "payment_terms_days", "number", item.payment_terms_days ?? 30, "", "min=\"0\" max=\"365\"")}${businessField("Bank name", "bank_name", "text", item.bank_name || "")}${businessField("Bank account reference", "bank_account_reference", "text", item.bank_account_reference || "")}${businessSelect("Status *", "status", [["Active", "Active"], ["Blocked", "Blocked"], ["Inactive", "Inactive"]], item.status || "Active")}${businessTextarea("Address", "address", "Registered business address", true, item.address || "")}${businessTextarea("Notes", "notes", "Supply categories, restrictions or verification details", true, item.notes || "")}`; }
function businessQuotationFields(purchaseId) { const purchase = (businessData?.purchases || []).find(row => row.id === Number(purchaseId)); const vendors = (businessData?.vendors || []).filter(row => row.status === "Active"); return `<div class="business-form-context"><strong>${businessEscape(purchase?.request_number || "Purchase")}</strong><span>${businessEscape(purchase?.item_name || "")} · ${businessNumber(purchase?.quantity || 0)} ${businessEscape(purchase?.unit || "")}</span></div>${businessSelect("Vendor *", "vendor_id", vendors.map(item => [item.id, `${item.vendor_code} · ${item.vendor_name}`]))}${businessField("Quotation number *", "quote_number", "text")}${businessField("Quotation date *", "quote_date", "date", new Date().toISOString().slice(0, 10))}${businessField("Valid until", "valid_until", "date")}${businessField("Quantity *", "quantity", "number", purchase?.quantity || 1, "", "min=\"0.001\" step=\"0.001\"")}${businessField("Unit price (INR) *", "unit_price", "number", "", "", "min=\"0\" step=\"0.01\"")}${businessField("Tax amount", "tax_amount", "number", "0", "", "min=\"0\" step=\"0.01\"")}${businessField("Discount", "discount_amount", "number", "0", "", "min=\"0\" step=\"0.01\"")}${businessField("Freight / delivery", "freight_amount", "number", "0", "", "min=\"0\" step=\"0.01\"")}${businessField("Delivery days", "delivery_days", "number", "0", "", "min=\"0\"")}${businessField("Warranty months", "warranty_months", "number", "0", "", "min=\"0\"")}${businessField("Payment terms", "payment_terms", "text")}${businessTextarea("Notes", "notes", "Technical deviations or commercial conditions", true)}`; }
function businessInvoiceFields() { const vendors = businessData?.vendors || []; const purchases = (businessData?.purchases || []).filter(item => ["Approved", "Ordered", "Received"].includes(item.status)); const quotations = (businessData?.quotations || []).filter(item => item.status === "Selected"); return `${businessSelect("Purchase request *", "purchase_id", purchases.map(item => [item.id, `${item.request_number} · ${item.item_name}`]))}${businessSelect("Vendor *", "vendor_id", vendors.map(item => [item.id, `${item.vendor_code} · ${item.vendor_name}`]))}${businessSelect("Selected quotation", "quotation_id", [["", "Not linked"], ...quotations.map(item => [item.id, `${item.quote_number} · ${item.vendor_name}`])])}${businessField("Invoice number *", "invoice_number", "text")}${businessField("Invoice date *", "invoice_date", "date", new Date().toISOString().slice(0, 10))}${businessField("Due date *", "due_date", "date")}${businessField("Subtotal (INR) *", "subtotal_amount", "number", "", "", "min=\"0\" step=\"0.01\"")}${businessField("Tax amount", "tax_amount", "number", "0", "", "min=\"0\" step=\"0.01\"")}${businessField("Discount", "discount_amount", "number", "0", "", "min=\"0\" step=\"0.01\"")}${businessTextarea("Notes", "notes", "Invoice description, delivery reference or exception", true)}`; }
function businessPaymentFields(invoiceId) { const item = (businessData?.invoices || []).find(row => row.id === Number(invoiceId)); return `<div class="business-form-context"><strong>${businessEscape(item?.invoice_number || "Invoice")}</strong><span>${businessEscape(item?.vendor_name || "")} · Outstanding ${businessMoney(item?.outstanding_amount)}</span></div>${businessField("Payment amount (INR) *", "amount", "number", item?.outstanding_amount || "", "", `min=\"0.01\" max=\"${Number(item?.outstanding_amount || 0)}\" step=\"0.01\"`)}${businessField("Requested payment date *", "requested_payment_date", "date", new Date().toISOString().slice(0, 10))}${businessTextarea("Request note", "request_note", "Reason, instalment description or supporting reference", true)}`; }
function businessPaymentCompletionFields(paymentId) { const item = (businessData?.payments || []).find(row => row.id === Number(paymentId)); return `<div class="business-form-context"><strong>${businessEscape(item?.reference_number || "Payment")}</strong><span>${businessEscape(item?.vendor_name || "")} · ${businessMoney(item?.amount)}</span></div>${businessField("Paid date *", "paid_date", "date", new Date().toISOString().slice(0, 10))}${businessField("Payment method *", "payment_method", "text", "Bank transfer")}${businessField("Bank / payment reference *", "bank_reference", "text")}`; }
function businessTransactionFields() { const budgets = businessData?.budgets || []; return `${businessSelect("Budget line", "budget_id", [["", "Not linked"], ...budgets.map(item => [item.id, `${item.fiscal_year} · ${item.department} · ${item.category}`])])}${businessSelect("Transaction type *", "transaction_type", [["Expense", "Expense"], ["Insurance Receipt", "Insurance receipt"], ["Other Income", "Other institutional income"]])}${businessField("Category *", "category", "text")}${businessField("Department *", "department", "text", "Hospital-wide")}${businessField("Counterparty", "counterparty", "text", "", "Vendor, insurer or other party")}${businessTextarea("Description *", "description", "Purpose and supporting reference", true)}${businessField("Amount (INR) *", "amount", "number", "", "", "min=\"0.01\" step=\"0.01\"")}${businessField("Transaction date *", "transaction_date", "date", new Date().toISOString().slice(0, 10))}${businessSelect("Status *", "status", [["Pending", "Pending"], ["Approved", "Approved"], ["Paid", "Paid"], ["Received", "Received"]], "Paid")}${businessField("Payment method", "payment_method", "text")}${businessField("Invoice / bank reference", "invoice_number", "text")}`; }
function businessPolicyFields(id = null) { const item = (businessData?.policies || []).find(row => row.id === Number(id)) || {}; return `${businessField("Payer / provider name *", "provider_name", "text", item.provider_name || "")}${businessField("Policy or scheme name *", "policy_name", "text", item.policy_name || "")}${businessField("Policy / scheme code *", "policy_code", "text", item.policy_code || "")}${businessSelect("Payer type *", "payer_type", [["Government Scheme", "Government scheme"], ["Private Insurer", "Private insurer"], ["TPA", "Third-party administrator"], ["Corporate", "Corporate payer"], ["Other", "Other"]], item.payer_type || "Government Scheme")}${businessSelect("Coverage model *", "coverage_model", [["Cashless", "Cashless"], ["Reimbursement", "Reimbursement"], ["Package Rate", "Package rate"], ["Mixed", "Mixed"]], item.coverage_model || "Cashless")}${businessField("Valid from *", "valid_from", "date", item.valid_from || "")}${businessField("Valid to *", "valid_to", "date", item.valid_to || "")}${businessField("Claim submission window (days) *", "claim_submission_days", "number", item.claim_submission_days ?? "30", "", "min=\"0\"")}${businessField("Payment due (days) *", "payment_due_days", "number", item.payment_due_days ?? "30", "", "min=\"0\"")}${businessSelect("Status *", "status", [["Active", "Active"], ["Expired", "Expired"], ["Suspended", "Suspended"]], item.status || "Active")}${businessField("Contact person", "contact_person", "text", item.contact_person || "")}${businessField("Contact email", "contact_email", "email", item.contact_email || "")}${businessField("Contact phone", "contact_phone", "tel", item.contact_phone || "")}${businessTextarea("Notes", "notes", "Coverage, exclusions, escalation or portal details", true, item.notes || "")}`; }
function businessClaimFields() { const policies = businessData?.policies || []; return `${businessField("Batch reference *", "batch_reference", "text", "", "Hospital or payer batch number")}${businessSelect("Payer policy / scheme *", "policy_id", policies.map(item => [item.id, `${item.provider_name} · ${item.policy_name}`]))}${businessField("Service period start *", "service_period_start", "date")}${businessField("Service period end *", "service_period_end", "date")}${businessField("Number of claims *", "claim_count", "number", "0", "", "min=\"0\"")}${businessField("Claimed amount (INR) *", "claimed_amount", "number", "0", "", "min=\"0\" step=\"0.01\"")}${businessField("Approved amount (INR)", "approved_amount", "number", "0", "", "min=\"0\" step=\"0.01\"")}${businessField("Amount received (INR)", "received_amount", "number", "0", "", "min=\"0\" step=\"0.01\"")}${businessSelect("Status *", "status", [["Draft", "Draft"], ["Submitted", "Submitted"], ["Queried", "Queried"], ["Approved", "Approved"], ["Partially Paid", "Partially paid"], ["Paid", "Paid"], ["Rejected", "Rejected"]])}${businessField("Expected payment date", "expected_payment_date", "date")}${businessTextarea("Query reason", "query_reason", "Reason for payer query, if any")}${businessTextarea("Notes", "notes", "Submission or settlement notes", true)}`; }
function businessClaimUpdateFields(id) { const item = (businessData?.claims || []).find(row => row.id === Number(id)); if (!item) return ""; return `<div class="business-form-context"><strong>${businessEscape(item.batch_reference)}</strong><span>${businessEscape(item.provider_name)} · Claimed ${businessMoney(item.claimed_amount)}</span></div>${businessField("Approved amount (INR) *", "approved_amount", "number", item.approved_amount, "", `min=\"0\" max=\"${Number(item.claimed_amount)}\" step=\"0.01\"`)}${businessField("Amount received (INR) *", "received_amount", "number", item.received_amount, "", `min=\"0\" max=\"${Number(item.claimed_amount)}\" step=\"0.01\"`)}${businessSelect("Status *", "status", [["Draft", "Draft"], ["Submitted", "Submitted"], ["Queried", "Queried"], ["Approved", "Approved"], ["Partially Paid", "Partially paid"], ["Paid", "Paid"], ["Rejected", "Rejected"]], item.status)}${businessField("Expected payment date", "expected_payment_date", "date", item.expected_payment_date || "")}${businessTextarea("Query reason", "query_reason", "", false, item.query_reason || "")}${businessTextarea("Notes", "notes", "", true, item.notes || "")}`; }

function businessField(label, name, type = "text", value = "", placeholder = "", extra = "") { return `<label><span>${label}</span><input name="${name}" type="${type}" value="${businessEscape(value)}" placeholder="${businessEscape(placeholder)}" ${label.includes("*") ? "required" : ""} ${extra}></label>`; }
function businessSelect(label, name, options, selected = "") { return `<label><span>${label}</span><select name="${name}" ${label.includes("*") ? "required" : ""}>${options.map(([value, text]) => `<option value="${businessEscape(value)}" ${String(value) === String(selected) ? "selected" : ""}>${businessEscape(text)}</option>`).join("")}</select></label>`; }
function businessTextarea(label, name, placeholder = "", wide = false, value = "") { return `<label class="${wide ? "is-wide" : ""}"><span>${label}</span><textarea name="${name}" placeholder="${businessEscape(placeholder)}" ${label.includes("*") ? "required" : ""}>${businessEscape(value)}</textarea></label>`; }

async function submitBusinessForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const kind = form.dataset.kind;
    const recordId = form.dataset.recordId;
    const button = form.querySelector("button[type='submit']");
    const errorBox = document.getElementById("businessFormError");
    const payload = Object.fromEntries(new FormData(form).entries());
    ["budget_id", "claim_submission_days", "payment_due_days", "policy_id", "claim_count", "vendor_id", "purchase_id", "quotation_id", "delivery_days", "warranty_months"].forEach(key => { if (key in payload && payload[key] !== "") payload[key] = Number(payload[key]); });
    if (payload.budget_id === "") payload.budget_id = null;
    if (payload.quotation_id === "") payload.quotation_id = null;
    if (payload.valid_until === "") payload.valid_until = null;
    if (payload.expected_payment_date === "") payload.expected_payment_date = null;
    const routes = { budget: ["POST", "/api/business/budgets"], purchase: ["POST", "/api/business/purchases"], vendor: ["POST", "/api/business/vendors"], vendorUpdate: ["PUT", `/api/business/vendors/${recordId}`], quotation: ["POST", `/api/business/purchases/${recordId}/quotations`], invoice: ["POST", "/api/business/invoices"], payment: ["POST", `/api/business/invoices/${recordId}/payments`], paymentComplete: ["PATCH", `/api/business/payments/${recordId}/complete`], transaction: ["POST", "/api/business/transactions"], policy: ["POST", "/api/business/policies"], policyUpdate: ["PUT", `/api/business/policies/${recordId}`], claim: ["POST", "/api/business/claims"], claimUpdate: ["PATCH", `/api/business/claims/${recordId}`] };
    const [method, endpoint] = routes[kind];
    button.disabled = true;
    errorBox.hidden = true;
    try {
        const response = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(businessErrorMessage(result.detail));
        closeBusinessModal();
        businessNotify("success", "Saved", "Business Office records and calculations have been updated.");
        await loadBusinessPortal();
    } catch (error) {
        errorBox.textContent = error.message;
        errorBox.hidden = false;
    } finally { button.disabled = false; }
}

function evaluateBusinessQuotations(quotations, weights = businessQuoteWeights) {
    if (!quotations.length) return [];
    const totalWeight = Object.values(weights).reduce((sum, value) => sum + Math.max(Number(value) || 0, 0), 0) || 1;
    const totals = quotations.map(item => Math.max(Number(item.total_amount) || 0, 0));
    const warranties = quotations.map(item => Math.max(Number(item.warranty_months) || 0, 0));
    const deliveries = quotations.map(item => Math.max(Number(item.delivery_days) || 0, 0));
    const terms = quotations.map(item => Math.max(Number(item.vendor_payment_terms_days) || 0, 0));
    const minimumTotal = Math.min(...totals);
    const maximumWarranty = Math.max(...warranties);
    const minimumDelivery = Math.min(...deliveries);
    const maximumTerms = Math.max(...terms);
    const scored = quotations.map(item => {
        const total = Math.max(Number(item.total_amount) || 0, 0);
        const warranty = Math.max(Number(item.warranty_months) || 0, 0);
        const delivery = Math.max(Number(item.delivery_days) || 0, 0);
        const paymentTerms = Math.max(Number(item.vendor_payment_terms_days) || 0, 0);
        const criteria = {
            price: total === 0 && minimumTotal === 0 ? 100 : (total === 0 ? 0 : minimumTotal / total * 100),
            warranty: maximumWarranty === 0 ? 100 : warranty / maximumWarranty * 100,
            delivery: (minimumDelivery + 1) / (delivery + 1) * 100,
            payment_terms: maximumTerms === 0 ? 100 : paymentTerms / maximumTerms * 100
        };
        const score = Object.entries(criteria).reduce((sum, [key, value]) => sum + value * Math.max(Number(weights[key]) || 0, 0), 0) / totalWeight;
        const reasons = [];
        if (total === minimumTotal) reasons.push("lowest price");
        if (warranty === maximumWarranty) reasons.push("longest warranty");
        if (delivery === minimumDelivery) reasons.push("fastest delivery");
        if (paymentTerms === maximumTerms) reasons.push("best payment credit");
        const dominatesCount = quotations.filter(other => {
            if (other.id === item.id) return false;
            const otherTotal = Math.max(Number(other.total_amount) || 0, 0);
            const otherWarranty = Math.max(Number(other.warranty_months) || 0, 0);
            const otherDelivery = Math.max(Number(other.delivery_days) || 0, 0);
            const otherTerms = Math.max(Number(other.vendor_payment_terms_days) || 0, 0);
            const noWorse = total <= otherTotal && warranty >= otherWarranty && delivery <= otherDelivery && paymentTerms >= otherTerms;
            return noWorse && (total < otherTotal || warranty > otherWarranty || delivery < otherDelivery || paymentTerms > otherTerms);
        }).length;
        return { ...item, evaluation_score: score, criteria_scores: criteria, evaluation_reasons: reasons, dominates_count: dominatesCount };
    });
    scored.sort((left, right) => right.evaluation_score - left.evaluation_score || Number(left.total_amount) - Number(right.total_amount) || Number(right.warranty_months) - Number(left.warranty_months));
    return scored.map((item, index) => ({ ...item, evaluation_rank: index + 1, is_recommended: index === 0 }));
}

function updateBusinessQuoteWeight(purchaseId, key, value) {
    if (!(key in businessQuoteWeights)) return;
    businessQuoteWeights[key] = Math.max(Number(value) || 0, 0);
    openQuotationComparison(purchaseId);
}

function resetBusinessQuoteWeights(purchaseId) {
    businessQuoteWeights = { ...businessQuoteDefaultWeights };
    openQuotationComparison(purchaseId);
}

function openQuotationComparison(purchaseId) {
    const purchase = (businessData?.purchases || []).find(row => row.id === Number(purchaseId));
    const quotations = (businessData?.quotations || []).filter(row => row.purchase_id === Number(purchaseId));
    const evaluated = evaluateBusinessQuotations(quotations);
    const best = evaluated[0];
    const runnerUp = evaluated[1];
    const advantage = best && runnerUp && runnerUp.evaluation_score > 0 ? (best.evaluation_score - runnerUp.evaluation_score) / runnerUp.evaluation_score * 100 : 0;
    const role = String(localStorage.getItem("role") || "").toLowerCase();
    const isManager = ["manager", "admin"].includes(role);
    const modal = document.getElementById("businessModal");
    if (!purchase || !modal) return;
    const recommendation = best ? `<section class="business-quote-recommendation"><div class="business-quote-score"><span>${best.evaluation_score.toFixed(1)}</span><small>/ 100</small></div><div><span class="business-recommendation-label"><i data-lucide="sparkles"></i> Best overall value</span><h3>${businessEscape(best.vendor_name)}</h3><p>${runnerUp ? `<strong>${advantage.toFixed(1)}% stronger overall</strong> than ${businessEscape(runnerUp.vendor_name)} under the priorities below.` : "Add another quotation to calculate a relative advantage."} ${best.evaluation_reasons.length ? `Strongest on ${businessEscape(best.evaluation_reasons.join(", "))}.` : "The recommendation is based on the combined weighted score."}</p>${best.dominates_count ? `<small>This quotation is no worse on every measured criterion and is better on at least one criterion than ${best.dominates_count} other quotation${best.dominates_count === 1 ? "" : "s"}.</small>` : ""}</div></section>` : `<section class="business-quote-recommendation is-empty"><div><h3>No recommendation yet</h3><p>Add at least two supplier quotations to compare their value.</p></div></section>`;
    const controls = [["price", "Price"], ["warranty", "Warranty"], ["delivery", "Delivery speed"], ["payment_terms", "Payment credit"]].map(([key, label]) => `<label><span>${label}</span><input type="number" min="0" max="100" step="5" value="${businessQuoteWeights[key]}" onchange="updateBusinessQuoteWeight(${purchase.id}, '${key}', this.value)"><small>weight</small></label>`).join("");
    const rows = evaluated.length ? evaluated.map(item => `<tr class="${item.is_recommended ? "is-recommended-quote" : (item.is_lowest ? "is-best-quote" : "")}"><td><span class="business-quote-rank">#${item.evaluation_rank}</span><strong>${businessEscape(item.vendor_name)}</strong>${item.is_recommended ? "<small class=\"business-best-label\">Recommended best value</small>" : (item.is_lowest ? "<small>Lowest price</small>" : "")}</td><td>${businessEscape(item.quote_number)}<small>${businessDate(item.quote_date)}</small></td><td><strong>${businessMoney(item.total_amount)}</strong><small>${businessMoney(item.unit_price)} each · Score ${item.criteria_scores.price.toFixed(0)}</small></td><td>${item.delivery_days} days<small>Score ${item.criteria_scores.delivery.toFixed(0)}</small></td><td>${item.warranty_months} months<small>Score ${item.criteria_scores.warranty.toFixed(0)}</small></td><td>${item.vendor_payment_terms_days} days<small>Score ${item.criteria_scores.payment_terms.toFixed(0)} · ${businessEscape(item.payment_terms || "Vendor credit period")}</small></td><td><strong class="business-value-score">${item.evaluation_score.toFixed(1)}</strong><small>${item.evaluation_reasons.length ? businessEscape(item.evaluation_reasons.join(" · ")) : "Weighted value"}</small></td><td><span class="business-action-stack">${isManager && item.status !== "Selected" ? `<button class="business-row-action" type="button" onclick="selectBusinessQuotation(${item.id}, ${purchase.id})">Select</button>` : `<span class="business-status is-${businessStatusClass(item.status)}">${businessEscape(item.status)}</span>`}<button class="business-row-action" type="button" onclick="openBusinessDocuments('quotation', ${item.id})">Documents</button></span></td></tr>`).join("") : businessTableEmpty(8, "No quotations collected", "Add at least one supplier quotation for comparison.");
    modal.innerHTML = `<div class="business-modal-backdrop" onclick="closeBusinessModal(event)"><section class="business-modal business-comparison-modal" role="dialog" aria-modal="true"><header><span><i data-lucide="scale"></i></span><div><h2>Quotation value comparison</h2><p>${businessEscape(purchase.request_number)} · ${businessEscape(purchase.item_name)}</p></div><button type="button" onclick="closeBusinessModal()"><i data-lucide="x"></i></button></header><div class="business-comparison-toolbar"><div><strong>${quotations.length} quotation${quotations.length === 1 ? "" : "s"} evaluated</strong><small>Ranked by price, warranty, delivery speed and supplier credit terms.</small></div><button class="business-primary" type="button" onclick="openBusinessForm('quotation', ${purchase.id})"><i data-lucide="plus"></i> Add quotation</button></div>${recommendation}<section class="business-quote-weights"><div><strong>Evaluation priorities</strong><small>Change the weights to match this purchase. The score recalculates immediately.</small></div><div class="business-weight-grid">${controls}</div><button type="button" onclick="resetBusinessQuoteWeights(${purchase.id})">Reset balanced weights</button></section><div class="business-quote-safety"><i data-lucide="shield-alert"></i><span><strong>Decision support, not automatic approval.</strong> Confirm that every quotation meets the clinical and technical specification before selecting the commercial recommendation.</span></div><div class="business-table-scroll"><table class="business-table business-quote-table"><thead><tr><th>Rank & vendor</th><th>Quotation</th><th>Total price</th><th>Delivery</th><th>Warranty</th><th>Credit terms</th><th>Value score</th><th>Decision</th></tr></thead><tbody>${rows}</tbody></table></div></section></div>`;
    if (window.lucide) lucide.createIcons();
}

async function selectBusinessQuotation(id, purchaseId) {
    try {
        const response = await fetch(`/api/business/quotations/${id}/select`, { method: "PATCH" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(businessErrorMessage(result.detail));
        businessNotify("success", "Quotation selected", "The chosen vendor and exact purchase value have been applied to the request.");
        await loadBusinessPortal();
        openQuotationComparison(purchaseId);
    } catch (error) { businessNotify("error", "Quotation not selected", error.message); }
}

function openInvoiceReview(id) {
    const item = (businessData?.invoices || []).find(row => row.id === Number(id));
    const modal = document.getElementById("businessModal");
    if (!item || !modal) return;
    modal.innerHTML = `<div class="business-modal-backdrop" onclick="closeBusinessModal(event)"><section class="business-modal business-review-modal" role="dialog" aria-modal="true"><header><span><i data-lucide="receipt-text"></i></span><div><h2>Review invoice ${businessEscape(item.invoice_number)}</h2><p>${businessEscape(item.vendor_name)} · ${businessEscape(item.request_number)}</p></div><button type="button" onclick="closeBusinessModal()"><i data-lucide="x"></i></button></header><div class="business-review-detail"><div><small>Invoice total</small><strong>${businessMoney(item.total_amount)}</strong><span>Subtotal ${businessMoney(item.subtotal_amount)} · Tax ${businessMoney(item.tax_amount)}</span></div><div><small>Due date</small><strong>${businessDate(item.due_date)}</strong><span>${businessEscape(item.notes || "No notes")}</span></div></div><div class="business-form-grid business-review-fields">${businessField("Approved amount (INR) *", "approved_amount", "number", item.total_amount, "", `min=\"0\" max=\"${Number(item.total_amount)}\" step=\"0.01\"`)}${businessTextarea("Decision note", "note", "Matching result, exception or rejection reason", true)}</div><div id="businessFormError" class="business-form-error" hidden></div><footer><button class="business-reject" type="button" onclick="decideBusinessInvoice(${item.id}, 'Rejected')">Reject</button><button type="button" onclick="decideBusinessInvoice(${item.id}, 'Disputed')">Dispute</button><button class="business-primary" type="button" onclick="decideBusinessInvoice(${item.id}, 'Approved')">Approve invoice</button></footer></section></div>`;
    if (window.lucide) lucide.createIcons();
}

async function decideBusinessInvoice(id, decision) {
    const amount = document.querySelector("[name='approved_amount']")?.value || "0";
    const note = document.querySelector("[name='note']")?.value.trim() || "";
    try {
        const response = await fetch(`/api/business/invoices/${id}/decision`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, approved_amount: amount, note }) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(businessErrorMessage(result.detail));
        closeBusinessModal();
        businessNotify(decision === "Approved" ? "success" : "warning", `Invoice ${decision.toLowerCase()}`, "The decision and approved amount are recorded in the audit trail.");
        await loadBusinessPortal();
    } catch (error) { const box = document.getElementById("businessFormError"); if (box) { box.textContent = error.message; box.hidden = false; } }
}

function openPaymentReview(id) {
    const item = (businessData?.payments || []).find(row => row.id === Number(id));
    const modal = document.getElementById("businessModal");
    if (!item || !modal) return;
    modal.innerHTML = `<div class="business-modal-backdrop" onclick="closeBusinessModal(event)"><section class="business-modal business-review-modal" role="dialog" aria-modal="true"><header><span><i data-lucide="hand-coins"></i></span><div><h2>Review payment request</h2><p>${businessEscape(item.reference_number)} · ${businessEscape(item.vendor_name)}</p></div><button type="button" onclick="closeBusinessModal()"><i data-lucide="x"></i></button></header><div class="business-review-detail"><div><small>Requested amount</small><strong>${businessMoney(item.amount)}</strong><span>Invoice ${businessEscape(item.invoice_number)}</span></div><div><small>Requested date</small><strong>${businessDate(item.requested_payment_date)}</strong><span>${businessEscape(item.request_note || "No request note")}</span></div></div><label class="business-review-note"><span>Approval note</span><textarea id="paymentDecisionNote" placeholder="Approval conditions or rejection reason"></textarea></label><div id="businessFormError" class="business-form-error" hidden></div><footer><button class="business-reject" type="button" onclick="decideBusinessPayment(${item.id}, 'Rejected')">Reject</button><button class="business-primary" type="button" onclick="decideBusinessPayment(${item.id}, 'Approved')">Approve payment</button></footer></section></div>`;
    if (window.lucide) lucide.createIcons();
}

async function decideBusinessPayment(id, decision) {
    const note = document.getElementById("paymentDecisionNote")?.value.trim() || "";
    try {
        const response = await fetch(`/api/business/payments/${id}/decision`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, note }) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(businessErrorMessage(result.detail));
        closeBusinessModal();
        businessNotify(decision === "Approved" ? "success" : "warning", `Payment ${decision.toLowerCase()}`, "The approval decision has been recorded.");
        await loadBusinessPortal();
    } catch (error) { const box = document.getElementById("businessFormError"); if (box) { box.textContent = error.message; box.hidden = false; } }
}

async function openBusinessDocuments(recordType, recordId) {
    const modal = document.getElementById("businessModal");
    if (!modal) return;
    modal.innerHTML = `<div class="business-modal-backdrop" onclick="closeBusinessModal(event)"><section class="business-modal business-review-modal" role="dialog" aria-modal="true"><header><span><i data-lucide="paperclip"></i></span><div><h2>Supporting documents</h2><p>Compressed and stored securely with this business record.</p></div><button type="button" onclick="closeBusinessModal()"><i data-lucide="x"></i></button></header><div class="business-loading"><span></span><strong>Loading documents</strong></div></section></div>`;
    try {
        const response = await fetch(`/api/business/documents/${recordType}/${recordId}`, { cache: "no-store" });
        const documents = await response.json().catch(() => []);
        if (!response.ok) throw new Error(businessErrorMessage(documents.detail));
        const section = modal.querySelector("section");
        section.innerHTML = `<header><span><i data-lucide="paperclip"></i></span><div><h2>Supporting documents</h2><p>${documents.length} file${documents.length === 1 ? "" : "s"} attached.</p></div><button type="button" onclick="closeBusinessModal()"><i data-lucide="x"></i></button></header><form class="business-document-upload" onsubmit="uploadBusinessDocument(event, '${recordType}', ${recordId})"><div>${businessSelect("Document type *", "document_type", [["Quotation", "Quotation"], ["Invoice", "Invoice"], ["Purchase Order", "Purchase order"], ["Delivery Note", "Delivery note"], ["Receipt", "Receipt"], ["Contract", "Contract"], ["Tax Document", "Tax document"], ["Other", "Other"]])}${businessField("PDF or image *", "file", "file", "", "", "accept=\".pdf,.jpg,.jpeg,.png\"")}</div><button class="business-primary" type="submit"><i data-lucide="upload"></i> Upload</button></form><div class="business-document-list">${documents.length ? documents.map(item => `<article><span><i data-lucide="file-check-2"></i></span><div><strong>${businessEscape(item.original_name)}</strong><small>${businessEscape(item.document_type)} · ${Math.ceil(Number(item.stored_size_bytes || 0) / 1024)} KB · ${businessDate(item.uploaded_at)}</small></div><a href="${businessEscape(item.download_url)}"><i data-lucide="download"></i> Download</a><button type="button" onclick="deleteBusinessDocument(${item.id}, '${recordType}', ${recordId})"><i data-lucide="trash-2"></i></button></article>`).join("") : businessInlineEmpty("No supporting documents have been uploaded.")}</div><div id="businessFormError" class="business-form-error" hidden></div>`;
        if (window.lucide) lucide.createIcons();
    } catch (error) { businessNotify("error", "Documents unavailable", error.message); closeBusinessModal(); }
}

async function uploadBusinessDocument(event, recordType, recordId) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type='submit']");
    const errorBox = document.getElementById("businessFormError");
    button.disabled = true;
    try {
        const response = await fetch(`/api/business/documents/${recordType}/${recordId}`, { method: "POST", body: new FormData(form) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(businessErrorMessage(result.detail));
        businessNotify("success", "Document uploaded", "The supporting file is compressed and stored with the record.");
        await loadBusinessPortal();
        await openBusinessDocuments(recordType, recordId);
    } catch (error) { errorBox.textContent = error.message; errorBox.hidden = false; } finally { button.disabled = false; }
}

async function deleteBusinessDocument(id, recordType, recordId) {
    try {
        const response = await fetch(`/api/business/documents/${id}`, { method: "DELETE" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(businessErrorMessage(result.detail));
        await loadBusinessPortal();
        await openBusinessDocuments(recordType, recordId);
    } catch (error) { businessNotify("error", "Document not deleted", error.message); }
}

function openPurchaseReview(id) {
    const item = (businessData?.purchases || []).find(row => row.id === Number(id));
    const modal = document.getElementById("businessModal");
    if (!item || !modal) return;
    modal.innerHTML = `<div class="business-modal-backdrop" onclick="closeBusinessModal(event)"><section class="business-modal business-review-modal" role="dialog" aria-modal="true"><header><span><i data-lucide="clipboard-check"></i></span><div><h2>Review ${businessEscape(item.request_number)}</h2><p>Administrator approval is recorded in the audit trail.</p></div><button type="button" onclick="closeBusinessModal()"><i data-lucide="x"></i></button></header><div class="business-review-detail"><div><small>Purchase</small><strong>${businessEscape(item.item_name)}</strong><span>${businessEscape(item.department)} · ${businessEscape(item.category)}</span></div><div><small>Total request</small><strong>${businessMoney(item.total_amount)}</strong><span>${businessNumber(item.quantity)} ${businessEscape(item.unit)} × ${businessMoney(item.unit_cost)}</span></div><div class="is-wide"><small>Justification</small><p>${businessEscape(item.justification)}</p></div></div><label class="business-review-note"><span>Decision note</span><textarea id="purchaseDecisionNote" placeholder="Add conditions, reasons or an approval reference"></textarea></label><div id="businessFormError" class="business-form-error" hidden></div><footer><button class="business-reject" type="button" onclick="decidePurchase(${item.id}, 'Rejected')"><i data-lucide="x"></i> Reject</button><button class="business-primary" type="button" onclick="decidePurchase(${item.id}, 'Approved')"><i data-lucide="check"></i> Approve purchase</button></footer></section></div>`;
    if (window.lucide) lucide.createIcons();
}

async function decidePurchase(id, decision) {
    const note = document.getElementById("purchaseDecisionNote")?.value.trim() || "";
    try {
        const response = await fetch(`/api/business/purchases/${id}/decision`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, note }) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(businessErrorMessage(result.detail));
        closeBusinessModal();
        businessNotify(decision === "Approved" ? "success" : "warning", `Purchase ${decision.toLowerCase()}`, "The decision is recorded and visible to the Business Office.");
        await loadBusinessPortal();
    } catch (error) { const box = document.getElementById("businessFormError"); if (box) { box.textContent = error.message; box.hidden = false; } }
}

function openPurchaseStatus(id, status) {
    const item = (businessData?.purchases || []).find(row => row.id === Number(id));
    const modal = document.getElementById("businessModal");
    if (!item || !modal) return;
    const paymentFields = status === "Paid" ? `${businessField("Payment method *", "payment_method", "text", "Bank transfer", "NEFT, cheque, bank transfer…")}${businessField("Invoice / bank reference", "invoice_number", "text")}` : "";
    modal.innerHTML = `<div class="business-modal-backdrop" onclick="closeBusinessModal(event)"><section class="business-modal business-review-modal" role="dialog" aria-modal="true"><header><span><i data-lucide="milestone"></i></span><div><h2>Mark purchase ${businessEscape(status)}</h2><p>${businessEscape(item.request_number)} · ${businessEscape(item.item_name)}</p></div><button type="button" onclick="closeBusinessModal()"><i data-lucide="x"></i></button></header><form onsubmit="advancePurchase(event, ${item.id}, '${status}')"><div class="business-form-grid">${paymentFields}${businessTextarea("Progress note", "note", "Add a delivery, receipt or payment note", true)}</div><div id="businessFormError" class="business-form-error" hidden></div><footer><button type="button" onclick="closeBusinessModal()">Cancel</button><button class="business-primary" type="submit"><i data-lucide="check"></i> Mark ${businessEscape(status)}</button></footer></form></section></div>`;
    if (window.lucide) lucide.createIcons();
}

async function advancePurchase(event, id, status) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    payload.status = status;
    payload.payment_method ||= "";
    payload.invoice_number ||= "";
    try {
        const response = await fetch(`/api/business/purchases/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(businessErrorMessage(result.detail));
        closeBusinessModal();
        businessNotify("success", "Purchase updated", status === "Paid" ? "Payment posted automatically to the institutional ledger." : `Purchase marked ${status.toLowerCase()}.`);
        await loadBusinessPortal();
    } catch (error) { const box = document.getElementById("businessFormError"); if (box) { box.textContent = error.message; box.hidden = false; } }
}

function closeBusinessModal(event) { if (event) return; const modal = document.getElementById("businessModal"); if (modal) modal.innerHTML = ""; }
function downloadBusinessReport() { window.location.href = "/api/business/report.csv"; }
function downloadVendorOutstanding() { window.location.href = "/api/business/vendor-outstanding.csv"; }
function businessFiscalYear() { const now = new Date(); const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; return `${year}-${String(year + 1).slice(-2)}`; }
function businessMoney(value) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0)); }
function businessNumber(value) { return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(value || 0)); }
function businessDate(value) { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? businessEscape(value) : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date); }
function businessStatusClass(value) { return String(value || "").toLowerCase().replaceAll(/[^a-z0-9]+/g, "-"); }
function businessErrorMessage(detail) { if (Array.isArray(detail)) return detail.map(item => item.msg || "Invalid value").join(" · "); return detail || "The record could not be saved."; }
function businessNotify(type, title, message) { const api = window.BioTrackToast; if (api && typeof api[type] === "function") api[type](title, message); else if (typeof window.notifyUser === "function") window.notifyUser(message, type, title); }
function businessEscape(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
;
/* source: dashboard_v2/views/storeRequestsView.js */
let engineerStoreData = { catalogue: [], calls: [], requests: [] };
let engineerStoreMode = "Internal";

function renderStoreRequests() {
    pageContent.innerHTML = `<main class="central-store-page engineer-store-page">
        <section class="store-hero is-engineer"><div><span class="store-eyebrow"><i data-lucide="package-plus"></i> Engineering supplies</span><h1>Spare-part requests</h1><p>Request an item already held by Central Store, or submit a new external requirement.</p></div><button class="store-primary" onclick="openSpareRequestEditor()"><i data-lucide="plus"></i>New request</button></section>
        <section class="store-kpis"><article><span class="is-blue"><i data-lucide="send"></i></span><div><small>Submitted</small><strong id="engStoreSubmitted">—</strong></div></article><article><span class="is-violet"><i data-lucide="package-search"></i></span><div><small>In progress</small><strong id="engStoreActive">—</strong></div></article><article><span class="is-amber"><i data-lucide="badge-check"></i></span><div><small>Awaiting confirmation</small><strong id="engStoreConfirm">—</strong></div></article><article><span class="is-green"><i data-lucide="circle-check-big"></i></span><div><small>Completed</small><strong id="engStoreDone">—</strong></div></article></section>
        <section class="store-workspace"><header class="engineer-store-header"><div><span>My team’s queue</span><h2>Requests and deliveries</h2></div><button class="store-refresh" onclick="loadEngineerStore(true)" aria-label="Refresh"><i data-lucide="refresh-cw"></i></button></header><div id="engineerStoreList" class="store-panel"><div class="store-loading"><i data-lucide="loader-circle"></i>Loading requests…</div></div></section>
    </main>`;
    if (window.lucide) lucide.createIcons();
    loadEngineerStore();
}

async function loadEngineerStore(showToast = false) {
    try {
        const [catalogueResponse, callsResponse, requestsResponse] = await Promise.all([fetch("/api/central-store/catalog", { cache: "no-store" }), fetch("/api/central-store/engineer-calls", { cache: "no-store" }), fetch("/api/central-store/my-requests", { cache: "no-store" })]);
        const [catalogue, calls, requests] = await Promise.all([catalogueResponse.json(), callsResponse.json(), requestsResponse.json()]);
        if (!catalogueResponse.ok || !callsResponse.ok || !requestsResponse.ok) throw new Error(catalogue.detail || calls.detail || requests.detail || "Unable to load requests.");
        engineerStoreData = { catalogue, calls, requests };
        const active = new Set(["Awaiting Procurement", "Ready", "Dispatched"]);
        const counters = { engStoreSubmitted: requests.filter(row => row.status === "Submitted").length, engStoreActive: requests.filter(row => active.has(row.status)).length, engStoreConfirm: requests.filter(row => row.status === "Awaiting Engineer Confirmation").length, engStoreDone: requests.filter(row => row.status === "Completed").length };
        Object.entries(counters).forEach(([id, value]) => { const element = document.getElementById(id); if (element) element.textContent = value; });
        renderEngineerStoreList();
        if (showToast) BioTrackToast.success("Requests refreshed", "Your engineering supply queue is up to date.");
    } catch (error) { const list = document.getElementById("engineerStoreList"); if (list) list.innerHTML = `<div class="store-empty"><i data-lucide="wifi-off"></i><h3>Requests unavailable</h3><p>${storeEscape(error.message)}</p></div>`; BioTrackToast.error("Unable to load requests", error.message); if (window.lucide) lucide.createIcons(); }
}

function renderEngineerStoreList() {
    const list = document.getElementById("engineerStoreList"); if (!list) return;
    const rows = engineerStoreData.requests || [];
    list.innerHTML = rows.length ? `<div class="engineer-request-list">${rows.map(request => `<article><span class="engineer-request-icon"><i data-lucide="${request.request_type === "External" ? "shopping-cart" : "package"}"></i></span><div class="engineer-request-main"><small>${storeEscape(request.request_number)} · ${storeEscape(request.request_type)}</small><h3>${storeEscape(request.item_name)}</h3><p>${Number(request.quantity)} ${storeEscape(request.unit)} · ${storeEscape(request.delivery_location)}</p></div><div class="engineer-request-progress"><span class="store-status is-${storeStatusClass(request.status)}">${storeEscape(request.status)}</span>${request.status === "Dispatched" ? `<small>${request.delivery_task?.status === "Accepted" ? "Ward Boy is delivering" : "Waiting for Ward Boy"}</small>` : ""}</div>${request.status === "Awaiting Engineer Confirmation" ? `<button class="store-primary" onclick="confirmSpareReceipt(${Number(request.id)})"><i data-lucide="badge-check"></i>Confirm received</button>` : ""}</article>`).join("")}</div>` : '<div class="store-empty"><i data-lucide="package-plus"></i><h3>No spare-part requests yet</h3><p>Create an internal or external request for Central Store.</p><button class="store-primary" onclick="openSpareRequestEditor()">Create request</button></div>';
    if (window.lucide) lucide.createIcons();
}

function openSpareRequestEditor() {
    engineerStoreMode = "Internal";
    const modal = document.createElement("div"); modal.id = "spareRequestEditor"; modal.className = "store-modal-backdrop";
    modal.innerHTML = `<section class="store-modal spare-request-modal" role="dialog" aria-modal="true" aria-labelledby="requestSpareTitle"><header><div><span>Send to Central Store</span><h2 id="requestSpareTitle">Request spare parts</h2></div><button onclick="closeSpareRequestEditor()" aria-label="Close"><i data-lucide="x"></i></button></header><div class="request-mode-switch"><button class="is-active" type="button" onclick="setSpareRequestMode('Internal',this)"><i data-lucide="warehouse"></i><b>Internal stock</b><small>Choose from Central Store</small></button><button type="button" onclick="setSpareRequestMode('External',this)"><i data-lucide="shopping-cart"></i><b>External item</b><small>Describe a new requirement</small></button></div><form id="spareRequestForm" onsubmit="submitSpareRequest(event)"><div id="spareRequestFields"></div><footer><button type="button" class="is-ghost" onclick="closeSpareRequestEditor()">Cancel</button><button class="store-primary" type="submit"><i data-lucide="send"></i>Send request</button></footer></form></section>`;
    document.body.appendChild(modal); renderSpareRequestFields(); if (window.lucide) lucide.createIcons();
}

function closeSpareRequestEditor() { document.getElementById("spareRequestEditor")?.remove(); }

function setSpareRequestMode(mode, button) { engineerStoreMode = mode; document.querySelectorAll(".request-mode-switch button").forEach(item => item.classList.toggle("is-active", item === button)); renderSpareRequestFields(); }

function renderSpareRequestFields() {
    const container = document.getElementById("spareRequestFields"); if (!container) return;
    const internal = engineerStoreMode === "Internal";
    const catalogueOptions = (engineerStoreData.catalogue || []).map(item => `<option value="${Number(item.id)}">${storeEscape(item.item_name)} — ${Number(item.current_stock)} ${storeEscape(item.unit)} (${storeEscape(item.stock_state)})</option>`).join("");
    const callOptions = (engineerStoreData.calls || []).map(call => `<option value="${Number(call.id)}">${storeEscape(call.ticket)} — ${storeEscape(call.equipment)}</option>`).join("");
    container.innerHTML = `<div class="store-form-grid">${internal ? `<label class="is-wide"><span>Central Store item *</span><select name="central_store_item_id" required><option value="">Select a spare part</option>${catalogueOptions}</select></label><label><span>Request reason *</span><select name="request_reason" required><option>General</option><option>Low Stock</option><option>Out of Stock</option></select></label>` : `<label><span>Spare-part name *</span><input name="item_name" required maxlength="240"></label><label><span>Preferred item code</span><input name="item_code" maxlength="80"></label><label><span>Category</span><input name="category" maxlength="120"></label><label><span>Manufacturer</span><input name="manufacturer" maxlength="160"></label><label class="is-wide"><span>Specification *</span><textarea name="specification" required maxlength="500" placeholder="Model, dimensions, compatibility and technical details"></textarea></label><input type="hidden" name="request_reason" value="External Item">`}<label><span>Quantity *</span><input type="number" name="quantity" min="1" value="1" required></label><label><span>Unit *</span><input name="unit" value="pieces" required></label><label><span>Priority *</span><select name="priority"><option>Low</option><option selected>Medium</option><option>High</option><option>Critical</option></select></label><label><span>Delivery location</span><input name="delivery_location" placeholder="Defaults to your engineering room"></label><label class="is-wide"><span>Related maintenance call</span><select name="linked_request_id"><option value="">No linked call</option>${callOptions}</select></label><label class="is-wide"><span>Notes / purpose</span><textarea name="notes" maxlength="1000" placeholder="Why this item is required"></textarea></label></div>`;
}

async function submitSpareRequest(event) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget));
    const payload = { request_type: engineerStoreMode, central_store_item_id: values.central_store_item_id ? Number(values.central_store_item_id) : null, item_name: values.item_name || "", item_code: values.item_code || "", category: values.category || "", manufacturer: values.manufacturer || "", specification: values.specification || "", quantity: Number(values.quantity), unit: values.unit, request_reason: values.request_reason, priority: values.priority, linked_request_id: values.linked_request_id ? Number(values.linked_request_id) : null, delivery_location: values.delivery_location || "", notes: values.notes || "" };
    try { const response = await fetch("/api/central-store/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.detail || "Unable to send request."); closeSpareRequestEditor(); BioTrackToast.success("Request sent", `${data.request.request_number} is now with Central Store.`); await loadEngineerStore(); } catch (error) { BioTrackToast.error("Request not sent", error.message); }
}

async function confirmSpareReceipt(requestId) {
    if (!window.confirm("Confirm that you received these spare parts?")) return;
    try { const response = await fetch(`/api/central-store/requests/${requestId}/confirm-receipt`, { method: "PATCH" }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.detail || "Unable to confirm receipt."); BioTrackToast.success("Receipt confirmed", "The spare-part request is now complete."); await loadEngineerStore(); } catch (error) { BioTrackToast.error("Receipt not confirmed", error.message); }
}
;
/* source: dashboard_v2/views/vendorsView.js */
const VENDOR_API = "/api/vendors";
let vendorContracts = [];

function vendorRoleTeam() {
    const role = normalizeDashboardRole(localStorage.getItem("role"));
    return role === "engineer" ? "Biomedical" : role === "electrical" ? "Electrical" : role === "it" ? "IT" : null;
}

function vendorIsAdmin() {
    return normalizeDashboardRole(localStorage.getItem("role")) === "admin";
}

function renderVendors() {
    pageContent.innerHTML = `
        <div class="vendors-page">
            <section class="vendors-hero">
                <div><span><i data-lucide="handshake"></i> Service partners</span><h1>Vendors & contracts</h1><p>Track AMC and CMC coverage, response commitments, renewals, contacts and service visits.</p></div>
                <button id="addVendorContract" type="button"><i data-lucide="file-plus-2"></i> Add contract</button>
            </section>
            <section class="vendor-kpis">
                <article><i data-lucide="files"></i><div><span>Total contracts</span><strong id="vendorTotal">0</strong></div></article>
                <article><i data-lucide="badge-check"></i><div><span>Active</span><strong id="vendorActive">0</strong></div></article>
                <article><i data-lucide="calendar-clock"></i><div><span>Renewal due</span><strong id="vendorRenewal">0</strong></div></article>
                <article><i data-lucide="history"></i><div><span>Service visits</span><strong id="vendorVisits">0</strong></div></article>
            </section>
            <section class="vendor-register">
                <header><div><span>Contract register</span><h2>Engineering service coverage</h2></div><label><i data-lucide="search"></i><input id="vendorSearch" type="search" placeholder="Search vendor, contract or contact"></label></header>
                <div class="vendor-table-wrap"><table class="vendor-table"><thead><tr><th>Vendor</th><th>Department</th><th>Contract</th><th>Response SLA</th><th>Renewal</th><th>Status</th><th>Actions</th></tr></thead><tbody id="vendorTableBody"><tr><td colspan="7">Loading contracts…</td></tr></tbody></table></div>
            </section>
        </div>`;
    document.getElementById("addVendorContract").addEventListener("click", () => openVendorContractModal());
    document.getElementById("vendorSearch").addEventListener("input", renderVendorTable);
    window.lucide?.createIcons();
    loadVendorContracts();
}

async function loadVendorContracts() {
    try {
        const response = await fetch(VENDOR_API);
        const data = await response.json().catch(() => []);
        if (!response.ok) throw new Error(data.detail || "Unable to load vendor contracts.");
        vendorContracts = Array.isArray(data) ? data : [];
        updateVendorMetrics();
        renderVendorTable();
    } catch (error) {
        document.getElementById("vendorTableBody").innerHTML = `<tr><td colspan="7" class="vendor-empty">${escapeHTML(error.message)}</td></tr>`;
    }
}

function updateVendorMetrics() {
    document.getElementById("vendorTotal").textContent = vendorContracts.length;
    document.getElementById("vendorActive").textContent = vendorContracts.filter(item => item.renewal_state === "Active").length;
    document.getElementById("vendorRenewal").textContent = vendorContracts.filter(item => ["Renewal due", "Expired"].includes(item.renewal_state)).length;
    document.getElementById("vendorVisits").textContent = vendorContracts.reduce((sum, item) => sum + item.service_history.length, 0);
}

function renderVendorTable() {
    const tbody = document.getElementById("vendorTableBody");
    if (!tbody) return;
    const search = (document.getElementById("vendorSearch")?.value || "").trim().toLowerCase();
    const items = vendorContracts.filter(item => [item.vendor_name, item.contract_number, item.contact_person, item.service_team].join(" ").toLowerCase().includes(search));
    if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="vendor-empty"><strong>No contracts found</strong><small>Add the first AMC or CMC agreement for this engineering team.</small></td></tr>';
        return;
    }
    tbody.innerHTML = items.map(item => `
        <tr>
            <td><div class="vendor-identity"><span>${escapeHTML(item.vendor_name.slice(0, 1).toUpperCase())}</span><div><strong>${escapeHTML(item.vendor_name)}</strong><small>${escapeHTML(item.contact_person || "No contact")} · ${escapeHTML(item.phone || item.email || "No details")}</small></div></div></td>
            <td><span class="vendor-team is-${item.service_team.toLowerCase()}">${escapeHTML(item.service_team)}</span></td>
            <td><div class="vendor-contract-cell"><strong>${escapeHTML(item.contract_type)}</strong><small>${escapeHTML(item.contract_number || "Number not set")}</small></div></td>
            <td><strong>${Number(item.response_sla_hours)} hours</strong></td>
            <td><div class="vendor-renewal"><strong>${new Date(`${item.end_date}T00:00:00`).toLocaleDateString()}</strong><small>${escapeHTML(item.renewal_state)}</small></div></td>
            <td><span class="vendor-state is-${item.renewal_state.toLowerCase().replaceAll(" ", "-")}">${escapeHTML(item.renewal_state)}</span></td>
            <td><div class="vendor-actions"><button type="button" onclick="openVendorHistory(${item.id})"><i data-lucide="history"></i> History</button><button type="button" onclick="openVendorContractModal(${item.id})"><i data-lucide="square-pen"></i> Edit</button></div></td>
        </tr>`).join("");
    window.lucide?.createIcons();
}

function vendorTeamOptions(selected) {
    return ["Biomedical", "Electrical", "IT"].map(team => `<option value="${team}" ${team === selected ? "selected" : ""}>${team}</option>`).join("");
}

function openVendorContractModal(id = null) {
    closeVendorModal();
    const item = vendorContracts.find(contract => contract.id === Number(id));
    const selectedTeam = item?.service_team || vendorRoleTeam() || "Biomedical";
    const modal = document.createElement("div");
    modal.id = "vendorModal";
    modal.className = "vendor-modal-backdrop";
    modal.innerHTML = `<section class="vendor-modal" role="dialog" aria-modal="true" aria-labelledby="vendorModalTitle"><form id="vendorContractForm">
        <header><div><span>${item ? "Update agreement" : "New agreement"}</span><h2 id="vendorModalTitle">${item ? "Edit vendor contract" : "Add vendor contract"}</h2><p>Capture coverage, contacts, response SLA and renewal dates.</p></div><button type="button" class="vendor-modal-close" aria-label="Close"><i data-lucide="x"></i></button></header>
        <div class="vendor-form-grid">
            <label><span>Vendor name *</span><input id="vendorName" required maxlength="200" value="${escapeHTML(item?.vendor_name || "")}"></label>
            <label><span>Engineering department *</span><select id="vendorTeam" ${vendorIsAdmin() ? "" : "disabled"}>${vendorTeamOptions(selectedTeam)}</select></label>
            <label><span>Contract type *</span><select id="vendorType"><option ${item?.contract_type === "AMC" ? "selected" : ""}>AMC</option><option ${item?.contract_type === "CMC" ? "selected" : ""}>CMC</option></select></label>
            <label><span>Contract number</span><input id="vendorNumber" maxlength="120" value="${escapeHTML(item?.contract_number || "")}"></label>
            <label><span>Contact person</span><input id="vendorContact" maxlength="160" value="${escapeHTML(item?.contact_person || "")}"></label>
            <label><span>Phone</span><input id="vendorPhone" maxlength="40" value="${escapeHTML(item?.phone || "")}"></label>
            <label><span>Email</span><input id="vendorEmail" type="email" value="${escapeHTML(item?.email || "")}"></label>
            <label><span>Response SLA (hours) *</span><input id="vendorSla" type="number" min="1" max="720" required value="${Number(item?.response_sla_hours || 24)}"></label>
            <label><span>Start date *</span><input id="vendorStart" type="date" required value="${item?.start_date || ""}"></label>
            <label><span>Renewal / end date *</span><input id="vendorEnd" type="date" required value="${item?.end_date || ""}"></label>
            <label><span>Contract status</span><select id="vendorStatus"><option ${item?.status === "Active" ? "selected" : ""}>Active</option><option ${item?.status === "On Hold" ? "selected" : ""}>On Hold</option><option ${item?.status === "Cancelled" ? "selected" : ""}>Cancelled</option></select></label>
            <label class="full"><span>Coverage details</span><textarea id="vendorCoverage" rows="3" maxlength="4000">${escapeHTML(item?.coverage || "")}</textarea></label>
        </div>
        <footer><button type="button" class="vendor-cancel">Cancel</button><button type="submit" class="vendor-save"><i data-lucide="save"></i> ${item ? "Save changes" : "Add contract"}</button></footer>
    </form></section>`;
    document.body.appendChild(modal);
    modal.querySelector(".vendor-modal-close").onclick = closeVendorModal;
    modal.querySelector(".vendor-cancel").onclick = closeVendorModal;
    modal.querySelector("form").addEventListener("submit", event => saveVendorContract(event, item?.id));
    window.lucide?.createIcons();
}

function closeVendorModal() { document.getElementById("vendorModal")?.remove(); }

async function saveVendorContract(event, id) {
    event.preventDefault();
    const button = event.currentTarget.querySelector(".vendor-save");
    const payload = {
        vendor_name: document.getElementById("vendorName").value,
        service_team: document.getElementById("vendorTeam").value,
        contract_type: document.getElementById("vendorType").value,
        contract_number: document.getElementById("vendorNumber").value,
        contact_person: document.getElementById("vendorContact").value,
        phone: document.getElementById("vendorPhone").value,
        email: document.getElementById("vendorEmail").value || null,
        response_sla_hours: Number(document.getElementById("vendorSla").value),
        start_date: document.getElementById("vendorStart").value,
        end_date: document.getElementById("vendorEnd").value,
        status: document.getElementById("vendorStatus").value,
        coverage: document.getElementById("vendorCoverage").value,
    };
    button.disabled = true;
    try {
        const response = await fetch(id ? `${VENDOR_API}/${id}` : VENDOR_API, { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "Unable to save the contract.");
        closeVendorModal();
        BioTrackToast.success("Contract saved", `${payload.vendor_name} is now in the service register.`);
        await loadVendorContracts();
    } catch (error) { BioTrackToast.error("Contract not saved", error.message); button.disabled = false; }
}

function openVendorHistory(id) {
    closeVendorModal();
    const item = vendorContracts.find(contract => contract.id === Number(id));
    if (!item) return;
    const modal = document.createElement("div");
    modal.id = "vendorModal";
    modal.className = "vendor-modal-backdrop";
    modal.innerHTML = `<section class="vendor-modal vendor-history-modal" role="dialog" aria-modal="true"><header><div><span>Service history</span><h2>${escapeHTML(item.vendor_name)}</h2><p>${escapeHTML(item.contract_type)} · ${escapeHTML(item.contract_number || "No contract number")}</p></div><button type="button" class="vendor-modal-close" aria-label="Close"><i data-lucide="x"></i></button></header>
        <div class="vendor-history-list">${item.service_history.map(history => `<article><span><i data-lucide="wrench"></i></span><div><strong>${escapeHTML(history.summary)}</strong><small>${new Date(`${history.service_date}T00:00:00`).toLocaleDateString()} · ${escapeHTML(history.technician_name || "Technician not recorded")}${history.reference_number ? ` · ${escapeHTML(history.reference_number)}` : ""}</small></div><b>${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(history.cost || 0)}</b></article>`).join("") || '<p class="vendor-empty">No service visits recorded yet.</p>'}</div>
        <form id="vendorHistoryForm" class="vendor-history-form"><h3>Add service visit</h3><div><label><span>Date *</span><input id="historyDate" type="date" required></label><label><span>Reference</span><input id="historyReference"></label><label><span>Vendor technician</span><input id="historyTechnician"></label><label><span>Cost (₹)</span><input id="historyCost" type="number" min="0" step="0.01" value="0"></label><label class="full"><span>Service summary *</span><textarea id="historySummary" required rows="3"></textarea></label></div><button type="submit"><i data-lucide="plus"></i> Add visit</button></form>
    </section>`;
    document.body.appendChild(modal);
    modal.querySelector(".vendor-modal-close").onclick = closeVendorModal;
    modal.querySelector("form").addEventListener("submit", event => saveVendorHistory(event, id));
    window.lucide?.createIcons();
}

async function saveVendorHistory(event, contractId) {
    event.preventDefault();
    const payload = { service_date: document.getElementById("historyDate").value, reference_number: document.getElementById("historyReference").value, technician_name: document.getElementById("historyTechnician").value, summary: document.getElementById("historySummary").value, cost: Number(document.getElementById("historyCost").value) };
    try {
        const response = await fetch(`${VENDOR_API}/${contractId}/history`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "Unable to add service history.");
        closeVendorModal(); await loadVendorContracts(); openVendorHistory(contractId);
    } catch (error) { BioTrackToast.error("Service visit not saved", error.message); }
}

window.openVendorContractModal = openVendorContractModal;
window.openVendorHistory = openVendorHistory;
;
/* source: dashboard_v2/js/settings.js */
/* ==========================================================
   BIOTRACK SETTINGS
   PART 3A
========================================================== */
let settingsMfaEnabled = false;
const profilePhotoPattern = /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\r\n]+$/i;

function isSafeProfilePhoto(source) {
    return typeof source === "string"
        && source.length <= 2100000
        && profilePhotoPattern.test(source);
}

function initSettings() {
    initializeProfilePhoto();

    initializeProfileEditor();

    initializeNotificationSwitches();

    initializeSecurity();

    initializePreferences();

    initializeBackup();

    loadProfileData();

    loadSavedPreferences();

    initializeSmoothButtons();

    initializeButtonEffects();

    initializeCardEffects();

    initializeKeyboardShortcuts();

    showToast(
        "Settings",
        "Settings page loaded successfully.",
        "fa-circle-check"
    );

}
/* ==========================================================
   LOAD PROFILE DATA
========================================================== */

async function loadProfileData() {

    const username =
        localStorage.getItem("username") || "Administrator";

    const role =
        localStorage.getItem("role") || "Administrator";

    const email =
        localStorage.getItem("email") || "admin@biotrack.com";

    const department =
        localStorage.getItem("department") || "Not assigned";

    let profile = { username, name: localStorage.getItem("name") || username, role, email, department };
    try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (response.ok) profile = await response.json();
    } catch (error) {
        console.warn("Unable to refresh profile data", error);
    }

    const fullName =
        document.getElementById("settingsFullName");

    const emailText =
        document.getElementById("settingsEmail");

    const roleText =
        document.getElementById("settingsRole");

    const employee =
        document.getElementById("settingsEmployeeId");

    if(fullName) fullName.textContent = profile.name || profile.username || username;

    if(emailText) emailText.textContent = profile.email || "Not provided";

    if(roleText) roleText.textContent = profile.role || role;

    if(employee) employee.textContent = profile.department || department;

    settingsMfaEnabled = Boolean(profile.mfa_enabled);
    const mfaStatus = document.getElementById("mfaStatusText");
    const mfaButton = document.getElementById("configureMfa");
    if (mfaStatus) mfaStatus.textContent = settingsMfaEnabled
        ? "Enabled · a code is required when you sign in."
        : "Optional · currently disabled.";
    if (mfaButton) mfaButton.firstChild.textContent = settingsMfaEnabled ? "Disable " : "Enable ";

}

function initializeProfileEditor() {
    const button = document.getElementById("editProfileBtn");
    if (!button) return;

    button.addEventListener("click", async () => {
        let profile;
        try {
            const response = await fetch("/api/auth/me", { cache: "no-store" });
            if (!response.ok) throw new Error("Unable to load your profile.");
            profile = await response.json();
        } catch (error) {
            showToast("Profile", error.message, "fa-circle-exclamation");
            return;
        }

        const overlay = document.createElement("div");
        overlay.className = "profile-edit-overlay";
        overlay.innerHTML = `
            <form class="profile-edit-dialog" id="profileEditForm">
                <div class="profile-edit-header"><div><h2>Edit profile</h2><p>Update your contact information.</p></div><button type="button" class="profile-edit-close" aria-label="Close">×</button></div>
                <label>Full name<input id="profileEditName" required maxlength="120" value="${escapeHTML(profile.name || "")}"></label>
                <label>Email address<input id="profileEditEmail" type="email" required value="${escapeHTML(profile.email || "")}"></label>
                <label>Phone<input id="profileEditPhone" maxlength="30" value="${escapeHTML(profile.phone || "")}"></label>
                <div class="profile-edit-actions"><button type="button" class="secondary-btn profile-edit-cancel">Cancel</button><button type="submit" class="primary-btn">Save profile</button></div>
            </form>`;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.querySelector(".profile-edit-close").onclick = close;
        overlay.querySelector(".profile-edit-cancel").onclick = close;
        overlay.querySelector("#profileEditForm").onsubmit = async event => {
            event.preventDefault();
            const saveButton = event.submitter;
            saveButton.disabled = true;
            try {
                const response = await fetch("/api/auth/profile", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: overlay.querySelector("#profileEditName").value.trim(),
                        email: overlay.querySelector("#profileEditEmail").value.trim(),
                        phone: overlay.querySelector("#profileEditPhone").value.trim(),
                    }),
                });
                const result = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(result.detail || "Unable to save your profile.");
                localStorage.setItem("name", result.name);
                localStorage.setItem("email", result.email);
                const topUsername = document.getElementById("topUsername");
                if (topUsername) topUsername.textContent = result.name;
                close();
                await loadProfileData();
                showToast("Profile updated", "Your changes were saved.", "fa-circle-check");
            } catch (error) {
                showToast("Profile", error.message, "fa-circle-exclamation");
                saveButton.disabled = false;
            }
        };
        overlay.querySelector("#profileEditName").focus();
    });
}

/* ==========================================================
   PROFILE IMAGE
========================================================== */

function initializeProfilePhoto() {

    const uploadInput = document.getElementById("profileUpload");

    const preview = document.getElementById("profilePreview");

    const cameraButton = document.getElementById("changePhoto");

    if (!uploadInput || !preview || !cameraButton) return;

    const photoKey = `biotrack-profile-photo:${localStorage.getItem("username") || "user"}`;
    const savedPhoto = localStorage.getItem(photoKey);
    if (isSafeProfilePhoto(savedPhoto)) {
        preview.src = savedPhoto;
        applyProfilePhotoToTopbar(savedPhoto);
    } else if (savedPhoto) {
        localStorage.removeItem(photoKey);
    }

    cameraButton.addEventListener("click", () => {

        uploadInput.click();

    });

    uploadInput.addEventListener("change", event => {

        const file = event.target.files[0];

        if (!file) return;

        if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {

            showToast(

                "Invalid File",

                "Please select a PNG, JPEG, or WebP image.",

                "fa-circle-exclamation"

            );

            return;

        }

        if (file.size > 1500000) {
            showToast("Image Too Large", "Choose a profile image smaller than 1.5 MB.", "fa-circle-exclamation");
            uploadInput.value = "";
            return;
        }

        const reader = new FileReader();

        reader.onload = e => {

            if (!isSafeProfilePhoto(e.target.result)) {
                showToast("Invalid File", "The selected image could not be validated.", "fa-circle-exclamation");
                uploadInput.value = "";
                return;
            }

            preview.src = e.target.result;

            try {
                localStorage.setItem(photoKey, e.target.result);
                applyProfilePhotoToTopbar(e.target.result);
            } catch (error) {
                showToast("Profile Photo", "The image could not be stored in this browser.", "fa-circle-exclamation");
                return;
            }

            showToast(

                "Profile Updated",

                "Your profile picture has been changed.",

                "fa-circle-check"

            );

        };

        reader.readAsDataURL(file);

    });

}

function applyProfilePhotoToTopbar(source) {
    if (!isSafeProfilePhoto(source)) return;
    const avatar = document.getElementById("topAvatar");
    const sidebarAvatar = document.getElementById("sidebarAvatar");
    [avatar, sidebarAvatar].forEach(element => {
        if (!element) return;
        element.style.backgroundImage = `url("${source}")`;
        element.style.backgroundPosition = "center";
        element.style.backgroundSize = "cover";
        element.textContent = "";
    });
}

/* ==========================================================
   BUTTON SCROLL EFFECT
========================================================== */

function initializeSmoothButtons() {

    document.querySelectorAll(".primary-btn, .secondary-btn").forEach(button => {

        button.addEventListener("click", createRipple);

    });

}

/* ==========================================================
   RIPPLE EFFECT
========================================================== */

function createRipple(event) {

    const button = event.currentTarget;

    const ripple = document.createElement("span");

    const size = Math.max(button.clientWidth, button.clientHeight);

    const rect = button.getBoundingClientRect();

    ripple.className = "ripple";

    ripple.style.width = size + "px";

    ripple.style.height = size + "px";

    ripple.style.left = event.clientX - rect.left - size / 2 + "px";

    ripple.style.top = event.clientY - rect.top - size / 2 + "px";

    button.appendChild(ripple);

    setTimeout(() => {

        ripple.remove();

    }, 600);

}


/* ==========================================================
   NOTIFICATION SWITCHES
========================================================== */

function initializeNotificationSwitches() {

    const switches = document.querySelectorAll(
        "#inAppNotification, #desktopNotification, #requestUpdates, #pmReminder"
    );

    const saved = JSON.parse(localStorage.getItem("biotrack-notifications") || "{}");

    switches.forEach(toggle => {

        if (typeof saved[toggle.id] === "boolean") toggle.checked = saved[toggle.id];

        toggle.addEventListener("change", async function () {

            if (this.id === "desktopNotification" && this.checked && "Notification" in window) {
                const permission = await Notification.requestPermission();
                if (permission !== "granted") this.checked = false;
            }

            const title = getSettingName(this.id);

            const status = this.checked ? "Enabled" : "Disabled";

            showToast(
                title,
                `${title} ${status}.`,
                this.checked
                    ? "fa-circle-check"
                    : "fa-circle-minus"
            );

        });

    });

    const saveButton = document.getElementById("saveNotificationSettings");
    if (saveButton) {
        saveButton.addEventListener("click", () => {
            const preferences = {};
            switches.forEach(toggle => { preferences[toggle.id] = toggle.checked; });
            localStorage.setItem("biotrack-notifications", JSON.stringify(preferences));
            document.dispatchEvent(new CustomEvent("biotrack:notification-preferences-changed", { detail: preferences }));
            showToast("Notifications", "Notification preferences saved.", "fa-circle-check");
        });
    }

}

function getSettingName(id) {

    switch (id) {

        case "inAppNotification":
            return "In-app Notifications";

        case "desktopNotification":
            return "Desktop Notifications";

        case "requestUpdates":
            return "Request Updates";

        case "pmReminder":
            return "Preventive Maintenance Reminder";

        default:
            return "Setting";

    }

}

/* ==========================================================
   SYSTEM PREFERENCES
========================================================== */

function initializePreferences() {

    const theme = document.getElementById("themeSelect");
    const density = document.getElementById("densitySelect");
    const date = document.getElementById("dateFormat");
    const time = document.getElementById("timeFormat");

    if (theme) theme.addEventListener("change", () => saveSystemPreference("biotrack-theme", theme.value, "Theme", `${theme.options[theme.selectedIndex].text} theme applied.`));

    if (density) density.addEventListener("change", () => saveSystemPreference("biotrack-density", density.value, "Interface Density", `${density.options[density.selectedIndex].text} spacing applied.`));

    if (date) {

        date.addEventListener("change", () => saveSystemPreference("dateFormat", date.value, "Date Format", `${date.value} selected.`));

    }

    if (time) {

        time.addEventListener("change", () => saveSystemPreference("timeFormat", time.value, "Time Format", `${time.value} selected.`));

    }

}

function saveSystemPreference(key, value, title, message) {
    localStorage.setItem(key, value);
    window.applyBioTrackPreferences?.();
    document.dispatchEvent(new CustomEvent("biotrack:preferences-changed"));
    showToast(title, message, "fa-circle-check");
}

/* ==========================================================
   SECURITY
========================================================== */

function initializeSecurity() {

    const changePassword =
        document.getElementById("changePassword");

    const sessions =
        document.getElementById("viewSessions");

    const configureMfa =
        document.getElementById("configureMfa");

    if (changePassword) {

        changePassword.addEventListener("click", openPasswordModal);

    }

    if (sessions) {

        sessions.addEventListener("click", openSessionDialog);

    }

    if (configureMfa) {
        configureMfa.addEventListener("click", openMfaDialog);
    }

}

async function openMfaDialog() {
    try {
        const profileResponse = await fetch("/api/auth/me", { cache: "no-store" });
        const profile = await profileResponse.json().catch(() => ({}));
        if (!profileResponse.ok) throw new Error(profile.detail || "Unable to load MFA status.");
        settingsMfaEnabled = Boolean(profile.mfa_enabled);
    } catch (error) {
        showToast("Authenticator", error.message, "fa-circle-exclamation");
        return;
    }

    const overlay = document.createElement("div");
    overlay.className = "profile-edit-overlay";
    overlay.innerHTML = `
        <form class="profile-edit-dialog mfa-settings-dialog" id="mfaSettingsForm">
            <div class="profile-edit-header"><div><h2>${settingsMfaEnabled ? "Disable" : "Enable"} authenticator verification</h2><p>MFA is optional for every BioTrack account.</p></div><button type="button" class="profile-edit-close" aria-label="Close">×</button></div>
            <div id="mfaSetupDetails"></div>
            <label>Current password<input id="mfaCurrentPassword" type="password" autocomplete="current-password" required maxlength="72"></label>
            ${settingsMfaEnabled ? '<label>Authenticator code<input id="mfaSettingsCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required></label>' : ""}
            <div class="profile-edit-actions"><button type="button" class="secondary-btn mfa-cancel">Cancel</button><button type="submit" class="primary-btn" id="mfaSubmitButton">${settingsMfaEnabled ? "Disable MFA" : "Start setup"}</button></div>
        </form>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector(".profile-edit-close").onclick = close;
    overlay.querySelector(".mfa-cancel").onclick = close;

    const form = overlay.querySelector("#mfaSettingsForm");
    form.onsubmit = async event => {
        event.preventDefault();
        const password = overlay.querySelector("#mfaCurrentPassword").value;
        const button = overlay.querySelector("#mfaSubmitButton");
        button.disabled = true;
        try {
            if (settingsMfaEnabled) {
                const code = overlay.querySelector("#mfaSettingsCode").value.trim();
                const response = await fetch("/api/auth/mfa/disable", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ current_password: password, code }),
                });
                const result = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(result.detail || "Unable to disable authenticator verification.");
                close();
                showToast("Authenticator", result.message, "fa-circle-check");
                if (result.reauthenticate) {
                    sessionStorage.setItem("biotrackLoginNotice", "Authenticator verification was disabled. Sign in again.");
                    if (typeof clearDashboardIdentity === "function") clearDashboardIdentity();
                    setTimeout(() => window.location.replace("/"), 900);
                }
                return;
            }

            const setupResponse = await fetch("/api/auth/mfa/setup", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ current_password: password }),
            });
            const setup = await setupResponse.json().catch(() => ({}));
            if (!setupResponse.ok) throw new Error(setup.detail || "Unable to start authenticator setup.");
            const details = overlay.querySelector("#mfaSetupDetails");
            details.innerHTML = '<p>Scan the QR code in your authenticator app, or enter the setup key manually.</p><img class="mfa-qr" alt="Authenticator setup QR code"><p class="mfa-secret-row">Setup key: <code></code></p><label>Verification code<input id="mfaSettingsCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required></label>';
            const qr = details.querySelector("img");
            if (String(setup.qr_data_url || "").startsWith("data:image/png;base64,")) qr.src = setup.qr_data_url;
            else qr.hidden = true;
            details.querySelector("code").textContent = setup.secret || "";
            button.textContent = "Enable MFA";
            form.onsubmit = async enableEvent => {
                enableEvent.preventDefault();
                button.disabled = true;
                try {
                    const response = await fetch("/api/auth/mfa/enable", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ current_password: password, code: details.querySelector("#mfaSettingsCode").value.trim() }),
                    });
                    const result = await response.json().catch(() => ({}));
                    if (!response.ok) throw new Error(result.detail || "Unable to enable authenticator verification.");
                    close();
                    settingsMfaEnabled = true;
                    await loadProfileData();
                    showToast("Authenticator", result.message, "fa-circle-check");
                } catch (error) {
                    showToast("Authenticator", error.message, "fa-circle-exclamation");
                    button.disabled = false;
                }
            };
            details.querySelector("#mfaSettingsCode").focus();
        } catch (error) {
            showToast("Authenticator", error.message, "fa-circle-exclamation");
        } finally {
            button.disabled = false;
        }
    };
    overlay.querySelector("#mfaCurrentPassword").focus();
}

async function openSessionDialog() {
    const button = document.getElementById("viewSessions");
    if (button) button.disabled = true;
    try {
        const response = await fetch("/api/settings/session", { cache: "no-store" });
        const session = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(session.detail || "Unable to load the current session.");
        const overlay = document.createElement("div");
        overlay.className = "profile-edit-overlay";
        overlay.innerHTML = `
            <section class="profile-edit-dialog session-dialog" role="dialog" aria-modal="true" aria-labelledby="sessionDialogTitle">
                <div class="profile-edit-header"><div><h2 id="sessionDialogTitle">Current session</h2><p>This is the browser currently signed in to BioTrack.</p></div><button type="button" class="profile-edit-close" aria-label="Close">×</button></div>
                <div class="session-details">
                    <div><span>Account</span><strong id="sessionAccount"></strong></div>
                    <div><span>Device</span><strong id="sessionDevice"></strong></div>
                    <div><span>Network address</span><strong id="sessionIp"></strong></div>
                    <div><span>Signed in</span><strong id="sessionIssued"></strong></div>
                    <div><span>Expires</span><strong id="sessionExpires"></strong></div>
                </div>
                <div class="profile-edit-actions"><button type="button" class="secondary-btn session-close">Close</button><button type="button" class="danger-btn session-logout"><i data-lucide="log-out"></i> Sign out this device</button></div>
            </section>`;
        document.body.appendChild(overlay);
        overlay.querySelector("#sessionAccount").textContent = `${session.username} · ${session.role}`;
        overlay.querySelector("#sessionDevice").textContent = friendlyBrowserName(session.user_agent);
        overlay.querySelector("#sessionIp").textContent = session.ip_address || "Unknown";
        overlay.querySelector("#sessionIssued").textContent = formatSettingsTimestamp(session.issued_at);
        overlay.querySelector("#sessionExpires").textContent = formatSettingsTimestamp(session.expires_at);
        const close = () => overlay.remove();
        overlay.querySelector(".profile-edit-close").onclick = close;
        overlay.querySelector(".session-close").onclick = close;
        overlay.addEventListener("click", event => { if (event.target === overlay) close(); });
        overlay.querySelector(".session-logout").onclick = () => document.querySelector(".logout-btn")?.click();
        if (window.lucide) window.lucide.createIcons();
    } catch (error) {
        showToast("Current Session", error.message, "fa-circle-exclamation");
    } finally {
        if (button) button.disabled = false;
    }
}

function friendlyBrowserName(userAgent) {
    const value = String(userAgent || "");
    if (/Edg\//.test(value)) return "Microsoft Edge on this device";
    if (/Chrome\//.test(value)) return "Google Chrome on this device";
    if (/Firefox\//.test(value)) return "Mozilla Firefox on this device";
    if (/Safari\//.test(value)) return "Safari on this device";
    return "Current browser";
}

function formatSettingsTimestamp(value) {
    if (!value) return "Not available";
    const timestamp = new Date(value);
    return Number.isNaN(timestamp.getTime()) ? "Not available" : timestamp.toLocaleString();
}

function openPasswordModal() {
    const modal = document.getElementById("passwordModal");
    if (!modal) return;
    modal.hidden = false;
    document.getElementById("currentPassword")?.focus();

    document.getElementById("closePasswordModal").onclick = closePasswordModal;
    document.getElementById("cancelPasswordChange").onclick = closePasswordModal;
    document.getElementById("savePasswordChange").onclick = submitPasswordChange;
}

function closePasswordModal() {
    const modal = document.getElementById("passwordModal");
    if (!modal) return;
    modal.hidden = true;
    ["currentPassword", "newPassword", "confirmPassword"].forEach(id => {
        const field = document.getElementById(id);
        if (field) field.value = "";
    });
}

async function submitPasswordChange() {
    const currentPassword = document.getElementById("currentPassword")?.value || "";
    const newPassword = document.getElementById("newPassword")?.value || "";
    const confirmPassword = document.getElementById("confirmPassword")?.value || "";

    if (newPassword.length < 12) {
        showToast("Password", "Use at least 12 characters.", "fa-circle-exclamation");
        return;
    }
    if (newPassword !== confirmPassword) {
        showToast("Password", "The new passwords do not match.", "fa-circle-exclamation");
        return;
    }

    if (!currentPassword) {
        showToast("Password", "Enter your current password.", "fa-circle-exclamation");
        return;
    }
    const saveButton = document.getElementById("savePasswordChange");
    if (saveButton) saveButton.disabled = true;
    try {
        const response = await fetch("/api/auth/change-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "Unable to change password.");
        closePasswordModal();
        showToast("Password", data.message || "Password changed successfully.", "fa-circle-check");
        if (data.reauthenticate) {
            sessionStorage.setItem("biotrackLoginNotice", "Your password was changed. Sign in again with the new password.");
            if (typeof clearDashboardIdentity === "function") clearDashboardIdentity();
            setTimeout(() => window.location.replace("/"), 900);
        }
    } catch (error) {
        showToast("Password", error.message, "fa-circle-exclamation");
    } finally {
        if (saveButton) saveButton.disabled = false;
    }
}

/* ==========================================================
   TOAST NOTIFICATION
========================================================== */

function showToast(title, message, icon) {
    const type = icon === "fa-circle-exclamation" ? "error" : "success";
    BioTrackToast.show({ title, message, type });
}


/* ==========================================================
   BACKUP & EXPORT
========================================================== */

function initializeBackup() {

    const backupBtn = document.getElementById("backupNow");
    const exportBtn = document.getElementById("exportData");

    if (backupBtn) {

        backupBtn.addEventListener("click", () => downloadSettingsFile(backupBtn, "/api/settings/backup", "Creating backup…", "Backup Complete", "Your scoped BioTrack backup was downloaded."));

    }

    if (exportBtn) {

        exportBtn.addEventListener("click", () => downloadSettingsFile(exportBtn, "/api/settings/export", "Preparing export…", "Export Complete", "Maintenance data was downloaded as CSV."));

    }

}

async function downloadSettingsFile(button, url, busyLabel, successTitle, successMessage) {
    const original = button.innerHTML;
    button.disabled = true;
    button.textContent = busyLabel;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || "The download could not be prepared.");
        }
        const blob = await response.blob();
        const disposition = response.headers.get("Content-Disposition") || "";
        const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || "biotrack-download";
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
        showToast(successTitle, successMessage, "fa-circle-check");
    } catch (error) {
        showToast("Download Failed", error.message, "fa-circle-exclamation");
    } finally {
        button.disabled = false;
        button.innerHTML = original;
        if (window.lucide) window.lucide.createIcons();
    }
}

/* ==========================================================
   THEME
========================================================== */

function initializeTheme() {

    const selector = document.getElementById("themeSelect");

    if (!selector) return;

    selector.addEventListener("change", () => {

        localStorage.setItem("biotrack-theme", selector.value);

        applyTheme(selector.value);

    });

}

function applyTheme(theme) {

    document.body.classList.remove("dark-theme");

    if (theme === "dark") {

        document.body.classList.add("dark-theme");

    }

    showToast(
        "Theme Updated",
        `${theme} theme applied.`,
        "fa-palette"
    );

}

/* ==========================================================
   SAVE PREFERENCES
========================================================== */

function loadSavedPreferences() {

    const theme = localStorage.getItem("biotrack-theme");

    if (theme) {

        const selector = document.getElementById("themeSelect");

        if (selector) {

            selector.value = theme;

            window.applyBioTrackPreferences?.();

        }

    }

    const density = localStorage.getItem("biotrack-density");
    const densitySelector = document.getElementById("densitySelect");
    if (density && densitySelector) densitySelector.value = density;

    ["dateFormat", "timeFormat"].forEach(id => {
        const element = document.getElementById(id);
        const saved = localStorage.getItem(id);
        if (element && saved) element.value = saved;
    });

}

function saveDropdown(id) {

    const element = document.getElementById(id);

    if (!element) return;

    const saved = localStorage.getItem(id);

    if (saved) {

        element.value = saved;

    }

    element.addEventListener("change", () => {

        localStorage.setItem(id, element.value);

    });

}

/* ==========================================================
   GLOBAL BUTTON EFFECT
========================================================== */

/* ==========================================================
   BUTTON EFFECTS
========================================================== */

function initializeButtonEffects() {

    if (window.settingsButtonEffectsBound) return;
    window.settingsButtonEffectsBound = true;

    document.addEventListener("click", function (event) {

        const button = event.target.closest("button");

        if (!button) return;

        button.style.transform = "scale(.97)";

        setTimeout(() => {

            button.style.transform = "";

        }, 120);

    });

}

/* ==========================================================
   CARD HOVER EFFECT
========================================================== */

function initializeCardEffects(){

    document.querySelectorAll(".settings-card")
        .forEach(card=>{

            card.style.transition=".3s ease";

        });

}

/* ==========================================================
   KEYBOARD SHORTCUTS
========================================================== */

function initializeKeyboardShortcuts(){

    if (window.settingsKeyboardShortcutsBound) return;
    window.settingsKeyboardShortcutsBound = true;

    document.addEventListener("keydown", event => {

        if (!document.querySelector(".settings-page")) return;

        if(event.ctrlKey &&
           event.key.toLowerCase()==="s"){

            event.preventDefault();

            showToast(
                "Settings Saved",
                "Your preferences have been saved.",
                "fa-floppy-disk"
            );

        }

    });

}

;
/* source: dashboard_v2/views/pmView.js */
// ==========================================
// PM DASHBOARD V2
// ==========================================

function renderPM() {

    pageContent.innerHTML = `

    <!-- ==========================================
         PM PAGE
    ========================================== -->

    <div class="pm-page">

        <!-- ==========================================
             HEADER
        ========================================== -->

        <section class="pm-header">

            <div class="pm-header-left">

                <h1>
                    Preventive Maintenance
                </h1>

                <p>
                    Plan, monitor and manage equipment maintenance from one live calendar.
                </p>

            </div>

            <div class="pm-header-right">

                <img
                    src="/static/assets/pm_calendar.png"
                    alt="Preventive Maintenance"
                    class="pm-header-image"
                >

            </div>

        </section>

        <!-- ==========================================
             CALENDAR
        ========================================== -->

        <section class="pm-calendar-card">

            <div class="pm-calendar-toolbar">

                <div class="pm-calendar-navigation">

                    <button id="pmPrevMonth" type="button" aria-label="Previous month">

                        <i data-lucide="chevron-left"></i>

                    </button>

                    <h2 id="pmCurrentMonth">

                        July 2026

                    </h2>

                    <button id="pmNextMonth" type="button" aria-label="Next month">

                        <i data-lucide="chevron-right"></i>

                    </button>

                </div>

                <button
                    class="pm-today-btn"
                    id="pmTodayButton">

                    Today

                </button>

                <div class="pm-google-calendar" id="pmGoogleCalendar">
                    <span class="pm-google-calendar-status" id="pmGoogleCalendarStatus">Add visits from their schedule rows.</span>
                    <a class="pm-google-calendar-btn" href="https://calendar.google.com/calendar/" target="_blank" rel="noopener">Open Google Calendar</a>
                </div>

            </div>

            <div id="pmCalendar">

                <!-- Calendar generated by pmCalendar.js -->

            </div>

            <section class="pm-legend" aria-label="Maintenance status legend">
                <div class="legend-item"><span class="legend-dot scheduled"></span>Scheduled</div>
                <div class="legend-item"><span class="legend-dot due"></span>Due today</div>
                <div class="legend-item"><span class="legend-dot overdue"></span>Overdue</div>
                <div class="legend-item"><span class="legend-dot completed"></span>Completed</div>
                <div class="legend-item"><span class="legend-dot empty"></span>No PM</div>
            </section>

        </section>

        <!-- ==========================================
             KPI CARDS
        ========================================== -->

        <section
            id="pmKpiCards"
            class="pm-kpi-section">

        </section>

        <section
            id="pmScheduleOverview"
            class="pm-section">

        </section>

        <!-- ==========================================
             UPCOMING PM
        ========================================== -->

        <section
            id="pmUpcomingSection"
            class="pm-section">

        </section>

        <!-- ==========================================
             OVERDUE PM
        ========================================== -->

        <section
            id="pmOverdueSection"
            class="pm-section">

        </section>

        <!-- ==========================================
             PM HISTORY
        ========================================== -->

        <section
            id="pmHistorySection"
            class="pm-section">

        </section>
        <!-- ==========================================
            PM DRAWER
        ========================================== -->

        <div
            id="pmDrawerOverlay"
            class="pm-drawer-overlay">

            <div
                id="pmDrawer"
                class="pm-drawer">

                <div class="pm-drawer-header">

                    <div>

                        <h2>
                            Schedule Preventive Maintenance
                        </h2>

                        <p>

                            Create a preventive maintenance schedule.

                        </p>

                    </div>

                    <button
                        id="pmDrawerClose"
                        class="pm-drawer-close">

                        <i data-lucide="x"></i>

                    </button>

                </div>

                <div class="pm-drawer-body">

                <!-- Date -->

                <div class="pm-form-group">

                    <label>Date</label>

                    <input
                        id="pmDate"
                        type="text"
                        readonly
                    >

                </div>

                <!-- Department -->

                <div class="pm-form-group">

                    <label>Department</label>

                    <select id="pmDepartment">

                        <option value="">
                            Select Department
                        </option>

                    </select>

                </div>

                <!-- Equipment -->

                <div class="pm-form-group">

                    <label>Equipment</label>

                    <p class="pm-form-hint">Choose an asset assigned to this department. Unassigned biomedical assets are included and will be assigned when you schedule the visit.</p>

                    <select id="pmEquipment">

                        <option value="">
                            Select a department first
                        </option>

                    </select>

                </div>

                <!-- Engineer -->

                <div class="pm-form-group">

                    <label>Biomedical Engineer</label>

                    <select id="pmEngineer">

                        <option value="">
                            Assign Engineer
                        </option>

                    </select>

                </div>

                <!-- Frequency -->

                <div class="pm-form-group">

                    <label>Frequency</label>

                    <select id="pmFrequency">

                        <option value="30">
                            Every 30 Days
                        </option>

                        <option value="90">
                            Every 90 Days
                        </option>

                        <option value="180">
                            Every 180 Days
                        </option>

                        <option value="365">
                            Every Year
                        </option>

                    </select>

                </div>

                <!-- Remarks -->

                <div class="pm-form-group">

                    <label>Remarks</label>

                    <textarea
                        id="pmRemarks"
                        rows="5"
                        placeholder="Additional remarks..."
                    ></textarea>

                </div>

                <div class="pm-drawer-footer">

                    <button
                        id="pmCancelButton"
                        class="secondary-btn">

                        Cancel

                    </button>

                    <button
                        id="pmScheduleButton"
                        class="primary-btn">

                        Schedule PM

                    </button>

                </div>

            </div>

        </div>
    </div>

    `;

    lucide.createIcons();

    initializePMCalendar();

    initializePMDrawer();


    loadEngineeringPMSchedules();

}
;
/* source: dashboard_v2/js/pmCalendar.js */
// ==========================================
// PM CALENDAR ENGINE
// ==========================================


// ==========================================
// CURRENT DATE
// ==========================================

let pmCurrentDate = new Date();

let pmSelectedDate = null;


// ==========================================
// MONTHS
// ==========================================

const pmMonths = [

    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"

];


// ==========================================
// WEEK DAYS
// ==========================================

const pmWeekDays = [

    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
    "Sun"

];


// ==========================================
// DEMO EVENTS
// (Temporary until backend integration)
// ==========================================

let pmEvents = [];


// ==========================================
// INITIALIZE
// ==========================================

function initializePMCalendar(){

    initializePMCalendarButtons();

    renderPMCalendar();

}


// ==========================================
// BUTTON EVENTS
// ==========================================

function initializePMCalendarButtons(){

    document

        .getElementById("pmPrevMonth")

        .addEventListener(

            "click",

            previousPMMonth

        );

    document

        .getElementById("pmNextMonth")

        .addEventListener(

            "click",

            nextPMMonth

        );

    document

        .getElementById("pmTodayButton")

        .addEventListener(

            "click",

            goToTodayPM

        );

}


// ==========================================
// PREVIOUS MONTH
// ==========================================

function previousPMMonth(){

    pmCurrentDate.setMonth(

        pmCurrentDate.getMonth()-1

    );

    renderPMCalendar();

}


// ==========================================
// NEXT MONTH
// ==========================================

function nextPMMonth(){

    pmCurrentDate.setMonth(

        pmCurrentDate.getMonth()+1

    );

    renderPMCalendar();

}


// ==========================================
// TODAY
// ==========================================

function goToTodayPM(){

    pmCurrentDate = new Date();

    renderPMCalendar();

}
// ==========================================
// RENDER CALENDAR
// ==========================================

function renderPMCalendar() {

    const calendar =
        document.getElementById("pmCalendar");

    if (!calendar) return;

    const year =
        pmCurrentDate.getFullYear();

    const month =
        pmCurrentDate.getMonth();

    document.getElementById("pmCurrentMonth").textContent =
        `${pmMonths[month]} ${year}`;

    calendar.innerHTML = "";

    renderWeekHeader(calendar);

    renderCalendarDays(calendar);

}


// ==========================================
// WEEK HEADER
// ==========================================

function renderWeekHeader(calendar){

    const grid =
        document.createElement("div");

    grid.className =
        "pm-calendar-grid";

    pmWeekDays.forEach(day=>{

        const weekday =
            document.createElement("div");

        weekday.className =
            "pm-weekday";

        weekday.textContent =
            day;

        grid.appendChild(weekday);

    });

    calendar.appendChild(grid);

}
// ==========================================
// RENDER CALENDAR DAYS
// ==========================================

function renderCalendarDays(calendar){

    const grid =
        document.createElement("div");

    grid.className =
        "pm-calendar-grid";

    const year =
        pmCurrentDate.getFullYear();

    const month =
        pmCurrentDate.getMonth();

    // First day of month
    const firstDay =
        new Date(year, month, 1);

    // Last day of month
    const lastDay =
        new Date(year, month + 1, 0);

    // Monday = first column
    let startingDay =
        firstDay.getDay();

    startingDay =
        startingDay === 0 ? 6 : startingDay - 1;

    // Previous month
    const previousMonthLastDay =
        new Date(year, month, 0).getDate();

    // Previous month dates
    for(

        let i = startingDay;

        i > 0;

        i--

    ){

        grid.appendChild(

            createDayCard(

                previousMonthLastDay - i + 1,

                true

            )

        );

    }

    // Current month dates
    for(

        let day = 1;

        day <= lastDay.getDate();

        day++

    ){

        const currentDate =

            new Date(

                year,

                month,

                day

            );

        grid.appendChild(

            createDayCard(

                day,

                false,

                currentDate

            )

        );

    }

    // Fill remaining cells
    const totalCells =
        grid.children.length;

    const remaining =
        42 - totalCells;

    for(

        let day = 1;

        day <= remaining;

        day++

    ){

        grid.appendChild(

            createDayCard(

                day,

                true

            )

        );

    }

    calendar.appendChild(grid);

}
// ==========================================
// CREATE DAY CARD
// ==========================================

function createDayCard(day, otherMonth = false, date = null) {

    const card =
        document.createElement("div");

    card.className =
        "pm-day";

    if (otherMonth) {

        card.classList.add("other-month");

    }

    // Today's Date
    if (date && isToday(date)) {

        card.classList.add("today");

    }

    // Day Number
    const number =
        document.createElement("div");

    number.className =
        "pm-day-number";

    number.textContent =
        day;

    card.appendChild(number);

    // Event
    if (date) {

        const event =
            getPMEvent(date);

        if (event) {

            // Status Dot
            const dot =
                document.createElement("div");

            dot.className =
                `pm-status-dot ${event.status.toLowerCase()}`;

            card.appendChild(dot);

            // Event Chip
            const chip =
                document.createElement("div");

            chip.className =
                `pm-event ${event.status.toLowerCase()}`;

            chip.textContent =
                event.status;

            card.appendChild(chip);

        }

        card.addEventListener("click", () => {

            selectPMDate(date);

            openPMDrawer(date);

        });

    }

    return card;

}


// ==========================================
// TODAY CHECK
// ==========================================

function isToday(date){

    const today = new Date();

    return (

        today.getFullYear() === date.getFullYear()

        &&

        today.getMonth() === date.getMonth()

        &&

        today.getDate() === date.getDate()

    );

}


// ==========================================
// GET EVENT
// ==========================================

function getPMEvent(date){

    const formatted =
        formatPMDate(date);

    const events = pmEvents.filter(event =>

        event.date === formatted

    );

    if (!events.length) return null;

    const priority = { Overdue: 4, Due: 3, Upcoming: 2, Completed: 1 };
    const primary = [...events].sort(
        (a, b) => (priority[b.status] || 0) - (priority[a.status] || 0)
    )[0];

    return {
        ...primary,
        count: events.length
    };

}


// ==========================================
// FORMAT DATE
// ==========================================

function formatPMDate(date){

    const year =
        date.getFullYear();

    const month =
        String(

            date.getMonth() + 1

        ).padStart(2,"0");

    const day =
        String(

            date.getDate()

        ).padStart(2,"0");

    return `${year}-${month}-${day}`;

}


// ==========================================
// SELECT DATE
// ==========================================

function selectPMDate(date){

    pmSelectedDate = date;

}
// ==========================================
// SET EVENTS
// ==========================================

function setPMEvents(events = []) {

    pmEvents = Array.isArray(events)

        ? events

        : [];

    refreshPMCalendar();

}


// ==========================================
// ADD EVENT
// ==========================================

function addPMEvent(event) {

    if (!event) return;

    pmEvents.push(event);

    refreshPMCalendar();

}


// ==========================================
// REMOVE EVENT
// ==========================================

function removePMEvent(date) {

    pmEvents = pmEvents.filter(event =>

        event.date !== date

    );

    refreshPMCalendar();

}


// ==========================================
// CLEAR EVENTS
// ==========================================

function clearPMEvents() {

    pmEvents = [];

    refreshPMCalendar();

}


// ==========================================
// REFRESH
// ==========================================

function refreshPMCalendar() {

    renderPMCalendar();

}


// ==========================================
// GET SELECTED DATE
// ==========================================

function getSelectedPMDate() {

    return pmSelectedDate;

}


// ==========================================
// GET CURRENT MONTH
// ==========================================

function getCurrentPMMonth() {

    return {

        month: pmCurrentDate.getMonth(),

        year: pmCurrentDate.getFullYear()

    };

}


// ==========================================
// GO TO DATE
// ==========================================

function goToPMDate(date) {

    if (!(date instanceof Date)) {

        date = new Date(date);

    }

    if (isNaN(date)) return;

    pmCurrentDate = new Date(date);

    refreshPMCalendar();

}


// ==========================================
// INITIALIZE SAFELY
// ==========================================

function initializePMCalendarSafely() {

    if (

        !document.getElementById("pmCalendar")

    ) {

        return;

    }

    initializePMCalendar();

}


// ==========================================
// PUBLIC API
// ==========================================

window.initializePMCalendar =
    initializePMCalendar;

window.refreshPMCalendar =
    refreshPMCalendar;

window.setPMEvents =
    setPMEvents;

window.addPMEvent =
    addPMEvent;

window.removePMEvent =
    removePMEvent;

window.clearPMEvents =
    clearPMEvents;

window.goToPMDate =
    goToPMDate;

window.getCurrentPMMonth =
    getCurrentPMMonth;

window.getSelectedPMDate =
    getSelectedPMDate;
;
/* source: dashboard_v2/js/pmDrawer.js */
// PM scheduling drawer: one API-driven form, no fragmented dropdown calls.
let selectedPMDate = null;
let pmFormData = { departments: [], assets: [], engineers: [] };

const pmDrawerOverlay = () => document.getElementById("pmDrawerOverlay");
const pmDateInput = () => document.getElementById("pmDate");

function initializePMDrawer() {
    if (!pmDrawerOverlay()) return;
    document.getElementById("pmDrawerClose")?.addEventListener("click", closePMDrawer);
    document.getElementById("pmCancelButton")?.addEventListener("click", closePMDrawer);
    document.getElementById("pmScheduleButton")?.addEventListener("click", savePMSchedule);
    document.getElementById("pmDepartment")?.addEventListener("change", event => populateDepartmentAssets(event.target.value));
    document.getElementById("pmEquipment")?.addEventListener("change", event => setPMFrequencyFromAsset(event.target.value));
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && pmDrawerOverlay()?.classList.contains("active")) closePMDrawer();
    });
}

async function openPMDrawer(date) {
    selectedPMDate = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(selectedPMDate.getTime())) return;
    pmDateInput().value = formatDrawerDate(selectedPMDate);
    document.getElementById("pmDepartment").value = "";
    document.getElementById("pmEquipment").innerHTML = '<option value="">Select a department first</option>';
    document.getElementById("pmEquipment").disabled = true;
    document.getElementById("pmEngineer").value = "";
    document.getElementById("pmFrequency").value = "90";
    document.getElementById("pmRemarks").value = "";
    pmDrawerOverlay().classList.add("active");
    await loadPMDrawerData();
}

function closePMDrawer() {
    pmDrawerOverlay()?.classList.remove("active");
}

function formatDrawerDate(date) {
    return date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

async function loadPMDrawerData() {
    const department = document.getElementById("pmDepartment");
    const equipment = document.getElementById("pmEquipment");
    const engineer = document.getElementById("pmEngineer");
    const button = document.getElementById("pmScheduleButton");
    try {
        if (button) button.disabled = true;
        department.innerHTML = '<option value="">Loading departments…</option>';
        equipment.innerHTML = '<option value="">Select a department first</option>';
        equipment.disabled = true;
        engineer.innerHTML = '<option value="">Loading engineers…</option>';
        const response = await fetch("/api/pm/form-data", { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || "Unable to load PM scheduling data.");
        pmFormData = {
            departments: Array.isArray(result.departments) ? result.departments : [],
            assets: Array.isArray(result.assets) ? result.assets : [],
            engineers: Array.isArray(result.engineers) ? result.engineers : [],
        };
        department.innerHTML = '<option value="">Select Department</option>' + pmFormData.departments.map(item => `<option value="${pmDrawerEscape(item)}">${pmDrawerEscape(item)}</option>`).join("");
        engineer.innerHTML = '<option value="">Assign Biomedical Engineer</option>' + pmFormData.engineers.map(item => `<option value="${item.id}">${pmDrawerEscape(item.name)}</option>`).join("");
        if (!pmFormData.departments.length) {
            department.innerHTML = '<option value="">No department users are available</option>';
        }
        if (!pmFormData.engineers.length) {
            engineer.innerHTML = '<option value="">No biomedical engineer is available</option>';
        }
    } catch (error) {
        console.error(error);
        department.innerHTML = '<option value="">Could not load departments</option>';
        engineer.innerHTML = '<option value="">Could not load engineers</option>';
        BioTrackToast.error("PM form unavailable", error.message);
    } finally {
        if (button) button.disabled = false;
    }
}

function populateDepartmentAssets(department) {
    const equipment = document.getElementById("pmEquipment");
    equipment.innerHTML = '<option value="">Select Equipment</option>';
    if (!department) {
        equipment.disabled = true;
        return;
    }
    const matching = pmFormData.assets.filter(asset => !asset.department || asset.department === department);
    matching.forEach(asset => {
        const assignment = asset.department ? "" : " — unassigned (will be assigned)";
        equipment.innerHTML += `<option value="${asset.id}">${pmDrawerEscape(asset.equipment_name || asset.asset_code || "Unnamed asset")}${assignment}</option>`;
    });
    equipment.disabled = matching.length === 0;
    if (!matching.length) equipment.innerHTML = '<option value="">No biomedical assets are available</option>';
}

function setPMFrequencyFromAsset(assetId) {
    const asset = pmFormData.assets.find(item => String(item.id) === String(assetId));
    const frequency = document.getElementById("pmFrequency");
    if (asset && asset.pm_frequency && frequency.querySelector(`option[value="${asset.pm_frequency}"]`)) {
        frequency.value = String(asset.pm_frequency);
    } else {
        frequency.value = "90";
    }
}

async function savePMSchedule() {
    const department = document.getElementById("pmDepartment").value;
    const equipment = document.getElementById("pmEquipment").value;
    const engineer = document.getElementById("pmEngineer").value;
    const frequency = Number(document.getElementById("pmFrequency").value);
    const remarks = document.getElementById("pmRemarks").value.trim();
    const button = document.getElementById("pmScheduleButton");
    if (!department || !equipment || !engineer || !selectedPMDate) {
        BioTrackToast.warning("Complete the PM schedule", "Select a department, equipment and biomedical engineer.");
        return;
    }
    if (!Number.isInteger(frequency) || frequency <= 0) {
        BioTrackToast.warning("Invalid PM frequency", "Choose a frequency greater than zero.");
        return;
    }
    const payload = {
        asset_id: Number(equipment),
        department,
        frequency_days: frequency,
        scheduled_date: formatPMDate(selectedPMDate),
        engineer_id: Number(engineer),
        remarks,
    };
    try {
        button.disabled = true;
        button.textContent = "Scheduling…";
        const response = await fetch("/api/pm/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || "Unable to schedule preventive maintenance.");
        closePMDrawer();
        if (typeof loadEngineeringPMSchedules === "function") await loadEngineeringPMSchedules();
        if (typeof showSuccess === "function") {
            showSuccess({ title: "PM scheduled", message: "The department will now be able to approve or decline the planned visit.", buttonText: "Continue" });
        } else {
            BioTrackToast.success("PM scheduled", "The preventive-maintenance visit was scheduled successfully.");
        }
    } catch (error) {
        console.error(error);
        BioTrackToast.error("PM schedule failed", error.message);
    } finally {
        button.disabled = false;
        button.textContent = "Schedule PM";
    }
}

function getSelectedPMDate() {
    return selectedPMDate;
}
function pmDrawerEscape(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

window.openPMDrawer = openPMDrawer;
window.closePMDrawer = closePMDrawer;
window.getSelectedPMDate = getSelectedPMDate;
;
/* source: dashboard_v2/js/pmScheduleOverview.js */
// Live PM schedule overview for biomedical engineers and administrators.
async function loadEngineeringPMSchedules() {
    const container = document.getElementById("pmScheduleOverview");
    if (!container) return;
    container.innerHTML = '<div class="pm-overview-loading">Loading scheduled PM visits…</div>';
    try {
        const response = await fetch("/api/pm/all");
        if (!response.ok) throw new Error("Unable to load PM schedules.");
        const schedules = await response.json();
        const items = Array.isArray(schedules) ? schedules : [];
        setPMEvents(items.map(item => ({ date: item.scheduled_date, status: item.status })));
        renderEngineeringPMSchedules(items);
    } catch (error) {
        console.error(error);
        container.innerHTML = `<div class="pm-overview-empty">${pmOverviewEscape(error.message)}</div>`;
    }
}

function renderEngineeringPMSchedules(schedules) {
    const container = document.getElementById("pmScheduleOverview");
    if (!container) return;
    if (!schedules.length) {
        container.innerHTML = `<div class="pm-overview-card"><div class="pm-overview-header"><div><span>Live schedule</span><h2>Department confirmations</h2></div></div><div class="pm-overview-empty">No PM visits have been scheduled yet.</div></div>`;
        return;
    }
    container.innerHTML = `
      <div class="pm-overview-card">
        <div class="pm-overview-header"><div><span>Live schedule</span><h2>Department confirmations</h2><p>PM dates, approval decisions and notes from department users.</p></div><button class="pm-overview-refresh" onclick="loadEngineeringPMSchedules()"><i data-lucide="refresh-cw"></i> Refresh</button></div>
        <div class="pm-overview-list">
          ${schedules.map(item => `
            <article class="pm-overview-row">
              <div class="pm-overview-date"><strong>${pmOverviewDay(item.scheduled_date)}</strong><span>${pmOverviewMonth(item.scheduled_date)}</span></div>
              <div class="pm-overview-equipment"><strong>${pmOverviewEscape(item.equipment_name || "Department equipment")}</strong><span>${pmOverviewEscape(item.asset_code || "-")} · ${pmOverviewEscape(item.department || "No department")}</span></div>
              <div class="pm-overview-state"><b class="pm-overview-badge ${pmOverviewClass(item.status)}">${pmOverviewEscape(item.status || "Upcoming")}</b><small>PM status</small></div>
              <div class="pm-overview-response"><b class="pm-overview-response-badge ${pmOverviewClass(item.department_response)}">${pmOverviewEscape(item.department_response || "Pending")}</b><small>Department response</small>${item.department_response_note ? `<p>“${pmOverviewEscape(item.department_response_note)}”</p>` : ""}</div>
              <a class="pm-overview-calendar-link" href="${pmOverviewGoogleCalendarUrl(item)}" target="_blank" rel="noopener noreferrer" aria-label="Add ${pmOverviewEscape(item.equipment_name || "PM visit")} to Google Calendar"><i data-lucide="calendar-plus"></i> Add to Google Calendar</a>
            </article>
          `).join("")}
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
}

function pmOverviewGoogleCalendarUrl(item) {
    const startDate = String(item.scheduled_date || "").replaceAll("-", "");
    const parsedDate = new Date(`${item.scheduled_date}T00:00:00Z`);
    if (!startDate || Number.isNaN(parsedDate.getTime())) return "https://calendar.google.com/calendar/";
    parsedDate.setUTCDate(parsedDate.getUTCDate() + 1);
    const endDate = parsedDate.toISOString().slice(0, 10).replaceAll("-", "");
    const title = `Preventive Maintenance — ${item.equipment_name || item.asset_code || "Equipment"}`;
    const details = [
        `BioTrack PM schedule #${item.id}`,
        `Asset: ${item.asset_code || "—"}`,
        `Department: ${item.department || "—"}`,
        `Location: ${item.location || "—"}`,
        `Status: ${item.status || "Upcoming"}`,
        item.remarks ? `Remarks: ${item.remarks}` : "",
    ].filter(Boolean).join("\n");
    const params = new URLSearchParams({
        action: "TEMPLATE",
        text: title,
        dates: `${startDate}/${endDate}`,
        details,
        location: item.location || "",
    });
    return `https://calendar.google.com/calendar/u/0/r/eventedit?${params.toString()}`;
}

function pmOverviewDay(value) {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? "—" : String(date.getDate()).padStart(2, "0");
}
function pmOverviewMonth(value) {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(undefined, { month: "short" }).format(date);
}
function pmOverviewClass(value) {
    return String(value || "pending").toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
}
function pmOverviewEscape(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
;
/* source: dashboard_v2/views/reportsView.js */


function reportsView() {

    return `

<section class="reports-page">

    <!-- ==========================================
        REPORTS HEADER
    =========================================== -->

    <header class="reports-header">

        <div class="reports-header-left">

            <div class="reports-icon">

                <i class="fa-solid fa-chart-pie"></i>

            </div>

            <div class="reports-title">

                <h1>Reports</h1>

                <p>

                    Get insights and analytics on maintenance
                    activities, equipment performance and
                    biomedical service efficiency.

                </p>

            </div>

        </div>

        <div class="reports-header-image">

            <img
                src="/static/assets/reports-banner.svg"
                alt="Reports Illustration"
                loading="lazy"
                decoding="async">

        </div>

    </header>



    <!-- ==========================================
        FILTERS
    =========================================== -->

    <section class="reports-filters">

        <div class="reports-filter-grid">

            <div class="reports-filter">

                <label>Date Range</label>

                <div class="reports-input">

                    <i class="fa-regular fa-calendar"></i>

                    <input
                        type="date"
                        id="reportsStartDate">

                    <span>-</span>

                    <input
                        type="date"
                        id="reportsEndDate">

                </div>

            </div>

            <div class="reports-filter">

                <label>Department</label>

                <div class="reports-input">

                    <i class="fa-solid fa-building"></i>

                    <select id="reportsDepartment">

                        <option>All Departments</option>

                        <option>ICU</option>

                        <option>Radiology</option>

                        <option>Operation Theatre</option>

                        <option>Emergency</option>

                        <option>Laboratory</option>

                        <option>Biomedical Engineering</option>

                    </select>

                </div>

            </div>

            <div class="reports-filter">

                <label>Location</label>

                <div class="reports-input">

                    <i class="fa-solid fa-location-dot"></i>

                    <select id="reportsLocation">

                        <option>All Locations</option>

                        <option>Main Building</option>

                        <option>Block A</option>

                        <option>Block B</option>

                        <option>Emergency Wing</option>

                    </select>

                </div>

            </div>

            <div class="reports-filter">

                <label>Equipment</label>

                <div class="reports-input">

                    <i class="fa-solid fa-stethoscope"></i>

                    <select id="reportsEquipment">

                        <option>All Equipment</option>

                        <option>Ventilator</option>

                        <option>Patient Monitor</option>

                        <option>ECG</option>

                        <option>X-Ray</option>

                        <option>Ultrasound</option>

                    </select>

                </div>

            </div>

            <div class="reports-filter-buttons">

                <button
                    class="reports-btn-secondary"
                    id="reportsResetBtn">

                    Reset

                </button>

                <button
                    class="reports-btn-primary"
                    id="reportsApplyBtn">

                    <i class="fa-solid fa-filter"></i>

                    Apply Filters

                </button>

            </div>

        </div>

    </section>



    <!-- ==========================================
        KPI SECTION
    =========================================== -->

    <section class="reports-kpi-grid">
    <!-- ==========================================
        KPI CARDS
    =========================================== -->

    <section class="reports-kpi-section">

        <!-- Total Requests -->

        <div class="reports-kpi-card">

            <div class="reports-kpi-icon reports-blue">

                <i class="fa-solid fa-clipboard-list"></i>

            </div>

            <div class="reports-kpi-content">

                <span class="reports-kpi-title">

                    Total Requests

                </span>

                <h2 id="reportsTotalRequests">

                    128

                </h2>

                <p class="reports-kpi-trend positive">

                    <i class="fa-solid fa-arrow-trend-up"></i>

                    +12.4% from last month

                </p>

            </div>

        </div>

        <!-- Completed -->

        <div class="reports-kpi-card">

            <div class="reports-kpi-icon reports-green">

                <i class="fa-solid fa-circle-check"></i>

            </div>

            <div class="reports-kpi-content">

                <span class="reports-kpi-title">

                    Completed

                </span>

                <h2 id="reportsCompletedRequests">

                    89

                </h2>

                <p class="reports-kpi-trend positive">

                    <i class="fa-solid fa-arrow-trend-up"></i>

                    +15.7% completion

                </p>

            </div>

        </div>

        <!-- Pending -->

        <div class="reports-kpi-card">

            <div class="reports-kpi-icon reports-yellow">

                <i class="fa-solid fa-clock"></i>

            </div>

            <div class="reports-kpi-content">

                <span class="reports-kpi-title">

                    Pending

                </span>

                <h2 id="reportsPendingRequests">

                    26

                </h2>

                <p class="reports-kpi-trend warning">

                    Awaiting Engineer

                </p>

            </div>

        </div>

        <!-- Overdue -->

        <div class="reports-kpi-card">

            <div class="reports-kpi-icon reports-red">

                <i class="fa-solid fa-triangle-exclamation"></i>

            </div>

            <div class="reports-kpi-content">

                <span class="reports-kpi-title">

                    Overdue

                </span>

                <h2 id="reportsOverdueRequests">

                    13

                </h2>

                <p class="reports-kpi-trend negative">

                    Immediate attention required

                </p>

            </div>

        </div>

        <!-- Average Downtime -->

        <div class="reports-kpi-card">

            <div class="reports-kpi-icon reports-cyan">

                <i class="fa-solid fa-stopwatch"></i>

            </div>

            <div class="reports-kpi-content">

                <span class="reports-kpi-title">

                    Avg. Downtime

                </span>

                <h2>

                    <span id="reportsAvgDowntime">

                        24.6

                    </span>

                    <small>hrs</small>

                </h2>

                <p class="reports-kpi-trend positive">

                    −9.8% from last month

                </p>

            </div>

        </div>

    </section>



    <!-- ==========================================
        REPORT GRID
    =========================================== -->

    <section class="reports-grid">
    <!-- ==========================================
        REQUESTS OVERVIEW
    =========================================== -->

    <section class="reports-card reports-card-large">

        <div class="reports-card-header">

            <div>

                <h3>Requests Overview</h3>

                <p>Monthly biomedical maintenance requests</p>

            </div>

            <select
                class="reports-select"
                id="reportsOverviewRange">

                <option>Last 30 Days</option>
                <option selected>Last 12 Months</option>
                <option>This Year</option>

            </select>

        </div>

        <div class="reports-chart-container">

            <canvas id="reportsOverviewChart"></canvas>

        </div>

    </section>



    <!-- ==========================================
        REQUEST STATUS
    =========================================== -->

    <section class="reports-card">

        <div class="reports-card-header">

            <div>

                <h3>Requests by Status</h3>

                <p>Current maintenance request status</p>

            </div>

        </div>

        <div class="reports-chart-container reports-chart-small">

            <canvas id="reportsStatusChart"></canvas>

        </div>

        <div class="reports-legend">

            <div class="reports-legend-item">

                <span class="reports-dot reports-green"></span>

                <span>Completed</span>

                <strong>89</strong>

            </div>

            <div class="reports-legend-item">

                <span class="reports-dot reports-yellow"></span>

                <span>Pending</span>

                <strong>26</strong>

            </div>

            <div class="reports-legend-item">

                <span class="reports-dot reports-red"></span>

                <span>Overdue</span>

                <strong>13</strong>

            </div>

        </div>

    </section>



    <!-- ==========================================
        PROBLEM CATEGORIES
    =========================================== -->

    <section class="reports-card">

        <div class="reports-card-header">

            <div>

                <h3>Top Problem Categories</h3>

                <p>Distribution of reported faults</p>

            </div>

        </div>

        <div class="reports-chart-container reports-chart-small">

            <canvas id="reportsCategoryChart"></canvas>

        </div>

        <div class="reports-legend">

            <div class="reports-legend-item">

                <span class="reports-dot reports-blue"></span>

                <span>Electrical</span>

                <strong>38</strong>

            </div>

            <div class="reports-legend-item">

                <span class="reports-dot reports-purple"></span>

                <span>Mechanical</span>

                <strong>32</strong>

            </div>

            <div class="reports-legend-item">

                <span class="reports-dot reports-cyan"></span>

                <span>Software</span>

                <strong>21</strong>

            </div>

            <div class="reports-legend-item">

                <span class="reports-dot reports-green"></span>

                <span>Calibration</span>

                <strong>15</strong>

            </div>

            <div class="reports-legend-item">

                <span class="reports-dot reports-gray"></span>

                <span>Others</span>

                <strong>22</strong>

            </div>

        </div>

    </section>



    <!-- ==========================================
        REQUESTS BY DEPARTMENT
    =========================================== -->

    <section class="reports-card">

        <div class="reports-card-header">

            <h3>Requests by Department</h3>

            <button class="reports-icon-button" type="button" aria-label="Expand requests by department chart">

                <i class="fa-solid fa-arrow-up-right-from-square"></i>

            </button>

        </div>

        <div class="reports-chart-container">

            <canvas id="reportsDepartmentChart"></canvas>

        </div>

    </section>



    <!-- ==========================================
        DOWNTIME TREND
    =========================================== -->

    <section class="reports-card">

        <div class="reports-card-header">

            <h3>Downtime Trend</h3>

            <button class="reports-icon-button" type="button" aria-label="Expand downtime trend chart">

                <i class="fa-solid fa-arrow-up-right-from-square"></i>

            </button>

        </div>

        <div class="reports-chart-container">

            <canvas id="reportsDowntimeChart"></canvas>

        </div>

    </section>
    <!-- ==========================================
        REPORT SUMMARY
    =========================================== -->

    <section class="reports-summary-card">

        <div class="reports-card-header">

            <h3>Reports Summary</h3>

        </div>

        <div class="reports-summary-list">

            <div class="reports-summary-item">

                <span>

                    <i class="fa-solid fa-clipboard-list reports-blue"></i>

                    Total Requests

                </span>

                <strong>128</strong>

            </div>

            <div class="reports-summary-item">

                <span>

                    <i class="fa-solid fa-circle-check reports-green"></i>

                    Completed Requests

                </span>

                <strong>89</strong>

            </div>

            <div class="reports-summary-item">

                <span>

                    <i class="fa-solid fa-clock reports-yellow"></i>

                    Pending Requests

                </span>

                <strong>26</strong>

            </div>

            <div class="reports-summary-item">

                <span>

                    <i class="fa-solid fa-triangle-exclamation reports-red"></i>

                    Overdue Requests

                </span>

                <strong>13</strong>

            </div>

            <div class="reports-summary-item">

                <span>

                    <i class="fa-solid fa-stopwatch reports-cyan"></i>

                    Average Downtime

                </span>

                <strong>24.6 hrs</strong>

            </div>

            <div class="reports-summary-item">

                <span>

                    <i class="fa-solid fa-hospital reports-purple"></i>

                    Active Departments

                </span>

                <strong>6</strong>

            </div>

        </div>

    </section>



    <!-- ==========================================
        EXPORT REPORTS
    =========================================== -->

    <section class="reports-export-card">

        <div class="reports-card-header">

            <div>

                <h3>Export Reports</h3>

                <p>

                    Download reports or schedule
                    automatic report generation.

                </p>

            </div>

        </div>

        <div class="reports-export-grid">

            <button
                class="reports-btn-secondary reports-executive-pdf"
                id="reportsPdfBtn">

                <span class="reports-export-icon reports-export-icon-pdf" aria-hidden="true">
                    <i class="fa-solid fa-file-pdf"></i>
                </span>

                <span class="reports-export-copy">
                    <strong>Executive PDF</strong>
                    <small>Charts, KPIs &amp; call register</small>
                </span>

                <span class="reports-export-badge">Recommended</span>

            </button>

            <button
                class="reports-btn-secondary"
                id="reportsExcelBtn">

                <i class="fa-solid fa-file-excel"></i>

                Export Excel

            </button>

            <button
                class="reports-btn-secondary"
                id="reportsCsvBtn">

                <i class="fa-solid fa-file-csv"></i>

                Export CSV

            </button>

            <button
                class="reports-btn-primary"
                id="reportsScheduleBtn">

                <i class="fa-solid fa-calendar-days"></i>

                Schedule Report

            </button>

        </div>

    </section>

</section>

</section>

`;
}
/* ==========================================
   RENDER REPORTS
========================================== */

function renderReports() {

    const pageContent = document.getElementById("page-content");

    pageContent.innerHTML = reportsView();

    if (typeof startReports === "function") {

        startReports();

    }

}

/* ==========================================
   GLOBAL FUNCTIONS
========================================== */

window.reportsView = reportsView;
window.renderReports = renderReports;
;
/* source: dashboard_v2/js/reports.js */
/* ==========================================================
   BIOTRACK REPORTS
   reports.js
========================================================== */
/* ==========================================================
   API
========================================================== */

let reportScheduleTimers = [];

async function reportsApi(url){

    const response = await fetch(url);

    if(!response.ok){

        throw new Error("Failed to load report data");

    }

    return await response.json();

}
/* ==========================================================
   INITIALIZE REPORTS
========================================================== */

async function initializeReports(){

    initializeReportsFilters();

    initializeReportsRipple();

    initializeReportChartExpanders();

    await animateReportsKPIs();

    loadReportsFilters();

    initializeReportsCharts();

    initializeReportsExport();

}

function initializeReportChartExpanders(){
    document.querySelectorAll(".reports-icon-button").forEach(button=>{
        button.addEventListener("click",()=>{
            const card=button.closest(".reports-card");
            const canvas=card?.querySelector("canvas");
            const chart=canvas&&typeof Chart!=="undefined"?Chart.getChart(canvas):null;
            if(!card||!canvas||!chart){
                showReportsToast("Chart is not ready yet. Please try again.");
                return;
            }
            let dialog=document.getElementById("reportsChartDialog");
            if(!dialog){
                dialog=document.createElement("dialog");
                dialog.id="reportsChartDialog";
                dialog.className="reports-chart-dialog";
                dialog.innerHTML='<form method="dialog"><button class="reports-chart-dialog-close" aria-label="Close expanded chart">×</button></form><h2></h2><img alt="Expanded report chart">';
                dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close();});
                document.body.appendChild(dialog);
            }
            dialog.querySelector("h2").textContent=card.querySelector("h3")?.textContent||"Report chart";
            dialog.querySelector("img").src=chart.toBase64Image();
            if(!dialog.open)dialog.showModal();
        });
    });
}

/* ==========================================================
   FILTERS
========================================================== */

function initializeReportsFilters(){

    const applyButton=document.getElementById("reportsApplyBtn");
    const resetButton=document.getElementById("reportsResetBtn");

    if(applyButton){

        applyButton.addEventListener(

            "click",

            applyReportsFilters

        );

    }

    if(resetButton){

        resetButton.addEventListener(

            "click",

            resetReportsFilters

        );

    }

}

function applyReportsFilters(){

    const filters={

        startDate:getReportsValue("reportsStartDate"),

        endDate:getReportsValue("reportsEndDate"),

        department:getReportsValue("reportsDepartment"),

        location:getReportsValue("reportsLocation"),

        equipment:getReportsValue("reportsEquipment")

    };

    localStorage.setItem(

        "biotrackReportsFilters",

        JSON.stringify(filters)

    );

    showReportsToast(

        "Filters Applied",

        "Reports updated successfully.",

        "success"

    );

}

function resetReportsFilters(){

    setReportsValue(

        "reportsStartDate",

        ""

    );

    setReportsValue(

        "reportsEndDate",

        ""

    );

    setReportsSelect(

        "reportsDepartment",

        0

    );

    setReportsSelect(

        "reportsLocation",

        0

    );

    setReportsSelect(

        "reportsEquipment",

        0

    );

    localStorage.removeItem(

        "biotrackReportsFilters"

    );

    showReportsToast(

        "Filters Reset",

        "Showing all maintenance reports.",

        "info"

    );

}

function loadReportsFilters(){

    const saved=JSON.parse(

        localStorage.getItem(

            "biotrackReportsFilters"

        )

    );

    if(!saved) return;

    setReportsValue(

        "reportsStartDate",

        saved.startDate

    );

    setReportsValue(

        "reportsEndDate",

        saved.endDate

    );

    setReportsValue(

        "reportsDepartment",

        saved.department

    );

    setReportsValue(

        "reportsLocation",

        saved.location

    );

    setReportsValue(

        "reportsEquipment",

        saved.equipment

    );

}

/* ==========================================================
   HELPERS
========================================================== */

function getReportsValue(id){

    const element=document.getElementById(id);

    return element ? element.value : "";

}

function setReportsValue(id,value){

    const element=document.getElementById(id);

    if(element){

        element.value=value;

    }

}

function setReportsSelect(id,index){

    const element=document.getElementById(id);

    if(element){

        element.selectedIndex=index;

    }

}

/* ==========================================================
   KPI ANIMATION
========================================================== */

async function animateReportsKPIs(){

    try{

        const summary = await reportsApi("/api/reports/summary");

        animateCounter(
            "reportsTotalRequests",
            summary.maintenance_requests
        );

        animateCounter(
            "reportsCompletedRequests",
            summary.completed_requests
        );

        animateCounter(
            "reportsPendingRequests",
            summary.pending_requests
        );

        animateCounter(
            "reportsOverdueRequests",
            summary.overdue_requests
        );

        animateDecimal(
            "reportsAvgDowntime",
            summary.average_downtime
        );

    }

    catch(error){

        console.error(error);

    }

}

function animateCounter(id,target){

    const element=document.getElementById(id);

    if(!element) return;

    let current=0;

    const step=Math.ceil(target/45);

    const timer=setInterval(()=>{

        current+=step;

        if(current>=target){

            current=target;

            clearInterval(timer);

        }

        element.textContent=current;

    },20);

}

function animateDecimal(id,target){

    const element=document.getElementById(id);

    if(!element) return;

    let value=0;

    const timer=setInterval(()=>{

        value+=0.5;

        if(value>=target){

            value=target;

            clearInterval(timer);

        }

        element.textContent=value.toFixed(1);

    },20);

}

/* ==========================================================
   RIPPLE EFFECT
========================================================== */

function initializeReportsRipple(){

    document.querySelectorAll(

        ".reports-btn-primary,.reports-btn-secondary,.reports-icon-button"

    ).forEach(button=>{

        button.addEventListener(

            "click",

            createReportsRipple

        );

    });

}

function createReportsRipple(event){

    const button=event.currentTarget;

    const ripple=document.createElement("span");

    const size=Math.max(

        button.clientWidth,

        button.clientHeight

    );

    const rect=button.getBoundingClientRect();

    ripple.className="reports-ripple";

    ripple.style.width=size+"px";

    ripple.style.height=size+"px";

    ripple.style.left=

        event.clientX-

        rect.left-

        size/2+"px";

    ripple.style.top=

        event.clientY-

        rect.top-

        size/2+"px";

    button.appendChild(ripple);

    setTimeout(()=>{

        ripple.remove();

    },600);

}
/* ==========================================================
   CHARTS
========================================================== */

function reportsDarkModeEnabled(){
    return document.body.classList.contains("dark-theme");
}

function reportsChartGridColor(){
    return reportsDarkModeEnabled() ? "rgba(148,163,184,.18)" : "#eef2f7";
}

function applyReportsChartTheme(){
    if(typeof Chart === "undefined") return;
    Chart.defaults.color = reportsDarkModeEnabled() ? "#aebed2" : "#64748b";
    Chart.defaults.borderColor = reportsChartGridColor();
}

function initializeReportsCharts(){

    createReportsOverviewChart();

    createReportsStatusChart();

    createReportsCategoryChart();

    createReportsDepartmentChart();

    createReportsDowntimeChart();

}

/* ==========================================================
   REQUESTS OVERVIEW
========================================================== */

function createReportsOverviewChart(){

    applyReportsChartTheme();

    const canvas=document.getElementById("reportsOverviewChart");

    if(!canvas || typeof Chart==="undefined") return;

    new Chart(canvas,{

        type:"line",

        data:{

            labels:[
                "Jan","Feb","Mar","Apr","May","Jun",
                "Jul","Aug","Sep","Oct","Nov","Dec"
            ],

            datasets:[{

                label:"Requests",

                data:[62,71,69,84,90,86,98,104,99,113,121,128],

                borderColor:"#2563eb",

                backgroundColor:"rgba(37,99,235,.12)",

                fill:true,

                tension:.4,

                pointRadius:4,

                pointHoverRadius:6

            }]

        },

        options:{

            responsive:true,

            maintainAspectRatio:false,

            plugins:{

                legend:{display:false}

            },

            scales:{

                x:{

                    grid:{display:false}

                },

                y:{

                    beginAtZero:true,

                    grid:{color:reportsChartGridColor()}

                }

            }

        }

    });

}

/* ==========================================================
   STATUS CHART
========================================================== */

function createReportsStatusChart(){

    applyReportsChartTheme();

    const canvas=document.getElementById("reportsStatusChart");

    if(!canvas || typeof Chart==="undefined") return;

    new Chart(canvas,{

        type:"doughnut",

        data:{

            labels:[

                "Completed",

                "Pending",

                "Overdue"

            ],

            datasets:[{

                data:[89,26,13],

                backgroundColor:[

                    "#16a34a",

                    "#f59e0b",

                    "#ef4444"

                ],

                borderWidth:0

            }]

        },

        options:{

            responsive:true,

            maintainAspectRatio:false,

            cutout:"72%",

            plugins:{

                legend:{display:false}

            }

        }

    });

}

/* ==========================================================
   CATEGORY CHART
========================================================== */

function createReportsCategoryChart(){

    applyReportsChartTheme();

    const canvas=document.getElementById("reportsCategoryChart");

    if(!canvas || typeof Chart==="undefined") return;

    new Chart(canvas,{

        type:"doughnut",

        data:{

            labels:[

                "Electrical",

                "Mechanical",

                "Software",

                "Calibration",

                "Others"

            ],

            datasets:[{

                data:[38,32,21,15,22],

                backgroundColor:[

                    "#2563eb",

                    "#8b5cf6",

                    "#06b6d4",

                    "#22c55e",

                    "#94a3b8"

                ],

                borderWidth:0

            }]

        },

        options:{

            responsive:true,

            maintainAspectRatio:false,

            cutout:"68%",

            plugins:{

                legend:{display:false}

            }

        }

    });

}

/* ==========================================================
   DEPARTMENT CHART
========================================================== */

function createReportsDepartmentChart(){

    applyReportsChartTheme();

    const canvas=document.getElementById("reportsDepartmentChart");

    if(!canvas || typeof Chart==="undefined") return;

    new Chart(canvas,{

        type:"bar",

        data:{

            labels:[

                "ICU",

                "Radiology",

                "OT",

                "Emergency",

                "Lab",

                "BME"

            ],

            datasets:[{

                data:[28,20,17,25,15,23],

                backgroundColor:"#2563eb",

                borderRadius:8,

                borderSkipped:false

            }]

        },

        options:{

            responsive:true,

            maintainAspectRatio:false,

            plugins:{

                legend:{display:false}

            },

            scales:{

                x:{

                    grid:{display:false}

                },

                y:{

                    beginAtZero:true,

                    grid:{color:reportsChartGridColor()}

                }

            }

        }

    });

}

/* ==========================================================
   DOWNTIME TREND
========================================================== */

function createReportsDowntimeChart(){

    applyReportsChartTheme();

    const canvas=document.getElementById("reportsDowntimeChart");

    if(!canvas || typeof Chart==="undefined") return;

    new Chart(canvas,{

        type:"line",

        data:{

            labels:[
                "Jan","Feb","Mar","Apr","May","Jun",
                "Jul","Aug","Sep","Oct","Nov","Dec"
            ],

            datasets:[{

                label:"Downtime",

                data:[38,36,34,31,29,30,27,24,23,22,20,19],

                borderColor:"#06b6d4",

                backgroundColor:"rgba(6,182,212,.12)",

                fill:true,

                tension:.4,

                pointRadius:4,

                pointHoverRadius:6

            }]

        },

        options:{

            responsive:true,

            maintainAspectRatio:false,

            plugins:{

                legend:{display:false}

            },

            scales:{

                x:{

                    grid:{display:false}

                },

                y:{

                    beginAtZero:true,

                    grid:{color:reportsChartGridColor()}

                }

            }

        }

    });

}
/* ==========================================================
   EXPORT
========================================================== */

function initializeReportsExport(){

    registerReportsExport("reportsPdfBtn", "pdf");
    registerReportsExport("reportsExcelBtn", "xlsx");
    registerReportsExport("reportsCsvBtn", "csv");

    const scheduleButton=document.getElementById(

        "reportsScheduleBtn"

    );

    if(scheduleButton){

        scheduleButton.addEventListener(

            "click",

            openReportsScheduleDialog

        );

    }

    void loadAndArmReportSchedules();

}

function currentReportsFilters(){
    const normalize = (value, allPrefix) => value && !value.toLowerCase().startsWith(allPrefix) ? value : "";
    return {
        start_date:getReportsValue("reportsStartDate"),
        end_date:getReportsValue("reportsEndDate"),
        department:normalize(getReportsValue("reportsDepartment"), "all department"),
        location:normalize(getReportsValue("reportsLocation"), "all location"),
        equipment:normalize(getReportsValue("reportsEquipment"), "all equipment"),
    };
}

function reportsExportUrl(type,filters=currentReportsFilters()){
    const params=new URLSearchParams();
    Object.entries(filters||{}).forEach(([key,value])=>{if(value)params.set(key,value);});
    const query=params.toString();
    return `/api/reports/export/${type}${query?`?${query}`:""}`;
}

async function downloadReportsExport(type,button=null,filters=currentReportsFilters(),notify=true){
    const labels={pdf:"PDF",xlsx:"Excel",csv:"CSV"};
    const original=button?.innerHTML;
    if(button){
        button.disabled=true;
        button.innerHTML='<span class="reports-loader"></span> Generating...';
    }
    try{
        const response=await fetch(reportsExportUrl(type,filters));
        if(!response.ok){
            const result=await response.json().catch(()=>({}));
            throw new Error(result.detail||`Unable to generate the ${labels[type]||type} report.`);
        }
        const blob=await response.blob();
        const disposition=response.headers.get("Content-Disposition")||"";
        const filenameMatch=disposition.match(/filename="?([^";]+)"?/i);
        const filename=filenameMatch?.[1]||`BioTrack-report.${type}`;
        const url=URL.createObjectURL(blob);
        const anchor=document.createElement("a");
        anchor.href=url;
        anchor.download=filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(()=>URL.revokeObjectURL(url),1000);
        if(notify)showReportsToast(`${labels[type]||type} report ready`,`${filename} was downloaded.`,"success");
        return true;
    }catch(error){
        showReportsToast("Report export failed",error.message||"The report could not be generated.","error");
        return false;
    }finally{
        if(button){
            button.disabled=false;
            button.innerHTML=original;
        }
    }
}

function registerReportsExport(id,type){

    const button=document.getElementById(id);

    if(!button) return;

    button.addEventListener(

        "click",

        ()=>downloadReportsExport(type,button)

    );

}

function localDateTimeInputValue(date){
    const local=new Date(date.getTime()-date.getTimezoneOffset()*60000);
    return local.toISOString().slice(0,16);
}

function closeReportsScheduleDialog(){
    document.getElementById("reportsScheduleOverlay")?.remove();
}

function cleanupReportsSchedules(){
    closeReportsScheduleDialog();
    reportScheduleTimers.forEach(timer=>window.clearTimeout(timer));
    reportScheduleTimers=[];
}

function openReportsScheduleDialog(){
    closeReportsScheduleDialog();
    const firstRun=new Date(Date.now()+60*60*1000);
    firstRun.setMinutes(Math.ceil(firstRun.getMinutes()/15)*15,0,0);
    const overlay=document.createElement("div");
    overlay.id="reportsScheduleOverlay";
    overlay.className="reports-schedule-overlay";
    overlay.innerHTML=`
        <section class="reports-schedule-dialog" role="dialog" aria-modal="true" aria-labelledby="reportsScheduleTitle">
            <header><span><i class="fa-solid fa-calendar-days"></i></span><div><h2 id="reportsScheduleTitle">Schedule a report</h2><p>Save a recurring export. BioTrack will download it when Reports is open at the scheduled time.</p></div><button type="button" class="reports-schedule-close" aria-label="Close">×</button></header>
            <form id="reportsScheduleForm">
                <label>Report format<select id="scheduledReportFormat"><option value="pdf">PDF</option><option value="xlsx">Excel</option><option value="csv">CSV</option></select></label>
                <label>Frequency<select id="scheduledReportFrequency"><option value="once">One time</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
                <label class="is-wide">First run<input id="scheduledReportDate" type="datetime-local" required value="${localDateTimeInputValue(firstRun)}"></label>
                <div class="reports-schedule-filter-note is-wide"><i class="fa-solid fa-filter"></i><span>The current report filters will be saved with this schedule.</span></div>
                <footer class="is-wide"><button type="button" class="reports-btn-secondary" id="cancelReportSchedule">Cancel</button><button type="submit" class="reports-btn-primary" id="saveReportSchedule"><i class="fa-solid fa-calendar-check"></i> Save schedule</button></footer>
            </form>
        </section>`;
    document.body.appendChild(overlay);
    overlay.querySelector(".reports-schedule-close").onclick=closeReportsScheduleDialog;
    overlay.querySelector("#cancelReportSchedule").onclick=closeReportsScheduleDialog;
    overlay.querySelector("#reportsScheduleForm").onsubmit=saveReportSchedule;
}

async function saveReportSchedule(event){
    event.preventDefault();
    const button=document.getElementById("saveReportSchedule");
    button.disabled=true;
    try{
        const response=await fetch("/api/reports/schedules",{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({
                report_format:getReportsValue("scheduledReportFormat"),
                frequency:getReportsValue("scheduledReportFrequency"),
                next_run_at:getReportsValue("scheduledReportDate"),
                filters:currentReportsFilters(),
            }),
        });
        const result=await response.json().catch(()=>({}));
        if(!response.ok||!result.success)throw new Error(result.detail||"Unable to save this report schedule.");
        closeReportsScheduleDialog();
        showReportsToast("Report scheduled",`First export: ${new Date(result.next_run_at).toLocaleString()}.`,"success");
        await loadAndArmReportSchedules();
    }catch(error){
        showReportsToast("Schedule not saved",error.message||"Unable to save this report schedule.","error");
        button.disabled=false;
    }
}

async function runScheduledReport(schedule){
    const downloaded=await downloadReportsExport(schedule.report_format,null,schedule.filters,false);
    if(!downloaded)return;
    const response=await fetch(`/api/reports/schedules/${Number(schedule.id)}/complete`,{method:"POST"});
    if(response.ok){
        showReportsToast("Scheduled report ready",`${String(schedule.report_format).toUpperCase()} report downloaded automatically.`,"success");
        await loadAndArmReportSchedules();
    }
}

async function loadAndArmReportSchedules(){
    reportScheduleTimers.forEach(timer=>window.clearTimeout(timer));
    reportScheduleTimers=[];
    try{
        const response=await fetch("/api/reports/schedules");
        if(!response.ok)return;
        const schedules=await response.json();
        schedules.forEach(schedule=>{
            const delay=new Date(schedule.next_run_at).getTime()-Date.now();
            if(delay>2147483647)return;
            const timer=window.setTimeout(()=>runScheduledReport(schedule),Math.max(0,delay));
            reportScheduleTimers.push(timer);
        });
    }catch(error){
        console.error("Unable to arm report schedules",error);
    }
}

/* ==========================================================
   TOAST
========================================================== */

function showReportsToast(title,message,type="info"){
    BioTrackToast.show({ title, message, type });
}

/* ==========================================================
   KEYBOARD SHORTCUTS
========================================================== */

function initializeReportsKeyboard(){

    document.addEventListener(

        "keydown",

        event=>{

            if(event.ctrlKey && event.key==="r"){

                event.preventDefault();

                resetReportsFilters();

            }

            if(event.ctrlKey && event.key==="e"){

                event.preventDefault();

                document

                    .getElementById("reportsPdfBtn")

                    ?.click();

            }

        }

    );

}

/* ==========================================================
   WINDOW RESIZE
========================================================== */

window.addEventListener(

    "resize",

    ()=>{

        if(typeof Chart==="undefined") return;

        Object.values(Chart.instances).forEach(chart=>{

            if(chart){

                chart.resize();

            }

        });

    }

);

/* ==========================================================
   MODULE STARTUP
========================================================== */

async function startReports(){

    await initializeReports();

    initializeReportsKeyboard();

}

window.startReports = startReports;
window.initializeReports = initializeReports;
;
/* source: dashboard_v2/views/usersView.js */
let usersCache = [];
let filteredUsers = [];
let editingUserId = null;
const usersPagination = { page: 1, pageSize: 10 };

const USER_ROLE_LABELS = {
    Manager: "Administrator",
    BME: "Biomedical Engineer",
    Electrical: "Electrical Engineer",
    IT: "IT Department",
    User: "Department User",
    WardBoy: "Ward Boy",
    CentralStore: "Central Store",
    Business: "Business Office",
};

function renderUsers() {
    pageContent.innerHTML = `
        <div class="users-page">
            <section class="users-hero">
                <div>
                    <span class="users-eyebrow"><i data-lucide="users-round"></i> Access control</span>
                    <h1>User Management</h1>
                    <p>Manage staff accounts, departments and access roles from one place.</p>
                </div>
                <button class="users-primary-button" type="button" onclick="showRegisterUser()">
                    <i data-lucide="user-plus"></i><span>Register user</span>
                </button>
            </section>

            <section class="users-stats" aria-label="User summary">
                <article><span class="is-blue"><i data-lucide="users"></i></span><div><small>Total users</small><strong id="usersTotalCount">—</strong></div></article>
                <article><span class="is-violet"><i data-lucide="shield-check"></i></span><div><small>Administrators</small><strong id="usersAdminCount">—</strong></div></article>
                <article><span class="is-green"><i data-lucide="wrench"></i></span><div><small>Engineering staff</small><strong id="usersEngineerCount">—</strong></div></article>
                <article><span class="is-orange"><i data-lucide="building-2"></i></span><div><small>Departments</small><strong id="usersDepartmentCount">—</strong></div></article>
            </section>

            <section class="users-directory-card">
                <header class="users-directory-header">
                    <div><h2>Staff directory</h2><p id="usersResultLabel">Loading user accounts…</p></div>
                    <button class="users-refresh-button" type="button" onclick="loadUsers()"><i data-lucide="refresh-cw"></i><span>Refresh</span></button>
                </header>

                <div class="users-controls">
                    <label class="users-search-field">
                        <span class="sr-only">Search users</span><i data-lucide="search"></i>
                        <input id="userSearch" type="search" placeholder="Search name, username or email" autocomplete="off" oninput="filterUsers()">
                    </label>
                    <label class="users-filter-field"><span>Department</span><select id="deptFilter" onchange="filterUsers()"><option value="">All departments</option></select></label>
                    <label class="users-filter-field"><span>Role</span><select id="roleFilter" onchange="filterUsers()"><option value="">All roles</option></select></label>
                    <label class="users-filter-field users-sort-field"><span>Sort by</span><select id="sortUsers" onchange="filterUsers()"><option value="name">Name A–Z</option><option value="username">Username A–Z</option><option value="department">Department A–Z</option><option value="role">Role A–Z</option></select></label>
                    <button id="clearUserFilters" class="users-clear-button" type="button" onclick="clearUserFilters()" hidden><i data-lucide="x"></i> Clear</button>
                </div>

                <div class="users-table-scroll">
                    <table class="users-table">
                        <thead><tr><th>User</th><th>Department</th><th>Role</th><th>Contact</th><th class="users-actions-heading">Actions</th></tr></thead>
                        <tbody id="usersBody"><tr><td colspan="5"><div class="users-state"><span class="users-spinner"></span><strong>Loading users</strong><p>Fetching the latest staff directory.</p></div></td></tr></tbody>
                    </table>
                </div>
                <div id="usersPagination" class="table-pagination users-pagination"></div>
            </section>
        </div>
        <div id="userModal"></div>
    `;

    if (window.lucide) lucide.createIcons();
    loadUsers();
}

async function loadUsers() {
    const refreshButton = document.querySelector(".users-refresh-button");
    refreshButton?.classList.add("is-loading");
    try {
        const data = await fetchPaginatedList("/api/users", { cache: "no-store" });
        usersCache = Array.isArray(data) ? data : [];
        populateUserFilters(usersCache);
        renderUserStats(usersCache);
        filterUsers();
    } catch (error) {
        usersCache = [];
        filteredUsers = [];
        renderUserStats([]);
        renderUsersState("wifi-off", "Unable to load users", error.message || "Please refresh and try again.", true);
        const label = document.getElementById("usersResultLabel");
        if (label) label.textContent = "Directory unavailable";
    } finally {
        refreshButton?.classList.remove("is-loading");
        if (window.lucide) lucide.createIcons();
    }
}

function populateUserFilters(users) {
    const departmentSelect = document.getElementById("deptFilter");
    const roleSelect = document.getElementById("roleFilter");
    if (!departmentSelect || !roleSelect) return;
    const selectedDepartment = departmentSelect.value;
    const selectedRole = roleSelect.value;
    const departments = [...new Set(users.map(user => String(user.department || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const roles = [...new Set(users.map(user => String(user.role || "").trim()).filter(Boolean))].sort((a, b) => (USER_ROLE_LABELS[a] || a).localeCompare(USER_ROLE_LABELS[b] || b));
    departmentSelect.innerHTML = '<option value="">All departments</option>' + departments.map(value => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join("");
    roleSelect.innerHTML = '<option value="">All roles</option>' + roles.map(value => `<option value="${escapeHTML(value)}">${escapeHTML(USER_ROLE_LABELS[value] || value)}</option>`).join("");
    departmentSelect.value = departments.includes(selectedDepartment) ? selectedDepartment : "";
    roleSelect.value = roles.includes(selectedRole) ? selectedRole : "";
}

function renderUserStats(users) {
    const setValue = (id, value) => { const element = document.getElementById(id); if (element) element.textContent = value; };
    setValue("usersTotalCount", users.length);
    setValue("usersAdminCount", users.filter(user => user.role === "Manager").length);
    setValue("usersEngineerCount", users.filter(user => ["BME", "Electrical", "IT"].includes(user.role)).length);
    setValue("usersDepartmentCount", new Set(users.map(user => String(user.department || "").trim().toLowerCase()).filter(Boolean)).size);
}

function displayUsers(data) {
    const body = document.getElementById("usersBody");
    const pagination = document.getElementById("usersPagination");
    const resultLabel = document.getElementById("usersResultLabel");
    if (!body || !pagination) return;
    if (resultLabel) resultLabel.textContent = `${data.length} ${data.length === 1 ? "account" : "accounts"} found`;

    if (!data.length) {
        renderUsersState("user-search", "No users found", "Try a different search or clear the active filters.");
        TablePagination.render(pagination, usersPagination, 0, () => displayUsers(filteredUsers), "users");
        return;
    }

    const pageItems = TablePagination.pageItems(data, usersPagination);
    body.innerHTML = pageItems.map(user => {
        const roleClass = userRoleClass(user.role);
        const name = user.name || user.username || "Unnamed user";
        return `
            <tr>
                <td><div class="users-identity"><span class="users-avatar is-${roleClass}">${escapeHTML(userInitials(name))}</span><div><strong>${escapeHTML(name)}</strong><small>@${escapeHTML(user.username || "—")}</small></div></div></td>
                <td><div class="users-department"><i data-lucide="building-2"></i><span>${escapeHTML(user.department || "Not assigned")}</span></div></td>
                <td><span class="users-role-badge is-${roleClass}"><i data-lucide="${userRoleIcon(user.role)}"></i>${escapeHTML(USER_ROLE_LABELS[user.role] || user.role || "Unknown")}</span></td>
                <td><div class="users-contact"><a href="mailto:${escapeHTML(user.email || "")}">${escapeHTML(user.email || "No email")}</a><span>${escapeHTML(user.phone || "No phone")}</span></div></td>
                <td class="users-actions"><button class="users-icon-button is-edit" type="button" onclick="editUser(${Number(user.id)})" aria-label="Edit ${escapeHTML(name)}"><i data-lucide="pencil"></i><span>Edit</span></button><button class="users-icon-button is-delete" type="button" onclick="deleteUser(${Number(user.id)})" aria-label="Delete ${escapeHTML(name)}"><i data-lucide="trash-2"></i><span>Delete</span></button></td>
            </tr>`;
    }).join("");

    TablePagination.render(pagination, usersPagination, data.length, () => displayUsers(filteredUsers), "users");
    if (window.lucide) lucide.createIcons();
}

function renderUsersState(icon, title, message, showRetry = false) {
    const body = document.getElementById("usersBody");
    const pagination = document.getElementById("usersPagination");
    if (!body) return;
    body.innerHTML = `<tr><td colspan="5"><div class="users-state"><span><i data-lucide="${icon}"></i></span><strong>${escapeHTML(title)}</strong><p>${escapeHTML(message)}</p>${showRetry ? '<button type="button" onclick="loadUsers()">Try again</button>' : ""}</div></td></tr>`;
    if (pagination) pagination.innerHTML = "";
    if (window.lucide) lucide.createIcons();
}

function filterUsers() {
    const search = document.getElementById("userSearch");
    const department = document.getElementById("deptFilter");
    const role = document.getElementById("roleFilter");
    const sort = document.getElementById("sortUsers");
    if (!search || !department || !role || !sort) return;
    const query = search.value.trim().toLowerCase();
    filteredUsers = usersCache.filter(user => {
        const haystack = [user.name, user.username, user.email, user.phone, user.department, USER_ROLE_LABELS[user.role], user.role].join(" ").toLowerCase();
        return (!query || haystack.includes(query)) && (!department.value || user.department === department.value) && (!role.value || user.role === role.value);
    });
    const sortKey = sort.value || "name";
    filteredUsers.sort((a, b) => String(a[sortKey] || "").localeCompare(String(b[sortKey] || ""), undefined, { sensitivity: "base" }));
    usersPagination.page = 1;
    const clearButton = document.getElementById("clearUserFilters");
    if (clearButton) clearButton.hidden = !(query || department.value || role.value || sortKey !== "name");
    displayUsers(filteredUsers);
}

function clearUserFilters() {
    document.getElementById("userSearch").value = "";
    document.getElementById("deptFilter").value = "";
    document.getElementById("roleFilter").value = "";
    document.getElementById("sortUsers").value = "name";
    filterUsers();
    document.getElementById("userSearch").focus();
}

function showRegisterUser() {
    const currentUser = editingUserId ? usersCache.find(user => user.id === editingUserId) : null;
    const modalRoot = document.getElementById("userModal");
    if (!modalRoot) return;
    modalRoot.innerHTML = `
        <div class="user-modal-backdrop" role="presentation">
            <section class="user-editor-modal" role="dialog" aria-modal="true" aria-labelledby="userModalTitle">
                <header><span class="user-modal-icon"><i data-lucide="${currentUser ? "user-cog" : "user-plus"}"></i></span><div><h2 id="userModalTitle">${currentUser ? "Edit user" : "Register a new user"}</h2><p>${currentUser ? "Update account details and access." : "Create a staff account and assign its access role."}</p></div><button type="button" class="user-modal-close" onclick="closeUserModal()" aria-label="Close"><i data-lucide="x"></i></button></header>
                <form class="user-editor-form" onsubmit="event.preventDefault();registerUser()">
                    <div class="user-form-grid">
                        <label><span>Full name</span><input id="newName" maxlength="120" autocomplete="name" placeholder="e.g. Anjali Thomas" required></label>
                        <label><span>Username</span><input id="newUsername" minlength="3" maxlength="80" autocomplete="username" placeholder="e.g. anjali.thomas" required></label>
                        <label><span>Department</span><select id="newDept" required>${renderHospitalDepartmentOptions(currentUser?.department)}</select></label>
                        <label><span>Access role</span><select id="newRole" required><option value="">Select a role</option><option value="Manager">Administrator</option><option value="BME">Biomedical Engineer</option><option value="Electrical">Electrical Engineer</option><option value="IT">IT Department</option><option value="User">Department User</option><option value="WardBoy">Ward Boy</option><option value="CentralStore">Central Store</option><option value="Business">Business Office</option></select></label>
                        <label><span>Email address</span><input id="newEmail" type="email" autocomplete="email" placeholder="name@hospital.org" required></label>
                        <label><span>Phone number</span><input id="newPhone" type="tel" autocomplete="tel" placeholder="10-digit mobile number" required></label>
                        <label class="user-password-field"><span>${currentUser ? "New password" : "Password"}</span><div><input id="newPassword" type="password" minlength="12" maxlength="72" autocomplete="new-password" placeholder="${currentUser ? "Leave blank to keep current" : "At least 12 characters"}" ${currentUser ? "" : "required"}><button type="button" onclick="toggleUserPassword()" aria-label="Show password"><i data-lucide="eye"></i></button></div><small>${currentUser ? "Only enter a password if it needs to change." : "Use 12–72 characters."}</small></label>
                        ${currentUser ? `<label><span>Account status</span><select id="newAccountStatus"><option value="active">Active</option><option value="disabled">Disabled</option></select><small>Disabling immediately revokes all sessions.</small></label>` : ""}
                        ${currentUser?.mfa_enabled ? `<label><span>MFA recovery</span><span class="user-security-check"><input id="resetUserMfa" type="checkbox"> Reset authenticator setup</span><small>The user must enroll again at next login.</small></label>` : ""}
                    </div>
                    <footer><button class="user-modal-cancel" type="button" onclick="closeUserModal()">Cancel</button><button class="user-modal-save" type="submit"><i data-lucide="save"></i><span>${currentUser ? "Save changes" : "Create user"}</span></button></footer>
                </form>
            </section>
        </div>`;
    if (currentUser) {
        document.getElementById("newName").value = currentUser.name || "";
        document.getElementById("newRole").value = currentUser.role || "";
        document.getElementById("newEmail").value = currentUser.email || "";
        document.getElementById("newPhone").value = currentUser.phone || "";
        document.getElementById("newUsername").value = currentUser.username || "";
        document.getElementById("newAccountStatus").value = currentUser.is_active === false ? "disabled" : "active";
    }
    const roleSelect = document.getElementById("newRole");
    const departmentSelect = document.getElementById("newDept");
    if (departmentSelect) departmentSelect.dataset.previousDepartment = ["WardBoy", "CentralStore", "Business"].includes(currentUser?.role) ? "" : (currentUser?.department || "");
    roleSelect?.addEventListener("change", syncServiceRoleDepartment);
    syncServiceRoleDepartment();
    document.body.classList.add("user-modal-open");
    if (window.lucide) lucide.createIcons();
    requestAnimationFrame(() => document.getElementById("newName")?.focus());
}

function syncServiceRoleDepartment() {
    const roleSelect = document.getElementById("newRole");
    const departmentSelect = document.getElementById("newDept");
    if (!roleSelect || !departmentSelect) return;
    const lockedDepartment = roleSelect.value === "WardBoy"
        ? "Hospital Support Services"
        : roleSelect.value === "CentralStore" ? "Central Store"
        : roleSelect.value === "Business" ? "Business Office" : "";
    if (lockedDepartment) {
        if (!departmentSelect.disabled) departmentSelect.dataset.previousDepartment = departmentSelect.value || "";
        departmentSelect.innerHTML = `<option value="${lockedDepartment}">${lockedDepartment}</option>`;
        departmentSelect.value = lockedDepartment;
        departmentSelect.disabled = true;
        departmentSelect.closest("label")?.classList.add("is-role-locked");
        return;
    }
    if (departmentSelect.disabled) {
        departmentSelect.disabled = false;
        departmentSelect.innerHTML = renderHospitalDepartmentOptions(departmentSelect.dataset.previousDepartment || "");
        departmentSelect.closest("label")?.classList.remove("is-role-locked");
    }
}

function toggleUserPassword() {
    const input = document.getElementById("newPassword");
    const button = input?.nextElementSibling;
    if (!input || !button) return;
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    button.setAttribute("aria-label", show ? "Hide password" : "Show password");
    button.innerHTML = `<i data-lucide="${show ? "eye-off" : "eye"}"></i>`;
    if (window.lucide) lucide.createIcons();
}

function validateUserForm() {
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phone = /^(?:\+91|91)?[6-9][0-9]{9}$/;
    const fields = [newName, newDept, newRole, newEmail, newPhone, newUsername];
    if (fields.some(field => !field.value.trim())) { BioTrackToast.warning("Required fields missing", "Complete all required user details."); return false; }
    if (!email.test(newEmail.value.trim())) { BioTrackToast.warning("Invalid email", "Enter a valid email address."); newEmail.focus(); return false; }
    if (!phone.test(newPhone.value.replace(/[\s-]/g, ""))) { BioTrackToast.warning("Invalid phone number", "Enter a valid Indian mobile number."); newPhone.focus(); return false; }
    if ((!editingUserId || newPassword.value) && (newPassword.value.length < 12 || newPassword.value.length > 72 || !newPassword.value.trim())) { BioTrackToast.warning("Invalid password", "Password must contain 12 to 72 characters and cannot be blank."); newPassword.focus(); return false; }
    return true;
}

async function registerUser() {
    if (!validateUserForm()) return;
    const saveButton = document.querySelector(".user-modal-save");
    saveButton?.classList.add("is-loading");
    if (saveButton) saveButton.disabled = true;
    const wasEditing = Boolean(editingUserId);
    try {
        const payload = { name: newName.value.trim(), department: newDept.value.trim(), role: newRole.value, email: newEmail.value.trim(), phone: newPhone.value.trim(), username: newUsername.value.trim(), password: newPassword.value, is_active: document.getElementById("newAccountStatus")?.value !== "disabled", reset_mfa: Boolean(document.getElementById("resetUserMfa")?.checked) };
        const response = await fetch(editingUserId ? `/api/users/${editingUserId}` : "/api/users/register", { method: editingUserId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            const detail = Array.isArray(result.detail) ? result.detail.map(item => item.msg).filter(Boolean).join(" ") : result.detail;
            throw new Error(detail || "Unable to save user.");
        }
        closeUserModal();
        if (typeof showSuccess === "function") showSuccess({ title: wasEditing ? "User updated" : "User registered", message: result.message || "The staff account was saved successfully.", buttonText: "Continue" });
        await loadUsers();
    } catch (error) {
        BioTrackToast.error("User not saved", error.message || "Unable to save this user.");
    } finally {
        saveButton?.classList.remove("is-loading");
        if (saveButton) saveButton.disabled = false;
    }
}

function editUser(id) {
    if (!usersCache.some(user => user.id === id)) return;
    editingUserId = id;
    showRegisterUser();
}

async function deleteUser(id) {
    const user = usersCache.find(item => item.id === id);
    if (!user || !confirm(`Delete ${user.name || user.username}? This account will no longer be able to sign in.`)) return;
    try {
        const response = await fetch(`/api/users/${id}`, { method: "DELETE" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.detail || "Unable to delete user.");
        await loadUsers();
        BioTrackToast.success("User deleted", "The staff account was removed successfully.");
    } catch (error) {
        BioTrackToast.error("User not deleted", error.message || "Unable to delete this user.");
    }
}

function closeUserModal() {
    const modalRoot = document.getElementById("userModal");
    if (modalRoot) modalRoot.innerHTML = "";
    document.body.classList.remove("user-modal-open");
    editingUserId = null;
}

function userInitials(value) {
    return String(value || "U").trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join("").toUpperCase() || "U";
}

function userRoleClass(role) {
    return ({ Manager: "admin", BME: "biomedical", Electrical: "electrical", IT: "it", User: "user", WardBoy: "ward-boy", CentralStore: "central-store", Business: "business" })[role] || "user";
}

function userRoleIcon(role) {
    return ({ Manager: "shield-check", BME: "heart-pulse", Electrical: "zap", IT: "monitor-cog", User: "user-round", WardBoy: "truck", CentralStore: "warehouse", Business: "landmark" })[role] || "user-round";
}
;
/* source: dashboard_v2/views/qrScannerView.js */
function renderQRScannerModule() {
    pageContent.innerHTML = `
        <section class="qr-scanner-module-page" aria-labelledby="qrModuleTitle">
            <header class="qr-module-hero">
                <div class="qr-module-copy">
                    <span class="qr-module-eyebrow"><i data-lucide="scan-line"></i> Equipment identification</span>
                    <h1 id="qrModuleTitle">QR Scanner</h1>
                    <p>Scan an equipment label to open its asset profile, service history, preventive-maintenance schedule and current status.</p>
                    <div class="qr-module-actions">
                        <button class="qr-module-primary" id="reopenQrCamera" type="button"><i data-lucide="camera"></i> Open camera</button>
                        <button class="qr-module-secondary" type="button" onclick="navigate('assets')"><i data-lucide="monitor-cog"></i> Open asset register</button>
                    </div>
                </div>
                <div class="qr-module-visual" aria-hidden="true">
                    <span class="qr-module-corner top-left"></span>
                    <span class="qr-module-corner top-right"></span>
                    <span class="qr-module-corner bottom-left"></span>
                    <span class="qr-module-corner bottom-right"></span>
                    <i data-lucide="qr-code"></i>
                    <div class="qr-module-scan-line"></div>
                </div>
            </header>

            <div class="qr-module-status" role="status">
                <span class="qr-module-live-dot"></span>
                <div><strong>Scanner ready</strong><p>The camera opens automatically when this module is selected.</p></div>
            </div>

            <div class="qr-module-grid">
                <article><span><i data-lucide="camera"></i></span><div><small>Step 1</small><h2>Allow camera access</h2><p>Your browser may ask for permission the first time you scan on a device.</p></div></article>
                <article><span><i data-lucide="focus"></i></span><div><small>Step 2</small><h2>Frame the equipment QR</h2><p>Hold the code inside the scanning frame until it is recognized.</p></div></article>
                <article><span><i data-lucide="external-link"></i></span><div><small>Step 3</small><h2>Open the asset record</h2><p>BioTrack takes you directly to the matching equipment profile.</p></div></article>
            </div>

            <aside class="qr-module-note">
                <i data-lucide="shield-check"></i>
                <div><strong>Secure, role-aware lookup</strong><p>Only equipment available to your signed-in department and role can be opened.</p></div>
            </aside>
        </section>`;

    document.getElementById("reopenQrCamera")?.addEventListener("click", openQRScanner);
    if (window.lucide) lucide.createIcons();
}

window.renderQRScannerModule = renderQRScannerModule;
;
/* source: dashboard_v2/views/qrAssetProfileView.js */
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
;
/* source: dashboard_v2/js/requestDetails.js */
// ==========================================
// CURRENT REQUEST
// ==========================================

let currentRequestTicket = null;


// ==========================================
// INITIALIZE PAGE
// ==========================================

async function initializeRequestDetails() {

    currentRequestTicket =
        localStorage.getItem("selectedRequest");

    if (!currentRequestTicket) {

        navigate("myRequests");

        return;

    }

    await loadRequestDetails();

}


// ==========================================
// LOAD REQUEST DETAILS
// ==========================================

async function loadRequestDetails() {

    try {

        const response = await fetch(

            `/api/user/request-details/${encodeURIComponent(currentRequestTicket)}`,

            {

                cache: "no-store"

            }

        );

        if (!response.ok) {

            const result = await response.json().catch(() => ({}));

            throw new Error(

                result.detail || "Unable to load request."

            );

        }

        const request = await response.json();

        populateRequestDetails(request);

    }

    catch (error) {

        console.error(error);

        const title =
            document.getElementById("requestTicketNumber");

        const badge =
            document.getElementById("requestStatusBadge");

        if (title) {

            title.textContent = "Unable to load this request";

        }

        if (badge) {

            badge.textContent = "Unavailable";

            badge.className = "status-badge closed";

        }

        showSuccess({

            title: "Unable to Load Request",

            message: error.message

        });

    }

}


// ==========================================
// POPULATE PAGE
// ==========================================

function populateRequestDetails(request) {

    document.getElementById("requestTicketNumber").textContent =
        `Ticket #${request.ticket}`;

    const badge =
        document.getElementById("requestStatusBadge");

    badge.textContent =
        request.status;

    badge.className =
        `status-badge ${request.status.toLowerCase().replaceAll(" ","-")}`;

    document.getElementById("equipmentName").textContent =
        request.equipment;

    document.getElementById("equipmentId").textContent =
        request.equipment_id;

    document.getElementById("departmentName").textContent =
        request.department;

    document.getElementById("priorityLevel").textContent =
        request.priority;

    document.getElementById("reportedDate").textContent =
        formatDateTime(request.received);

    document.getElementById("engineerNotes").textContent =
        request.notes || "No engineer notes available.";

    document.getElementById("workPerformed").textContent =
        request.work_done || "No work has been recorded.";

    document.getElementById("resolutionText").textContent =

        request.status === "Completed"

        ? "Maintenance completed successfully."

        : "Maintenance is still in progress.";

    buildTimeline(request);

    buildSpareParts(request);

}


// ==========================================
// BUILD TIMELINE
// ==========================================

function buildTimeline(request) {

    const timeline =
        document.getElementById("timelineContainer");

    let html = "";

    html += `
        <div class="timeline-item">

            <div class="timeline-dot"></div>

            <div>

                <strong>Request Submitted</strong>

                <p>${formatDateTime(request.received)}</p>

            </div>

        </div>
    `;

    if (request.started) {

        html += `
            <div class="timeline-item">

                <div class="timeline-dot active"></div>

                <div>

                    <strong>Engineer Started Work</strong>

                    <p>${formatDateTime(request.started)}</p>

                </div>

            </div>
        `;

    }

    if (request.completed) {

        html += `
            <div class="timeline-item">

                <div class="timeline-dot success"></div>

                <div>

                    <strong>Maintenance Completed</strong>

                    <p>${formatDateTime(request.completed)}</p>

                </div>

            </div>
        `;

    }

    timeline.innerHTML = html;

}


// ==========================================
// BUILD SPARE PARTS
// ==========================================

function buildSpareParts(request) {

    const tbody =
        document.getElementById("sparePartsBody");

    tbody.innerHTML = "";

    if (!request.spare_parts) {

        tbody.innerHTML = `

            <tr>

                <td colspan="2">

                    No spare parts used.

                </td>

            </tr>

        `;

        return;

    }

    request.spare_parts
        .split(",")

        .forEach(part => {

            tbody.innerHTML += `

                <tr>

                    <td>${escapeHTML(part.trim())}</td>

                    <td>1</td>

                </tr>

            `;

        });

}


// ==========================================
// GLOBAL
// ==========================================

window.initializeRequestDetails =
    initializeRequestDetails;
;
/* source: dashboard_v2/views/requestDetailsView.js */
// ==========================================
// REQUEST DETAILS PAGE
// ==========================================

async function renderRequestDetails() {

    pageContent.innerHTML = `

    <div class="request-details-page">

        <!-- ==========================================
             PAGE HEADER
        =========================================== -->

        <div class="request-details-header">

            <button
                class="request-back-btn"
                onclick="navigate('myRequests')">

                <i data-lucide="arrow-left"></i>
                Back to My Requests

            </button>

            <div class="request-header-content">

                <div>

                    <h1 id="requestTicketNumber">
                        Ticket #--------
                    </h1>

                    <p>
                        View the complete progress of your maintenance request.
                    </p>

                </div>

                <span
                    id="requestStatusBadge"
                    class="status-badge">

                    Loading...

                </span>

            </div>

        </div>


        <!-- ==========================================
             INFORMATION GRID
        =========================================== -->

        <div class="request-info-grid">

            <!-- Equipment Information -->

            <div class="request-card">

                <div class="card-title">

                    <i data-lucide="monitor"></i>

                    <h3>Equipment Information</h3>

                </div>

                <div class="info-list">

                    <div class="info-row">
                        <span>Equipment</span>
                        <strong id="equipmentName">-</strong>
                    </div>

                    <div class="info-row">
                        <span>Equipment ID</span>
                        <strong id="equipmentId">-</strong>
                    </div>

                    <div class="info-row">
                        <span>Department</span>
                        <strong id="departmentName">-</strong>
                    </div>

                    <div class="info-row">
                        <span>Priority</span>
                        <strong id="priorityLevel">-</strong>
                    </div>

                    <div class="info-row">
                        <span>Reported</span>
                        <strong id="reportedDate">-</strong>
                    </div>

                </div>

            </div>


            <!-- Assigned Engineer -->

            <div class="request-card">

                <div class="card-title">

                    <i data-lucide="user-round"></i>

                    <h3>Assigned Engineer</h3>

                </div>

                <div class="engineer-profile">

                    <div class="engineer-avatar">

                        <i data-lucide="user"></i>

                    </div>

                    <div>

                        <h4 id="engineerName">
                            Not Assigned
                        </h4>

                        <p id="engineerRole">
                            Biomedical Engineer
                        </p>

                    </div>

                </div>

            </div>

        </div>


        <!-- ==========================================
             TIMELINE
        =========================================== -->

        <div class="request-card">

            <div class="card-title">

                <i data-lucide="history"></i>

                <h3>Maintenance Timeline</h3>

            </div>

            <div
                id="timelineContainer"
                class="timeline-container">

                Loading timeline...

            </div>

        </div>


        <!-- ==========================================
             ENGINEER NOTES
        =========================================== -->

        <div class="request-card">

            <div class="card-title">

                <i data-lucide="clipboard-pen"></i>

                <h3>Engineer Notes</h3>

            </div>

            <div
                id="engineerNotes"
                class="notes-box">

                No notes available.

            </div>

        </div>


        <!-- ==========================================
             WORK PERFORMED
        =========================================== -->

        <div class="request-card">

            <div class="card-title">

                <i data-lucide="wrench"></i>

                <h3>Work Performed</h3>

            </div>

            <div
                id="workPerformed"
                class="notes-box">

                No work recorded.

            </div>

        </div>


        <!-- ==========================================
             SPARE PARTS
        =========================================== -->

        <div class="request-card">

            <div class="card-title">

                <i data-lucide="package"></i>

                <h3>Spare Parts Used</h3>

            </div>

            <table class="spare-table">

                <thead>

                    <tr>

                        <th>Part Name</th>

                        <th>Quantity</th>

                    </tr>

                </thead>

                <tbody id="sparePartsBody">

                    <tr>

                        <td colspan="2">

                            No spare parts used.

                        </td>

                    </tr>

                </tbody>

            </table>

        </div>


        <!-- ==========================================
             RESOLUTION
        =========================================== -->

        <div class="request-card">

            <div class="card-title">

                <i data-lucide="badge-check"></i>

                <h3>Resolution</h3>

            </div>

            <div
                id="resolutionText"
                class="notes-box">

                Awaiting completion...

            </div>

        </div>

    </div>

    `;

await initializeRequestDetails();

if (window.lucide) {
    lucide.createIcons();
}
}
;
/* source: dashboard_v2/js/successModal.js */
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
;
/* source: dashboard_v2/views/myRequestsView.js */
// Department-user maintenance request centre.

let myRequestsCache = [];
let filteredMyRequests = [];
let myRequestsStatusMode = "all";
const myRequestsPagination = { page: 1, pageSize: 10 };

const MY_REQUEST_STATUS_META = {
    open: { label: "Open", icon: "circle-dot" },
    assigned: { label: "Assigned", icon: "user-check" },
    "in-progress": { label: "In progress", icon: "loader-circle" },
    "awaiting-parts": { label: "Awaiting parts", icon: "package-search" },
    completed: { label: "Completed", icon: "circle-check-big" },
    closed: { label: "Closed", icon: "circle-check-big" }
};

function normalizeMyRequestStatus(value) {
    return String(value || "open").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function myRequestStatusMeta(value) {
    const key = normalizeMyRequestStatus(value);
    return { key, ...(MY_REQUEST_STATUS_META[key] || { label: value || "Open", icon: "circle-dot" }) };
}

function myRequestPriorityMeta(value) {
    const key = String(value || "medium").trim().toLowerCase();
    if (key === "critical") return { key, icon: "siren", label: "Critical" };
    if (key === "high") return { key, icon: "triangle-alert", label: "High" };
    if (key === "low") return { key, icon: "arrow-down", label: "Low" };
    return { key: "medium", icon: "minus", label: "Medium" };
}

async function renderMyRequests() {
    const pageContent = document.getElementById("page-content");
    if (!pageContent) return;

    if (window.__myRequestsRefreshTimer) {
        window.clearInterval(window.__myRequestsRefreshTimer);
        window.__myRequestsRefreshTimer = null;
    }

    pageContent.innerHTML = `
        <section class="my-requests-page" aria-labelledby="myRequestsTitle">
            <header class="my-requests-command-hero">
                <div class="my-requests-hero-copy">
                    <span class="my-requests-eyebrow"><i data-lucide="radio-tower"></i> Department service desk</span>
                    <h1 id="myRequestsTitle">My maintenance requests</h1>
                    <p>Report equipment problems and follow every service update from one clear workspace.</p>
                    <div class="my-requests-hero-actions">
                        <button class="my-requests-primary-action" type="button" onclick="navigate('newRequest')">
                            <i data-lucide="circle-plus"></i><span>New maintenance request</span>
                        </button>
                        <button class="my-requests-secondary-action" id="myRequestsRefresh" type="button">
                            <i data-lucide="refresh-cw"></i><span>Refresh</span>
                        </button>
                    </div>
                </div>
                <div class="my-requests-live-panel" aria-label="Request centre status">
                    <span class="my-requests-live-label"><i data-lucide="activity"></i> Live request tracking</span>
                    <strong id="myRequestsActiveHero">— active</strong>
                    <small id="myRequestsUpdated">Updating request status…</small>
                    <div class="my-requests-live-visual" aria-hidden="true">
                        <i data-lucide="clipboard-check"></i>
                    </div>
                </div>
            </header>

            <section class="myrequest-kpis" aria-label="Request summary">
                <article class="myrequest-card is-blue">
                    <span class="myrequest-icon"><i data-lucide="ticket-check"></i></span>
                    <span class="myrequest-info"><small>Total requests</small><strong id="totalRequests">—</strong><em>All submitted tickets</em></span>
                </article>
                <article class="myrequest-card is-orange">
                    <span class="myrequest-icon"><i data-lucide="radio"></i></span>
                    <span class="myrequest-info"><small>Active queue</small><strong id="openRequests">—</strong><em>Waiting for completion</em></span>
                </article>
                <article class="myrequest-card is-cyan">
                    <span class="myrequest-icon"><i data-lucide="loader-circle"></i></span>
                    <span class="myrequest-info"><small>In progress</small><strong id="progressRequests">—</strong><em>Engineer is working</em></span>
                </article>
                <article class="myrequest-card is-green">
                    <span class="myrequest-icon"><i data-lucide="badge-check"></i></span>
                    <span class="myrequest-info"><small>Completed</small><strong id="completedRequests">—</strong><em>Resolved requests</em></span>
                </article>
            </section>

            <section class="my-requests-workspace" aria-labelledby="myRequestsWorkspaceTitle">
                <div class="my-requests-workspace-heading">
                    <div>
                        <span class="my-requests-section-label">Request history</span>
                        <h2 id="myRequestsWorkspaceTitle">Track service progress</h2>
                        <p>Search your tickets or focus on the requests that need attention.</p>
                    </div>
                    <span class="my-requests-result-count" id="myRequestsResultCount">0 requests</span>
                </div>

                <div class="my-requests-status-tabs" id="myRequestsStatusTabs" role="tablist" aria-label="Filter requests by status">
                    <button class="is-active" type="button" data-status-mode="all"><i data-lucide="list-filter"></i>All <span id="myRequestsTabAll">0</span></button>
                    <button type="button" data-status-mode="active"><i data-lucide="radio"></i>Active <span id="myRequestsTabActive">0</span></button>
                    <button type="button" data-status-mode="open"><i data-lucide="circle-dot"></i>Open <span id="myRequestsTabOpen">0</span></button>
                    <button type="button" data-status-mode="in-progress"><i data-lucide="loader-circle"></i>In progress <span id="myRequestsTabProgress">0</span></button>
                    <button type="button" data-status-mode="completed"><i data-lucide="circle-check-big"></i>Completed <span id="myRequestsTabCompleted">0</span></button>
                </div>

                <div class="myrequest-toolbar">
                    <label class="myrequest-search" for="myRequestsSearch">
                        <i data-lucide="search"></i>
                        <input id="myRequestsSearch" type="search" placeholder="Search ticket, equipment or department…" autocomplete="off">
                    </label>
                    <div class="myrequest-filters">
                        <label><span>Priority</span><select id="myRequestsPriorityFilter"><option value="">All priorities</option></select></label>
                        <button id="myRequestsClear" type="button"><i data-lucide="filter-x"></i><span>Clear</span></button>
                    </div>
                </div>

                <div class="myrequest-table-card">
                    <table class="myrequest-table">
                        <thead><tr><th>Request</th><th>Equipment</th><th>Status</th><th>Reported</th><th>Downtime</th><th><span class="sr-only">Action</span></th></tr></thead>
                        <tbody id="myRequestsBody"><tr><td colspan="6"><div class="my-requests-loading"><i data-lucide="loader-circle"></i>Loading your requests…</div></td></tr></tbody>
                    </table>
                </div>
                <div id="myRequestsPagination" class="table-pagination"></div>
            </section>
        </section>`;

    document.getElementById("myRequestsSearch")?.addEventListener("input", () => applyMyRequestsFilters());
    document.getElementById("myRequestsPriorityFilter")?.addEventListener("change", () => applyMyRequestsFilters());
    document.getElementById("myRequestsRefresh")?.addEventListener("click", () => loadMyRequests(true));
    document.getElementById("myRequestsClear")?.addEventListener("click", clearMyRequestsFilters);
    document.querySelectorAll("#myRequestsStatusTabs [data-status-mode]").forEach((button) => {
        button.addEventListener("click", () => {
            myRequestsStatusMode = button.dataset.statusMode || "all";
            document.querySelectorAll("#myRequestsStatusTabs [data-status-mode]").forEach((item) => item.classList.toggle("is-active", item === button));
            applyMyRequestsFilters();
        });
    });

    window.lucide?.createIcons();
    await loadMyRequests();

    window.__myRequestsRefreshTimer = window.setInterval(() => {
        if (!document.querySelector(".my-requests-page")) {
            window.clearInterval(window.__myRequestsRefreshTimer);
            window.__myRequestsRefreshTimer = null;
            return;
        }
        loadMyRequests(false, true);
    }, 60000);
}

async function loadMyRequests(showFeedback = false, silent = false) {
    const refreshButton = document.getElementById("myRequestsRefresh");
    refreshButton?.classList.add("is-loading");
    refreshButton?.setAttribute("aria-busy", "true");

    try {
        const response = await fetch("/api/user/my-requests", { credentials: "same-origin" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "Unable to load your maintenance requests.");

        myRequestsCache = Array.isArray(data.requests) ? data.requests : [];
        updateMyRequestSummary(data.summary || {}, myRequestsCache);
        populateMyRequestsFilters(myRequestsCache);
        applyMyRequestsFilters(false);

        const updated = document.getElementById("myRequestsUpdated");
        if (updated) updated.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
        if (showFeedback) window.BioTrackToast?.success("Requests refreshed", "Your maintenance requests are up to date.");
    } catch (error) {
        if (!silent) window.BioTrackToast?.error("Requests unavailable", error.message || "Unable to load your maintenance requests.");
        const tbody = document.getElementById("myRequestsBody");
        if (tbody && !myRequestsCache.length) {
            tbody.innerHTML = `<tr><td colspan="6"><div class="my-requests-empty is-error"><i data-lucide="cloud-alert"></i><strong>Requests could not be loaded</strong><span>Check your connection and try Refresh.</span></div></td></tr>`;
        }
    } finally {
        refreshButton?.classList.remove("is-loading");
        refreshButton?.removeAttribute("aria-busy");
        window.lucide?.createIcons();
    }
}

function updateMyRequestSummary(summary, requests) {
    const completed = requests.filter((request) => ["completed", "closed"].includes(normalizeMyRequestStatus(request.status))).length;
    const inProgress = requests.filter((request) => normalizeMyRequestStatus(request.status) === "in-progress").length;
    const active = Math.max(0, requests.length - completed);
    const totals = {
        totalRequests: Number(summary.total ?? requests.length),
        openRequests: active,
        progressRequests: Number(summary.in_progress ?? inProgress),
        completedRequests: Number(summary.completed ?? completed)
    };

    Object.entries(totals).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = String(value);
    });

    const activeHero = document.getElementById("myRequestsActiveHero");
    if (activeHero) activeHero.textContent = `${active} active ${active === 1 ? "request" : "requests"}`;

    const counts = {
        myRequestsTabAll: requests.length,
        myRequestsTabActive: active,
        myRequestsTabOpen: requests.filter((request) => normalizeMyRequestStatus(request.status) === "open").length,
        myRequestsTabProgress: inProgress,
        myRequestsTabCompleted: completed
    };
    Object.entries(counts).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = String(value);
    });
}

function populateMyRequestsFilters(requests) {
    const select = document.getElementById("myRequestsPriorityFilter");
    if (!select) return;
    const previous = select.value;
    const options = [...new Set(requests.map((request) => request.priority).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    select.innerHTML = `<option value="">All priorities</option>${options.map((value) => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join("")}`;
    if (options.includes(previous)) select.value = previous;
}

function clearMyRequestsFilters() {
    const search = document.getElementById("myRequestsSearch");
    const priority = document.getElementById("myRequestsPriorityFilter");
    if (search) search.value = "";
    if (priority) priority.value = "";
    myRequestsStatusMode = "all";
    document.querySelectorAll("#myRequestsStatusTabs [data-status-mode]").forEach((item) => item.classList.toggle("is-active", item.dataset.statusMode === "all"));
    applyMyRequestsFilters();
}

function applyMyRequestsFilters(resetPage = true) {
    const search = (document.getElementById("myRequestsSearch")?.value || "").trim().toLowerCase();
    const priority = document.getElementById("myRequestsPriorityFilter")?.value || "";

    filteredMyRequests = myRequestsCache.filter((request) => {
        const status = normalizeMyRequestStatus(request.status);
        const statusMatches = myRequestsStatusMode === "all"
            || (myRequestsStatusMode === "active" && !["completed", "closed"].includes(status))
            || (myRequestsStatusMode === "completed" && ["completed", "closed"].includes(status))
            || status === myRequestsStatusMode;
        const searchable = [request.ticket, request.equipment, request.equipment_id, request.department, request.status]
            .filter(Boolean).join(" ").toLowerCase();
        return statusMatches && (!search || searchable.includes(search)) && (!priority || request.priority === priority);
    });

    if (resetPage) myRequestsPagination.page = 1;
    const resultCount = document.getElementById("myRequestsResultCount");
    if (resultCount) resultCount.textContent = `${filteredMyRequests.length} ${filteredMyRequests.length === 1 ? "request" : "requests"}`;
    renderMyRequestsTable(filteredMyRequests);
}

function renderMyRequestsTable(requests) {
    const tbody = document.getElementById("myRequestsBody");
    if (!tbody) return;

    if (!requests.length) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="my-requests-empty"><i data-lucide="inbox"></i><strong>No matching requests</strong><span>Try another filter or create a new maintenance request.</span><button type="button" onclick="navigate('newRequest')"><i data-lucide="circle-plus"></i>New request</button></div></td></tr>`;
        TablePagination.render(document.getElementById("myRequestsPagination"), myRequestsPagination, 0, () => renderMyRequestsTable(filteredMyRequests), "requests");
        window.lucide?.createIcons();
        return;
    }

    const pageItems = TablePagination.pageItems(requests, myRequestsPagination);
    tbody.innerHTML = pageItems.map((request) => {
        const status = myRequestStatusMeta(request.status);
        const priority = myRequestPriorityMeta(request.priority);
        const downtime = Number(request.downtime || 0);
        return `<tr>
            <td data-label="Request"><div class="myrequest-ticket"><strong>${escapeHTML(request.ticket || "—")}</strong><span class="myrequest-priority is-${priority.key}"><i data-lucide="${priority.icon}"></i>${priority.label}</span></div></td>
            <td data-label="Equipment"><div class="myrequest-equipment"><span><i data-lucide="monitor-cog"></i></span><div><strong>${escapeHTML(request.equipment || "Unnamed equipment")}</strong><small>${escapeHTML(request.equipment_id || "No equipment ID")} · ${escapeHTML(request.department || "Department not set")}</small></div></div></td>
            <td data-label="Status"><span class="myrequest-status is-${status.key}"><i data-lucide="${status.icon}"></i>${escapeHTML(status.label)}</span></td>
            <td data-label="Reported"><div class="myrequest-date"><i data-lucide="calendar-clock"></i><span>${formatDateTime(request.reported_time)}</span></div></td>
            <td data-label="Downtime"><div class="myrequest-downtime"><i data-lucide="timer"></i><strong>${downtime > 0 ? `${downtime.toFixed(1)} h` : "—"}</strong></div></td>
            <td data-label="Action"><button class="myrequest-open" type="button" data-ticket="${escapeHTML(request.ticket || "")}" aria-label="Open request ${escapeHTML(request.ticket || "")}"><span>Open</span><i data-lucide="arrow-up-right"></i></button></td>
        </tr>`;
    }).join("");

    tbody.querySelectorAll(".myrequest-open[data-ticket]").forEach((button) => button.addEventListener("click", () => openRequest(button.dataset.ticket || "")));
    TablePagination.render(document.getElementById("myRequestsPagination"), myRequestsPagination, requests.length, () => renderMyRequestsTable(filteredMyRequests), "requests");
    window.lucide?.createIcons();
}

function openRequest(ticket) {
    if (!ticket) return;
    localStorage.setItem("selectedRequest", ticket);
    navigate("requestDetails");
}
;
/* source: dashboard_v2/views/settingsView.js */
/* ==========================================
   SETTINGS VIEW
========================================== */

function renderSettings() {

    pageContent.innerHTML = `

<section class="settings-page">



    <!-- ==========================================
         SETTINGS CONTENT
    =========================================== -->

    <section class="settings-content">

        <!-- Header -->

        <header class="page-header">

            <div>

                <h1>Settings</h1>

                <p>

                    Manage your profile,
                    notifications,
                    security and
                    system preferences.

                </p>

            </div>

            <div class="header-image">

                <img
                    src="/static/dashboard_v2/assets/settings/settings-banner.png"
                    alt="Settings Banner">

            </div>

        </header>

        <!-- Settings Grid -->

        <div class="settings-grid">
        <!-- ====================================
     PROFILE SETTINGS
==================================== -->

<section
    class="settings-card profile-card"
    id="profile">

    <div class="card-header">

        <div>

            <h2>Profile Settings</h2>

            <p>

                Update your personal information
                and account profile.

            </p>

        </div>

        <i data-lucide="user-round"
            class="card-icon"></i>

    </div>

    <div class="profile-content">

        <!-- Profile Image -->

        <div class="settings-profile-avatar">

        <img
            id="profilePreview"
            class="profile-image"
            src="/static/dashboard_v2/assets/settings/profile.png"
            alt="Profile Picture">

        <button
            class="camera-btn"
            id="changePhoto"
            type="button">

            <i data-lucide="camera"></i>

        </button>

        <input
            type="file"
            id="profileUpload"
            accept="image/*"
            hidden>

    </div>

        <!-- Profile Details -->

        <div class="profile-details">

            <div class="detail-row">

                <label>Full Name</label>

                <span id="settingsFullName">
                    Loading...
                </span>

            </div>

            <div class="detail-row">

                <label>Email Address</label>

                <span id="settingsEmail">
                    Loading...
                </span>

            </div>

            <div class="detail-row">

                <label>Department</label>

                <span id="settingsEmployeeId">
                    Loading...
                </span>

            </div>

            <div class="detail-row">

                <label>Role</label>

                <span id="settingsRole">
                    Loading...
                </span>

            </div>

            <button
                class="primary-btn edit-profile"
                id="editProfileBtn">

                <i data-lucide="square-pen"></i>

                Edit Profile

            </button>

        </div>

    </div>

</section>
<!-- ====================================
     NOTIFICATIONS
==================================== -->

<section
    class="settings-card notifications-card"
    id="notifications">

    <div class="card-header">

        <div>

            <h2>Notifications</h2>

            <p>

                Manage how you receive
                updates and alerts.

            </p>

        </div>

        <i
            data-lucide="bell"
            class="card-icon"></i>

    </div>

    <div class="notification-list">

        <!-- In-app -->

        <div class="notification-item">

            <div class="notification-info">

                <div class="notification-icon">

                    <i data-lucide="bell-dot"></i>

                </div>

                <div>

                    <h4>In-app Notifications</h4>

                    <p>

                        Show operational alerts
                        in the BioTrack
                        notification centre.

                    </p>

                </div>

            </div>

            <label class="switch">

                <input
                    type="checkbox"
                    id="inAppNotification"
                    checked>

                <span class="slider"></span>

            </label>

        </div>

        <!-- Desktop -->

        <div class="notification-item">

            <div class="notification-info">

                <div class="notification-icon">

                    <i data-lucide="monitor"></i>

                </div>

                <div>

                    <h4>Desktop Notifications</h4>

                    <p>

                        Show alerts directly
                        on your desktop.

                    </p>

                </div>

            </div>

            <label class="switch">

                <input
                    type="checkbox"
                    id="desktopNotification"
                    checked>

                <span class="slider"></span>

            </label>

        </div>

        <!-- Request Updates -->

        <div class="notification-item">

            <div class="notification-info">

                <div class="notification-icon">

                    <i data-lucide="send"></i>

                </div>

                <div>

                    <h4>Request Updates</h4>

                    <p>

                        Notify whenever a
                        service request changes
                        its status.

                    </p>

                </div>

            </div>

            <label class="switch">

                <input
                    type="checkbox"
                    id="requestUpdates"
                    checked>

                <span class="slider"></span>

            </label>

        </div>


        <!-- PM Reminder -->

        <div class="notification-item">

            <div class="notification-info">

                <div class="notification-icon">

                    <i data-lucide="calendar-check"></i>

                </div>

                <div>

                    <h4>Preventive Maintenance Reminder</h4>

                    <p>

                        Receive reminders before
                        scheduled preventive
                        maintenance.

                    </p>

                </div>

            </div>

            <label class="switch">

                <input
                    type="checkbox"
                    id="pmReminder">

                <span class="slider"></span>

            </label>

        </div>

    </div>

    <div class="card-footer">

        <button
            class="primary-btn"
            id="saveNotificationSettings">

            <i data-lucide="settings-2"></i>

            Configure Notifications

        </button>

    </div>

</section>
<!-- ====================================
     SECURITY
==================================== -->

<section
    class="settings-card security-card"
    id="security">

    <div class="card-header">

        <div>

            <h2>Security</h2>

            <p>

                Manage your password,
                account security and
                active sessions.

            </p>

        </div>

        <i
            data-lucide="shield-check"
            class="card-icon"></i>

    </div>

    <div class="security-list">

        <!-- Password -->

        <div class="security-item">

            <div>

                <h4>Password</h4>

                <p>••••••••••••</p>

            </div>

            <button
                class="secondary-btn"
                id="changePassword">

                Change

                <i data-lucide="chevron-right"></i>

            </button>

        </div>

        <!-- Account protection -->

        <div class="security-item">

            <div>

                <h4>Account Protection</h4>

                <p>

                    Password hashing, secure cookies
                    and automatic session expiry
                    are active.

                </p>

            </div>

            <span class="security-status-pill"><i data-lucide="shield-check"></i> Protected</span>

        </div>

        <!-- Optional authenticator verification -->

        <div class="security-item">

            <div>

                <h4>Authenticator verification</h4>

                <p id="mfaStatusText">Optional · checking status…</p>

            </div>

            <button class="secondary-btn" id="configureMfa">

                Configure

                <i data-lucide="chevron-right"></i>

            </button>

        </div>

        <!-- Active Sessions -->

        <div class="security-item">

            <div>

                <h4>Current Session</h4>

                <p>

                    Review this browser session,
                    network address and
                    expiry time.

                </p>

            </div>

            <button
                class="secondary-btn"
                id="viewSessions">

                View

                <i data-lucide="chevron-right"></i>

            </button>

        </div>

    </div>

</section>

<!-- ====================================
     SYSTEM PREFERENCES
==================================== -->

<section
    class="settings-card preferences-card"
    id="preferences">

    <div class="card-header">

        <div>

            <h2>System Preferences</h2>

            <p>

                Customize your
                BioTrack experience.

            </p>

        </div>

        <i
            data-lucide="sliders-horizontal"
            class="card-icon"></i>

    </div>

    <div class="preference-list">

        <!-- Theme -->

        <div class="preference-item">

            <div class="preference-left">

                <i data-lucide="sun-moon"></i>

                <span>Theme</span>

            </div>

            <select id="themeSelect">

                <option value="light" selected>
                    Light
                </option>

                <option value="dark">
                    Dark
                </option>

                <option value="system">
                    System Default
                </option>

            </select>

        </div>

        <!-- Density -->

        <div class="preference-item">

            <div class="preference-left">

                <i data-lucide="rows-3"></i>

                <span>Interface Density</span>

            </div>

            <select id="densitySelect">

                <option value="comfortable" selected>
                    Comfortable
                </option>

                <option value="compact">
                    Compact
                </option>

            </select>

        </div>

        <!-- Date Format -->

        <div class="preference-item">

            <div class="preference-left">

                <i data-lucide="calendar-days"></i>

                <span>Date Format</span>

            </div>

            <select id="dateFormat">

                <option selected>
                    DD/MM/YYYY
                </option>

                <option>
                    MM/DD/YYYY
                </option>

                <option>
                    YYYY-MM-DD
                </option>

            </select>

        </div>

        <!-- Time Format -->

        <div class="preference-item">

            <div class="preference-left">

                <i data-lucide="clock-3"></i>

                <span>Time Format</span>

            </div>

            <select id="timeFormat">

                <option selected>
                    24 Hour
                </option>

                <option>
                    12 Hour
                </option>

            </select>

        </div>

    </div>

</section>

<div class="password-modal" id="passwordModal" hidden>
    <div class="password-dialog" role="dialog" aria-modal="true" aria-labelledby="passwordDialogTitle">
        <button class="password-close" type="button" id="closePasswordModal" aria-label="Close">×</button>
        <h2 id="passwordDialogTitle">Change Password</h2>
        <p>Use a new password with at least 12 characters.</p>
        <label for="currentPassword">Current password</label>
        <input id="currentPassword" type="password" autocomplete="current-password">
        <label for="newPassword">New password</label>
        <input id="newPassword" type="password" autocomplete="new-password" minlength="12">
        <label for="confirmPassword">Confirm new password</label>
        <input id="confirmPassword" type="password" autocomplete="new-password" minlength="12">
        <div class="password-actions">
            <button class="secondary-btn" type="button" id="cancelPasswordChange">Cancel</button>
            <button class="primary-btn" type="button" id="savePasswordChange">Update Password</button>
        </div>
    </div>
</div>
<!-- ====================================
     BACKUP & DATA
==================================== -->

<section
    class="settings-card backup-card"
    id="backup">

    <div class="card-header">

        <div>

            <h2>Backup & Data</h2>

            <p>

                Secure your BioTrack information
                by creating backups or exporting
                maintenance data.

            </p>

        </div>

        <i
            data-lucide="database"
            class="card-icon"></i>

    </div>

    <div class="backup-actions">

        <!-- Backup -->

        <div class="backup-box">

            <div class="backup-icon">

                <i data-lucide="cloud-upload"></i>

            </div>

            <h4>Create Backup</h4>

            <p>

                Generate a complete backup
                of your BioTrack system.

            </p>

            <button
                class="primary-btn"
                id="backupNow">

                <i data-lucide="cloud-upload"></i>

                Backup Now

            </button>

        </div>

        <!-- Export -->

        <div class="backup-box">

            <div class="backup-icon">

                <i data-lucide="download"></i>

            </div>

            <h4>Export Data</h4>

            <p>

                Download reports,
                requests and maintenance
                records.

            </p>

            <button
                class="secondary-btn"
                id="exportData">

                <i data-lucide="download"></i>

                Export

            </button>

        </div>

    </div>

</section>

<!-- ====================================
     ABOUT SYSTEM
==================================== -->

<section
    class="settings-card about-card"
    id="about">

    <div class="card-header">

        <div>

            <h2>About System</h2>

            <p>

                Information about
                the BioTrack platform.

            </p>

        </div>

        <i
            data-lucide="info"
            class="card-icon"></i>

    </div>

    <div class="about-grid">

        <div class="about-item">

            <label>System Name</label>

            <span>
                BioTrack Biomedical Maintenance System
            </span>

        </div>

        <div class="about-item">

            <label>Version</label>

            <span id="systemVersion">

                Version 2.0.0

            </span>

        </div>

        <div class="about-item">

            <label>Developed By</label>

            <span>

                LFH Software Solutions

            </span>

        </div>

        <div class="about-item">

            <label>Support</label>

            <span>

                support@biotrack.com

            </span>

        </div>

    </div>

    <div class="about-footer">

        <p>

            © 2026 BioTrack Biomedical Maintenance System.
            All Rights Reserved.

        </p>

    </div>

</section>
        </div>

    </section>

</section>

`;

    const settingsGrid = pageContent.querySelector(".settings-grid");
    if (settingsGrid) {
        const leftColumn = document.createElement("div");
        const rightColumn = document.createElement("div");
        leftColumn.className = "settings-column settings-column-left";
        rightColumn.className = "settings-column settings-column-right";

        ["profile", "security", "backup"].forEach(id => {
            const card = settingsGrid.querySelector(`#${id}`);
            if (card) leftColumn.appendChild(card);
        });
        ["notifications", "preferences", "about"].forEach(id => {
            const card = settingsGrid.querySelector(`#${id}`);
            if (card) rightColumn.appendChild(card);
        });

        const passwordModal = settingsGrid.querySelector("#passwordModal");
        settingsGrid.replaceChildren(leftColumn, rightColumn);
        if (passwordModal) pageContent.querySelector(".settings-content")?.appendChild(passwordModal);
    }

    // Re-create Lucide icons after injecting HTML
    if (window.lucide) {
        lucide.createIcons();
    }

    // Initialize page logic
    if (typeof initSettings === "function") {
        initSettings();
    }

}
;
/* source: dashboard_v2/views/aiView.js */
// ==========================================
// AI VIEW
// ==========================================

function renderAI() {

    pageContent.innerHTML = `

        <div class="loading-page">

            AI Module

        </div>

    `;

}
;
/* source: dashboard_v2/js/asset_profile.js */
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
;
/* source: js/biomedical_dashboard.js */
/* ==========================================================
   BIOTRACK ENGINEER DASHBOARD
   engineerDashboard.js
========================================================== */
/* ==========================================================
   RENDER ENGINEER DASHBOARD
========================================================== */
function renderEngineerDashboard() {

    if (engineerRefreshTimer) {

        clearInterval(engineerRefreshTimer);

    }

    const pageContent = document.getElementById("page-content");

    pageContent.innerHTML = engineerDashboardView();

    if (window.lucide) {

        lucide.createIcons();

    }

    startEngineerDashboard();

}

function renderElectricalDashboard() {

    renderEngineerDashboard();

}

function renderITDashboard() {

    renderEngineerDashboard();

}
/* ==========================================================
   INITIALIZE
========================================================== */

async function initializeEngineerDashboard() {

    initializeEngineerButtons();

    await loadEngineerDashboard();

    startEngineerAutoRefresh();

}

/* ==========================================================
   DASHBOARD LOADER
========================================================== */

async function loadEngineerDashboard() {

    try {

        const response = await fetch("/api/engineer/dashboard");

        if (!response.ok) {

            throw new Error("Failed to load engineer dashboard.");

        }

        const data = await response.json();

        updateEngineerKPIs(data);

        renderAssignedCalls(data.assigned || []);

        renderEquipmentStatus(data);

        renderActivityFeed(Array.isArray(data.activity) ? data.activity : []);

    }

    catch (error) {

        console.error(error);

    }

}

/* ==========================================================
   KPI CARDS
========================================================== */

function updateEngineerKPIs(data) {

    setEngineerValue(
        "assignedCalls",
        data.assigned_calls
    );

    setEngineerValue(
        "progressCalls",
        data.in_progress
    );

    setEngineerValue(
        "criticalCalls",
        data.critical_calls
    );

    setEngineerValue(
        "completedCalls",
        data.completed_today
    );

}

function setEngineerValue(id, value) {

    const element = document.getElementById(id);

    if (element) {

        element.textContent = value ?? 0;

    }

}

/* ==========================================================
   BUTTONS
========================================================== */

function initializeEngineerButtons() {

    document

        .querySelectorAll(".quick-actions button")

        .forEach(button => {

            button.addEventListener(

                "click",

                createEngineerRipple

            );

        });

}

/* ==========================================================
   RIPPLE EFFECT
========================================================== */

function createEngineerRipple(event) {

    const button = event.currentTarget;

    const ripple = document.createElement("span");

    const size = Math.max(

        button.clientWidth,

        button.clientHeight

    );

    const rect = button.getBoundingClientRect();

    ripple.className = "reports-ripple";

    ripple.style.width = size + "px";

    ripple.style.height = size + "px";

    ripple.style.left =

        event.clientX -

        rect.left -

        size / 2 +

        "px";

    ripple.style.top =

        event.clientY -

        rect.top -

        size / 2 +

        "px";

    button.appendChild(ripple);

    setTimeout(() => {

        ripple.remove();

    }, 600);

}

/* ==========================================================
   AUTO REFRESH
========================================================== */

let engineerRefreshTimer = null;

function startEngineerAutoRefresh() {

    if (engineerRefreshTimer) {

        clearInterval(engineerRefreshTimer);

    }

    engineerRefreshTimer = setInterval(

        loadEngineerDashboard,

        10000

    );

}
/* ==========================================================
   ASSIGNED CALLS
========================================================== */

function renderAssignedCalls(calls) {

    const container =
        document.getElementById("assignedList");

    if (!container) return;

    container.innerHTML = "";

    if (calls.length === 0) {

        container.innerHTML = `

            <div class="loading-card">

                No maintenance calls assigned.

            </div>

        `;

        return;

    }

    calls.forEach(call => {

        container.innerHTML += `

            <div class="call-card ${engineerClassToken(call.priority)}">

                <div class="call-header">

                    <div>

                        <h3>${escapeHTML(call.ticket)}</h3>

                        <small>${escapeHTML(call.department)}</small>

                    </div>

                    <span class="priority ${engineerClassToken(call.priority)}">

                        ${escapeHTML(call.priority)}

                    </span>

                </div>

                <div class="call-grid">

                    <div>

                        <label>Equipment</label>

                        <strong>${escapeHTML(call.equipment)}</strong>

                    </div>

                    <div>

                        <label>Equipment ID</label>

                        <strong>${escapeHTML(call.equipment_id)}</strong>

                    </div>

                    <div>

                        <label>Status</label>

                        <strong>${escapeHTML(call.status)}</strong>

                    </div>

                    <div>

                        <label>Reported</label>

                        <strong>${escapeHTML(call.reported_time)}</strong>

                    </div>

                </div>

                <p class="call-description">
                    <strong>${escapeHTML(call.issue || "Maintenance issue")}:</strong>
                    ${escapeHTML(call.description || "No description provided.")}
                </p>

                <div class="call-actions">

                    <button
                        class="primary-btn"
                        onclick="openEngineerTicket(${Number(call.id)})">

                        Open Ticket

                    </button>

                </div>

            </div>

        `;

    });

    if (window.lucide) {

        lucide.createIcons();

    }

}

function engineerClassToken(value) {
    return String(value || "normal").toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
}

/* ==========================================================
   EQUIPMENT STATUS
========================================================== */

function renderEquipmentStatus(data) {

    setEngineerValue(

        "onlineEquipment",

        data.online_equipment

    );

    setEngineerValue(

        "offlineEquipment",

        data.offline_equipment

    );

    setEngineerValue(

        "pmDueToday",

        data.pm_due_today

    );

}

/* ==========================================================
   ACTIVITY FEED
========================================================== */

function renderActivityFeed(activity) {

    const feed =
        document.getElementById("activityFeed");

    if (!feed) return;

    feed.innerHTML = "";

    if (!activity || activity.length === 0) {

        feed.innerHTML = `

            <p>No activity available.</p>

        `;

        return;

    }

    activity.forEach(item => {

        feed.innerHTML += `

            <div class="activity-item">

                <strong>${escapeHTML(item.title)}</strong>

                <small>${escapeHTML(item.time)}</small>

            </div>

        `;

    });

}

/* ==========================================================
   OPEN TICKET
========================================================== */

function openEngineerTicket(id) {

    localStorage.setItem(

        "selectedTicket",

        id

    );

    navigate("ticket");

}

function navigateToEngineerHome() {

    navigate(
        (localStorage.getItem("role") || "").toLowerCase() === "electrical"
            ? "electricalDashboard"
            : (localStorage.getItem("role") || "").toLowerCase() === "it"
                ? "itDashboard"
                : "engineerDashboard"
    );

}

/* ==========================================================
   MODULE STARTUP
========================================================== */

async function startEngineerDashboard() {

    await initializeEngineerDashboard();

}

window.startEngineerDashboard =
    startEngineerDashboard;
window.renderElectricalDashboard = renderElectricalDashboard;
window.renderITDashboard = renderITDashboard;
window.navigateToEngineerHome = navigateToEngineerHome;
;
/* source: dashboard_v2/js/router.js */
// ==========================================
// PAGE CONTENT
// ==========================================

const pageContent = document.getElementById("page-content");

function normalizeDashboardRole(value) {
    const role = String(value || "").trim().toLowerCase();
    if (role === "manager") return "admin";
    if (role === "bme") return "engineer";
    return role;
}

const ROLE_HOME_PAGES = {
    admin: "dashboard",
    engineer: "engineerDashboard",
    electrical: "electricalDashboard",
    it: "itDashboard",
    user: "userDashboard",
    wardboy: "wardBoyDashboard",
    centralstore: "centralStore",
    business: "businessPortal",
};

const ROLE_PAGE_ACCESS = {
    admin: new Set(["dashboard", "ticket", "callManagement", "callAssignment", "maintenance", "assets", "assetForm", "assetDetails", "inventory", "centralStore", "storeRequests", "vendors", "businessPortal", "pm", "reports", "users", "qr", "qrAssetProfile", "settings"]),
    engineer: new Set(["engineerDashboard", "ticket", "callManagement", "maintenance", "assets", "assetForm", "assetDetails", "inventory", "storeRequests", "vendors", "pm", "reports", "qr", "qrAssetProfile", "settings"]),
    electrical: new Set(["electricalDashboard", "ticket", "callManagement", "maintenance", "assets", "assetForm", "assetDetails", "inventory", "storeRequests", "vendors", "qr", "qrAssetProfile", "settings"]),
    it: new Set(["itDashboard", "ticket", "callManagement", "maintenance", "assets", "assetForm", "assetDetails", "inventory", "storeRequests", "vendors", "qr", "qrAssetProfile", "settings"]),
    user: new Set(["userDashboard", "newRequest", "myRequests", "myAssets", "assetDetails", "departmentPMSchedule", "requestDetails", "qr", "qrAssetProfile", "settings"]),
    wardboy: new Set(["wardBoyDashboard", "settings"]),
    centralstore: new Set(["centralStore", "settings"]),
    business: new Set(["businessPortal", "settings"]),
};
// ==========================================
// CURRENT SELECTED ASSET
// ==========================================

let currentAssetId = null;
let currentQRAssetId = null;

// ==========================================
// PAGE REGISTRY
// ==========================================

const Pages = {

    // Administrator
    dashboard: renderDashboard,
    ticket: renderTicket,

    // Department User
    // Department User
    userDashboard: renderUserDashboard,
    wardBoyDashboard: renderWardBoyDashboard,
    newRequest: renderNewRequest,
    myRequests: renderMyRequests,
    myAssets: renderMyAssets,
    departmentPMSchedule: renderDepartmentPMSchedule,
    requestDetails: renderRequestDetails,

    // Biomedical Engineer
    engineerDashboard: renderEngineerDashboard,
    electricalDashboard: renderElectricalDashboard,
    itDashboard: renderITDashboard,
    callManagement: renderMaintenance,
    // Admin
    callAssignment: renderMaintenance,

    maintenance: renderMaintenanceModule,
    assets: renderAssets,
    assetForm: renderAssetForm,
    assetDetails: renderAssetDetails,
    inventory: renderInventory,
    centralStore: renderCentralStore,
    storeRequests: renderStoreRequests,
    vendors: typeof renderVendors === "function" ? renderVendors : () => {},
    businessPortal: renderBusinessPortal,
    pm: renderPM,
    reports: renderReports,
    ai: renderAI,
    users: renderUsers,
    qr: renderQRScannerModule,
    qrAssetProfile: renderQRAssetProfile,
    settings: renderSettings

};

// ==========================================
// NAVIGATE
// ==========================================

function navigate(page) {
    const role = normalizeDashboardRole(localStorage.getItem("role"));
    const allowedPages = ROLE_PAGE_ACCESS[role];

    if (page !== "wardBoyDashboard" && typeof cleanupWardBoyDashboard === "function") cleanupWardBoyDashboard();

    if (!allowedPages || !allowedPages.has(page)) {
        const homePage = ROLE_HOME_PAGES[role];
        console.warn(`Blocked navigation to ${page} for role ${role || "unknown"}.`);
        if (!homePage) {
            window.location.href = "/";
            return;
        }
        if (page !== homePage && Pages[homePage]) navigate(homePage);
        return;
    }

    if (
        page !== "qr"
        && typeof isQRScannerActive === "function"
        && isQRScannerActive()
        && typeof closeQRScanner === "function"
    ) {
        void closeQRScanner();
    }

    if (page !== "inventory") {
        if (typeof closeInventoryModal === "function") closeInventoryModal();
        if (typeof closeInventoryDeleteDialog === "function") closeInventoryDeleteDialog();
    }

    if (page !== "assets" && typeof closeAssetManagementDialog === "function") {
        closeAssetManagementDialog();
    }

    if (!["assets", "myAssets"].includes(page) && typeof closeAssetRelocationDialog === "function") {
        closeAssetRelocationDialog();
    }

    if (page !== "reports" && typeof cleanupReportsSchedules === "function") {
        cleanupReportsSchedules();
    }

    // Check page exists
    if (!Pages[page]) {

        console.error("Page not found:", page);
        return;

    }

    // Sidebar Active State
    document.querySelectorAll(".nav-item").forEach(item => {

        item.classList.remove("active");

    });

    const activeItem = document.querySelector(`[data-page="${page}"]`);

    if (activeItem) {

        activeItem.classList.add("active");

    }

    // Render selected page
    Pages[page]();

    if (page === "qr" && typeof openQRScanner === "function") {
        window.setTimeout(openQRScanner, 0);
    }

    // Refresh Lucide icons for dynamically rendered pages
    if (window.lucide) {

        lucide.createIcons();

    }

}

// ==========================================
// SIDEBAR EVENTS
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {

    if (typeof validateDashboardSession === "function") {
        const sessionIsValid = await validateDashboardSession();
        if (!sessionIsValid) return;
    }

    const role = normalizeDashboardRole(localStorage.getItem("role"));
    const homePage = ROLE_HOME_PAGES[role];
    if (!homePage) {
        window.location.href = "/";
        return;
    }
    const requestedPage = new URLSearchParams(window.location.search).get("page");
    navigate(requestedPage && ROLE_PAGE_ACCESS[role].has(requestedPage) ? requestedPage : homePage);

    // Sidebar navigation
    document.querySelectorAll(".nav-item").forEach(item => {

        item.addEventListener("click", function (e) {

            e.preventDefault();

            const page = this.dataset.page;

            if (page) {

                navigate(page);

            }

        });

    });

});
// ==========================================
// OPEN ASSET DETAILS
// ==========================================

function openAssetPage(assetId) {

    currentAssetId = assetId;

    navigate("assetDetails");

}

function openQRAssetProfile(assetId) {
    currentQRAssetId = Number(assetId);
    navigate("qrAssetProfile");
}
;
/* source: dashboard_v2/js/new_request.js */
// Department-user maintenance complaint workflow.

const REQUEST_DRAFT_KEY = "biotrackMaintenanceRequestDraft";
let requestDepartmentAssets = [];
let requestSubmitting = false;

async function initializeNewRequest() {
    initializeRequesterFields();
    restoreRequestDraft();
    initializeRequestFormEvents();
    initializePrioritySelector();
    initializeDescriptionHelpers();
    initializeEquipmentControls();
    applyQRMaintenancePrefill();
    updateRequestExperience();
    await loadRequestDepartmentAssets();
}

function initializeRequesterFields() {
    const department = document.getElementById("departmentSearch");
    const reportedBy = document.getElementById("reportedBy");
    const assignedDepartment = (localStorage.getItem("department") || "").trim();
    const requesterName = (localStorage.getItem("name") || localStorage.getItem("username") || "").trim();

    if (department) {
        department.value = assignedDepartment;
        department.readOnly = true;
    }
    if (reportedBy) {
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
        clearRequestFieldError(field);
        if (!lockableFields.has(id)) return;

        field.readOnly = Boolean(suppliedValue);
        if (id === "departmentSearch") field.readOnly = true;
        field.classList.toggle("qr-prefill-locked", field.readOnly);
        field.classList.toggle("qr-prefill-missing", !field.readOnly);
        const existingHint = field.closest(".request-field")?.querySelector(".qr-missing-field-hint");
        if (existingHint) existingHint.remove();
        if (!field.readOnly) {
            const hint = document.createElement("small");
            hint.className = "qr-missing-field-hint";
            hint.textContent = "Not stored on this asset — please add it.";
            field.closest(".request-field")?.appendChild(hint);
        }
    });

    const serviceTeam = document.getElementById("serviceTeam");
    if (serviceTeam) {
        const hasServiceTeam = ["Biomedical", "Electrical", "IT"].includes(prefill.service_team);
        if (hasServiceTeam) serviceTeam.value = prefill.service_team;
        serviceTeam.disabled = hasServiceTeam;
        serviceTeam.classList.toggle("qr-prefill-locked", hasServiceTeam);
        serviceTeam.classList.toggle("qr-prefill-missing", !hasServiceTeam);
    }

    const problemCategory = document.getElementById("problemCategory");
    if (problemCategory && !problemCategory.value) problemCategory.value = "Breakdown";

    const mount = document.getElementById("qrRequestPrefillMount");
    if (mount) {
        mount.innerHTML = '<div id="qrRequestPrefillBanner" class="qr-request-prefill-banner"><span><i data-lucide="badge-check"></i></span><div><strong>Equipment identified from its QR code</strong><p>Verified values are locked. Complete any highlighted missing information, then describe the problem.</p></div><button id="removeQRPrefill" type="button">Use different equipment</button></div>';
        document.getElementById("removeQRPrefill")?.addEventListener("click", clearQRRequestPrefill);
    }
    if (window.lucide) lucide.createIcons();
}

function clearQRRequestPrefill() {
    sessionStorage.removeItem("qrMaintenancePrefill");
    document.getElementById("qrRequestPrefillBanner")?.remove();
    unlockRequestEquipmentFields();
    document.getElementById("departmentSearch").readOnly = true;
    document.getElementById("serviceTeam").disabled = false;
    document.getElementById("departmentAssetPicker")?.focus();
    updateRequestExperience();
}

function initializeRequestFormEvents() {
    const form = document.getElementById("maintenanceRequestForm");
    form?.addEventListener("submit", submitRequest);
    form?.addEventListener("input", handleRequestFieldUpdate);
    form?.addEventListener("change", handleRequestFieldUpdate);
    document.querySelector(".clear-btn")?.addEventListener("click", () => clearForm());
    document.getElementById("openRequestScanner")?.addEventListener("click", () => navigate("qr"));
}

function handleRequestFieldUpdate(event) {
    const field = event.target;
    if (field?.matches("input, select, textarea")) clearRequestFieldError(field);
    updateDescriptionCount();
    updateRequestExperience();
    saveRequestDraft();
}

function initializePrioritySelector() {
    document.querySelectorAll("[data-request-priority]").forEach(button => {
        button.setAttribute("aria-pressed", String(button.classList.contains("is-selected")));
        button.addEventListener("click", () => setRequestPriority(button.dataset.requestPriority));
    });
}

function setRequestPriority(priority) {
    const field = document.getElementById("priority");
    if (!field || !["Low", "Medium", "High", "Critical"].includes(priority)) return;
    field.value = priority;
    document.querySelectorAll("[data-request-priority]").forEach(button => {
        const selected = button.dataset.requestPriority === priority;
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-pressed", String(selected));
    });
    document.getElementById("priorityGuidance")?.classList.toggle("is-critical", priority === "Critical");
    updateRequestExperience();
    saveRequestDraft();
}

function initializeDescriptionHelpers() {
    document.querySelectorAll("[data-description-prompt]").forEach(button => {
        button.addEventListener("click", () => {
            const field = document.getElementById("failureDescription");
            if (!field) return;
            const prompt = button.dataset.descriptionPrompt || "";
            field.value = field.value.trim() ? `${field.value.trim()} ${prompt}` : prompt;
            field.focus();
            updateDescriptionCount();
            saveRequestDraft();
        });
    });
    updateDescriptionCount();
}

function updateDescriptionCount() {
    const field = document.getElementById("failureDescription");
    const counter = document.getElementById("failureDescriptionCount");
    if (field && counter) counter.textContent = `${field.value.length} / 4000`;
}

function initializeEquipmentControls() {
    document.getElementById("departmentAssetPicker")?.addEventListener("change", event => {
        const asset = requestDepartmentAssets.find(item => String(item.id) === event.target.value);
        if (asset) applyRegisteredAsset(asset);
        else unlockRequestEquipmentFields();
    });
    document.getElementById("useManualEquipment")?.addEventListener("click", () => {
        const picker = document.getElementById("departmentAssetPicker");
        if (picker) picker.value = "";
        unlockRequestEquipmentFields();
        document.getElementById("equipmentIdentifier")?.focus();
        updateRequestExperience();
    });
}

async function loadRequestDepartmentAssets() {
    const picker = document.getElementById("departmentAssetPicker");
    const help = document.getElementById("assetPickerHelp");
    if (!picker) return;
    try {
        const response = await fetch("/api/assets/department/mine", { cache: "no-store" });
        const data = await response.json().catch(() => ([]));
        if (!response.ok) throw new Error(data.detail || "Unable to load department equipment.");
        requestDepartmentAssets = Array.isArray(data) ? data : [];
        picker.replaceChildren(new Option("Select registered equipment", ""));
        requestDepartmentAssets.forEach(asset => {
            const identifier = asset.asset_code || asset.equipment_no || `Asset ${asset.id}`;
            const location = asset.location ? ` — ${asset.location}` : "";
            picker.add(new Option(`${identifier} · ${asset.equipment_name || "Unnamed equipment"}${location}`, String(asset.id)));
        });
        if (!requestDepartmentAssets.length) {
            picker.replaceChildren(new Option("No registered equipment — enter details manually", ""));
            picker.disabled = true;
            if (help) help.textContent = "No assets are registered to this department yet. Manual entry is available below.";
        }
        matchPrefilledRequestAsset();
    } catch (error) {
        picker.replaceChildren(new Option("Equipment list unavailable — enter manually", ""));
        picker.disabled = true;
        if (help) help.textContent = error.message || "Enter the equipment details manually.";
    }
}

function matchPrefilledRequestAsset() {
    const identifier = document.getElementById("equipmentIdentifier")?.value.trim().toLowerCase();
    if (!identifier) return;
    const asset = requestDepartmentAssets.find(item => [item.asset_code, item.equipment_no]
        .some(value => String(value || "").trim().toLowerCase() === identifier));
    if (asset) document.getElementById("departmentAssetPicker").value = String(asset.id);
}

function applyRegisteredAsset(asset) {
    const values = {
        equipmentIdentifier: asset.asset_code || asset.equipment_no,
        equipmentName: asset.equipment_name,
        makeModel: [asset.manufacturer, asset.model].filter(Boolean).join(" / "),
        locationRoom: asset.location,
        serviceTeam: asset.service_team,
    };
    Object.entries(values).forEach(([id, value]) => {
        const field = document.getElementById(id);
        if (!field || !String(value || "").trim()) return;
        field.value = value;
        clearRequestFieldError(field);
    });
    ["equipmentIdentifier", "equipmentName", "makeModel"].forEach(id => {
        const field = document.getElementById(id);
        if (field) field.readOnly = true;
    });
    const serviceTeam = document.getElementById("serviceTeam");
    if (serviceTeam && ["Biomedical", "Electrical", "IT"].includes(asset.service_team)) {
        serviceTeam.value = asset.service_team;
        serviceTeam.disabled = true;
    }
    const status = document.getElementById("selectedAssetStatus");
    if (status) {
        status.hidden = false;
        status.textContent = `${asset.equipment_name || "Equipment"} selected from your department registry. Verified details have been filled in.`;
    }
    updateRequestExperience();
    saveRequestDraft();
}

function unlockRequestEquipmentFields() {
    ["locationRoom", "equipmentIdentifier", "equipmentName", "makeModel"].forEach(id => {
        const field = document.getElementById(id);
        if (!field) return;
        field.readOnly = false;
        field.classList.remove("qr-prefill-locked", "qr-prefill-missing");
    });
    document.getElementById("serviceTeam").disabled = false;
    const status = document.getElementById("selectedAssetStatus");
    if (status) status.hidden = true;
}

function requestValue(id) {
    return String(document.getElementById(id)?.value || "").trim();
}

function updateRequestExperience() {
    const teamLabels = {
        Biomedical: "Biomedical Engineering",
        Electrical: "Electrical Engineering",
        IT: "IT Department",
    };
    const summaryValues = {
        summaryDepartment: requestValue("departmentSearch") || "Not available",
        summaryLocation: requestValue("locationRoom") || "Add a location",
        summaryEquipment: requestValue("equipmentName") || "Select equipment",
        summaryCategory: requestValue("problemCategory") || "Choose a category",
        summaryTeam: teamLabels[requestValue("serviceTeam")] || "Choose a team",
    };
    Object.entries(summaryValues).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    });

    const priority = requestValue("priority") || "Medium";
    const prioritySummary = document.getElementById("summaryPriority");
    if (prioritySummary) {
        prioritySummary.textContent = priority;
        prioritySummary.className = `request-summary-priority is-${priority.toLowerCase()}`;
    }

    const sectionState = {
        location: Boolean(requestValue("departmentSearch") && requestValue("reportedBy") && requestValue("locationRoom")),
        equipment: Boolean(requestValue("equipmentIdentifier") && requestValue("equipmentName")),
        problem: Boolean(requestValue("problemCategory") && requestValue("serviceTeam") && priority),
    };
    Object.entries(sectionState).forEach(([step, complete]) => {
        document.querySelector(`[data-request-step="${step}"]`)?.classList.toggle("is-complete", complete);
    });
    const ready = Object.values(sectionState).every(Boolean);
    const readyState = document.getElementById("requestReadyState");
    if (readyState) {
        readyState.classList.toggle("is-ready", ready);
        const title = readyState.querySelector("strong");
        const copy = readyState.querySelector("small");
        if (title) title.textContent = ready ? "Ready to submit" : "Complete the required fields";
        if (copy) copy.textContent = ready
            ? "Your request will be sent to the selected engineering team."
            : "Your ticket will be created instantly after submission.";
    }
}

function validateForm() {
    const requiredFields = [
        ["departmentSearch", "Your account needs an assigned department."],
        ["locationRoom", "Enter the exact location of the equipment."],
        ["reportedBy", "Your account needs a reporter name."],
        ["equipmentIdentifier", "Enter or select an equipment identifier."],
        ["equipmentName", "Enter the equipment name."],
        ["problemCategory", "Choose the type of problem."],
        ["serviceTeam", "Choose the engineering team."],
    ];
    let firstInvalid = null;
    requiredFields.forEach(([id, message]) => {
        const field = document.getElementById(id);
        if (!field) return;
        clearRequestFieldError(field);
        if (!String(field.value || "").trim()) {
            setRequestFieldError(field, message);
            if (!firstInvalid) firstInvalid = field;
        }
    });
    if (firstInvalid) {
        firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
        firstInvalid.focus({ preventScroll: true });
        return false;
    }
    return true;
}

function setRequestFieldError(field, message) {
    field.setAttribute("aria-invalid", "true");
    field.closest(".request-input-with-icon, .request-select-wrap")?.classList.add("input-error");
    const error = document.getElementById(`${field.id}Error`);
    if (error) error.textContent = message;
}

function clearRequestFieldError(field) {
    field.removeAttribute("aria-invalid");
    field.closest(".request-input-with-icon, .request-select-wrap")?.classList.remove("input-error");
    const error = document.getElementById(`${field.id}Error`);
    if (error) error.textContent = "";
}

function saveRequestDraft() {
    if (requestSubmitting) return;
    const draft = {
        locationRoom: requestValue("locationRoom"),
        equipmentIdentifier: requestValue("equipmentIdentifier"),
        equipmentName: requestValue("equipmentName"),
        makeModel: requestValue("makeModel"),
        problemCategory: requestValue("problemCategory"),
        serviceTeam: requestValue("serviceTeam"),
        priority: requestValue("priority"),
        failureDescription: document.getElementById("failureDescription")?.value || "",
        wardBoyAssistance: Boolean(document.getElementById("wardBoyAssistance")?.checked),
    };
    sessionStorage.setItem(REQUEST_DRAFT_KEY, JSON.stringify(draft));
}

function restoreRequestDraft() {
    if (getQRMaintenancePrefill()) return;
    try {
        const draft = JSON.parse(sessionStorage.getItem(REQUEST_DRAFT_KEY) || "null");
        if (!draft) return;
        ["locationRoom", "equipmentIdentifier", "equipmentName", "makeModel", "problemCategory", "serviceTeam", "failureDescription"]
            .forEach(id => {
                const field = document.getElementById(id);
                if (field && draft[id] != null) field.value = String(draft[id]);
            });
        document.getElementById("wardBoyAssistance").checked = Boolean(draft.wardBoyAssistance);
        setRequestPriority(draft.priority || "Medium");
    } catch (error) {
        sessionStorage.removeItem(REQUEST_DRAFT_KEY);
    }
}

function clearForm(options = {}) {
    const preserveQR = options.preserveQR !== false;
    sessionStorage.removeItem(REQUEST_DRAFT_KEY);
    document.getElementById("maintenanceRequestForm")?.reset();
    initializeRequesterFields();
    unlockRequestEquipmentFields();
    const picker = document.getElementById("departmentAssetPicker");
    if (picker && !picker.disabled) picker.value = "";
    setRequestPriority("Medium");
    document.querySelectorAll(".request-field-error").forEach(error => { error.textContent = ""; });
    document.querySelectorAll('[aria-invalid="true"]').forEach(field => field.removeAttribute("aria-invalid"));
    if (preserveQR && getQRMaintenancePrefill()) applyQRMaintenancePrefill();
    else document.getElementById("qrRequestPrefillBanner")?.remove();
    updateDescriptionCount();
    updateRequestExperience();
    if (!options.silent) showRequestToast("The form has been reset.", "success");
}

function setRequestSubmitting(submitting) {
    requestSubmitting = submitting;
    const button = document.getElementById("submitRequestBtn");
    if (!button) return;
    button.disabled = submitting;
    button.classList.toggle("is-loading", submitting);
    const title = button.querySelector(".request-submit-copy strong");
    const copy = button.querySelector(".request-submit-copy small");
    if (title) title.textContent = submitting ? "Submitting request…" : "Submit maintenance request";
    if (copy) copy.textContent = submitting ? "Please keep this page open" : "Create a trackable ticket";
}

async function submitRequest(event) {
    event?.preventDefault();
    if (requestSubmitting || !validateForm()) {
        if (!requestSubmitting) showRequestToast("Check the highlighted fields and try again.", "error");
        return;
    }
    setRequestSubmitting(true);
    try {
        const response = await fetch("/api/requests", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                department: requestValue("departmentSearch"),
                location: requestValue("locationRoom"),
                equipment_identifier: requestValue("equipmentIdentifier"),
                equipment_name: requestValue("equipmentName"),
                make_model: requestValue("makeModel"),
                priority: requestValue("priority"),
                problem_category: requestValue("problemCategory"),
                service_team: requestValue("serviceTeam"),
                failure_description: document.getElementById("failureDescription").value.trim(),
                request_ward_boy_pickup: Boolean(document.getElementById("wardBoyAssistance")?.checked),
            }),
        });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401 && typeof expireDashboardSession === "function") {
            await expireDashboardSession(data.detail);
            return;
        }
        if (!response.ok) {
            const detail = Array.isArray(data.detail)
                ? data.detail.map(item => item.msg).filter(Boolean).join(" ")
                : data.detail;
            throw new Error(detail || "Unable to save this maintenance request.");
        }

        sessionStorage.removeItem(REQUEST_DRAFT_KEY);
        showSuccess({
            title: "Request submitted",
            message: data.ward_boy_pickup_requested
                ? `Ticket ${data.ticket_number} was created. A Ward Boy pickup job is also available.`
                : `Ticket ${data.ticket_number} was created and sent to the engineering team.`,
            buttonText: "Create another request",
            onClose() {
                sessionStorage.removeItem("qrMaintenancePrefill");
                clearForm({ preserveQR: false, silent: true });
                document.getElementById("locationRoom")?.focus();
            },
        });
    } catch (error) {
        console.error(error);
        showRequestToast(error.message || "Unable to submit this request.", "error");
    } finally {
        setRequestSubmitting(false);
    }
}

function showRequestToast(message, type = "success") {
    const title = type === "success" ? "Maintenance request" : "Request needs attention";
    BioTrackToast.show({ title, message, type });
}
;
/* source: dashboard_v2/js/clock.js */
// ==========================================
// BIOTRACK V2 CLOCK
// ==========================================

function updateClock() {

    const now = new Date();

    const date = `${now.toLocaleDateString("en-IN", { weekday: "long" })}, ${formatPreferredDate(now)}`;
    const time = now.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: (localStorage.getItem("timeFormat") || "24 Hour") === "12 Hour",
    });

    const currentDate = document.getElementById("currentDate");
    const currentTime = document.getElementById("currentTime");

    // Prevent errors on pages that don't have a clock
    if (currentDate) {
        currentDate.textContent = date;
    }

    if (currentTime) {
        currentTime.textContent = time;
    }

}

function formatPreferredDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const format = localStorage.getItem("dateFormat") || "DD/MM/YYYY";
    if (format === "MM/DD/YYYY") return `${month}/${day}/${year}`;
    if (format === "YYYY-MM-DD") return `${year}-${month}-${day}`;
    return `${day}/${month}/${year}`;
}

updateClock();

setInterval(updateClock, 1000);


/* ==========================================
   DATE & TIME FORMATTERS
========================================== */

/**
 * Example:
 * 14 Jul 2026, 07:56 PM
 */
function formatDateTime(dateString) {

    if (!dateString) return "-";

    const date = new Date(dateString);

    return `${formatPreferredDate(date)}, ${date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: (localStorage.getItem("timeFormat") || "24 Hour") === "12 Hour",
    })}`;

}


/**
 * Example:
 * 14 Jul 2026
 */
function formatDate(dateString) {

    if (!dateString) return "-";

    const date = new Date(dateString);

    return formatPreferredDate(date);

}


/**
 * Example:
 * 07:56 PM
 */
function formatTime(dateString) {

    if (!dateString) return "-";

    const date = new Date(dateString);

    return date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: (localStorage.getItem("timeFormat") || "24 Hour") === "12 Hour",
    });

}

document.addEventListener("biotrack:preferences-changed", updateClock);
;
/* source: dashboard_v2/js/assets_details.js */
// ==========================================
// OPEN ASSET DRAWER
// ==========================================

function openAssetDrawer(asset) {

    closeAssetDrawer();

    document.body.insertAdjacentHTML(

        "beforeend",

        `
        <div id="assetDrawerOverlay" class="asset-overlay">

            <div id="assetDrawer" class="asset-drawer">

                <!-- ===================================== -->
                <!-- HEADER -->
                <!-- ===================================== -->

                <div class="drawer-header">

                    <div>

                        <h2>${asset.equipment_name || "-"}</h2>

                        <p class="drawer-subtitle">

                            Asset Code :
                            <strong>${asset.asset_code || "-"}</strong>

                        </p>

                    </div>

                    <button
                        id="closeDrawerBtn"
                        class="drawer-close">

                        ✕

                    </button>

                </div>


                <!-- ===================================== -->
                <!-- BODY -->
                <!-- ===================================== -->

                <div class="drawer-body">

                    <!-- Equipment Image -->

                    <div class="asset-image">

                        🏥

                    </div>


                    <!-- ===================================== -->
                    <!-- GENERAL INFORMATION -->
                    <!-- ===================================== -->

                    <!-- ===================================== -->
                    <!-- GENERAL INFORMATION -->
                    <!-- ===================================== -->

                    <div class="drawer-section">

                        <div class="section-header">

                            <h3>General Information</h3>

                        </div>

                        <div class="asset-info">

                            <div class="info-card">

                                <label>Equipment No</label>

                                <h4>${asset.equipment_no || "-"}</h4>

                            </div>

                            <div class="info-card">

                                <label>Equipment Name</label>

                                <h4>${asset.equipment_name || "-"}</h4>

                            </div>

                            <div class="info-card">

                                <label>Manufacturer</label>

                                <h4>${asset.manufacturer || "-"}</h4>

                            </div>

                            <div class="info-card">

                                <label>Model</label>

                                <h4>${asset.model || "-"}</h4>

                            </div>

                            <div class="info-card">

                                <label>Department</label>

                                <h4>${asset.department || "-"}</h4>

                            </div>

                            <div class="info-card">

                                <label>Status</label>

                                <span class="status-badge">

                                    ${asset.status || "-"}

                                </span>

                            </div>

                            <div class="info-card">

                                <label>Serial Number</label>

                                <h4>${asset.serial_number || "-"}</h4>

                            </div>

                            <div class="info-card">

                                <label>Asset Code</label>

                                <h4>${asset.asset_code || "-"}</h4>

                            </div>

                        </div>

                    </div>

                    </div>

                </div>

            </div>

        </div>
        <!-- ===================================== -->
        <!-- PURCHASE & WARRANTY -->
        <!-- ===================================== -->

        <div class="drawer-section">

            <div class="section-header">

                <h3>Purchase & Warranty</h3>

            </div>

            <div class="asset-info">

                <div class="info-card">

                    <label>Purchase Date</label>

                    <h4>${asset.purchase_date || "-"}</h4>

                </div>

                <div class="info-card">

                    <label>Installation Date</label>

                    <h4>${asset.installation_date || "-"}</h4>

                </div>

                <div class="info-card">

                    <label>Purchase Value</label>

                    <h4>₹ ${asset.purchase_value ?? "-"}</h4>

                </div>

                <div class="info-card">

                    <label>Tax Amount</label>

                    <h4>₹ ${asset.tax_amount ?? "-"}</h4>

                </div>

                <div class="info-card">

                    <label>Net Value</label>

                    <h4>₹ ${asset.net_value ?? "-"}</h4>

                </div>

                <div class="info-card">

                    <label>Warranty</label>

                    <h4>${asset.warranty || "-"}</h4>

                </div>

                <div class="info-card">

                    <label>Supplier</label>

                    <h4>${asset.supplier || "-"}</h4>

                </div>

                <div class="info-card">

                    <label>Maintained By</label>

                    <h4>${asset.maintained_by || "-"}</h4>

                </div>

            </div>

        </div>
        `

    );


    const overlay = document.getElementById("assetDrawerOverlay");
    const drawer = document.getElementById("assetDrawer");

    requestAnimationFrame(() => {

        overlay.classList.add("show");
        drawer.classList.add("show");

    });

    document
        .getElementById("closeDrawerBtn")
        .addEventListener("click", closeAssetDrawer);

}

// ==========================================
// CLOSE DRAWER
// ==========================================

function closeAssetDrawer() {

    const overlay = document.getElementById("assetDrawerOverlay");
    const drawer = document.getElementById("assetDrawer");

    if (!overlay || !drawer) return;

    overlay.classList.remove("show");
    drawer.classList.remove("show");

    setTimeout(() => {

        overlay.remove();

    }, 350);

}


// ==========================================
// GLOBAL
// ==========================================

window.openAssetDrawer = openAssetDrawer;
window.closeAssetDrawer = closeAssetDrawer;
;
/* source: dashboard_v2/js/qr_scanner.js */
// ==========================================
// QR SCANNER
// ==========================================

let html5QrScanner = null;
let qrScannerStarting = false;
let qrResultHandled = false;
let qrScannerSessionId = 0;
let qrScannerCloseRequested = false;

function setQRScannerStatus(message, isError = false) {
    const status = document.getElementById("qrScannerStatus");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", isError);
}

// Open the device camera immediately. The browser will show its native
// permission prompt the first time a user scans on a device.
async function openQRScanner() {
    if (document.querySelector(".qr-scanner-overlay") || qrScannerStarting) return;

    const sessionId = ++qrScannerSessionId;
    qrScannerCloseRequested = false;

    const modal = document.createElement("div");
    modal.className = "qr-scanner-overlay";
    modal.innerHTML = `
        <div class="qr-scanner-modal" role="dialog" aria-modal="true" aria-labelledby="qrScannerTitle">
            <div class="qr-scanner-header">
                <h2 id="qrScannerTitle">Scan Equipment QR</h2>
                <button id="closeScannerBtn" type="button" aria-label="Close scanner">✕</button>
            </div>
            <div class="qr-scanner-body">
                <div id="reader"></div>
                <p class="scanner-note" id="qrScannerStatus" role="status">Starting your camera…</p>
            </div>
            <div class="qr-scanner-footer">
                <button id="stopScannerBtn" type="button" class="scanner-stop-btn">Close Scanner</button>
            </div>
        </div>`;

    document.body.appendChild(modal);
    document.getElementById("closeScannerBtn").onclick = closeQRScanner;
    document.getElementById("stopScannerBtn").onclick = closeQRScanner;
    modal.addEventListener("click", event => {
        if (event.target === modal) closeQRScanner();
    });

    if (typeof Html5Qrcode === "undefined") {
        setQRScannerStatus("The camera scanner could not be loaded. Refresh the page and try again.", true);
        return;
    }

    qrScannerStarting = true;
    qrResultHandled = false;
    const scanner = new Html5Qrcode("reader");
    html5QrScanner = scanner;

    try {
        await scanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 260, height: 260 } },
            onQRCodeDetected,
            () => {}
        );

        if (qrScannerCloseRequested || sessionId !== qrScannerSessionId || !modal.isConnected) {
            await stopQRScannerInstance(scanner, modal);
            return;
        }
        setQRScannerStatus("Position the QR code inside the scanning frame.");
    } catch (error) {
        if (qrScannerCloseRequested || sessionId !== qrScannerSessionId) return;
        console.error("Unable to start QR camera", error);
        setQRScannerStatus(
            "Camera access is unavailable. Allow camera permission in your browser, then open the scanner again.",
            true
        );
    } finally {
        if (sessionId === qrScannerSessionId) qrScannerStarting = false;
    }
}

async function onQRCodeDetected(decodedText) {
    if (qrResultHandled) return;
    qrResultHandled = true;
    setQRScannerStatus("QR code found. Opening the asset…");

    try {
        await closeQRScanner();
        const response = await fetch(`/api/qr/lookup/${encodeURIComponent(decodedText)}`);
        const result = await response.json().catch(() => ({}));

        if (!response.ok || !result.success || !result.asset?.id) {
            BioTrackToast.warning("Asset not found", result.detail || result.message || "No matching equipment record was found.");
            return;
        }

        openQRAssetProfile(result.asset.id);
    } catch (error) {
        console.error(error);
        BioTrackToast.error("Scan lookup failed", "Unable to locate this asset. Please try again.");
    }
}

async function closeQRScanner() {
    qrScannerCloseRequested = true;
    qrScannerSessionId += 1;
    const scanner = html5QrScanner;
    html5QrScanner = null;
    qrScannerStarting = false;
    qrResultHandled = false;
    const overlay = document.querySelector(".qr-scanner-overlay");

    stopQRMediaTracks(overlay);
    overlay?.remove();
    await stopQRScannerInstance(scanner, overlay);
}

function stopQRMediaTracks(root = document) {
    if (!root?.querySelectorAll) return;
    root.querySelectorAll("video").forEach(video => {
        const stream = video.srcObject;
        if (stream?.getTracks) {
            stream.getTracks().forEach(track => track.stop());
            video.srcObject = null;
        }
    });
}

async function stopQRScannerInstance(scanner, root) {
    stopQRMediaTracks(root);
    if (!scanner) return;

    try {
        await scanner.stop();
    } catch (_) {
        // A pending permission request may not be stoppable until start resolves.
    }
    try {
        scanner.clear();
    } catch (_) {}
    stopQRMediaTracks(root);
}

function isQRScannerActive() {
    return Boolean(
        html5QrScanner
        || qrScannerStarting
        || document.querySelector(".qr-scanner-overlay")
    );
}

document.addEventListener("visibilitychange", () => {
    if (document.hidden && isQRScannerActive()) void closeQRScanner();
});
window.addEventListener("pagehide", () => {
    if (isQRScannerActive()) void closeQRScanner();
});

window.openQRScanner = openQRScanner;
window.closeQRScanner = closeQRScanner;
window.isQRScannerActive = isQRScannerActive;
