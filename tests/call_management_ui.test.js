const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "frontend/dashboard_v2/views/maintenanceView.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "frontend/dashboard_v2/css/maintenance.css"), "utf8");
const darkStyles = fs.readFileSync(path.join(root, "frontend/dashboard_v2/css/dark_theme.css"), "utf8");
const sidebar = fs.readFileSync(path.join(root, "frontend/dashboard_v2/js/sidebar.js"), "utf8");
const departmentSource = fs.readFileSync(path.join(root, "frontend/dashboard_v2/views/myRequestsView.js"), "utf8");
const departmentStyles = fs.readFileSync(path.join(root, "frontend/dashboard_v2/css/my_requests.css"), "utf8");
const dashboardStyles = fs.readFileSync(path.join(root, "frontend/dashboard_v2/dist/dashboard.bundle.css"), "utf8");
const dashboardScripts = fs.readFileSync(path.join(root, "frontend/dashboard_v2/dist/dashboard.bundle.js"), "utf8");

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

test("department users receive the redesigned maintenance request centre", () => {
    assert.match(departmentSource, /Department service desk/);
    assert.match(departmentSource, /New maintenance request/);
    assert.match(departmentSource, /my-requests-status-tabs/);
    assert.match(departmentSource, /data-status-mode="active"/);
    assert.match(departmentSource, /myRequestsPriorityFilter/);
    assert.match(departmentSource, /myrequest-equipment/);
    assert.match(departmentSource, /credentials: "same-origin"/);
    assert.match(departmentSource, /setInterval[\s\S]*60000/);
    assert.match(dashboardStyles, /source: dashboard_v2\/css\/my_requests\.css/);
    assert.match(dashboardScripts, /source: dashboard_v2\/views\/myRequestsView\.js/);
});

test("department request centre has responsive and dark-mode coverage", () => {
    assert.match(departmentStyles, /my-requests-command-hero/);
    assert.match(departmentStyles, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
    assert.match(departmentStyles, /@media\(max-width:680px\)/);
    assert.match(departmentStyles, /\.myrequest-table td::before/);
    assert.match(darkStyles, /Department-user maintenance request centre/);
    assert.match(darkStyles, /body\.dark-theme \.my-requests-workspace/);
});
