const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function read(relativePath) {
    return fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
}

test("official hospital department list exposes all 27 selectable departments", () => {
    const context = { window: {}, console };
    context.window.window = context.window;
    vm.createContext(context);
    vm.runInContext(read("frontend/dashboard_v2/js/hospital_departments.js"), context);

    assert.equal(context.window.HOSPITAL_DEPARTMENTS.length, 27);
    assert.ok(context.window.HOSPITAL_DEPARTMENTS.includes("ENT (Ear, Nose and Throat)"));
    assert.ok(context.window.HOSPITAL_DEPARTMENTS.includes("Heart Care Centre (Cardiology)"));
    assert.ok(context.window.HOSPITAL_DEPARTMENTS.includes("Neurosurgery"));
    const selected = context.window.renderHospitalDepartmentOptions("Radiology");
    assert.match(selected, /value="Radiology" selected/);
});

test("user and asset add/edit forms use the shared department dropdown", () => {
    const dashboardBundle = read("frontend/dashboard_v2/dist/dashboard.bundle.js");
    const users = read("frontend/dashboard_v2/views/usersView.js");
    const assetForm = read("frontend/dashboard_v2/views/assetFormView.js");
    const assetEditor = read("frontend/dashboard_v2/js/asset_profile.js");

    assert.match(dashboardBundle, /source: dashboard_v2\/js\/hospital_departments\.js/);
    assert.match(users, /<select id="newDept" required>\$\{renderHospitalDepartmentOptions\(currentUser\?\.department\)\}<\/select>/);
    assert.match(assetForm, /<select id="department">[\s\S]*renderHospitalDepartmentOptions\(\)/);
    assert.match(assetEditor, /<select name="department">\$\{renderHospitalDepartmentOptions\(asset\.department\)\}<\/select>/);
});

test("legacy department values remain selectable while editing existing records", () => {
    const context = { window: {}, console };
    context.window.window = context.window;
    vm.createContext(context);
    vm.runInContext(read("frontend/dashboard_v2/js/hospital_departments.js"), context);

    const options = context.window.renderHospitalDepartmentOptions("Dialysis");
    assert.match(options, /value="Dialysis" selected>Dialysis \(existing\)<\/option>/);
});
