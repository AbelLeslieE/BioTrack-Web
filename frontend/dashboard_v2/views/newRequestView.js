async function renderNewRequest() {

    const response = await fetch(
        "/static/dashboard_v2/partials/new_request.html"
    );

    pageContent.innerHTML = await response.text();

    const modal = document.getElementById("successModal");

    console.log("Initial class:", modal.className);

    // Watch for any class changes
    const observer = new MutationObserver(() => {

        console.log("Modal class changed:", modal.className);

        console.trace("Who changed it?");

    });

    observer.observe(modal, {
        attributes: true,
        attributeFilter: ["class"]
    });

    initializeNewRequest();

    lucide.createIcons();
}