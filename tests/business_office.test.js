const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

test("Business Office stays separate from patient billing", () => {
    const model = read("backend/models/business.py");
    const view = read("frontend/dashboard_v2/views/businessView.js");
    assert.match(model, /institutional finance/i);
    assert.match(view, /No patient billing data/);
    assert.doesNotMatch(model, /patient_(?:id|name)|invoice_to_patient/i);
});

test("business portal covers budgets purchases payments insurers and reports", () => {
    const view = read("frontend/dashboard_v2/views/businessView.js");
    const route = read("backend/routes/business_routes.py");
    for (const phrase of ["Budget execution", "Requests and approvals", "Payment and receipt ledger", "Insurance schemes and settlements", "Download CSV"]) {
        assert.match(view, new RegExp(phrase));
    }
    assert.match(route, /committed_spend/);
    assert.match(route, /insurance_outstanding/);
    assert.match(route, /source_type="purchase"/);
    assert.match(route, /source_type="insurance_claim"/);
});

test("administrator dashboard exposes financial supervision", () => {
    const dashboard = read("frontend/dashboard_v2/views/dashboardView.js");
    const dashboardData = read("frontend/dashboard_v2/js/dashboard.js");
    assert.match(dashboard, /Hospital financial position/);
    assert.match(dashboard, /Purchases to approve/);
    assert.match(dashboardData, /\/api\/business\/admin-summary/);
    assert.match(dashboardData, /recent_pending/);
});

test("supplier workflow covers vendors quotations invoices partial payments and documents", () => {
    const model = read("backend/models/business.py");
    const route = read("backend/routes/business_routes.py");
    const view = read("frontend/dashboard_v2/views/businessView.js");
    for (const name of ["BusinessVendor", "SupplierQuotation", "SupplierInvoice", "SupplierPayment", "BusinessDocument"]) assert.match(model, new RegExp(`class ${name}`));
    for (const phrase of ["Quotation value comparison", "Vendor master", "Supplier invoices", "Payment approval queue", "Outstanding report", "Supporting documents"]) assert.match(view, new RegExp(phrase));
    assert.match(route, /vendor-outstanding\.csv/);
    assert.match(route, /Pending Approval/);
    assert.match(route, /source_type="supplier_payment"/);
    assert.match(model, /Numeric\(18, 2\)/);
});

test("quotation comparison recommends best overall value with adjustable priorities", () => {
    const route = read("backend/routes/business_routes.py");
    const view = read("frontend/dashboard_v2/views/businessView.js");
    for (const criterion of ["price", "warranty", "delivery", "payment_terms"]) assert.match(route, new RegExp(`"${criterion}"`));
    for (const phrase of ["Best overall value", "stronger overall", "Evaluation priorities", "Decision support, not automatic approval", "evaluateBusinessQuotations"]) assert.match(view, new RegExp(phrase));
    assert.match(view, /businessQuoteDefaultWeights/);
    assert.match(view, /dominatesCount/);
});

test("quotations have a dedicated Business Office module", () => {
    const view = read("frontend/dashboard_v2/views/businessView.js");
    assert.match(view, /businessTabButton\("quotations", "scale", "Quotations"\)/);
    assert.match(view, /quotations: renderBusinessQuotations/);
    assert.match(view, /function renderBusinessQuotations\(\)/);
    for (const phrase of ["Quotation management", "Quotation workbench", "Ready to compare", "Quotation register"]) assert.match(view, new RegExp(phrase));
    assert.match(view, /openBusinessQuotationModule\(\$\{item\.id\}\)/);
});

test("vendor numbers are assigned automatically", () => {
    const schema = read("backend/schemas/business_schema.py");
    const route = read("backend/routes/business_routes.py");
    const view = read("frontend/dashboard_v2/views/businessView.js");
    assert.doesNotMatch(schema, /class VendorInput[\s\S]*?vendor_code:/);
    assert.match(route, /row\.vendor_code = f"VEN-\{row\.id:03d\}"/);
    assert.match(view, /Assigned automatically when saved/);
    assert.doesNotMatch(view, /businessField\("Vendor code \*"/);
});

test("quotations can be edited with complete commercial details", () => {
    const model = read("backend/models/business.py");
    const route = read("backend/routes/business_routes.py");
    const migration = read("backend/migrations/add_quotation_details.py");
    const view = read("frontend/dashboard_v2/views/businessView.js");
    for (const field of ["installation_amount", "training_details", "tax_rate", "amc_annual_amount", "amc_terms", "additional_conditions"]) {
        assert.match(model, new RegExp(field));
        assert.match(migration, new RegExp(field));
    }
    assert.match(route, /@router\.put\("\/quotations\/\{quotation_id\}"\)/);
    assert.match(view, /quotationUpdate: \{ title: "Edit supplier quotation"/);
    assert.match(view, /function openQuotationDetails\(quotationId\)/);
    for (const phrase of ["Quotation breakdown", "Vendor details", "Additional conditions", "Edit quotation"]) assert.match(view, new RegExp(phrase));
});

test("business summary keeps long currency values readable", () => {
    const view = read("frontend/dashboard_v2/views/businessView.js");
    const css = read("frontend/dashboard_v2/css/business.css");
    assert.match(view, /amount\.length > 18 \? "is-very-long"/);
    assert.match(view, /title="\$\{businessEscape\(amount\)\}"/);
    assert.match(css, /business-summary-card>div\{min-width:0;flex:1\}/);
    assert.match(css, /business-summary-card strong\.is-long/);
    assert.match(css, /@media\(max-width:480px\)\{\.business-summary-grid\{grid-template-columns:1fr\}/);
});

test("native accounting and GST are exposed inside the BioTrack Business Office", () => {
    const view = read("frontend/dashboard_v2/views/businessView.js");
    const route = read("backend/routes/accounting_routes.py");
    const service = read("backend/services/accounting_service.py");
    const migration = read("backend/migrations/add_native_accounting.py");
    const businessRoute = read("backend/routes/business_routes.py");
    const posting = read("backend/services/accounting_posting_service.py");
    assert.match(view, /businessTabButton\("accounting", "book-open-check", "Accounting & GST"\)/);
    assert.match(view, /\/api\/finance\/dashboard/);
    assert.match(view, /function openGSTCalculator\(\)/);
    assert.match(view, /function openJournalEntry\(\)/);
    assert.match(view, /function openTrialBalance\(companyId\)/);
    assert.match(view, /function openFinancialStatements\(companyId\)/);
    assert.match(view, /function openGeneralLedger\(companyId\)/);
    assert.match(route, /@router\.post\("\/gst\/calculate"\)/);
    assert.match(route, /@router\.post\("\/journals"\)/);
    assert.match(route, /@router\.get\("\/trial-balance\/\{company_id\}"\)/);
    assert.match(route, /@router\.get\("\/financial-statements\/\{company_id\}"\)/);
    assert.match(route, /@router\.get\("\/general-ledger\/\{company_id\}"\)/);
    assert.match(service, /ROUND_HALF_UP/);
    assert.match(service, /Journal entry is not balanced/);
    assert.match(businessRoute, /post_approved_supplier_invoice/);
    assert.match(businessRoute, /post_completed_supplier_payment/);
    assert.match(posting, /source_type="supplier_invoice"/);
    assert.match(posting, /source_type="supplier_payment"/);
    for (const table of ["finance_companies", "finance_accounts", "finance_journal_entries", "finance_journal_lines"]) assert.match(migration, new RegExp(table));
});

test("native banking imports and reconciles statement transactions", () => {
    const view = read("frontend/dashboard_v2/views/businessView.js");
    const route = read("backend/routes/accounting_routes.py");
    const model = read("backend/models/accounting.py");
    assert.match(view, /businessTabButton\("banking", "landmark", "Banking"\)/);
    for (const name of ["FinanceBankAccount", "FinanceBankTransaction"]) assert.match(model, new RegExp(`class ${name}`));
    assert.match(route, /@router\.post\("\/bank-transactions\/import"\)/);
    assert.match(route, /@router\.get\("\/bank-transactions\/\{transaction_id\}\/suggestions"\)/);
    assert.match(route, /@router\.patch\("\/bank-transactions\/\{transaction_id\}\/reconcile"/);
    for (const name of ["openBankAccountForm", "openBankImportForm", "openBankReconciliation", "reconcileBankTransaction"]) assert.match(view, new RegExp(`function ${name}`));
});

test("accounting governance supports immutable reversals and forward-only period locks", () => {
    const view = read("frontend/dashboard_v2/views/businessView.js");
    const route = read("backend/routes/accounting_routes.py");
    assert.match(route, /@router\.post\("\/journals\/\{journal_id\}\/reverse"/);
    assert.match(route, /@router\.patch\("\/companies\/\{company_id\}\/lock-date"/);
    assert.match(route, /original\.status = "Reversed"/);
    assert.match(route, /period lock can only move forward/i);
    assert.match(view, /function openJournalReversal/);
    assert.match(view, /function openPeriodLockForm/);
});
