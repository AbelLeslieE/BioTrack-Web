// ==========================================
// INVENTORY MODULE
// ==========================================

const INVENTORY_API = "/api/inventory";

let inventoryData = [];

let filteredInventory = [];

let currentInventoryId = null;


// ==========================================
// RENDER INVENTORY PAGE
// ==========================================

async function renderInventory() {

    pageContent.innerHTML = `

    <div class="inventory-page">

        <div class="page-header">

            <div>

                <h1>Inventory Management</h1>

                <p>

                    Manage biomedical spare parts and consumables.

                </p>

            </div>

            <div class="page-actions">

                <button id="importInventoryBtn">

                    <i data-lucide="upload"></i>

                    Import Excel

                </button>

                <button id="exportInventoryBtn">

                    <i data-lucide="download"></i>

                    Export

                </button>

                <button id="addInventoryBtn">

                    <i data-lucide="plus"></i>

                    Add Item

                </button>

            </div>

        </div>


        <!-- KPI -->

        <div class="inventory-kpis">

            <div class="kpi-card">

                <div class="kpi-info">

                    <span>Total Items</span>

                    <h2 id="inventoryTotalItems">0</h2>

                </div>

                <div class="kpi-icon">

                    <i data-lucide="boxes"></i>

                </div>

            </div>

            <div class="kpi-card">

                <div class="kpi-info">

                    <span>Low Stock</span>

                    <h2 id="inventoryLowStock">0</h2>

                </div>

                <div class="kpi-icon">

                    <i data-lucide="triangle-alert"></i>

                </div>

            </div>

            <div class="kpi-card">

                <div class="kpi-info">

                    <span>Out Of Stock</span>

                    <h2 id="inventoryOutStock">0</h2>

                </div>

                <div class="kpi-icon">

                    <i data-lucide="circle-x"></i>

                </div>

            </div>

            <div class="kpi-card">

                <div class="kpi-info">

                    <span>Total Value</span>

                    <h2 id="inventoryValue">₹0</h2>

                </div>

                <div class="kpi-icon">

                    <i data-lucide="indian-rupee"></i>

                </div>

            </div>

        </div>


        <!-- Toolbar -->

        <div class="inventory-toolbar">

            <input

                id="inventorySearch"

                type="text"

                placeholder="Search BPK, Item Name, Category..."

            >

            <select id="inventoryFilter">

                <option value="all">

                    All Items

                </option>

                <option value="available">

                    Available

                </option>

                <option value="low">

                    Low Stock

                </option>

                <option value="out">

                    Out Of Stock

                </option>

            </select>

        </div>


        <!-- Table -->

        <div class="table-container">

            <table class="inventory-table">

                <thead>

                    <tr>

                        <th>BPK No.</th>

                        <th>Item</th>

                        <th>Category</th>

                        <th>Manufacturer</th>

                        <th>Stock</th>

                        <th>Minimum</th>

                        <th>Status</th>

                        <th>Location</th>

                        <th>Actions</th>

                    </tr>

                </thead>

                <tbody id="inventoryTableBody">

                </tbody>

            </table>

        </div>

    </div>

    `;


    // Load data

    await loadInventory();


    // Events

    document
        .getElementById("inventorySearch")
        .addEventListener("input", applyInventoryFilters);

    document
        .getElementById("inventoryFilter")
        .addEventListener("change", applyInventoryFilters);

    document
        .getElementById("importInventoryBtn")
        .addEventListener("click", importInventoryExcel);

    document
        .getElementById("exportInventoryBtn")
        .addEventListener("click", exportInventoryExcel);

    document
    .getElementById("addInventoryBtn")
    .addEventListener("click", () => {

        alert("Add Inventory Modal - Coming Next");

    });


    if (window.lucide) {

        lucide.createIcons();

    }

}
// ==========================================
// LOAD INVENTORY
// ==========================================

async function loadInventory() {

    try {

        const response = await fetch(INVENTORY_API);

        if (!response.ok) {

            throw new Error("Failed to load inventory.");

        }

        inventoryData = await response.json();

        filteredInventory = [...inventoryData];

        updateInventoryKPIs();

        renderInventoryTable(filteredInventory);

    }

    catch (error) {

        console.error(error);

        inventoryData = [];

        filteredInventory = [];

        updateInventoryKPIs();

        renderInventoryTable([]);

    }

}


// ==========================================
// UPDATE KPI CARDS
// ==========================================

function updateInventoryKPIs() {

    const totalItems = inventoryData.length;

    const lowStock = inventoryData.filter(item =>

        item.current_stock > 0 &&

        item.current_stock <= item.minimum_stock

    ).length;

    const outOfStock = inventoryData.filter(item =>

        item.current_stock <= 0

    ).length;

    const totalValue = inventoryData.reduce((sum, item) => {

        return sum + ((item.current_stock || 0) * (item.purchase_price || 0));

    }, 0);

    document.getElementById("inventoryTotalItems").textContent = totalItems;

    document.getElementById("inventoryLowStock").textContent = lowStock;

    document.getElementById("inventoryOutStock").textContent = outOfStock;

    document.getElementById("inventoryValue").textContent =
        "₹" + totalValue.toLocaleString();

}


// ==========================================
// RENDER INVENTORY TABLE
// ==========================================

function renderInventoryTable(data) {

    const tbody = document.getElementById("inventoryTableBody");

    tbody.innerHTML = "";

    if (data.length === 0) {

        tbody.innerHTML = `

        <tr>

            <td colspan="9" class="table-empty">

                No inventory items found.

            </td>

        </tr>

        `;

        return;

    }

    data.forEach(item => {

        let statusClass = "stock-ok";

        let statusText = "Available";

        let stockClass = "stock-green";

        if (item.current_stock <= 0) {

            statusClass = "stock-out";

            statusText = "Out of Stock";

            stockClass = "stock-red";

        }

        else if (item.current_stock <= item.minimum_stock) {

            statusClass = "stock-low";

            statusText = "Low Stock";

            stockClass = "stock-orange";

        }

        tbody.innerHTML += `

        <tr>

            <td>

                ${item.bpk_number || "-"}

            </td>

            <td>

                <strong>

                    ${item.item_name || "-"}

                </strong>

            </td>

            <td>

                ${item.category || "-"}

            </td>

            <td>

                ${item.manufacturer || "-"}

            </td>

            <td class="${stockClass}">

                ${item.current_stock ?? 0}

            </td>

            <td>

                ${item.minimum_stock ?? 0}

            </td>

            <td>

                <span class="stock-badge ${statusClass}">

                    ${statusText}

                </span>

            </td>

            <td>

                ${item.location || "-"}

            </td>

            <td>

                <div class="action-buttons">

                    <button

                        class="table-btn edit-btn"

                        onclick="editInventory(${item.id})"

                    >

                        <i data-lucide="square-pen"></i>

                    </button>

                    <button

                        class="table-btn delete-btn"

                        onclick="deleteInventory(${item.id})"

                    >

                        <i data-lucide="trash-2"></i>

                    </button>

                </div>

            </td>

        </tr>

        `;

    });

    if (window.lucide) {

        lucide.createIcons();

    }

}
// ==========================================
// APPLY SEARCH & FILTER
// ==========================================

function applyInventoryFilters() {

    const search = document
        .getElementById("inventorySearch")
        .value
        .trim()
        .toLowerCase();

    const filter = document
        .getElementById("inventoryFilter")
        .value;

    filteredInventory = inventoryData.filter(item => {

        const matchesSearch =

            (item.bpk_number || "")
                .toLowerCase()
                .includes(search)

            ||

            (item.item_name || "")
                .toLowerCase()
                .includes(search)

            ||

            (item.category || "")
                .toLowerCase()
                .includes(search)

            ||

            (item.manufacturer || "")
                .toLowerCase()
                .includes(search);

        if (!matchesSearch) {

            return false;

        }

        switch (filter) {

            case "available":

                return item.current_stock >
                    item.minimum_stock;

            case "low":

                return item.current_stock > 0 &&
                    item.current_stock <= item.minimum_stock;

            case "out":

                return item.current_stock <= 0;

            default:

                return true;

        }

    });

    renderInventoryTable(filteredInventory);

}


// ==========================================
// EDIT INVENTORY
// ==========================================

function editInventory(id) {

    const item = inventoryData.find(

        x => x.id === id

    );

    if (!item) {

        return;

    }

    currentInventoryId = id;

    openInventoryModal(item);

}


// ==========================================
// DELETE INVENTORY
// ==========================================

async function deleteInventory(id) {

    if (!confirm("Delete this inventory item?")) {

        return;

    }

    const response = await fetch(

        `${INVENTORY_API}/${id}`,

        {

            method: "DELETE"

        }

    );

    const result = await response.json();

    if (result.success) {

        await loadInventory();

    }

}


// ==========================================
// SAVE INVENTORY
// ==========================================

async function saveInventoryItem(id = null) {

    const payload = {

        bpk_number:
            document.getElementById("inv_bpk").value,

        item_name:
            document.getElementById("inv_name").value,

        category:
            document.getElementById("inv_category").value,

        manufacturer:
            document.getElementById("inv_manufacturer").value,

        supplier:
            document.getElementById("inv_supplier").value,

        unit:
            document.getElementById("inv_unit").value,

        current_stock:
            Number(document.getElementById("inv_stock").value),

        minimum_stock:
            Number(document.getElementById("inv_min").value),

        maximum_stock:
            Number(document.getElementById("inv_max").value),

        purchase_price:
            Number(document.getElementById("inv_price").value),

        location:
            document.getElementById("inv_location").value,

        rack:
            document.getElementById("inv_rack").value,

        remarks:
            document.getElementById("inv_remarks").value

    };

    const url = id

        ? `${INVENTORY_API}/${id}`

        : INVENTORY_API;

    const method = id

        ? "PUT"

        : "POST";

    const response = await fetch(

        url,

        {

            method,

            headers:{

                "Content-Type":"application/json"

            },

            body:JSON.stringify(payload)

        }

    );

    const result = await response.json();

    if(result.success){

        closeInventoryModal();

        await loadInventory();

    }

}


// ==========================================
// IMPORT INVENTORY
// ==========================================

function importInventoryExcel(){

    const input = document.createElement("input");

    input.type = "file";

    input.accept = ".xlsx,.xls";

    input.onchange = async () => {

        if(!input.files.length){

            return;

        }

        const formData = new FormData();

        formData.append(

            "file",

            input.files[0]

        );

        const response = await fetch(

            `${INVENTORY_API}/upload`,

            {

                method:"POST",

                body:formData

            }

        );

        const result = await response.json();

        if(result.success){

            alert(

`Inventory Imported Successfully

Added : ${result.added}

Updated : ${result.updated}`

            );

            await loadInventory();

        }

        else{

            alert("Import Failed");

        }

    };

    input.click();

}


// ==========================================
// EXPORT INVENTORY
// ==========================================

function exportInventoryExcel(){

    alert("Export module will be connected next.");

}
// ==========================================
// LOADING OVERLAY
// ==========================================

function showInventoryLoading(message = "Loading...") {

    const old = document.getElementById("inventoryLoading");

    if (old) old.remove();

    const div = document.createElement("div");

    div.id = "inventoryLoading";

    div.className = "loading-overlay";

    div.innerHTML = `

        <div class="loading-card">

            <div class="loading-spinner"></div>

            <h3>${message}</h3>

        </div>

    `;

    document.body.appendChild(div);

}

function hideInventoryLoading(){

    const loading = document.getElementById("inventoryLoading");

    if(loading){

        loading.remove();

    }

}


// ==========================================
// SUCCESS MESSAGE
// ==========================================

function showInventoryToast(message){

    const old = document.getElementById("inventoryToast");

    if(old){

        old.remove();

    }

    const toast = document.createElement("div");

    toast.id = "inventoryToast";

    toast.className = "inventory-toast";

    toast.innerHTML = `

        <i data-lucide="circle-check-big"></i>

        <span>${message}</span>

    `;

    document.body.appendChild(toast);

    if(window.lucide){

        lucide.createIcons();

    }

    setTimeout(()=>{

        toast.classList.add("show");

    },50);

    setTimeout(()=>{

        toast.remove();

    },3000);

}


// ==========================================
// IMPROVED IMPORT
// ==========================================

async function importInventoryExcel(){

    const input=document.createElement("input");

    input.type="file";

    input.accept=".xlsx,.xls";

    input.onchange=async()=>{

        if(!input.files.length){

            return;

        }

        showInventoryLoading("Importing Inventory...");

        const formData=new FormData();

        formData.append(

            "file",

            input.files[0]

        );

        try{

            const response=await fetch(

                `${INVENTORY_API}/upload`,

                {

                    method:"POST",

                    body:formData

                }

            );

            const result=await response.json();

            hideInventoryLoading();

            if(result.success){

                showInventoryToast(

                    `Inventory Imported Successfully (${result.added} Added, ${result.updated} Updated)`

                );

                await loadInventory();

            }

            else{

                alert("Import Failed");

            }

        }

        catch(error){

            hideInventoryLoading();

            console.error(error);

            alert("Server Error");

        }

    };

    input.click();

}


// ==========================================
// EXPORT CSV
// ==========================================

function exportInventoryExcel(){

    if(inventoryData.length===0){

        showInventoryToast("Nothing to export.");

        return;

    }

    let csv=

`BPK Number,Item Name,Category,Manufacturer,Stock,Minimum Stock,Location\n`;

    inventoryData.forEach(item=>{

        csv+=`"${item.bpk_number}","${item.item_name}","${item.category}","${item.manufacturer}",${item.current_stock},${item.minimum_stock},"${item.location}"\n`;

    });

    const blob=new Blob(

        [csv],

        {

            type:"text/csv"

        }

    );

    const url=URL.createObjectURL(blob);

    const a=document.createElement("a");

    a.href=url;

    a.download="Inventory.csv";

    a.click();

    URL.revokeObjectURL(url);

    showInventoryToast("Inventory Exported");

}