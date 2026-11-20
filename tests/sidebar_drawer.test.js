const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "frontend/dashboard_v2/dashboard.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "frontend/dashboard_v2/css/responsive_overrides.css"), "utf8");
const sidebar = fs.readFileSync(path.join(root, "frontend/dashboard_v2/js/sidebar.js"), "utf8");

test("sidebar is hidden by default and the hamburger controls it at every width", () => {
    assert.match(html, /id="primary-sidebar"[^>]+aria-hidden="true"[^>]+inert/);
    assert.match(styles, /\.main-content\{margin-left:0/);
    assert.match(styles, /\.topbar\{left:0/);
    assert.match(styles, /transform:translateX\(-105%\)/);
    assert.match(styles, /\.sidebar\.active\{[\s\S]*?transform:translateX\(0\)/);
    assert.match(styles, /\.menu-toggle\{display:flex\}/);
    assert.doesNotMatch(sidebar, /if \(!mobileQuery\.matches\) return/);
});

test("sidebar closes after navigation, backdrop click, and Escape", () => {
    assert.match(sidebar, /event\.target\.closest\("\.nav-item"\)\) closeMenu\(\)/);
    assert.match(sidebar, /backdrop\.addEventListener\("click", \(\) => closeMenu\(true\)\)/);
    assert.match(sidebar, /event\.key === "Escape"[\s\S]*?closeMenu\(true\)/);
    assert.match(sidebar, /appSidebar\.inert = true/);
});
