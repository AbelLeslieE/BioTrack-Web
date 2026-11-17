const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const shared = fs.readFileSync(path.join(root, "frontend/dashboard_v2/js/assetRelocation.js"), "utf8");
const myAssets = fs.readFileSync(path.join(root, "frontend/dashboard_v2/views/myAssetsView.js"), "utf8");
const assets = fs.readFileSync(path.join(root, "frontend/dashboard_v2/views/assetsView.js"), "utf8");
const dashboard = fs.readFileSync(path.join(root, "frontend/dashboard_v2/dashboard.html"), "utf8");
const notifications = fs.readFileSync(path.join(root, "frontend/dashboard_v2/js/notifications.js"), "utf8");

test("department users can request a department or room relocation from My Assets", () => {
    assert.match(myAssets, /Request move/);
    assert.match(myAssets, /Move requested/);
    assert.match(myAssets, /AssetRelocation\?\.openRequest\(asset\)/);
    assert.match(shared, /Destination department/);
    assert.match(shared, /Destination room \/ location/);
    assert.match(shared, /fetch\("\/api\/assets\/relocation-requests"/);
});

test("engineering teams receive an approval queue that updates the asset", () => {
    assert.match(assets, /id="assetRelocationRequestsBtn"/);
    assert.match(assets, /AssetRelocation\?\.openQueue\(\)/);
    assert.match(shared, /Approve & update asset/);
    assert.match(shared, /data-relocation-decision="reject"/);
    assert.match(shared, /method: "PATCH"/);
    assert.match(notifications, /relocation: "route"/);
});

test("relocation workflow is loaded before asset views", () => {
    const sharedIndex = dashboard.indexOf("assetRelocation.js");
    assert.ok(sharedIndex > -1);
    assert.ok(sharedIndex < dashboard.indexOf("myAssetsView.js"));
    assert.ok(sharedIndex < dashboard.indexOf("assetsView.js"));
});
