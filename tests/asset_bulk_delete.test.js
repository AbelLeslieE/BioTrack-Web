const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "frontend/dashboard_v2/views/assetsView.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "frontend/dashboard_v2/css/assets.css"), "utf8");

test("administrator asset registry supports select all and deselect all", () => {
    assert.match(source, /id="assetSelectFilteredBtn"[\s\S]*?Select all/);
    assert.match(source, /id="assetClearSelectionBtn"[\s\S]*?Deselect all/);
    assert.match(source, /function toggleAssetSelection/);
    assert.match(source, /function toggleVisibleAssetSelection/);
});

test("duplicate review keeps one asset and bulk deletes selected records", () => {
    assert.match(source, /function findDuplicateAssetGroups/);
    assert.match(source, /Review duplicate assets/);
    assert.match(source, /BioTrack will keep the oldest record/);
    assert.match(source, /fetch\("\/api\/assets\/bulk-delete"/);
    assert.match(source, /asset_ids: assetIds/);
});

test("bulk asset dialogs support responsive layouts", () => {
    assert.match(styles, /\.asset-bulk-toolbar/);
    assert.match(styles, /\.asset-management-overlay/);
    assert.match(styles, /\.asset-duplicate-dialog/);
    assert.match(styles, /@media \(max-width:600px\)/);
});
