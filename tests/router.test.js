const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function createRouter(role) {
    const renders = [];
    const functionNames = [
        "renderDashboard", "renderTicket", "renderUserDashboard", "renderNewRequest",
        "renderMyRequests", "renderMyAssets", "renderDepartmentPMSchedule",
        "renderRequestDetails", "renderEngineerDashboard", "renderElectricalDashboard",
        "renderITDashboard", "renderMaintenance", "renderMaintenanceModule", "renderAssets",
        "renderAssetForm", "renderAssetDetails", "renderInventory", "renderPM",
        "renderReports", "renderAI", "renderUsers", "renderQRScannerModule", "renderQRAssetProfile", "renderSettings",
        "renderWardBoyDashboard",
    ];
    const context = {
        console: { log() {}, warn() {}, error() {} },
        localStorage: { getItem(key) { return key === "role" ? role : null; } },
        document: {
            getElementById() { return {}; },
            addEventListener() {},
            querySelectorAll() { return []; },
            querySelector() { return null; },
        },
        lucide: { createIcons() {} },
        openQRScanner() { renders.push("qr"); },
        setTimeout(callback) { callback(); },
        renders,
    };
    functionNames.forEach(name => {
        context[name] = () => renders.push(name);
    });
    context.window = context;
    context.location = { href: "/dashboard_v2" };
    vm.createContext(context);
    const source = fs.readFileSync(path.join(__dirname, "../frontend/dashboard_v2/js/router.js"), "utf8");
    vm.runInContext(source, context);
    return context;
}

test("manager and BME roles normalize to their correct dashboards", () => {
    const manager = createRouter("manager");
    manager.navigate("dashboard");
    assert.deepEqual(manager.renders, ["renderDashboard"]);

    const bme = createRouter("bme");
    bme.navigate("dashboard");
    assert.deepEqual(bme.renders, ["renderEngineerDashboard"]);
});

test("department users can open scoped asset details and launch the scanner", () => {
    const user = createRouter("user");
    user.navigate("assetDetails");
    user.navigate("qr");
    assert.deepEqual(user.renders, ["renderAssetDetails", "renderQRScannerModule", "qr"]);
});

test("Ward Boy accounts open only the transport dashboard", () => {
    const wardBoy = createRouter("wardboy");
    wardBoy.navigate("wardBoyDashboard");
    wardBoy.navigate("assets");
    assert.deepEqual(wardBoy.renders, ["renderWardBoyDashboard", "renderWardBoyDashboard"]);
});

test("unknown roles are returned to login instead of receiving a dashboard", () => {
    const unknown = createRouter("unexpected-role");
    unknown.navigate("dashboard");
    assert.equal(unknown.window.location.href, "/");
    assert.deepEqual(unknown.renders, []);
});
