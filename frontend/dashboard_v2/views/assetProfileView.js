// ==========================================
// ASSET PROFILE VIEW
// ==========================================

function renderAssetDetails() {

    pageContent.innerHTML = `

    <div class="asset-profile-page">

        <!-- ==========================================
             TOP BAR
        ========================================== -->

        <div class="asset-profile-top">

            <button
                class="btn-secondary"
                onclick="navigate('assets')">

                ← Back to Assets

            </button>

            <div class="asset-profile-actions">

                <button class="btn-secondary">

                    Edit Asset

                </button>

                <button class="btn-primary">

                    Generate QR

                </button>

            </div>

        </div>


        <!-- ==========================================
             HERO
        ========================================== -->

        <div id="assetProfileHero">

            Loading asset...

        </div>


        <!-- ==========================================
             TABS
        ========================================== -->

        <div class="asset-profile-tabs">

            <button class="tab-btn active">
                Overview
            </button>

            <button class="tab-btn">
                Maintenance
            </button>

            <button class="tab-btn">
                PM
            </button>

            <button class="tab-btn">
                Calibration
            </button>

            <button class="tab-btn">
                Documents
            </button>

            <button class="tab-btn">
                Warranty
            </button>

        </div>


        <!-- ==========================================
             CONTENT
        ========================================== -->

        <div id="assetProfileContent">

        </div>

    </div>

    `;

    loadAssetProfile();

}