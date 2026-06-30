// ==========================================
// OPEN ASSET DRAWER
// ==========================================

function openAssetDrawer(asset) {

    closeAssetDrawer();

    document.body.insertAdjacentHTML(

        "beforeend",

        `
        <div id="assetDrawerOverlay" class="asset-overlay">

            <div id="assetDrawer" class="asset-drawer">

                <!-- ===================================== -->
                <!-- HEADER -->
                <!-- ===================================== -->

                <div class="drawer-header">

                    <div>

                        <h2>${asset.equipment_name || "-"}</h2>

                        <p class="drawer-subtitle">

                            Asset Code :
                            <strong>${asset.asset_code || "-"}</strong>

                        </p>

                    </div>

                    <button
                        id="closeDrawerBtn"
                        class="drawer-close">

                        ✕

                    </button>

                </div>


                <!-- ===================================== -->
                <!-- BODY -->
                <!-- ===================================== -->

                <div class="drawer-body">

                    <!-- Equipment Image -->

                    <div class="asset-image">

                        🏥

                    </div>


                    <!-- ===================================== -->
                    <!-- GENERAL INFORMATION -->
                    <!-- ===================================== -->

                    <!-- ===================================== -->
                    <!-- GENERAL INFORMATION -->
                    <!-- ===================================== -->

                    <div class="drawer-section">

                        <div class="section-header">

                            <h3>General Information</h3>

                        </div>

                        <div class="asset-info">

                            <div class="info-card">

                                <label>Equipment No</label>

                                <h4>${asset.equipment_no || "-"}</h4>

                            </div>

                            <div class="info-card">

                                <label>Equipment Name</label>

                                <h4>${asset.equipment_name || "-"}</h4>

                            </div>

                            <div class="info-card">

                                <label>Manufacturer</label>

                                <h4>${asset.manufacturer || "-"}</h4>

                            </div>

                            <div class="info-card">

                                <label>Model</label>

                                <h4>${asset.model || "-"}</h4>

                            </div>

                            <div class="info-card">

                                <label>Department</label>

                                <h4>${asset.department || "-"}</h4>

                            </div>

                            <div class="info-card">

                                <label>Status</label>

                                <span class="status-badge">

                                    ${asset.status || "-"}

                                </span>

                            </div>

                            <div class="info-card">

                                <label>Serial Number</label>

                                <h4>${asset.serial_number || "-"}</h4>

                            </div>

                            <div class="info-card">

                                <label>Asset Code</label>

                                <h4>${asset.asset_code || "-"}</h4>

                            </div>

                        </div>

                    </div>

                    </div>

                </div>

            </div>

        </div>
        <!-- ===================================== -->
        <!-- PURCHASE & WARRANTY -->
        <!-- ===================================== -->

        <div class="drawer-section">

            <div class="section-header">

                <h3>Purchase & Warranty</h3>

            </div>

            <div class="asset-info">

                <div class="info-card">

                    <label>Purchase Date</label>

                    <h4>${asset.purchase_date || "-"}</h4>

                </div>

                <div class="info-card">

                    <label>Installation Date</label>

                    <h4>${asset.installation_date || "-"}</h4>

                </div>

                <div class="info-card">

                    <label>Purchase Value</label>

                    <h4>₹ ${asset.purchase_value ?? "-"}</h4>

                </div>

                <div class="info-card">

                    <label>Tax Amount</label>

                    <h4>₹ ${asset.tax_amount ?? "-"}</h4>

                </div>

                <div class="info-card">

                    <label>Net Value</label>

                    <h4>₹ ${asset.net_value ?? "-"}</h4>

                </div>

                <div class="info-card">

                    <label>Warranty</label>

                    <h4>${asset.warranty || "-"}</h4>

                </div>

                <div class="info-card">

                    <label>Supplier</label>

                    <h4>${asset.supplier || "-"}</h4>

                </div>

                <div class="info-card">

                    <label>Maintained By</label>

                    <h4>${asset.maintained_by || "-"}</h4>

                </div>

            </div>

        </div>
        `

    );
    

    const overlay = document.getElementById("assetDrawerOverlay");
    const drawer = document.getElementById("assetDrawer");

    requestAnimationFrame(() => {

        overlay.classList.add("show");
        drawer.classList.add("show");

    });

    document
        .getElementById("closeDrawerBtn")
        .addEventListener("click", closeAssetDrawer);

}

// ==========================================
// CLOSE DRAWER
// ==========================================

function closeAssetDrawer() {

    const overlay = document.getElementById("assetDrawerOverlay");
    const drawer = document.getElementById("assetDrawer");

    if (!overlay || !drawer) return;

    overlay.classList.remove("show");
    drawer.classList.remove("show");

    setTimeout(() => {

        overlay.remove();

    }, 350);

}


// ==========================================
// GLOBAL
// ==========================================

window.openAssetDrawer = openAssetDrawer;
window.closeAssetDrawer = closeAssetDrawer;