const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
    path.join(__dirname, "../frontend/dashboard_v2/views/assetsView.js"),
    "utf8",
);
const formSource = fs.readFileSync(
    path.join(__dirname, "../frontend/dashboard_v2/views/assetFormView.js"),
    "utf8",
);

test("shared asset QR generator only refreshes registry elements when mounted", () => {
    assert.match(source, /if \(document\.getElementById\("assetTableBody"\)\) applyAssetFilters\(\)/);
    assert.match(source, /const setGenerateLabel = label =>/);
    assert.doesNotMatch(source, /generate\.querySelector\("span"\)\.textContent/);
});

test("asset registration can save and generate a QR code in one operation", () => {
    assert.match(formSource, /async function persistAsset\(generateQR = false\)/);
    assert.match(formSource, /fetch\(`\/api\/qr\/generate\/\$\{createdAssetId\}`/);
    assert.match(formSource, /openAssetQRGenerator\(createdAssetId\)/);
    assert.match(source, /const selectedAssetIsMissing = assetId/);
});

test("asset review escapes user-provided values", () => {
    for (const field of ["equipmentId", "equipmentName", "department", "manufacturer", "purchaseCost", "warrantyEnd"]) {
        assert.match(formSource, new RegExp(`escapeHTML\\(assetFormData\\.${field}`));
    }
});

test("asset registration uploads the selected equipment photo and documents", () => {
    assert.match(formSource, /\["equipmentImage", "Photo"\]/);
    assert.match(formSource, /async function uploadAssetRegistrationFiles/);
    assert.match(formSource, /fetch\(`\/api\/assets\/\$\{assetId\}\/documents`/);
    assert.match(formSource, /const uploadFailures = await uploadAssetRegistrationFiles/);
});
