let businessData = null;
let businessActiveTab = "overview";

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
    const renderers = { overview: renderBusinessOverview, purchases: renderBusinessPurchases, budgets: renderBusinessBudgets, insurance: renderBusinessInsurance, reports: renderBusinessReports };
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
    if (item.status === "Submitted" && isManager) return `<button class="business-row-action" type="button" onclick="openPurchaseReview(${item.id})">Review</button>`;
    const next = { Approved: "Ordered", Ordered: "Received", Received: "Paid" }[item.status];
    if (next) return `<button class="business-row-action" type="button" onclick="openPurchaseStatus(${item.id}, '${next}')">Mark ${next}</button>`;
    return `<span class="business-muted">${item.approved_by ? `By ${businessEscape(item.approved_by)}` : "No action"}</span>`;
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
    ["budget_id", "allocated_amount", "quantity", "unit_cost", "amount", "claim_submission_days", "payment_due_days", "policy_id", "claim_count", "claimed_amount", "approved_amount", "received_amount"].forEach(key => { if (key in payload && payload[key] !== "") payload[key] = Number(payload[key]); });
    if (payload.budget_id === "") payload.budget_id = null;
    if (payload.expected_payment_date === "") payload.expected_payment_date = null;
    const routes = { budget: ["POST", "/api/business/budgets"], purchase: ["POST", "/api/business/purchases"], transaction: ["POST", "/api/business/transactions"], policy: ["POST", "/api/business/policies"], policyUpdate: ["PUT", `/api/business/policies/${recordId}`], claim: ["POST", "/api/business/claims"], claimUpdate: ["PATCH", `/api/business/claims/${recordId}`] };
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

function closeBusinessModal(event) { if (event && event.target !== event.currentTarget) return; const modal = document.getElementById("businessModal"); if (modal) modal.innerHTML = ""; }
function downloadBusinessReport() { window.location.href = "/api/business/report.csv"; }
function businessFiscalYear() { const now = new Date(); const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; return `${year}-${String(year + 1).slice(-2)}`; }
function businessMoney(value) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0)); }
function businessNumber(value) { return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(value || 0)); }
function businessDate(value) { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? businessEscape(value) : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date); }
function businessStatusClass(value) { return String(value || "").toLowerCase().replaceAll(/[^a-z0-9]+/g, "-"); }
function businessErrorMessage(detail) { if (Array.isArray(detail)) return detail.map(item => item.msg || "Invalid value").join(" · "); return detail || "The record could not be saved."; }
function businessNotify(type, title, message) { const api = window.BioTrackToast; if (api && typeof api[type] === "function") api[type](title, message); else if (typeof window.notifyUser === "function") window.notifyUser(message, type, title); }
function businessEscape(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
