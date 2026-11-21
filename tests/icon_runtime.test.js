const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const lucide = require("lucide");

const root = path.resolve(__dirname, "..");
const frontend = path.join(root, "frontend");

function sourceFiles(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            if (["dist", "vendor"].includes(entry.name)) return [];
            return sourceFiles(fullPath);
        }
        return /\.(?:html|js)$/.test(entry.name) ? [fullPath] : [];
    });
}

function toPascalCase(name) {
    return name.replace(/(^|-)([a-z0-9])/g, (_match, _separator, character) => character.toUpperCase());
}

test("icon libraries are served locally instead of relying on public CDNs", () => {
    const html = sourceFiles(frontend)
        .filter(file => file.endsWith(".html"))
        .map(file => fs.readFileSync(file, "utf8"))
        .join("\n");

    assert.doesNotMatch(html, /unpkg\.com\/lucide/i);
    assert.doesNotMatch(html, /cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome/i);
    assert.doesNotMatch(html, /cdn\.jsdelivr\.net\/npm\/chart\.js/i);
    assert.doesNotMatch(html, /unpkg\.com\/html5-qrcode/i);
    assert.match(html, /\/static\/vendor\/lucide\.min\.js/);
    assert.match(html, /\/static\/vendor\/fontawesome\/css\/all\.min\.css/);
    assert.match(html, /\/static\/vendor\/chart\.umd\.min\.js/);
    assert.match(html, /\/static\/vendor\/html5-qrcode\.min\.js/);

    assert.ok(fs.statSync(path.join(frontend, "vendor", "lucide.min.js")).size > 100_000);
    assert.ok(fs.statSync(path.join(frontend, "vendor", "chart.umd.min.js")).size > 100_000);
    assert.ok(fs.statSync(path.join(frontend, "vendor", "html5-qrcode.min.js")).size > 100_000);
    assert.ok(fs.statSync(path.join(frontend, "vendor", "fontawesome", "css", "all.min.css")).size > 10_000);
    assert.ok(fs.statSync(path.join(frontend, "vendor", "fontawesome", "webfonts", "fa-solid-900.woff2")).size > 10_000);
});

test("every static Lucide icon name used by the site exists", () => {
    const names = new Set();
    const pattern = /data-lucide=["']([a-z0-9-]+)["']/g;

    for (const file of sourceFiles(frontend)) {
        const source = fs.readFileSync(file, "utf8");
        for (const match of source.matchAll(pattern)) names.add(match[1]);
    }

    const missing = [...names].filter(name => !lucide.icons[toPascalCase(name)]);
    assert.deepEqual(missing, [], `Unknown Lucide icons: ${missing.join(", ")}`);
    assert.ok(names.size > 100, "Expected a site-wide icon audit.");
});
