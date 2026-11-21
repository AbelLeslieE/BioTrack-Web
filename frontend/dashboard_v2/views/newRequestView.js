async function renderNewRequest() {
    try {
        const response = await fetch("/static/dashboard_v2/partials/new_request.html");
        if (!response.ok) throw new Error("The maintenance request form could not be loaded.");
        pageContent.innerHTML = await response.text();
        if (window.lucide) lucide.createIcons();
        await initializeNewRequest();
    } catch (error) {
        pageContent.innerHTML = '<div class="request-load-error"><i data-lucide="cloud-alert"></i><h2>Request form unavailable</h2><p></p><button type="button">Try again</button></div>';
        pageContent.querySelector(".request-load-error p").textContent = error.message || "Please check your connection and try again.";
        pageContent.querySelector(".request-load-error button").addEventListener("click", renderNewRequest);
        if (window.lucide) lucide.createIcons();
    }
}
