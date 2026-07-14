// ==========================================
// REQUEST DETAILS PAGE
// ==========================================

function renderRequestDetails() {

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

initializeRequestDetails();

if (window.lucide) {
    lucide.createIcons();
}
}