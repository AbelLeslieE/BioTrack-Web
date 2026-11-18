const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

test("maintenance calls can request Ward Boy pickup assistance", () => {
    const partial = read("frontend/dashboard_v2/partials/new_request.html");
    const source = read("frontend/dashboard_v2/js/new_request.js");
    assert.match(partial, /id="wardBoyAssistance"/);
    assert.match(source, /request_ward_boy_pickup/);
});

test("engineering tickets support pickup and post-repair return transport", () => {
    const source = read("frontend/dashboard_v2/views/ticketView.js");
    assert.match(source, /Ward Boy Transport/);
    assert.match(source, /wardBoyReturnAfterRepair/);
    assert.match(source, /createWardBoyTransport\("Return"\)/);
});

test("Ward Boy portal is mobile responsive and exposes accept and delivery actions", () => {
    const source = read("frontend/dashboard_v2/views/wardBoyDashboardView.js");
    const styles = read("frontend/dashboard_v2/css/ward_boy.css");
    const dashboard = read("frontend/dashboard_v2/dashboard.html");
    assert.match(source, /Accept job/);
    assert.match(source, /Mark delivered/);
    assert.match(styles, /@media \(max-width: (?:620|700)px\)/);
    assert.match(dashboard, /wardBoyDashboardView\.js/);
});

test("administrators can create the Ward Boy login role", () => {
    const users = read("frontend/dashboard_v2/views/usersView.js");
    assert.match(users, /value="WardBoy">Ward Boy/);
    assert.match(users, /Hospital Support Services/);
});
