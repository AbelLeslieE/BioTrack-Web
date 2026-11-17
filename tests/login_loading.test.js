const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "frontend/login.html"), "utf8");
const source = fs.readFileSync(path.join(root, "frontend/js/login.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "frontend/css/login.css"), "utf8");

test("login shows an accessible loading message while authentication is pending", () => {
    assert.match(html, /id="loginProgress"[\s\S]*?role="status"[\s\S]*?Logging in…/);
    assert.match(source, /function setLoginLoading\(isLoading\)/);
    assert.match(source, /setLoginLoading\(true\)/);
    assert.match(source, /if \(!loginSucceeded\) setLoginLoading\(false\)/);
    assert.match(styles, /\.login-progress-spinner/);
    assert.match(styles, /@keyframes login-progress-spin/);
});

test("remember me stores only the username and restores it on the next visit", () => {
    assert.match(html, /id="rememberMe"[\s\S]*?<span>Remember me<\/span>/);
    assert.match(source, /localStorage\.getItem\("biotrackRememberedUsername"\)/);
    assert.match(source, /localStorage\.setItem\("biotrackRememberedUsername", body\.username\)/);
    assert.match(source, /localStorage\.removeItem\("biotrackRememberedUsername"\)/);
    assert.doesNotMatch(source, /setItem\([^\n]*password/i);
    assert.match(styles, /\.login-card #loginForm \.remember-option/);
});
