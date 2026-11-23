let businessData = null;
let businessActiveTab = "overview";
let businessQuotationFocusPurchaseId = null;
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
          ${businessTabButton("quotations", "scale", "Quotations")}
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
    const renderers = { overview: renderBusinessOverview, purchases: renderBusinessPurchases, quotations: renderBusinessQuotations, suppliers: renderBusinessSuppliers, budgets: renderBusinessBudgets, insurance: renderBusinessInsurance, reports: renderBusinessReports };
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
    const quotation = ["Submitted", "Approved"].includes(item.status) ? `<button class="business-row-action" type="button" onclick="openBusinessQuotationModule(${item.id})">Quotations</button>` : "";
    if (item.status === "Submitted" && isManager) return `<span class="business-action-stack">${quotation}<button class="business-row-action" type="button" onclick="openPurchaseReview(${item.id})">Review</button></span>`;
    const next = { Approved: "Ordered", Ordered: "Received", Received: "Paid" }[item.status];
    if (next === "Paid" && (businessData?.invoices || []).some(invoice => invoice.purchase_id === item.id)) return `<button class="business-row-action" type="button" onclick="showBusinessTab('suppliers')">Open invoices</button>`;
    if (next) return `<span class="business-action-stack">${quotation}<button class="business-row-action" type="button" onclick="openPurchaseStatus(${item.id}, '${next}')">Mark ${next}</button></span>`;
    return quotation || `<span class="business-muted">${item.approved_by ? `By ${businessEscape(item.approved_by)}` : "No action"}</span>`;
}

function openBusinessQuotationModule(purchaseId) {
    businessQuotationFocusPurchaseId = Number(purchaseId) || null;
    showBusinessTab("quotations");
    const row = document.querySelector(`[data-quotation-purchase="${businessQuotationFocusPurchaseId}"]`);
    if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderBusinessQuotations() {
    const purchases = businessData.purchases || [];
    const quotations = businessData.quotations || [];
    const vendors = (businessData.vendors || []).filter(item => item.status === "Active");
    const eligibleStatuses = ["Submitted", "Approved"];
    const quotationGroups = purchases
        .filter(purchase => eligibleStatuses.includes(purchase.status) || quotations.some(quote => quote.purchase_id === purchase.id))
        .sort((left, right) => Number(right.id === businessQuotationFocusPurchaseId) - Number(left.id === businessQuotationFocusPurchaseId));
    const comparisonCount = quotationGroups.filter(purchase => quotations.filter(quote => quote.purchase_id === purchase.id).length >= 2).length;
    const selectedCount = quotations.filter(item => item.status === "Selected").length;
    const groupRows = quotationGroups.length ? quotationGroups.map(purchase => {
        const purchaseQuotes = quotations.filter(item => item.purchase_id === purchase.id);
        const evaluated = evaluateBusinessQuotations(purchaseQuotes);
        const best = evaluated[0];
        const selected = purchaseQuotes.find(item => item.status === "Selected");
        const totals = purchaseQuotes.map(item => Number(item.total_amount || 0));
        const priceRange = totals.length ? `${businessMoney(Math.min(...totals))}${totals.length > 1 ? ` – ${businessMoney(Math.max(...totals))}` : ""}` : "—";
        const recommendation = evaluated.length >= 2 ? `<strong>${businessEscape(best.vendor_name)}</strong><small>${best.evaluation_score.toFixed(1)} / 100 best-value score</small>` : `<span class="business-muted">${evaluated.length ? "Add another quotation to compare" : "Not evaluated"}</span>`;
        const addButton = eligibleStatuses.includes(purchase.status) && vendors.length ? `<button class="business-row-action" type="button" onclick="openBusinessForm('quotation', ${purchase.id})">Add quotation</button>` : "";
        const compareButton = purchaseQuotes.length ? `<button class="business-row-action" type="button" onclick="openQuotationComparison(${purchase.id})">${purchaseQuotes.length >= 2 ? "Compare" : "Review"}</button>` : "";
        const vendorButton = !vendors.length ? `<button class="business-row-action" type="button" onclick="showBusinessTab('suppliers')">Add a vendor first</button>` : "";
        return `<tr class="${purchase.id === businessQuotationFocusPurchaseId ? "is-focused" : ""}" data-quotation-purchase="${purchase.id}"><td><strong>${businessEscape(purchase.request_number)}</strong><small>${businessDate(purchase.requested_at)}</small></td><td><strong>${businessEscape(purchase.item_name)}</strong><small>${businessEscape(purchase.department)} · ${businessNumber(purchase.quantity)} ${businessEscape(purchase.unit)}</small></td><td><span class="business-quotation-count">${purchaseQuotes.length}</span><small>${purchaseQuotes.length >= 2 ? "Ready to compare" : "quotation received"}</small></td><td><strong>${priceRange}</strong></td><td>${recommendation}</td><td>${selected ? `<span class="business-status is-approved">Selected</span><small>${businessEscape(selected.vendor_name)}</small>` : `<span class="business-status is-${businessStatusClass(purchase.status)}">${businessEscape(purchase.status)}</span>`}</td><td><span class="business-action-stack">${addButton}${compareButton}${vendorButton}</span></td></tr>`;
    }).join("") : businessTableEmpty(7, "No purchases need quotations", "Create a purchase request before collecting supplier quotations.");
    const quotationRows = quotations.length ? quotations.map(item => {
        const purchase = purchases.find(row => row.id === item.purchase_id);
        const documentCount = businessData.document_counts?.[`quotation:${item.id}`] || 0;
        const canEdit = ["Submitted", "Approved"].includes(purchase?.status);
        return `<tr><td><strong>${businessEscape(item.quote_number)}</strong><small>${businessDate(item.quote_date)}${item.valid_until ? ` · valid to ${businessDate(item.valid_until)}` : ""}</small></td><td><strong>${businessEscape(item.vendor_name)}</strong><small>${item.vendor_payment_terms_days || 0} day credit</small></td><td><strong>${businessEscape(purchase?.request_number || `Purchase #${item.purchase_id}`)}</strong><small>${businessEscape(purchase?.item_name || "")}</small></td><td><strong>${businessMoney(item.total_amount)}</strong><small>${businessMoney(item.unit_price)} each</small></td><td>${item.delivery_days || 0} days<small>${item.warranty_months || 0} month warranty</small></td><td><span class="business-status is-${businessStatusClass(item.status)}">${businessEscape(item.status)}</span></td><td><span class="business-action-stack"><button class="business-row-action" type="button" onclick="openQuotationDetails(${item.id})">View</button>${canEdit ? `<button class="business-row-action" type="button" onclick="openBusinessForm('quotationUpdate', ${item.id})">Edit</button>` : ""}<button class="business-row-action" type="button" onclick="openQuotationComparison(${item.purchase_id})">Compare</button><button class="business-row-action" type="button" onclick="openBusinessDocuments('quotation', ${item.id})">Documents${documentCount ? ` (${documentCount})` : ""}</button></span></td></tr>`;
    }).join("") : businessTableEmpty(7, "No quotations collected", "Use the quotation workbench above to add the first supplier offer.");
    return `
      <section class="business-section-heading"><div><span class="business-eyebrow">Supplier sourcing</span><h2>Quotation management</h2><p>Collect supplier offers, compare total value and document the selection decision in one dedicated workspace.</p></div></section>
      <section class="business-insurance-summary business-quotation-summary">
        <article><span><i data-lucide="shopping-basket"></i></span><div><small>Purchases in workbench</small><strong>${quotationGroups.length}</strong></div></article>
        <article><span><i data-lucide="files"></i></span><div><small>Quotations received</small><strong>${quotations.length}</strong></div></article>
        <article><span><i data-lucide="scale"></i></span><div><small>Ready to compare</small><strong>${comparisonCount}</strong></div></article>
        <article><span><i data-lucide="badge-check"></i></span><div><small>Selections completed</small><strong>${selectedCount}</strong></div></article>
      </section>
      <section class="business-panel business-table-panel business-quotation-workbench"><header><div><h2>Quotation workbench</h2><p>Each purchase stays together with its offers, price range, best-value recommendation and final selection.</p></div></header><div class="business-table-scroll"><table class="business-table"><thead><tr><th>Purchase</th><th>Requirement</th><th>Offers</th><th>Price range</th><th>Recommendation</th><th>Decision</th><th>Action</th></tr></thead><tbody>${groupRows}</tbody></table></div></section>
      <section class="business-panel business-table-panel"><header><div><h2>Quotation register</h2><p>All supplier quotations, commercial terms and supporting documents remain available for audit.</p></div></header><div class="business-table-scroll"><table class="business-table"><thead><tr><th>Quotation</th><th>Vendor</th><th>Purchase</th><th>Total value</th><th>Delivery & warranty</th><th>Status</th><th>Action</th></tr></thead><tbody>${quotationRows}</tbody></table></div></section>`;
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

function businessMetric(icon, label, value, tone, detail = "") { const amount = businessMoney(value); const sizeClass = amount.length > 18 ? "is-very-long" : amount.length > 13 ? "is-long" : ""; return `<article class="business-summary-card is-${tone}"><span><i data-lucide="${icon}"></i></span><div><small>${label}</small><strong class="${sizeClass}" title="${businessEscape(amount)}">${amount}</strong>${detail ? `<em>${detail}</em>` : ""}</div></article>`; }
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
        quotationUpdate: { title: "Edit supplier quotation", icon: "file-pen-line", body: businessQuotationFields(null, recordId), submit: "Update quotation" },
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
function businessVendorFields(id = null) { const item = (businessData?.vendors || []).find(row => row.id === Number(id)) || {}; return `<div class="business-form-context business-vendor-number"><strong>Vendor number</strong><span>${item.vendor_code ? businessEscape(item.vendor_code) : "Assigned automatically when saved"}</span></div>${businessField("Vendor name *", "vendor_name", "text", item.vendor_name || "")}${businessField("Supplier type *", "supplier_type", "text", item.supplier_type || "General", "Medical equipment, pharmacy, services…")}${businessField("Tax / GST identifier", "tax_identifier", "text", item.tax_identifier || "")}${businessField("Contact person", "contact_person", "text", item.contact_person || "")}${businessField("Phone", "phone", "tel", item.phone || "")}${businessField("Email", "email", "email", item.email || "")}${businessField("Payment terms (days) *", "payment_terms_days", "number", item.payment_terms_days ?? 30, "", "min=\"0\" max=\"365\"")}${businessField("Bank name", "bank_name", "text", item.bank_name || "")}${businessField("Bank account reference", "bank_account_reference", "text", item.bank_account_reference || "")}${businessSelect("Status *", "status", [["Active", "Active"], ["Blocked", "Blocked"], ["Inactive", "Inactive"]], item.status || "Active")}${businessTextarea("Address", "address", "Registered business address", true, item.address || "")}${businessTextarea("Notes", "notes", "Supply categories, restrictions or verification details", true, item.notes || "")}`; }
function businessQuotationFields(purchaseId, quotationId = null) { const item = (businessData?.quotations || []).find(row => row.id === Number(quotationId)) || {}; const purchase = (businessData?.purchases || []).find(row => row.id === Number(item.purchase_id || purchaseId)); const vendors = (businessData?.vendors || []).filter(row => row.status === "Active" || row.id === item.vendor_id); return `<div class="business-form-context"><strong>${businessEscape(purchase?.request_number || "Purchase")}</strong><span>${businessEscape(purchase?.item_name || "")} · ${businessNumber(purchase?.quantity || 0)} ${businessEscape(purchase?.unit || "")}</span></div>${businessSelect("Vendor *", "vendor_id", vendors.map(vendor => [vendor.id, `${vendor.vendor_code} · ${vendor.vendor_name}`]), item.vendor_id || "")}${businessField("Quotation number *", "quote_number", "text", item.quote_number || "")}${businessField("Quotation date *", "quote_date", "date", item.quote_date || new Date().toISOString().slice(0, 10))}${businessField("Valid until", "valid_until", "date", item.valid_until || "")}${businessField("Quantity *", "quantity", "number", item.quantity ?? purchase?.quantity ?? 1, "", "min=\"0.001\" step=\"0.001\"")}${businessField("Unit price (INR) *", "unit_price", "number", item.unit_price ?? "", "", "min=\"0\" step=\"0.01\"")}${businessField("Installation amount", "installation_amount", "number", item.installation_amount ?? "0", "", "min=\"0\" step=\"0.01\"")}${businessField("Installation details", "installation_details", "text", item.installation_details || "", "Included, free, scope of work…")}${businessField("Transportation / freight", "freight_amount", "number", item.freight_amount ?? "0", "", "min=\"0\" step=\"0.01\"")}${businessField("Training amount", "training_amount", "number", item.training_amount ?? "0", "", "min=\"0\" step=\"0.01\"")}${businessSelect("Training included *", "training_included", [["true", "Yes"], ["false", "No"]], String(item.training_included ?? false))}${businessField("Training details", "training_details", "text", item.training_details || "", "Users covered, duration or location")}${businessField("GST / tax rate (%)", "tax_rate", "number", item.tax_rate ?? "0", "", "min=\"0\" max=\"100\" step=\"0.01\"")}${businessField("Tax amount", "tax_amount", "number", Number(item.tax_rate || 0) > 0 ? "" : (item.tax_amount ?? "0"), "Calculated from the rate when left blank", "min=\"0\" step=\"0.01\"")}${businessField("Discount", "discount_amount", "number", item.discount_amount ?? "0", "", "min=\"0\" step=\"0.01\"")}${businessField("Delivery days", "delivery_days", "number", item.delivery_days ?? "0", "", "min=\"0\"")}${businessField("Warranty months", "warranty_months", "number", item.warranty_months ?? "0", "", "min=\"0\"")}${businessField("Payment terms", "payment_terms", "text", item.payment_terms || "", "Advance, milestone and balance terms")}${businessField("AMC annual amount", "amc_annual_amount", "number", item.amc_annual_amount ?? "0", "", "min=\"0\" step=\"0.01\"")}${businessField("AMC duration (years)", "amc_years", "number", item.amc_years ?? "0", "", "min=\"0\" max=\"50\"")}${businessTextarea("AMC terms", "amc_terms", "Coverage after warranty, escalation and exclusions", true, item.amc_terms || "")}${businessTextarea("Additional conditions", "additional_conditions", "One condition per line", true, item.additional_conditions || "")}${businessTextarea("Internal notes", "notes", "Technical deviations or internal commercial notes", true, item.notes || "")}`; }
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
    ["budget_id", "claim_submission_days", "payment_due_days", "policy_id", "claim_count", "vendor_id", "purchase_id", "quotation_id", "delivery_days", "warranty_months", "amc_years"].forEach(key => { if (key in payload && payload[key] !== "") payload[key] = Number(payload[key]); });
    if (payload.budget_id === "") payload.budget_id = null;
    if (payload.quotation_id === "") payload.quotation_id = null;
    if (payload.valid_until === "") payload.valid_until = null;
    if (payload.tax_amount === "") payload.tax_amount = "0";
    if (payload.expected_payment_date === "") payload.expected_payment_date = null;
    const routes = { budget: ["POST", "/api/business/budgets"], purchase: ["POST", "/api/business/purchases"], vendor: ["POST", "/api/business/vendors"], vendorUpdate: ["PUT", `/api/business/vendors/${recordId}`], quotation: ["POST", `/api/business/purchases/${recordId}/quotations`], quotationUpdate: ["PUT", `/api/business/quotations/${recordId}`], invoice: ["POST", "/api/business/invoices"], payment: ["POST", `/api/business/invoices/${recordId}/payments`], paymentComplete: ["PATCH", `/api/business/payments/${recordId}/complete`], transaction: ["POST", "/api/business/transactions"], policy: ["POST", "/api/business/policies"], policyUpdate: ["PUT", `/api/business/policies/${recordId}`], claim: ["POST", "/api/business/claims"], claimUpdate: ["PATCH", `/api/business/claims/${recordId}`] };
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

function openQuotationDetails(quotationId) {
    const item = (businessData?.quotations || []).find(row => row.id === Number(quotationId));
    const purchase = (businessData?.purchases || []).find(row => row.id === item?.purchase_id);
    const modal = document.getElementById("businessModal");
    if (!item || !modal) return;
    const amountOrIncluded = (amount, details = "") => Number(amount || 0) > 0 ? businessMoney(amount) : businessEscape(details || "Included / free");
    const conditions = [
        item.warranty_months ? `Warranty: ${businessNumber(item.warranty_months)} months` : "",
        item.delivery_days ? `Delivery: ${businessNumber(item.delivery_days)} days` : "",
        Number(item.amc_annual_amount || 0) > 0 || item.amc_terms ? `AMC: ${businessMoney(item.amc_annual_amount)} per year${item.amc_years ? ` for ${businessNumber(item.amc_years)} years` : ""}${item.amc_terms ? ` — ${item.amc_terms}` : ""}` : "",
        item.payment_terms ? `Payment: ${item.payment_terms}` : "",
        item.training_included || item.training_details ? `Training: ${item.training_details || "Included"}` : "",
        ...(item.additional_conditions || "").split(/\r?\n/).map(value => value.trim()).filter(Boolean),
    ].filter(Boolean);
    const canEdit = ["Submitted", "Approved"].includes(purchase?.status);
    modal.innerHTML = `<div class="business-modal-backdrop" onclick="closeBusinessModal(event)"><section class="business-modal business-quotation-detail" role="dialog" aria-modal="true"><header><span><i data-lucide="file-text"></i></span><div><h2>Quotation ${businessEscape(item.quote_number)}</h2><p>${businessEscape(purchase?.request_number || "Purchase")} · ${businessEscape(item.vendor_name)}</p></div><button type="button" onclick="closeBusinessModal()" aria-label="Close"><i data-lucide="x"></i></button></header><div class="business-quotation-detail-body"><section><div class="business-detail-title"><h3>Vendor details</h3><span>${businessEscape(item.vendor_code || "")}</span></div><dl class="business-vendor-detail"><div><dt>Company</dt><dd>${businessEscape(item.vendor_name)}</dd></div><div><dt>Location</dt><dd>${businessEscape(item.vendor_address || "Not recorded")}</dd></div><div><dt>Email</dt><dd>${businessEscape(item.vendor_email || "Not recorded")}</dd></div><div><dt>Contact</dt><dd>${businessEscape(item.vendor_phone || item.vendor_contact_person || "Not recorded")}</dd></div><div><dt>Quotation date</dt><dd>${businessDate(item.quote_date)}</dd></div><div><dt>Valid until</dt><dd>${businessDate(item.valid_until)}</dd></div></dl></section><section><h3>Quotation breakdown</h3><div class="business-quotation-breakdown"><div><span>${businessNumber(item.quantity)} ${businessEscape(purchase?.unit || "units")} × ${businessMoney(item.unit_price)}</span><strong>${businessMoney(item.line_amount)}</strong></div><div><span>Installation${item.installation_details ? `<small>${businessEscape(item.installation_details)}</small>` : ""}</span><strong>${amountOrIncluded(item.installation_amount)}</strong></div><div><span>Transportation</span><strong>${amountOrIncluded(item.freight_amount)}</strong></div><div><span>Training${item.training_details ? `<small>${businessEscape(item.training_details)}</small>` : ""}</span><strong>${amountOrIncluded(item.training_amount)}</strong></div><div><span>Subtotal</span><strong>${businessMoney(item.subtotal_amount)}</strong></div>${Number(item.discount_amount || 0) > 0 ? `<div><span>Discount</span><strong>− ${businessMoney(item.discount_amount)}</strong></div>` : ""}<div><span>GST / tax (${businessNumber(item.tax_rate || 0)}%)</span><strong>${businessMoney(item.tax_amount)}</strong></div><div class="is-total"><span>Grand total</span><strong>${businessMoney(item.total_amount)}</strong></div></div></section><section><h3>Additional conditions</h3>${conditions.length ? `<ul class="business-quotation-conditions">${conditions.map(condition => `<li>${businessEscape(condition)}</li>`).join("")}</ul>` : `<p class="business-muted">No additional commercial conditions were recorded.</p>`}</section>${item.notes ? `<section><h3>Internal notes</h3><p>${businessEscape(item.notes)}</p></section>` : ""}</div><footer><button type="button" onclick="openBusinessDocuments('quotation', ${item.id})"><i data-lucide="paperclip"></i> Documents</button>${canEdit ? `<button class="business-primary" type="button" onclick="openBusinessForm('quotationUpdate', ${item.id})"><i data-lucide="file-pen-line"></i> Edit quotation</button>` : ""}</footer></section></div>`;
    if (window.lucide) lucide.createIcons();
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
    const canEdit = ["Submitted", "Approved"].includes(purchase?.status);
    const modal = document.getElementById("businessModal");
    if (!purchase || !modal) return;
    const recommendation = best ? `<section class="business-quote-recommendation"><div class="business-quote-score"><span>${best.evaluation_score.toFixed(1)}</span><small>/ 100</small></div><div><span class="business-recommendation-label"><i data-lucide="sparkles"></i> Best overall value</span><h3>${businessEscape(best.vendor_name)}</h3><p>${runnerUp ? `<strong>${advantage.toFixed(1)}% stronger overall</strong> than ${businessEscape(runnerUp.vendor_name)} under the priorities below.` : "Add another quotation to calculate a relative advantage."} ${best.evaluation_reasons.length ? `Strongest on ${businessEscape(best.evaluation_reasons.join(", "))}.` : "The recommendation is based on the combined weighted score."}</p>${best.dominates_count ? `<small>This quotation is no worse on every measured criterion and is better on at least one criterion than ${best.dominates_count} other quotation${best.dominates_count === 1 ? "" : "s"}.</small>` : ""}</div></section>` : `<section class="business-quote-recommendation is-empty"><div><h3>No recommendation yet</h3><p>Add at least two supplier quotations to compare their value.</p></div></section>`;
    const controls = [["price", "Price"], ["warranty", "Warranty"], ["delivery", "Delivery speed"], ["payment_terms", "Payment credit"]].map(([key, label]) => `<label><span>${label}</span><input type="number" min="0" max="100" step="5" value="${businessQuoteWeights[key]}" onchange="updateBusinessQuoteWeight(${purchase.id}, '${key}', this.value)"><small>weight</small></label>`).join("");
    const rows = evaluated.length ? evaluated.map(item => `<tr class="${item.is_recommended ? "is-recommended-quote" : (item.is_lowest ? "is-best-quote" : "")}"><td><span class="business-quote-rank">#${item.evaluation_rank}</span><strong>${businessEscape(item.vendor_name)}</strong>${item.is_recommended ? "<small class=\"business-best-label\">Recommended best value</small>" : (item.is_lowest ? "<small>Lowest price</small>" : "")}</td><td>${businessEscape(item.quote_number)}<small>${businessDate(item.quote_date)}</small></td><td><strong>${businessMoney(item.total_amount)}</strong><small>${businessMoney(item.unit_price)} each · Score ${item.criteria_scores.price.toFixed(0)}</small></td><td>${item.delivery_days} days<small>Score ${item.criteria_scores.delivery.toFixed(0)}</small></td><td>${item.warranty_months} months<small>Score ${item.criteria_scores.warranty.toFixed(0)}</small></td><td>${item.vendor_payment_terms_days} days<small>Score ${item.criteria_scores.payment_terms.toFixed(0)} · ${businessEscape(item.payment_terms || "Vendor credit period")}</small></td><td><strong class="business-value-score">${item.evaluation_score.toFixed(1)}</strong><small>${item.evaluation_reasons.length ? businessEscape(item.evaluation_reasons.join(" · ")) : "Weighted value"}</small></td><td><span class="business-action-stack">${isManager && item.status !== "Selected" ? `<button class="business-row-action" type="button" onclick="selectBusinessQuotation(${item.id}, ${purchase.id})">Select</button>` : `<span class="business-status is-${businessStatusClass(item.status)}">${businessEscape(item.status)}</span>`}<button class="business-row-action" type="button" onclick="openQuotationDetails(${item.id})">View</button>${canEdit ? `<button class="business-row-action" type="button" onclick="openBusinessForm('quotationUpdate', ${item.id})">Edit</button>` : ""}<button class="business-row-action" type="button" onclick="openBusinessDocuments('quotation', ${item.id})">Documents</button></span></td></tr>`).join("") : businessTableEmpty(8, "No quotations collected", "Add at least one supplier quotation for comparison.");
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
