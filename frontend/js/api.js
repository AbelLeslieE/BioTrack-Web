/* ==========================================
   BIOTRACK API
========================================== */

const API_BASE = "";

/* ==========================================
   GENERIC REQUEST
========================================== */

async function apiRequest(endpoint, options = {}) {

    try {

        const response = await fetch(API_BASE + endpoint, {
            headers: {
                "Content-Type": "application/json"
            },
            ...options
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        return await response.json();

    } catch (error) {

        console.error(error);

        throw error;

    }

}

/* ==========================================
   REPORTS API
========================================== */

export async function getReportsSummary() {

    return apiRequest("/api/reports/summary");

}

export async function getMaintenanceTrend() {

    return apiRequest("/api/reports/maintenance-trend");

}

export async function getDepartmentSummary() {

    return apiRequest("/api/reports/departments");

}

export async function getStatusSummary() {

    return apiRequest("/api/reports/status");

}

export async function getDowntimeTrend() {

    return apiRequest("/api/reports/downtime");

}

export async function getReportTable() {

    return apiRequest("/api/reports/table");

}