const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const profileSource = fs.readFileSync(path.join(root, "frontend/dashboard_v2/js/asset_profile.js"), "utf8");
const detailsStyles = fs.readFileSync(path.join(root, "frontend/dashboard_v2/css/asset_details.css"), "utf8");
const routeSource = fs.readFileSync(path.join(root, "backend/routes/asset_routes.py"), "utf8");

test("asset detail actions open functional QR and edit workflows", () => {
    assert.match(profileSource, /onclick="openAssetEditor\(/);
    assert.match(profileSource, /onclick="openAssetQRGenerator\(/);
    assert.match(profileSource, /function openAssetEditor/);
    assert.match(profileSource, /method:\s*"PATCH"/);
    assert.match(profileSource, /await loadAssetDetails\(assetId\)/);
});

test("asset editor has responsive styled fields and backend update route", () => {
    assert.match(profileSource, /dialog\.className = "asset-edit-dialog"/);
    assert.match(profileSource, /name="service_team"/);
    assert.match(profileSource, /name="equipment_name" required/);
    assert.match(detailsStyles, /\.asset-edit-dialog/);
    assert.match(detailsStyles, /@media\(max-width:600px\)/);
    assert.match(routeSource, /@router\.patch\("\/\{asset_id\}"/);
    assert.match(routeSource, /def update_asset\(/);
});

test("missing asset photos fall back to an equipment illustration", () => {
    assert.match(profileSource, /class="asset-image-placeholder"/);
    assert.match(profileSource, /onerror="this\.remove\(\)"/);
});
