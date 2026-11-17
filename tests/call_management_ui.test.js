const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "frontend/dashboard_v2/views/maintenanceView.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "frontend/dashboard_v2/css/maintenance.css"), "utf8");
const darkStyles = fs.readFileSync(path.join(root, "frontend/dashboard_v2/css/dark_theme.css"), "utf8");
const sidebar = fs.readFileSync(path.join(root, "frontend/dashboard_v2/js/sidebar.js"), "utf8");

test("call management adapts its service desk to every engineering portal", () => {
    assert.match(source, /Hospital operations control/);
    assert.match(source, /Biomedical service desk/);
    assert.match(source, /Electrical service desk/);
    assert.match(source, /IT service desk/);
    assert.match(source, /icon: "heart-pulse"/);
    assert.match(source, /icon: "plug-zap"/);
    assert.match(source, /icon: "server-cog"/);
});

test("call management provides operational metrics, status tabs and rich request rows", () => {
    assert.match(source, /id="activeCalls"/);
    assert.match(source, /id="criticalCalls"/);
    assert.match(source, /data-maintenance-tab="Awaiting Parts"/);
    assert.match(source, /maintenancePriorityFilter/);
    assert.match(source, /maintenanceTeamIcon/);
    assert.match(source, /data-lucide="calendar-clock"/);
    assert.match(source, /setInterval[\s\S]*60000/);
    assert.doesNotMatch(source, /},5000\)/);
});

test("call management redesign is responsive and dark-mode complete", () => {
    assert.match(styles, /maintenance-command-hero/);
    assert.match(styles, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
    assert.match(styles, /@media\(max-width:680px\)/);
    assert.match(darkStyles, /Role-aware call management command centre/);
    assert.match(darkStyles, /body\.dark-theme \.maintenance-workspace/);
});

test("portal sidebars use discipline-specific call management icons", () => {
    assert.match(sidebar, /data-lucide="radio-tower"/);
    assert.match(sidebar, /data-lucide="stethoscope"/);
    assert.match(sidebar, /data-lucide="plug-zap"/);
    assert.match(sidebar, /data-lucide="server-cog"/);
});
