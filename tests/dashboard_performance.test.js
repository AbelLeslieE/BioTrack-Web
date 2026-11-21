const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

test("dashboard loads local application code from two bundles", () => {
    const html = fs.readFileSync(path.join(root, "frontend/dashboard_v2/dashboard.html"), "utf8");
    const localStyles = [...html.matchAll(/<link[^>]+href="(\/static\/[^"]+\.css[^\"]*)"/g)];
    const localScripts = [...html.matchAll(/<script[^>]+src="(\/static\/[^"]+\.js[^\"]*)"/g)];
    const applicationStyles = localStyles.filter(match => match[1].includes("/dashboard_v2/"));
    const applicationScripts = localScripts.filter(match => match[1].includes("/dashboard_v2/"));

    assert.equal(applicationStyles.length, 1);
    assert.ok(applicationStyles[0][1].includes("dashboard.bundle.css"));
    assert.equal(applicationScripts.length, 1);
    assert.ok(applicationScripts[0][1].includes("dashboard.bundle.js"));
    assert.ok(localStyles.every(match => /dashboard\.bundle|vendor\/fontawesome/.test(match[1])));
    assert.ok(localScripts.every(match => /dashboard\.bundle|vendor\/(?:lucide|chart\.umd|html5-qrcode)|js\/pwa/.test(match[1])));

    for (const file of ["dashboard.bundle.css", "dashboard.bundle.js"]) {
        const bundle = path.join(root, "frontend/dashboard_v2/dist", file);
        assert.ok(fs.existsSync(bundle), `${file} must be generated during the build`);
        assert.ok(fs.statSync(bundle).size > 10_000, `${file} must contain dashboard sources`);
    }
});

test("repeat visits serve cached static files while refreshing in background", () => {
    const worker = fs.readFileSync(path.join(root, "frontend/service-worker.js"), "utf8");
    assert.match(worker, /caches\.match\(request\)/);
    assert.match(worker, /return cachedResponse \|\| networkResponse/);
});
