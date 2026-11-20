const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

test("dashboard loads the global toast service before module scripts", () => {
    const styles = read("frontend/dashboard_v2/dist/dashboard.bundle.css");
    const scripts = read("frontend/dashboard_v2/dist/dashboard.bundle.js");
    assert.match(styles, /source: css\/toast\.css/);
    assert.match(scripts, /source: js\/toast\.js/);
    assert.ok(
        scripts.indexOf("source: js/toast.js") < scripts.indexOf("source: dashboard_v2/js/security.js"),
        "toast service must be available before feature modules execute",
    );
});

test("toast service is accessible, safe and supports every notification type", () => {
    const source = read("frontend/js/toast.js");
    assert.match(source, /window\.BioTrackToast = api/);
    assert.match(source, /success:/);
    assert.match(source, /error:/);
    assert.match(source, /warning:/);
    assert.match(source, /info:/);
    assert.match(source, /aria-live/);
    assert.match(source, /textContent = String\(message/);
    assert.match(source, /window\.alert = function toastInsteadOfAlert/);
});

test("dashboard feature code no longer opens native browser alerts", () => {
    const folders = [
        path.join(root, "frontend", "dashboard_v2"),
        path.join(root, "frontend", "js"),
    ];
    const javascript = [];
    const collect = folder => {
        for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
            const target = path.join(folder, entry.name);
            if (entry.isDirectory()) collect(target);
            else if (entry.name.endsWith(".js")) javascript.push(target);
        }
    };
    folders.forEach(collect);
    for (const file of javascript) {
        assert.doesNotMatch(fs.readFileSync(file, "utf8"), /\balert\s*\(/, file);
    }
});

test("asset imports use a team-selection dialog and typed result toasts", () => {
    const source = read("frontend/dashboard_v2/views/assetsView.js");
    assert.match(source, /BioTrackToast\.success\(\s*"Asset import complete"/);
    assert.match(source, /BioTrackToast\.error\("Asset import failed"/);
    assert.match(source, /openAssetImportDialog\(excelInput\)/);
    assert.match(source, /id="assetImportTeam"/);
});

test("toast layout supports dark mode and mobile screens", () => {
    const styles = read("frontend/css/toast.css");
    assert.match(styles, /body\.dark-theme \.app-toast/);
    assert.match(styles, /@media \(max-width: 640px\)/);
    assert.match(styles, /z-index: 2147483000/);
});
