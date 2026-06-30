// ==========================================
// API URL
// ==========================================

const API = {

    dashboard: "/api/dashboard/v2"

};
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