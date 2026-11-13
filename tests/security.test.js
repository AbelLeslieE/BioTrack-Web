const test = require("node:test");
const assert = require("node:assert/strict");

global.window = global;
require("../frontend/dashboard_v2/js/security.js");

test("escapeHTML encodes executable markup and attribute delimiters", () => {
    assert.equal(
        escapeHTML('<img src=x onerror="alert(1)">\'&'),
        "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&#39;&amp;"
    );
});
