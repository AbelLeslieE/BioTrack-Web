// ==========================================
// API URL
// ==========================================

const API = {

    dashboard: "/api/dashboard/v2"

};

async function fetchPaginatedList(endpoint, options = {}, pageSize = 250) {
    const items = [];
    let offset = 0;

    while (true) {
        const url = new URL(endpoint, window.location.origin);
        url.searchParams.set("limit", String(pageSize));
        url.searchParams.set("offset", String(offset));
        const response = await fetch(`${url.pathname}${url.search}`, options);
        const page = await response.json().catch(() => ([]));
        if (!response.ok) {
            throw new Error(page.detail || `Request failed with status ${response.status}.`);
        }
        if (!Array.isArray(page)) {
            throw new Error("The server returned an invalid paginated response.");
        }
        items.push(...page);
        if (page.length < pageSize) return items;
        offset += page.length;
        if (offset >= 100000) {
            throw new Error("The result set is too large to load safely.");
        }
    }
}
// ==========================================
// LOGOUT
// ==========================================

async function logoutUser() {

    await fetch("/api/logout", {
        method: "POST"
    });

}
// ==========================================
// FETCH DASHBOARD
// ==========================================

async function getDashboardData() {

    try {

        const response = await fetch(API.dashboard);

        return await response.json();

    }

    catch (error) {

        console.error(error);

        return null;

    }

}
