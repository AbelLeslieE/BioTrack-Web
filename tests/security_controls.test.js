const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const csrf = fs.readFileSync("frontend/js/csrf.js", "utf8");
const login = fs.readFileSync("frontend/js/login.js", "utf8");
const loginHtml = fs.readFileSync("frontend/login.html", "utf8");
const main = fs.readFileSync("backend/main.py", "utf8");

test("unsafe same-origin requests receive the CSRF header", () => {
    assert.match(csrf, /unsafeMethods = new Set\(\["POST", "PUT", "PATCH", "DELETE"\]\)/);
    assert.match(csrf, /headers\.set\("X-CSRF-Token", token\)/);
    assert.match(loginHtml, /static\/js\/csrf\.js/);
});

test("privileged login supports authenticator enrollment and verification", () => {
    assert.match(loginHtml, /id="mfaSection"/);
    assert.match(login, /mfa_enrollment_required/);
    assert.match(login, /mfa_code:/);
});

test("application installs the security middleware", () => {
    assert.match(main, /app\.add_middleware\(SecurityMiddleware\)/);
});
