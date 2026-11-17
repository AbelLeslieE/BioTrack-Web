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
        overlay.addEventListener("mousedown", event => {
            if (event.target === overlay) close();
        });
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
