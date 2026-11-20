const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

test("engineers can request internal catalogue stock or an external item", () => {
    const source = read("frontend/dashboard_v2/views/storeRequestsView.js");
    assert.match(source, /Internal stock/);
    assert.match(source, /External item/);
    assert.match(source, /central_store_item_id/);
    assert.match(source, /specification/);
});

test("Central Store has request, low-stock, out-of-stock and catalogue queues", () => {
    const source = read("frontend/dashboard_v2/views/centralStoreView.js");
    assert.match(source, /Engineer requests/);
    assert.match(source, /Low stock/);
    assert.match(source, /Out of stock/);
    assert.match(source, /Master catalogue/);
    assert.match(source, /DispatchWardBoy/);
});

test("spare delivery requires Ward Boy handover and engineer confirmation", () => {
    const ward = read("frontend/dashboard_v2/views/wardBoyDashboardView.js");
    const engineer = read("frontend/dashboard_v2/views/storeRequestsView.js");
    assert.match(ward, /store-tasks/);
    assert.match(ward, /engineer must now confirm receipt/i);
    assert.match(engineer, /confirm-receipt/);
});

test("Central Store has its own login role and navigation", () => {
    const users = read("frontend/dashboard_v2/views/usersView.js");
    const sidebar = read("frontend/dashboard_v2/js/sidebar.js");
    assert.match(users, /value="CentralStore">Central Store/);
    assert.match(sidebar, /case "centralstore"/);
    assert.match(sidebar, /data-page="centralStore"/);
});
