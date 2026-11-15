const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(relativePath) {
    return fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
}

test("dashboard validates the server session before routing", () => {
    const security = read("frontend/dashboard_v2/js/security.js");
    const router = read("frontend/dashboard_v2/js/router.js");

    assert.match(security, /fetch\("\/api\/auth\/me"/);
    assert.match(security, /response\.status === 401/);
    assert.match(security, /global\.expireDashboardSession/);
    assert.match(router, /await validateDashboardSession\(\)/);
    assert.match(router, /if \(!sessionIsValid\) return/);
});

test("stale request sessions return to login with a clear notice", () => {
    const security = read("frontend/dashboard_v2/js/security.js");
    const newRequest = read("frontend/dashboard_v2/js/new_request.js");
    const login = read("frontend/js/login.js");

    assert.match(newRequest, /response\.status === 401/);
    assert.match(newRequest, /await expireDashboardSession\(data\.detail\)/);
    assert.match(security, /Your previous account session is no longer valid/);
    assert.match(security, /global\.location\.replace\("\/"\)/);
    assert.match(login, /sessionStorage\.getItem\("biotrackLoginNotice"\)/);
});
