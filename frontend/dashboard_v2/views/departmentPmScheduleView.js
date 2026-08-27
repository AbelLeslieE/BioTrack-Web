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
        alert(error.message);
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
