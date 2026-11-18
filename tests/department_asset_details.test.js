const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const view = fs.readFileSync(path.join(root, "frontend/dashboard_v2/views/assetDetailsView.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "frontend/dashboard_v2/css/asset_details.css"), "utf8");
const darkStyles = fs.readFileSync(path.join(root, "frontend/dashboard_v2/css/dark_theme.css"), "utf8");

test("department asset details show only general information and latest PM", () => {
    assert.match(view, /function isDepartmentAssetDetailsView/);
    assert.match(view, /renderDepartmentAssetInformation\(safeAsset\)/);
    assert.match(view, /renderDepartmentLastPM\(safeAsset\)/);
    assert.match(view, /clearRestrictedAssetSections\(\)/);
    assert.match(view, /Last preventive maintenance completed/);
    assert.match(view, /navigate\('\$\{departmentView \? "myAssets" : "assets"\}'\)/);
});

test("department PM summary is responsive and dark-mode complete", () => {
    assert.match(styles, /\.department-last-pm-section\{[^}]*display:flex/);
    assert.match(styles, /@media\(max-width:600px\)[\s\S]*?\.department-last-pm-section\{[^}]*flex-direction:column/);
    assert.match(darkStyles, /body\.dark-theme \.department-last-pm-section/);
});
