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
