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

test("business summary keeps long currency values readable", () => {
    const view = read("frontend/dashboard_v2/views/businessView.js");
    const css = read("frontend/dashboard_v2/css/business.css");
    assert.match(view, /amount\.length > 18 \? "is-very-long"/);
    assert.match(view, /title="\$\{businessEscape\(amount\)\}"/);
    assert.match(css, /business-summary-card>div\{min-width:0;flex:1\}/);
    assert.match(css, /business-summary-card strong\.is-long/);
    assert.match(css, /@media\(max-width:480px\)\{\.business-summary-grid\{grid-template-columns:1fr\}/);
});
