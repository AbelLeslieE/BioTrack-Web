const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const dashboard = fs.readFileSync(path.join(root, "frontend/dashboard_v2/dashboard.html"), "utf8");
const darkTheme = fs.readFileSync(path.join(root, "frontend/dashboard_v2/css/dark_theme.css"), "utf8");

test("dark theme stylesheet loads after all module styles", () => {
    const darkIndex = dashboard.indexOf("dark_theme.css");
    assert.notEqual(darkIndex, -1);
    assert.ok(darkIndex > dashboard.indexOf("responsive_overrides.css"));
});

test("dark theme covers every role portal and primary module surface", () => {
    [
        ".admin-summary-card",
        ".engineer-dashboard",
        ".user-home-page",
        ".maintenance-page",
        ".asset-page",
        ".inventory-page",
        ".pm-page",
        ".reports-page",
        ".users-page",
        ".qr-scanner-module-page",
        ".settings-page",
        ".user-editor-modal",
        ".asset-drawer",
        ".pm-drawer",
        ".asset-hero",
        ".admin-insight-section",
        ".pm-header",
        "#pmCalendar",
        ".users-stats article",
        ".qr-module-grid article",
        ".reports-header",
        ".about-item",
        ".admin-team-action",
        ".admin-status-pill.is-completed",
        ".admin-attention-row button",
    ".mini-stats>div",
    ".user-home-hero",
    ".user-home-metric",
    ".user-home-empty-state",
    ".header-badge",
    ".back-btn",
    ".ticket-text",
    ".ticket-textarea",
    ].forEach(selector => assert.ok(darkTheme.includes(selector), `missing ${selector}`));
});
