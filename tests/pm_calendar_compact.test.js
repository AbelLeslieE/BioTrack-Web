const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const pmView = fs.readFileSync(path.join(root, "frontend/dashboard_v2/views/pmView.js"), "utf8");
const pmStyles = fs.readFileSync(path.join(root, "frontend/dashboard_v2/css/pm.css"), "utf8");
const departmentStyles = fs.readFileSync(path.join(root, "frontend/dashboard_v2/css/pm_compact.css"), "utf8");
const buildSource = fs.readFileSync(path.join(root, "scripts/build_dashboard_bundles.py"), "utf8");

test("engineering PM calendar fits a full month in the desktop viewport", () => {
    assert.match(pmStyles, /--pm-calendar-day-height:clamp\(48px,5\.8vh,66px\)/);
    assert.match(pmStyles, /\.pm-header\{[\s\S]*?min-height:88px;[\s\S]*?padding:14px 22px;/);
    assert.match(pmStyles, /\.pm-calendar-card\{[\s\S]*?min-height:0;[\s\S]*?padding:12px 14px 8px;/);
    assert.match(pmStyles, /\.pm-day\{[\s\S]*?min-height:var\(--pm-calendar-day-height\)/);
    assert.match(pmStyles, /@media \(max-width:768px\)[\s\S]*?--pm-calendar-day-height:52px/);
});

test("status legend is kept inside the compact calendar card", () => {
    const calendarStart = pmView.indexOf('<section class="pm-calendar-card">');
    const legend = pmView.indexOf('<section class="pm-legend"');
    const calendarEnd = pmView.indexOf("</section>", legend);
    assert.ok(calendarStart >= 0 && legend > calendarStart && calendarEnd > legend);
    assert.match(pmView, /Add visits from their schedule rows\./);
});

test("department PM portal uses the same viewport-aware compact calendar", () => {
    assert.match(departmentStyles, /--department-pm-day-height:clamp\(50px,5\.5vh,58px\)/);
    assert.match(departmentStyles, /\.department-pm-summary article\{[\s\S]*?min-height:46px/);
    assert.match(departmentStyles, /\.department-pm-day\{[\s\S]*?min-height:var\(--department-pm-day-height\)/);
    assert.match(departmentStyles, /@media\(max-width:680px\)[\s\S]*?--department-pm-day-height:42px/);
    assert.ok(buildSource.indexOf('"dashboard_v2/css/pm_compact.css"') > buildSource.indexOf('"dashboard_v2/css/responsive_overrides.css"'));
});
