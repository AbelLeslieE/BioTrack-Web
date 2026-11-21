const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const partial = fs.readFileSync("frontend/dashboard_v2/partials/new_request.html", "utf8");
const source = fs.readFileSync("frontend/dashboard_v2/js/new_request.js", "utf8");
const styles = fs.readFileSync("frontend/dashboard_v2/css/new_request.css", "utf8");
const darkStyles = fs.readFileSync("frontend/dashboard_v2/css/dark_theme.css", "utf8");

test("department complaint form is a guided accessible workflow", () => {
    assert.match(partial, /<form id="maintenanceRequestForm" novalidate>/);
    assert.match(partial, /Report an equipment problem/);
    assert.match(partial, /data-request-step="location"/);
    assert.match(partial, /data-request-step="equipment"/);
    assert.match(partial, /data-request-step="problem"/);
    assert.match(partial, /id="departmentAssetPicker"/);
    assert.match(partial, /id="openRequestScanner"/);
    assert.match(partial, /data-request-priority="Critical"/);
    assert.match(partial, /id="failureDescriptionCount"/);
    assert.match(partial, /id="summaryEquipment"/);
    assert.match(partial, /id="requestReadyState"/);
    assert.match(partial, /id="wardBoyAssistance"/);
});

test("complaint workflow prefills assets validates inline and protects duplicate submissions", () => {
    assert.match(source, /fetch\("\/api\/assets\/department\/mine"/);
    assert.match(source, /function applyRegisteredAsset/);
    assert.match(source, /REQUEST_DRAFT_KEY/);
    assert.match(source, /sessionStorage\.setItem\(REQUEST_DRAFT_KEY/);
    assert.match(source, /function setRequestFieldError/);
    assert.match(source, /aria-invalid/);
    assert.match(source, /requestSubmitting \|\| !validateForm\(\)/);
    assert.match(source, /button\.disabled = submitting/);
    assert.match(source, /response\.status === 401/);
    assert.match(source, /await expireDashboardSession\(data\.detail\)/);

    const validation = source.slice(source.indexOf("function validateForm"), source.indexOf("function setRequestFieldError"));
    assert.doesNotMatch(validation, /failureDescription/);
});

test("complaint redesign is isolated responsive and dark-mode complete", () => {
    assert.match(styles, /\.request-layout \{ display: grid/);
    assert.match(styles, /grid-template-columns: minmax\(0, 1fr\) 340px/);
    assert.match(styles, /@media \(max-width: 720px\)/);
    assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
    assert.doesNotMatch(styles, /\ninput,\s*\ntextarea,/);
    assert.match(darkStyles, /Department-user maintenance complaint form/);
    assert.match(darkStyles, /body\.dark-theme \.request-section/);
    assert.match(darkStyles, /body\.dark-theme \.request-priority-grid button\.is-selected/);
});
