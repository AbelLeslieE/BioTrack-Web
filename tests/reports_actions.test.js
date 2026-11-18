const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const reports = fs.readFileSync(path.join(root, "frontend/dashboard_v2/js/reports.js"), "utf8");
const reportsView = fs.readFileSync(path.join(root, "frontend/dashboard_v2/views/reportsView.js"), "utf8");
const settings = fs.readFileSync(path.join(root, "frontend/dashboard_v2/views/settingsView.js"), "utf8");
const settingsStyles = fs.readFileSync(path.join(root, "frontend/dashboard_v2/css/settings.css"), "utf8");

test("report buttons download real PDF Excel and CSV exports", () => {
    assert.match(reports, /registerReportsExport\("reportsPdfBtn", "pdf"\)/);
    assert.match(reports, /registerReportsExport\("reportsExcelBtn", "xlsx"\)/);
    assert.match(reports, /registerReportsExport\("reportsCsvBtn", "csv"\)/);
    assert.match(reports, /fetch\(reportsExportUrl\(type,filters\)\)/);
    assert.doesNotMatch(reports, /setTimeout\(\(\)=>\{[\s\S]*?report generated successfully/);
    assert.match(reportsView, /reports-executive-pdf/);
    assert.match(reportsView, /Executive PDF/);
    assert.match(reportsView, /Charts, KPIs &amp; call register/);
});

test("schedule report opens a persistent schedule workflow", () => {
    assert.match(reports, /function openReportsScheduleDialog/);
    assert.match(reports, /fetch\("\/api\/reports\/schedules"/);
    assert.match(reports, /function loadAndArmReportSchedules/);
    assert.match(reports, /runScheduledReport/);
});

test("settings cards use independent columns without the empty profile gap", () => {
    assert.match(settings, /settings-column-left/);
    assert.match(settings, /\["profile", "security", "backup"\]/);
    assert.match(settings, /\["notifications", "preferences", "about"\]/);
    assert.match(settingsStyles, /\.settings-column\s*\{[\s\S]*?flex-direction:column/);
});

test("department cards use aligned inline engineering icons", () => {
    const dashboardSource = fs.readFileSync(path.join(root, "frontend/dashboard_v2/js/dashboard.js"), "utf8");
    const dashboardStyles = fs.readFileSync(path.join(root, "frontend/dashboard_v2/css/admin_dashboard.css"), "utf8");
    assert.match(dashboardSource, /function adminTeamIconSvg/);
    assert.match(dashboardSource, /adminTeamIconSvg\(style\.className\)/);
    assert.match(dashboardSource, /<rect x="3" y="4" width="18" height="14"/);
    assert.doesNotMatch(dashboardSource, /data-lucide="\$\{style\.icon\}"/);
    assert.match(dashboardStyles, /\.admin-team-icon svg\s*\{[\s\S]*?width:24px[\s\S]*?stroke-width:2\.4/);
    assert.match(dashboardStyles, /\.admin-team-card-header\{display:flex;align-items:center/);
    assert.match(dashboardStyles, /\.admin-team-identity>div>span\{/);
    assert.doesNotMatch(dashboardStyles, /\.admin-team-identity span\{/);
});
