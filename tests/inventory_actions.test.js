const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(
    path.join(root, "frontend/dashboard_v2/views/inventoryView.js"),
    "utf8",
);
const styles = fs.readFileSync(
    path.join(root, "frontend/dashboard_v2/css/inventory.css"),
    "utf8",
);

test("inventory edit opens a populated add/edit form and saves with PUT", () => {
    assert.match(source, /function editInventory\(id\)/);
    assert.match(source, /function openInventoryModal\(item = null\)/);
    assert.match(source, /id="inventoryItemForm"/);
    assert.match(source, /id="inv_bpk" required/);
    assert.match(source, /id="inv_name" required/);
    assert.match(source, /id="inv_team"/);
    assert.match(source, /\? `\$\{INVENTORY_API\}\/\$\{id\}`/);
    assert.match(source, /const method = id[\s\S]*?"PUT"/);
});

test("inventory delete uses an accessible confirmation and DELETE request", () => {
    assert.match(source, /role="alertdialog"/);
    assert.match(source, /function confirmDeleteInventory\(id\)/);
    assert.match(source, /method: "DELETE"/);
    assert.match(source, /Inventory item deleted/);
    assert.doesNotMatch(source, /\bconfirm\s*\(/);
});

test("inventory action dialogs are responsive and have destructive styling", () => {
    assert.match(styles, /\.inventory-delete-modal/);
    assert.match(styles, /\.danger-btn/);
    assert.match(styles, /\.form-group\.full-width/);
    assert.match(styles, /@media\(max-width:768px\)/);
});
