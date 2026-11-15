const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
    path.join(__dirname, "../frontend/dashboard_v2/views/assetsView.js"),
    "utf8",
);

test("shared asset QR generator only refreshes registry elements when mounted", () => {
    assert.match(source, /if \(document\.getElementById\("assetTableBody"\)\) applyAssetFilters\(\)/);
    assert.match(source, /const setGenerateLabel = label =>/);
    assert.doesNotMatch(source, /generate\.querySelector\("span"\)\.textContent/);
});
