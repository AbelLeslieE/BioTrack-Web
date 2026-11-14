// Google Calendar connection and manual PM schedule synchronization.
function initializeGoogleCalendar() {
    const root = document.getElementById("pmGoogleCalendar");
    if (!root) return;
    document.getElementById("pmGoogleConnectButton")?.addEventListener("click", () => {
        window.location.href = "/api/google-calendar/connect";
    });
    document.getElementById("pmGoogleSyncButton")?.addEventListener("click", syncPMSchedulesToGoogle);
    document.getElementById("pmGoogleDisconnectButton")?.addEventListener("click", disconnectGoogleCalendar);
    showGoogleCalendarCallbackMessage();
    loadGoogleCalendarStatus();
}

async function loadGoogleCalendarStatus() {
    const status = document.getElementById("pmGoogleCalendarStatus");
    if (!status) return;
    try {
        const response = await fetch("/api/google-calendar/status", { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || "Could not check Google Calendar status.");
        const connect = document.getElementById("pmGoogleConnectButton");
        const sync = document.getElementById("pmGoogleSyncButton");
        const disconnect = document.getElementById("pmGoogleDisconnectButton");
        if (!result.configured) {
            status.textContent = "Google Calendar needs server setup";
            status.title = "Set the Google OAuth client ID, client secret, callback URL, and token encryption key in the server environment.";
            connect.hidden = true;
            sync.hidden = true;
            disconnect.hidden = true;
            return;
        }
        if (result.connected) {
            status.textContent = `Connected · ${result.email}`;
            status.classList.add("is-connected");
            sync.hidden = false;
            disconnect.hidden = false;
            connect.hidden = true;
        } else {
            status.textContent = "Google Calendar not connected";
            connect.hidden = false;
            sync.hidden = true;
            disconnect.hidden = true;
        }
    } catch (error) {
        status.textContent = error.message;
    }
}

async function syncPMSchedulesToGoogle() {
    const button = document.getElementById("pmGoogleSyncButton");
    const status = document.getElementById("pmGoogleCalendarStatus");
    if (!button) return;
    button.disabled = true;
    button.textContent = "Syncing…";
    try {
        const response = await fetch("/api/google-calendar/sync", { method: "POST" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || "Could not sync PM schedules.");
        status.textContent = `${result.created} added · ${result.updated} updated`;
        status.title = result.errors?.length ? result.errors.map(item => `PM #${item.schedule_id}: ${item.message}`).join("\n") : "All schedules synced to your primary calendar.";
        if (result.errors?.length) {
            alert(`${result.created} added and ${result.updated} updated. ${result.errors.length} schedule${result.errors.length === 1 ? "" : "s"} could not be synced. See the status details for more information.`);
        }
    } catch (error) {
        status.textContent = error.message;
        alert(error.message);
    } finally {
        button.disabled = false;
        button.textContent = "Sync schedules";
    }
}

async function disconnectGoogleCalendar() {
    if (!window.confirm("Disconnect Google Calendar? Existing calendar events will be kept.")) return;
    const response = await fetch("/api/google-calendar/disconnect", { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) {
        alert(result.detail || "Could not disconnect Google Calendar.");
        return;
    }
    await loadGoogleCalendarStatus();
}

function showGoogleCalendarCallbackMessage() {
    const url = new URL(window.location.href);
    const state = url.searchParams.get("googleCalendar");
    if (!state) return;
    if (state === "connected") {
        if (typeof showSuccess === "function") {
            showSuccess({ title: "Google Calendar connected", message: "Your PM schedule can now be synced to your primary calendar.", buttonText: "Continue" });
        }
    } else if (state === "cancelled") {
        alert("Google Calendar connection was cancelled.");
    }
    url.searchParams.delete("googleCalendar");
    window.history.replaceState({}, "", url);
}

window.initializeGoogleCalendar = initializeGoogleCalendar;
