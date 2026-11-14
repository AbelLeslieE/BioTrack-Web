const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
    path.join(__dirname, "../frontend/dashboard_v2/views/maintenanceView.js"),
    "utf8"
);
const ticketSource = fs.readFileSync(
    path.join(__dirname, "../frontend/dashboard_v2/views/ticketView.js"),
    "utf8"
);

test("downtime editor is administrator-only and saves through the dedicated endpoint", () => {
    assert.match(source, /isMaintenanceAdmin\(\)/);
    assert.match(source, /role === "admin"/);
    assert.match(source, /role === "manager"/);
    assert.match(source, /DOWNTIME_SECRET_CLICK_COUNT = 15/);
    assert.match(source, /handleDowntimeSecretClick/);
    assert.match(source, /method:\s*"PATCH"/);
    assert.match(source, /\/api\/requests\/\$\{encodeURIComponent\(ticket\)\}\/downtime/);
});

test("downtime editor exposes hours, minutes and no-history guidance", () => {
    assert.match(source, /downtimeHoursInput/);
    assert.match(source, /downtimeMinutesInput/);
    assert.match(source, /No separate change-history entry is created/);
});

test("ticket details use the downtime value itself as the hidden administrator edit trigger", () => {
    assert.match(ticketSource, /ticket-downtime-value/);
    assert.match(ticketSource, /ticket-downtime-trigger/);
    assert.match(ticketSource, /formatDowntime\(ticket\.downtime\)/);
    assert.match(ticketSource, /isMaintenanceAdmin\(\)/);
    assert.match(ticketSource, /handleDowntimeSecretClick/);
    assert.doesNotMatch(ticketSource, />\s*Edit downtime\s*</);
});
