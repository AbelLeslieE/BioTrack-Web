// ==========================================
// MY REQUESTS PAGE
// ==========================================

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
                        type="text"
                        placeholder="Search Ticket, Equipment..."
                    >

                </div>

                <div class="myrequest-filters">

                    <select>

                        <option>All Status</option>

                    </select>

                    <select>

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

        </div>

        `;

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

    const tbody =
        document.getElementById("myRequestsBody");

    tbody.innerHTML = "";

    if (data.requests.length === 0) {

        tbody.innerHTML = `

        <tr>

            <td colspan="7">

                No maintenance requests found.

            </td>

        </tr>

        `;

        return;

    }

    data.requests.forEach(request => {

        tbody.innerHTML += `

        <tr>

            <td>${request.ticket}</td>

            <td>${request.equipment}</td>

            <td>${request.equipment_id}</td>

            <td>${request.priority}</td>

            <td>

                <span class="status-badge ${request.status.toLowerCase().replaceAll(" ","-")}">

                    ${request.status}

                </span>

            </td>

            <td>${request.reported_time}</td>

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

}

// ==========================================
// OPEN REQUEST
// ==========================================

function openRequest(ticket){

    console.log(ticket);

    // Next step:
    // Open request details page

}