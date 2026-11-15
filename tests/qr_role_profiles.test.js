const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(relativePath) {
    return fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
}

test("scanner routes successful scans into the role-aware QR profile", () => {
    const source = read("frontend/dashboard_v2/js/qr_scanner.js");
    assert.match(source, /openQRAssetProfile\(result\.asset\.id\)/);
    assert.doesNotMatch(source, /openAssetPage\(result\.asset\.id\)/);
});

test("QR profile renders separate department, engineer and administrator workflows", () => {
    const source = read("frontend/dashboard_v2/views/qrAssetProfileView.js");
    assert.match(source, /profile\.view === "department"/);
    assert.match(source, /profile\.view === "engineer"/);
    assert.match(source, /profile\.view === "admin"/);
    assert.match(source, /sessionStorage\.setItem\("qrMaintenancePrefill"/);
    assert.match(source, /\/complete-pm/);
    assert.match(source, /Warranty/);
});

test("scanned maintenance request is prefilled and failure description is optional", () => {
    const source = read("frontend/dashboard_v2/js/new_request.js");
    const validationBlock = source.slice(source.indexOf("function validateForm"), source.indexOf("function initializeSubmitButton"));
    assert.match(source, /applyQRMaintenancePrefill/);
    assert.match(source, /qrMaintenancePrefill/);
    assert.doesNotMatch(validationBlock, /failureDescription/);

    const partial = read("frontend/dashboard_v2/partials/new_request.html");
    assert.match(partial, /Failure Description <span class="optional-label">\(optional\)<\/span>/);
});
