// ==========================================
// MY REQUESTS PAGE
// ==========================================

let myRequestsCache = [];
let filteredMyRequests = [];
const myRequestsPagination = { page: 1, pageSize: 10 };

async function renderMyRequests() {

    const pageContent =
        document.getElementById("page-content");

    pageContent.innerHTML = `

        <div class="my-requests-page">

            <div class="my-requests-header">

                <div class="my-requests-title">

                    <h1>My Maintenance Requests</h1>

                    <p>
                        Track all maintenance requests submitted by you.
                    </p>

                </div>

            </div>

            <div class="myrequest-kpis">

                <div class="myrequest-card">

                    <div class="myrequest-icon icon-total">
                        📋
                    </div>

                    <div class="myrequest-info">

                        <h2 id="totalRequests">0</h2>

                        <span>Total Requests</span>

                    </div>

                </div>

                <div class="myrequest-card">

                    <div class="myrequest-icon icon-open">
                        🟠
                    </div>

                    <div class="myrequest-info">

                        <h2 id="openRequests">0</h2>

                        <span>Open</span>

                    </div>

                </div>

                <div class="myrequest-card">

                    <div class="myrequest-icon icon-progress">
                        🔧
                    </div>

                    <div class="myrequest-info">

                        <h2 id="progressRequests">0</h2>

                        <span>In Progress</span>

                    </div>

                </div>

                <div class="myrequest-card">

                    <div class="myrequest-icon icon-completed">
                        ✅
                    </div>

                    <div class="myrequest-info">

                        <h2 id="completedRequests">0</h2>

                        <span>Completed</span>

                    </div>

                </div>

            </div>

            <div class="myrequest-toolbar">

                <div class="myrequest-search">

                    <input
                        id="myRequestsSearch"
                        type="text"
                        placeholder="Search Ticket, Equipment..."
                    >

                </div>

                <div class="myrequest-filters">

                    <select id="myRequestsStatusFilter">

                        <option>All Status</option>

                    </select>

                    <select id="myRequestsPriorityFilter">

                        <option>All Priority</option>

                    </select>

                </div>

            </div>

            <div class="myrequest-table-card">

                <table class="myrequest-table">

                    <thead>

                        <tr>

                            <th>Ticket</th>

                            <th>Equipment</th>

                            <th>Equipment ID</th>

                            <th>Priority</th>

                            <th>Status</th>

                            <th>Reported</th>

                            <th>Action</th>

                        </tr>

                    </thead>

                    <tbody id="myRequestsBody">

                    </tbody>

                </table>

            </div>

            <div id="myRequestsPagination" class="table-pagination"></div>

        </div>

        `;

    document.getElementById("myRequestsSearch").addEventListener("input", applyMyRequestsFilters);
    document.getElementById("myRequestsStatusFilter").addEventListener("change", applyMyRequestsFilters);
    document.getElementById("myRequestsPriorityFilter").addEventListener("change", applyMyRequestsFilters);

    loadMyRequests();

}

// ==========================================
// LOAD REQUESTS
// ==========================================

async function loadMyRequests() {

    const username =
        localStorage.getItem("username");

    const response = await fetch(

        `/api/user/my-requests?username=${username}`

    );

    const data = await response.json();

    document.getElementById("totalRequests").textContent =
        data.summary.total;

    document.getElementById("openRequests").textContent =
        data.summary.open;

    document.getElementById("progressRequests").textContent =
        data.summary.in_progress;

    document.getElementById("completedRequests").textContent =
        data.summary.completed;

    myRequestsCache = Array.isArray(data.requests) ? data.requests : [];
    populateMyRequestsFilters(myRequestsCache);
    applyMyRequestsFilters(false);

}

function populateMyRequestsFilters(requests) {
    const populate = (id, values, label) => {
        const select = document.getElementById(id);
        if (!select) return;
        const previous = select.value;
        const options = [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
        select.innerHTML = `<option value="">${label}</option>${options.map(value => `<option value="${String(value).replaceAll('"', '&quot;')}">${value}</option>`).join("")}`;
        if (options.includes(previous)) select.value = previous;
    };

    populate("myRequestsStatusFilter", requests.map(request => request.status), "All Statuses");
    populate("myRequestsPriorityFilter", requests.map(request => request.priority), "All Priorities");
}

function applyMyRequestsFilters(resetPage = true) {
    const search = (document.getElementById("myRequestsSearch")?.value || "").trim().toLowerCase();
    const status = document.getElementById("myRequestsStatusFilter")?.value || "";
    const priority = document.getElementById("myRequestsPriorityFilter")?.value || "";

    filteredMyRequests = myRequestsCache.filter((request) => {
        const searchable = [request.ticket, request.equipment, request.equipment_id, request.department]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
        return (!search || searchable.includes(search))
            && (!status || request.status === status)
            && (!priority || request.priority === priority);
    });

    if (resetPage) myRequestsPagination.page = 1;
    renderMyRequestsTable(filteredMyRequests);
}

function renderMyRequestsTable(requests) {
    const tbody = document.getElementById("myRequestsBody");
    if (!tbody) return;

    if (requests.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7">No maintenance requests found.</td></tr>`;
        TablePagination.render(
            document.getElementById("myRequestsPagination"),
            myRequestsPagination,
            0,
            () => renderMyRequestsTable(filteredMyRequests),
            "requests"
        );
        return;
    }

    const pageItems = TablePagination.pageItems(requests, myRequestsPagination);
    tbody.innerHTML = "";

    pageItems.forEach(request => {

        tbody.innerHTML += `

        <tr>

            <td>${request.ticket}</td>

            <td>${request.equipment}</td>

            <td>${request.equipment_id}</td>

            <td>${request.priority}</td>

            <td>

                <span class="status-badge ${(request.status || "").toLowerCase().replaceAll(" ","-")}">

                    ${request.status}

                </span>

            </td>

            <td>${formatDateTime(request.reported_time)}</td>

            <td>

                <button
                    class="btn-primary"

                    onclick="openRequest('${request.ticket}')">

                    View

                </button>

            </td>

        </tr>

        `;

    });

    TablePagination.render(
        document.getElementById("myRequestsPagination"),
        myRequestsPagination,
        requests.length,
        () => renderMyRequestsTable(filteredMyRequests),
        "requests"
    );

}

// ==========================================
// OPEN REQUEST
// ==========================================

function openRequest(ticket) {

    // Store selected ticket
    localStorage.setItem("selectedRequest", ticket);

    // Navigate to Request Details page
    navigate("requestDetails");

}
