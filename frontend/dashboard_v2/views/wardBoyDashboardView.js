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
                    <p>Accept equipment pickup and return jobs, follow the route, and confirm delivery.</p>
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
                    <div><span>Transport queue</span><h2>Equipment movement jobs</h2></div>
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
        <article class="ward-boy-task is-${String(task.status || "pending").toLowerCase()}">
            <header>
                <span class="ward-boy-task-type is-${String(task.movement_type || "pickup").toLowerCase()}"><i data-lucide="${task.movement_type === "Return" ? "undo-2" : "package-open"}"></i>${wardBoyEscape(task.movement_type)}</span>
                <span class="ward-boy-priority is-${String(task.priority || "medium").toLowerCase()}">${wardBoyEscape(task.priority || "Medium")}</span>
            </header>
            <div class="ward-boy-equipment">
                <span><i data-lucide="monitor-cog"></i></span>
                <div><small>${wardBoyEscape(task.ticket)}</small><h3>${wardBoyEscape(task.equipment || "Equipment")}</h3><p>${wardBoyEscape(task.equipment_identifier || "No equipment ID")}</p></div>
            </div>
            <div class="ward-boy-route">
                <div><span class="route-dot is-from"></span><small>Collect from</small><strong>${wardBoyEscape(task.source_location)}</strong></div>
                <span class="route-line"></span>
                <div><span class="route-dot is-to"></span><small>Deliver to</small><strong>${wardBoyEscape(task.destination_location)}</strong></div>
            </div>
            <footer>
                <div class="ward-boy-meta"><span><i data-lucide="building-2"></i>${wardBoyEscape(task.department || "Hospital")}</span><span><i data-lucide="clock-3"></i>${wardBoyEscape(wardBoyTime(task.requested_at))}</span></div>
                ${task.status === "Pending" ? `<button type="button" onclick="acceptWardBoyTask(${Number(task.id)})"><i data-lucide="hand"></i> Accept job</button>` : ""}
                ${task.status === "Accepted" ? `<button type="button" class="is-complete" onclick="completeWardBoyTask(${Number(task.id)})"><i data-lucide="badge-check"></i> Mark delivered</button>` : ""}
                ${task.status === "Completed" ? '<span class="ward-boy-delivered"><i data-lucide="circle-check-big"></i> Delivered</span>' : ""}
            </footer>
        </article>`).join("");
    if (window.lucide) lucide.createIcons();
}

async function mutateWardBoyTask(taskId, action) {
    const buttons = document.querySelectorAll(`button[onclick*="WardBoyTask(${taskId})"]`);
    buttons.forEach(button => { button.disabled = true; });
    try {
        const response = await fetch(`/api/ward-boy/tasks/${taskId}/${action}`, { method: "PATCH" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "Unable to update this job.");
        BioTrackToast.success(action === "accept" ? "Job accepted" : "Delivery completed", action === "accept" ? "Follow the route shown on the job card." : "The requester and engineering team can now see the delivery status.");
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

function acceptWardBoyTask(taskId) { return mutateWardBoyTask(taskId, "accept"); }
function completeWardBoyTask(taskId) { return mutateWardBoyTask(taskId, "complete"); }
