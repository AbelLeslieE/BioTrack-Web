const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");

test("web app manifest defines an installable scoped application", () => {
    const manifest = JSON.parse(
        fs.readFileSync(path.join(projectRoot, "frontend", "manifest.webmanifest"), "utf8")
    );

    assert.equal(manifest.start_url, "/");
    assert.equal(manifest.scope, "/");
    assert.equal(manifest.display, "standalone");
    assert.ok(manifest.name);
    assert.ok(manifest.short_name);
    assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192"));
    assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512"));
    assert.ok(manifest.icons.some((icon) => icon.purpose === "maskable"));
});

test("PWA icon files exist and are non-empty", () => {
    for (const file of ["biotrack-192.png", "biotrack-512.png", "biotrack-maskable-512.png"]) {
        const iconPath = path.join(projectRoot, "frontend", "assets", "icons", file);
        assert.ok(fs.statSync(iconPath).size > 1000, `${file} should contain a rendered icon`);
    }
});

test("service worker never caches API responses", () => {
    const serviceWorker = fs.readFileSync(
        path.join(projectRoot, "frontend", "service-worker.js"),
        "utf8"
    );

    assert.match(serviceWorker, /url\.pathname\.startsWith\("\/api\/"\)/);
    assert.match(serviceWorker, /event\.respondWith\(fetch\(request\)\)/);
    assert.doesNotMatch(serviceWorker, /cache\.put\([^\n]*\/api\//);
});

test("primary pages load the manifest and PWA registration", () => {
    const pages = [
        "login.html",
        "dashboard.html",
        "user_dashboard.html",
        "biomedical_dashboard.html",
        "devices.html",
        path.join("dashboard_v2", "dashboard.html"),
        path.join("dashboard_v2", "maintenance.html")
    ];

    for (const page of pages) {
        const html = fs.readFileSync(path.join(projectRoot, "frontend", page), "utf8");
        assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/, page);
        assert.match(html, /src="\/static\/js\/pwa\.js"/, page);
    }
});
