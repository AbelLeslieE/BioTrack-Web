const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const scanner = fs.readFileSync(path.join(__dirname, "../frontend/dashboard_v2/js/qr_scanner.js"), "utf8");
const router = fs.readFileSync(path.join(__dirname, "../frontend/dashboard_v2/js/router.js"), "utf8");

test("QR scanner starts the environment camera and cancels pending starts", () => {
    assert.match(scanner, /scanner\.start\(/);
    assert.match(scanner, /facingMode:\s*"environment"/);
    assert.match(scanner, /qrScannerSessionId/);
    assert.match(scanner, /qrScannerCloseRequested/);
    assert.match(scanner, /!modal\.isConnected/);
});

test("closing or leaving the QR module stops scanner and raw media tracks", () => {
    assert.match(scanner, /await scanner\.stop\(\)/);
    assert.match(scanner, /stream\.getTracks\(\)\.forEach\(track => track\.stop\(\)\)/);
    assert.match(scanner, /visibilitychange/);
    assert.match(scanner, /pagehide/);
    assert.match(router, /page !== "qr"/);
    assert.match(router, /closeQRScanner\(\)/);
});
