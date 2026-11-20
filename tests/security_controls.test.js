const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const csrf = fs.readFileSync("frontend/js/csrf.js", "utf8");
const login = fs.readFileSync("frontend/js/login.js", "utf8");
const loginHtml = fs.readFileSync("frontend/login.html", "utf8");
const main = fs.readFileSync("backend/main.py", "utf8");
const authRoutes = fs.readFileSync("backend/routes/auth_routes.py", "utf8");
const logRoutes = fs.readFileSync("backend/routes/log_routes.py", "utf8");
const settings = fs.readFileSync("frontend/dashboard_v2/js/settings.js", "utf8");

test("unsafe same-origin requests receive the CSRF header", () => {
    assert.match(csrf, /unsafeMethods = new Set\(\["POST", "PUT", "PATCH", "DELETE"\]\)/);
    assert.match(csrf, /headers\.set\("X-CSRF-Token", token\)/);
    assert.match(loginHtml, /static\/js\/csrf\.js/);
});

test("MFA is optional and only enabled accounts are challenged at login", () => {
    assert.match(loginHtml, /id="mfaSection"/);
    assert.match(login, /mfa_code:/);
    assert.match(authRoutes, /if user\.mfa_enabled:/);
    assert.doesNotMatch(authRoutes, /role_requires_mfa/);
    assert.match(settings, /MFA is optional/);
    assert.match(settings, /\/api\/auth\/mfa\/setup/);
});

test("application installs the security middleware", () => {
    assert.match(main, /app\.add_middleware\(SecurityMiddleware\)/);
});

test("dashboard documents are authenticated before being served", () => {
    assert.match(main, /@app\.get\("\/dashboard"\)/);
    assert.match(main, /get_current_user\(request, None, db\)/);
    assert.match(main, /RedirectResponse\(url="\/", status_code=303\)/);
});

test("runtime log queries use SQLAlchemy ORM instead of raw SQL", () => {
    assert.match(logRoutes, /db\.query\(Log\)/);
    assert.doesNotMatch(logRoutes, /text\(|SELECT \*/);
});
