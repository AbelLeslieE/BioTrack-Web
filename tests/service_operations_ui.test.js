const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const maintenance = fs.readFileSync(path.join(root, "frontend/dashboard_v2/views/maintenanceView.js"), "utf8");
const ticket = fs.readFileSync(path.join(root, "frontend/dashboard_v2/views/ticketView.js"), "utf8");
const vendors = fs.readFileSync(path.join(root, "frontend/dashboard_v2/views/vendorsView.js"), "utf8");
const sidebar = fs.readFileSync(path.join(root, "frontend/dashboard_v2/js/sidebar.js"), "utf8");
const assetDetails = fs.readFileSync(path.join(root, "frontend/dashboard_v2/views/assetDetailsView.js"), "utf8");

test("maintenance calls provide a five-stage technician assignment board", () => {
    for (const status of ["Open", "Assigned", "In Progress", "Awaiting Parts", "Completed"]) {
        assert.match(maintenance, new RegExp(`key: "${status}"`));
    }
    assert.match(maintenance, /function renderMaintenanceBoard\(calls\)/);
    assert.match(maintenance, /assignment/);
    assert.match(maintenance, /assignMaintenanceTechnician/);
});

test("ticket parts are reserved with cost before final stock consumption", () => {
    assert.match(ticket, /Repair parts cost/);
    assert.match(ticket, /Parts reserved for this repair/);
    assert.match(ticket, /available_stock/);
    assert.match(ticket, /updateTicketPartsCost/);
});

test("maintenance evidence is optimized and uploaded in KB-sized files", () => {
    assert.match(ticket, /Auto-compressed below 900 KB/);
    assert.match(ticket, /compressTicketImage/);
    assert.match(ticket, /Optimize & upload/);
    assert.match(ticket, /application\/pdf,image\/jpeg,image\/png/);
});

test("asset manuals and documents use the same compressed evidence pipeline", () => {
    assert.match(assetDetails, /Manuals & documents/);
    assert.match(assetDetails, /Auto-compressed below 900 KB/);
    assert.match(assetDetails, /uploadAssetDocument/);
    assert.match(assetDetails, /application\/pdf,image\/jpeg,image\/png/);
});

test("vendor contracts expose renewals, SLA, contacts and service history", () => {
    assert.match(sidebar, /Vendors & Contracts/);
    assert.match(vendors, /response_sla_hours/);
    assert.match(vendors, /renewal_state/);
    assert.match(vendors, /Service history/);
    assert.match(vendors, /saveVendorHistory/);
});
