async function renderNewRequest() {

    const response = await fetch(
        "/static/dashboard_v2/partials/new_request.html"
    );

    pageContent.innerHTML = await response.text();

    initializeNewRequest();

    lucide.createIcons();

}