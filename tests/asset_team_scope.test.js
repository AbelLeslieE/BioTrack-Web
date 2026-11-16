const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const assetsSource = fs.readFileSync(path.join(__dirname, "../frontend/dashboard_v2/views/assetsView.js"), "utf8");
const formSource = fs.readFileSync(path.join(__dirname, "../frontend/dashboard_v2/views/assetFormView.js"), "utf8");
const assetStyles = fs.readFileSync(path.join(__dirname, "../frontend/dashboard_v2/css/assets.css"), "utf8");

test("administrator asset registry covers every engineering service team", () => {
    assert.match(assetsSource, /Hospital Asset Registry/);
    assert.match(assetsSource, /asset-mode-options/);
    assert.match(assetsSource, /data-asset-team="Biomedical"/);
    assert.match(assetsSource, /data-asset-team="Electrical"/);
    assert.match(assetsSource, /data-asset-team="IT"/);
    assert.match(assetsSource, /asset-kpi-mode/);
    assert.match(assetsSource, /updateAssetKPIs/);
    assert.match(assetsSource, /asset\.service_team/);
    assert.match(assetsSource, /Biomedical, Electrical and IT assets/);
});

test("asset registration and Excel import require administrator team ownership", () => {
    assert.match(formSource, /id="service_team"/);
    assert.match(formSource, /option value="Biomedical"/);
    assert.match(formSource, /option value="Electrical"/);
    assert.match(formSource, /option value="IT"/);
    assert.match(assetsSource, /upload\?service_team=/);
    assert.match(assetsSource, /encodeURIComponent\(selectedTeam\)/);
});

test("asset registry uses a compact heading and inline quick actions", () => {
    assert.doesNotMatch(assetsSource, /Frequently used asset operations/);
    assert.match(assetsSource, /aria-label="Asset quick actions"/);
    assert.match(assetStyles, /\.asset-hero\s*\{[\s\S]*?padding:22px 24px/);
    assert.match(assetStyles, /\.asset-hero h1\s*\{[\s\S]*?font-size:32px/);
    assert.match(assetStyles, /\.asset-actions\s*\{[\s\S]*?flex-direction:row/);
    assert.match(assetStyles, /\.quick-actions-card\s*\{[\s\S]*?box-shadow:none/);
});
