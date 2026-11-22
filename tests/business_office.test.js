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
    for (const phrase of ["Quotation comparison", "Vendor master", "Supplier invoices", "Payment approval queue", "Outstanding report", "Supporting documents"]) assert.match(view, new RegExp(phrase));
    assert.match(route, /vendor-outstanding\.csv/);
    assert.match(route, /Pending Approval/);
    assert.match(route, /source_type="supplier_payment"/);
    assert.match(model, /Numeric\(18, 2\)/);
});
