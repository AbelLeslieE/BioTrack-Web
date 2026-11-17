const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const interactions = fs.readFileSync(path.join(root, "frontend/dashboard_v2/js/topbarInteractions.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "frontend/dashboard_v2/css/topbar.css"), "utf8");

test("notification panel stays open while its own list is scrolled", () => {
    assert.match(interactions, /activePopup\.contains\(scrollTarget\)/);
    assert.doesNotMatch(interactions, /addEventListener\("scroll", closePopups/);
});

test("notification center uses a viewport-safe independently scrollable layout", () => {
    assert.match(styles, /topbar-popover\.is-notification-center\{display:flex/);
    assert.match(styles, /notification-center-list\{flex:1 1 auto;min-height:0;max-height:none;overflow-x:hidden;overflow-y:auto/);
    assert.match(styles, /notification-center-copy strong\{[^}]*white-space:normal/);
    assert.match(styles, /notification-center-copy small\{[^}]*white-space:normal/);
});
