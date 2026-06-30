// ==========================================
// NEW REQUEST VIEW
// ==========================================

async function renderNewRequest() {

    try {

        const response = await fetch(
            "/static/dashboard_v2/partials/new_request.html"
        );

        pageContent.innerHTML = await response.text();

        // Initialize page
        if (typeof initializeNewRequest === "function") {

            initializeNewRequest();

        }

        // Refresh icons
        lucide.createIcons();

    }

    catch (error) {

        console.error(error);

        pageContent.innerHTML = `

            <div class="content">

                <h2>Unable to load New Request page.</h2>

            </div>

        `;

    }

}