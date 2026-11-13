// ==========================================
// LOAD ASSET PROFILE
// ==========================================

async function loadAssetProfile() {

    try {

        const response = await fetch(

            `/api/assets/${currentAssetId}`

        );

        if (!response.ok) {
            throw new Error("Asset not found.");
        }

        const asset = await response.json();

        const safeAsset = Object.fromEntries(
            Object.entries(asset).map(([key, value]) => [
                key,
                typeof value === "string" ? escapeHTML(value) : value
            ])
        );

        renderAssetHero(safeAsset);

    }

    catch (error) {

        console.error(error);

    }

}


// ==========================================
// HERO
// ==========================================

// ==========================================
// ASSET HERO
// ==========================================

function renderAssetHero(asset) {

    document.getElementById("assetProfileHero").innerHTML = `

    <section class="asset-hero">

        <div class="asset-image-card">

            <img
                src="${
                    asset.image_path
                        ? asset.image_path
                        : "/static/dashboard_v2/images/device-placeholder.png"
                }"
                alt="${asset.equipment_name}"
                class="asset-image">

        </div>

        <div class="asset-hero-content">

            <div class="asset-title-row">

                <div>

                    <span class="asset-category">

                        Biomedical Equipment

                    </span>

                    <h1>

                        ${asset.equipment_name}

                    </h1>

                    <p class="asset-code">

                        ${asset.asset_code}

                    </p>

                </div>

                <div class="asset-actions">

                    <button class="btn-outline">

                        Edit Asset

                    </button>

                    <button class="btn-primary">

                        Generate QR

                    </button>

                </div>

            </div>

            <div class="asset-summary">

                <div>

                    <label>Status</label>

                    <span class="status active">

                        ${asset.status}

                    </span>

                </div>

                <div>

                    <label>Manufacturer</label>

                    <strong>

                        ${asset.manufacturer || "-"}

                    </strong>

                </div>

                <div>

                    <label>Model</label>

                    <strong>

                        ${asset.model || "-"}

                    </strong>

                </div>

                <div>

                    <label>Department</label>

                    <strong>

                        ${asset.department || "-"}

                    </strong>

                </div>

            </div>

        </div>

    </section>

    `;

}
