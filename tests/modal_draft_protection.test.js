const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const section = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));

test("data-entry dialogs keep drafts when the backdrop is clicked", () => {
    const business = read("frontend/dashboard_v2/views/businessView.js");
    const centralStore = read("frontend/dashboard_v2/views/centralStoreView.js");
    const storeRequests = read("frontend/dashboard_v2/views/storeRequestsView.js");
    const users = read("frontend/dashboard_v2/views/usersView.js");
    const vendors = read("frontend/dashboard_v2/views/vendorsView.js");
    const maintenance = read("frontend/dashboard_v2/views/maintenanceView.js");
    const inventory = read("frontend/dashboard_v2/views/inventoryView.js");
    const pmDrawer = read("frontend/dashboard_v2/js/pmDrawer.js");
    const reports = read("frontend/dashboard_v2/js/reports.js");
    const assetProfile = read("frontend/dashboard_v2/js/asset_profile.js");
    const relocation = read("frontend/dashboard_v2/js/assetRelocation.js");

    assert.match(business, /function closeBusinessModal\(event\) \{ if \(event\) return;/);
    assert.doesNotMatch(centralStore, /event\.target === modal\) closeCatalogueEditor/);
    assert.doesNotMatch(storeRequests, /event\.target === modal\) closeSpareRequestEditor/);
    assert.doesNotMatch(users, /event\.target===this\) closeUserModal/);
    assert.doesNotMatch(vendors, /event\.target === modal\) closeVendorModal/);
    assert.doesNotMatch(maintenance, /event\.target === modal\) closeDowntimeEditor/);
    assert.doesNotMatch(section(inventory, "function openInventoryModal", "function closeInventoryModalOnEscape"), /event\.target === overlay/);
    assert.doesNotMatch(section(pmDrawer, "function initializePMDrawer", "async function openPMDrawer"), /event\.target === pmDrawerOverlay/);
    assert.doesNotMatch(section(reports, "function openReportsScheduleDialog", "async function saveReportSchedule"), /event\.target===overlay/);
    assert.doesNotMatch(section(assetProfile, "async function openAssetEditor", "async function saveAssetEdits"), /event\.target === dialog/);
    assert.doesNotMatch(section(relocation, "function mount", "async function loadMine"), /event\.target === overlay/);
});

test("profile and security forms also require an explicit close action", () => {
    const settings = read("frontend/dashboard_v2/js/settings.js");
    const profileEditor = section(settings, "function initializeProfileEditor", "function initializeProfilePhoto");
    const mfaEditor = section(settings, "async function openMfaDialog", "async function openSessionDialog");

    assert.doesNotMatch(profileEditor, /event\.target === overlay/);
    assert.doesNotMatch(mfaEditor, /event\.target === overlay/);
    assert.match(profileEditor, /profile-edit-cancel/);
    assert.match(mfaEditor, /mfa-cancel/);
});
