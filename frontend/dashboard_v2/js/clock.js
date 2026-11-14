// ==========================================
// BIOTRACK V2 CLOCK
// ==========================================

function updateClock() {

    const now = new Date();

    const date = `${now.toLocaleDateString("en-IN", { weekday: "long" })}, ${formatPreferredDate(now)}`;
    const time = now.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: (localStorage.getItem("timeFormat") || "24 Hour") === "12 Hour",
    });

    const currentDate = document.getElementById("currentDate");
    const currentTime = document.getElementById("currentTime");

    // Prevent errors on pages that don't have a clock
    if (currentDate) {
        currentDate.textContent = date;
    }

    if (currentTime) {
        currentTime.textContent = time;
    }

}

function formatPreferredDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const format = localStorage.getItem("dateFormat") || "DD/MM/YYYY";
    if (format === "MM/DD/YYYY") return `${month}/${day}/${year}`;
    if (format === "YYYY-MM-DD") return `${year}-${month}-${day}`;
    return `${day}/${month}/${year}`;
}

updateClock();

setInterval(updateClock, 1000);


/* ==========================================
   DATE & TIME FORMATTERS
========================================== */

/**
 * Example:
 * 14 Jul 2026, 07:56 PM
 */
function formatDateTime(dateString) {

    if (!dateString) return "-";

    const date = new Date(dateString);

    return `${formatPreferredDate(date)}, ${date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: (localStorage.getItem("timeFormat") || "24 Hour") === "12 Hour",
    })}`;

}


/**
 * Example:
 * 14 Jul 2026
 */
function formatDate(dateString) {

    if (!dateString) return "-";

    const date = new Date(dateString);

    return formatPreferredDate(date);

}


/**
 * Example:
 * 07:56 PM
 */
function formatTime(dateString) {

    if (!dateString) return "-";

    const date = new Date(dateString);

    return date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: (localStorage.getItem("timeFormat") || "24 Hour") === "12 Hour",
    });

}

document.addEventListener("biotrack:preferences-changed", updateClock);
