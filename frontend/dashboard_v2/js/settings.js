/* ==========================================================
   BIOTRACK SETTINGS
   PART 3A
========================================================== */
function initSettings() {
    initializeProfilePhoto();

    initializeProfileEditor();

    initializeNotificationSwitches();

    initializeSecurity();

    initializePreferences();

    initializeBackup();

    loadProfileData();

    loadSavedPreferences();

    initializeSmoothButtons();

    initializeButtonEffects();

    initializeCardEffects();

    initializeKeyboardShortcuts();

    showToast(
        "Settings",
        "Settings page loaded successfully.",
        "fa-circle-check"
    );

}
/* ==========================================================
   LOAD PROFILE DATA
========================================================== */

async function loadProfileData() {

    const username =
        localStorage.getItem("username") || "Administrator";

    const role =
        localStorage.getItem("role") || "Administrator";

    const email =
        localStorage.getItem("email") || "admin@biotrack.com";

    const department =
        localStorage.getItem("department") || "Not assigned";

    let profile = { username, name: localStorage.getItem("name") || username, role, email, department };
    try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (response.ok) profile = await response.json();
    } catch (error) {
        console.warn("Unable to refresh profile data", error);
    }

    const fullName =
        document.getElementById("settingsFullName");

    const emailText =
        document.getElementById("settingsEmail");

    const roleText =
        document.getElementById("settingsRole");

    const employee =
        document.getElementById("settingsEmployeeId");

    if(fullName) fullName.textContent = profile.name || profile.username || username;

    if(emailText) emailText.textContent = profile.email || "Not provided";

    if(roleText) roleText.textContent = profile.role || role;

    if(employee) employee.textContent = profile.department || department;

}

function initializeProfileEditor() {
    const button = document.getElementById("editProfileBtn");
    if (!button) return;

    button.addEventListener("click", async () => {
        let profile;
        try {
            const response = await fetch("/api/auth/me", { cache: "no-store" });
            if (!response.ok) throw new Error("Unable to load your profile.");
            profile = await response.json();
        } catch (error) {
            showToast("Profile", error.message, "fa-circle-exclamation");
            return;
        }

        const overlay = document.createElement("div");
        overlay.className = "profile-edit-overlay";
        overlay.innerHTML = `
            <form class="profile-edit-dialog" id="profileEditForm">
                <div class="profile-edit-header"><div><h2>Edit profile</h2><p>Update your contact information.</p></div><button type="button" class="profile-edit-close" aria-label="Close">×</button></div>
                <label>Full name<input id="profileEditName" required maxlength="120" value="${escapeHTML(profile.name || "")}"></label>
                <label>Email address<input id="profileEditEmail" type="email" required value="${escapeHTML(profile.email || "")}"></label>
                <label>Phone<input id="profileEditPhone" maxlength="30" value="${escapeHTML(profile.phone || "")}"></label>
                <div class="profile-edit-actions"><button type="button" class="secondary-btn profile-edit-cancel">Cancel</button><button type="submit" class="primary-btn">Save profile</button></div>
            </form>`;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.querySelector(".profile-edit-close").onclick = close;
        overlay.querySelector(".profile-edit-cancel").onclick = close;
        overlay.addEventListener("click", event => { if (event.target === overlay) close(); });
        overlay.querySelector("#profileEditForm").onsubmit = async event => {
            event.preventDefault();
            const saveButton = event.submitter;
            saveButton.disabled = true;
            try {
                const response = await fetch("/api/auth/profile", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: overlay.querySelector("#profileEditName").value.trim(),
                        email: overlay.querySelector("#profileEditEmail").value.trim(),
                        phone: overlay.querySelector("#profileEditPhone").value.trim(),
                    }),
                });
                const result = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(result.detail || "Unable to save your profile.");
                localStorage.setItem("name", result.name);
                localStorage.setItem("email", result.email);
                const topUsername = document.getElementById("topUsername");
                if (topUsername) topUsername.textContent = result.name;
                close();
                await loadProfileData();
                showToast("Profile updated", "Your changes were saved.", "fa-circle-check");
            } catch (error) {
                showToast("Profile", error.message, "fa-circle-exclamation");
                saveButton.disabled = false;
            }
        };
        overlay.querySelector("#profileEditName").focus();
    });
}

/* ==========================================================
   PROFILE IMAGE
========================================================== */

function initializeProfilePhoto() {

    const uploadInput = document.getElementById("profileUpload");

    const preview = document.getElementById("profilePreview");

    const cameraButton = document.getElementById("changePhoto");

    if (!uploadInput || !preview || !cameraButton) return;

    const photoKey = `biotrack-profile-photo:${localStorage.getItem("username") || "user"}`;
    const savedPhoto = localStorage.getItem(photoKey);
    if (savedPhoto) {
        preview.src = savedPhoto;
        applyProfilePhotoToTopbar(savedPhoto);
    }

    cameraButton.addEventListener("click", () => {

        uploadInput.click();

    });

    uploadInput.addEventListener("change", event => {

        const file = event.target.files[0];

        if (!file) return;

        if (!file.type.startsWith("image/")) {

            showToast(

                "Invalid File",

                "Please select an image.",

                "fa-circle-exclamation"

            );

            return;

        }

        if (file.size > 1500000) {
            showToast("Image Too Large", "Choose a profile image smaller than 1.5 MB.", "fa-circle-exclamation");
            uploadInput.value = "";
            return;
        }

        const reader = new FileReader();

        reader.onload = e => {

            preview.src = e.target.result;

            try {
                localStorage.setItem(photoKey, e.target.result);
                applyProfilePhotoToTopbar(e.target.result);
            } catch (error) {
                showToast("Profile Photo", "The image could not be stored in this browser.", "fa-circle-exclamation");
                return;
            }

            showToast(

                "Profile Updated",

                "Your profile picture has been changed.",

                "fa-circle-check"

            );

        };

        reader.readAsDataURL(file);

    });

}

function applyProfilePhotoToTopbar(source) {
    const avatar = document.getElementById("topAvatar");
    const sidebarAvatar = document.getElementById("sidebarAvatar");
    [avatar, sidebarAvatar].forEach(element => {
        if (!element) return;
        element.style.backgroundImage = `url("${source}")`;
        element.style.backgroundPosition = "center";
        element.style.backgroundSize = "cover";
        element.textContent = "";
    });
}

/* ==========================================================
   BUTTON SCROLL EFFECT
========================================================== */

function initializeSmoothButtons() {

    document.querySelectorAll(".primary-btn, .secondary-btn").forEach(button => {

        button.addEventListener("click", createRipple);

    });

}

/* ==========================================================
   RIPPLE EFFECT
========================================================== */

function createRipple(event) {

    const button = event.currentTarget;

    const ripple = document.createElement("span");

    const size = Math.max(button.clientWidth, button.clientHeight);

    const rect = button.getBoundingClientRect();

    ripple.className = "ripple";

    ripple.style.width = size + "px";

    ripple.style.height = size + "px";

    ripple.style.left = event.clientX - rect.left - size / 2 + "px";

    ripple.style.top = event.clientY - rect.top - size / 2 + "px";

    button.appendChild(ripple);

    setTimeout(() => {

        ripple.remove();

    }, 600);

}
 

/* ==========================================================
   NOTIFICATION SWITCHES
========================================================== */

function initializeNotificationSwitches() {

    const switches = document.querySelectorAll(
        "#inAppNotification, #desktopNotification, #requestUpdates, #pmReminder"
    );

    const saved = JSON.parse(localStorage.getItem("biotrack-notifications") || "{}");

    switches.forEach(toggle => {

        if (typeof saved[toggle.id] === "boolean") toggle.checked = saved[toggle.id];

        toggle.addEventListener("change", async function () {

            if (this.id === "desktopNotification" && this.checked && "Notification" in window) {
                const permission = await Notification.requestPermission();
                if (permission !== "granted") this.checked = false;
            }

            const title = getSettingName(this.id);

            const status = this.checked ? "Enabled" : "Disabled";

            showToast(
                title,
                `${title} ${status}.`,
                this.checked
                    ? "fa-circle-check"
                    : "fa-circle-minus"
            );

        });

    });

    const saveButton = document.getElementById("saveNotificationSettings");
    if (saveButton) {
        saveButton.addEventListener("click", () => {
            const preferences = {};
            switches.forEach(toggle => { preferences[toggle.id] = toggle.checked; });
            localStorage.setItem("biotrack-notifications", JSON.stringify(preferences));
            document.dispatchEvent(new CustomEvent("biotrack:notification-preferences-changed", { detail: preferences }));
            showToast("Notifications", "Notification preferences saved.", "fa-circle-check");
        });
    }

}

function getSettingName(id) {

    switch (id) {

        case "inAppNotification":
            return "In-app Notifications";

        case "desktopNotification":
            return "Desktop Notifications";

        case "requestUpdates":
            return "Request Updates";

        case "pmReminder":
            return "Preventive Maintenance Reminder";

        default:
            return "Setting";

    }

}

/* ==========================================================
   SYSTEM PREFERENCES
========================================================== */

function initializePreferences() {

    const theme = document.getElementById("themeSelect");
    const density = document.getElementById("densitySelect");
    const date = document.getElementById("dateFormat");
    const time = document.getElementById("timeFormat");

    if (theme) theme.addEventListener("change", () => saveSystemPreference("biotrack-theme", theme.value, "Theme", `${theme.options[theme.selectedIndex].text} theme applied.`));

    if (density) density.addEventListener("change", () => saveSystemPreference("biotrack-density", density.value, "Interface Density", `${density.options[density.selectedIndex].text} spacing applied.`));

    if (date) {

        date.addEventListener("change", () => saveSystemPreference("dateFormat", date.value, "Date Format", `${date.value} selected.`));

    }

    if (time) {

        time.addEventListener("change", () => saveSystemPreference("timeFormat", time.value, "Time Format", `${time.value} selected.`));

    }

}

function saveSystemPreference(key, value, title, message) {
    localStorage.setItem(key, value);
    window.applyBioTrackPreferences?.();
    document.dispatchEvent(new CustomEvent("biotrack:preferences-changed"));
    showToast(title, message, "fa-circle-check");
}

/* ==========================================================
   SECURITY
========================================================== */

function initializeSecurity() {

    const changePassword =
        document.getElementById("changePassword");

    const sessions =
        document.getElementById("viewSessions");

    if (changePassword) {

        changePassword.addEventListener("click", openPasswordModal);

    }

    if (sessions) {

        sessions.addEventListener("click", openSessionDialog);

    }

}

async function openSessionDialog() {
    const button = document.getElementById("viewSessions");
    if (button) button.disabled = true;
    try {
        const response = await fetch("/api/settings/session", { cache: "no-store" });
        const session = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(session.detail || "Unable to load the current session.");
        const overlay = document.createElement("div");
        overlay.className = "profile-edit-overlay";
        overlay.innerHTML = `
            <section class="profile-edit-dialog session-dialog" role="dialog" aria-modal="true" aria-labelledby="sessionDialogTitle">
                <div class="profile-edit-header"><div><h2 id="sessionDialogTitle">Current session</h2><p>This is the browser currently signed in to BioTrack.</p></div><button type="button" class="profile-edit-close" aria-label="Close">×</button></div>
                <div class="session-details">
                    <div><span>Account</span><strong id="sessionAccount"></strong></div>
                    <div><span>Device</span><strong id="sessionDevice"></strong></div>
                    <div><span>Network address</span><strong id="sessionIp"></strong></div>
                    <div><span>Signed in</span><strong id="sessionIssued"></strong></div>
                    <div><span>Expires</span><strong id="sessionExpires"></strong></div>
                </div>
                <div class="profile-edit-actions"><button type="button" class="secondary-btn session-close">Close</button><button type="button" class="danger-btn session-logout"><i data-lucide="log-out"></i> Sign out this device</button></div>
            </section>`;
        document.body.appendChild(overlay);
        overlay.querySelector("#sessionAccount").textContent = `${session.username} · ${session.role}`;
        overlay.querySelector("#sessionDevice").textContent = friendlyBrowserName(session.user_agent);
        overlay.querySelector("#sessionIp").textContent = session.ip_address || "Unknown";
        overlay.querySelector("#sessionIssued").textContent = formatSettingsTimestamp(session.issued_at);
        overlay.querySelector("#sessionExpires").textContent = formatSettingsTimestamp(session.expires_at);
        const close = () => overlay.remove();
        overlay.querySelector(".profile-edit-close").onclick = close;
        overlay.querySelector(".session-close").onclick = close;
        overlay.addEventListener("click", event => { if (event.target === overlay) close(); });
        overlay.querySelector(".session-logout").onclick = () => document.querySelector(".logout-btn")?.click();
        if (window.lucide) window.lucide.createIcons();
    } catch (error) {
        showToast("Current Session", error.message, "fa-circle-exclamation");
    } finally {
        if (button) button.disabled = false;
    }
}

function friendlyBrowserName(userAgent) {
    const value = String(userAgent || "");
    if (/Edg\//.test(value)) return "Microsoft Edge on this device";
    if (/Chrome\//.test(value)) return "Google Chrome on this device";
    if (/Firefox\//.test(value)) return "Mozilla Firefox on this device";
    if (/Safari\//.test(value)) return "Safari on this device";
    return "Current browser";
}

function formatSettingsTimestamp(value) {
    if (!value) return "Not available";
    const timestamp = new Date(value);
    return Number.isNaN(timestamp.getTime()) ? "Not available" : timestamp.toLocaleString();
}

function openPasswordModal() {
    const modal = document.getElementById("passwordModal");
    if (!modal) return;
    modal.hidden = false;
    document.getElementById("currentPassword")?.focus();

    document.getElementById("closePasswordModal").onclick = closePasswordModal;
    document.getElementById("cancelPasswordChange").onclick = closePasswordModal;
    document.getElementById("savePasswordChange").onclick = submitPasswordChange;
}

function closePasswordModal() {
    const modal = document.getElementById("passwordModal");
    if (!modal) return;
    modal.hidden = true;
    ["currentPassword", "newPassword", "confirmPassword"].forEach(id => {
        const field = document.getElementById(id);
        if (field) field.value = "";
    });
}

async function submitPasswordChange() {
    const currentPassword = document.getElementById("currentPassword")?.value || "";
    const newPassword = document.getElementById("newPassword")?.value || "";
    const confirmPassword = document.getElementById("confirmPassword")?.value || "";

    if (newPassword.length < 12) {
        showToast("Password", "Use at least 12 characters.", "fa-circle-exclamation");
        return;
    }
    if (newPassword !== confirmPassword) {
        showToast("Password", "The new passwords do not match.", "fa-circle-exclamation");
        return;
    }

    if (!currentPassword) {
        showToast("Password", "Enter your current password.", "fa-circle-exclamation");
        return;
    }
    const saveButton = document.getElementById("savePasswordChange");
    if (saveButton) saveButton.disabled = true;
    try {
        const response = await fetch("/api/auth/change-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "Unable to change password.");
        closePasswordModal();
        showToast("Password", "Password changed successfully.", "fa-circle-check");
    } catch (error) {
        showToast("Password", error.message, "fa-circle-exclamation");
    } finally {
        if (saveButton) saveButton.disabled = false;
    }
}

/* ==========================================================
   TOAST NOTIFICATION
========================================================== */

function showToast(title, message, icon) {
    const type = icon === "fa-circle-exclamation" ? "error" : "success";
    BioTrackToast.show({ title, message, type });
}


/* ==========================================================
   BACKUP & EXPORT
========================================================== */

function initializeBackup() {

    const backupBtn = document.getElementById("backupNow");
    const exportBtn = document.getElementById("exportData");

    if (backupBtn) {

        backupBtn.addEventListener("click", () => downloadSettingsFile(backupBtn, "/api/settings/backup", "Creating backup…", "Backup Complete", "Your scoped BioTrack backup was downloaded."));

    }

    if (exportBtn) {

        exportBtn.addEventListener("click", () => downloadSettingsFile(exportBtn, "/api/settings/export", "Preparing export…", "Export Complete", "Maintenance data was downloaded as CSV."));

    }

}

async function downloadSettingsFile(button, url, busyLabel, successTitle, successMessage) {
    const original = button.innerHTML;
    button.disabled = true;
    button.textContent = busyLabel;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || "The download could not be prepared.");
        }
        const blob = await response.blob();
        const disposition = response.headers.get("Content-Disposition") || "";
        const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || "biotrack-download";
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
        showToast(successTitle, successMessage, "fa-circle-check");
    } catch (error) {
        showToast("Download Failed", error.message, "fa-circle-exclamation");
    } finally {
        button.disabled = false;
        button.innerHTML = original;
        if (window.lucide) window.lucide.createIcons();
    }
}

/* ==========================================================
   THEME
========================================================== */

function initializeTheme() {

    const selector = document.getElementById("themeSelect");

    if (!selector) return;

    selector.addEventListener("change", () => {

        localStorage.setItem("biotrack-theme", selector.value);

        applyTheme(selector.value);

    });

}

function applyTheme(theme) {

    document.body.classList.remove("dark-theme");

    if (theme === "dark") {

        document.body.classList.add("dark-theme");

    }

    showToast(
        "Theme Updated",
        `${theme} theme applied.`,
        "fa-palette"
    );

}

/* ==========================================================
   SAVE PREFERENCES
========================================================== */

function loadSavedPreferences() {

    const theme = localStorage.getItem("biotrack-theme");

    if (theme) {

        const selector = document.getElementById("themeSelect");

        if (selector) {

            selector.value = theme;

            window.applyBioTrackPreferences?.();

        }

    }

    const density = localStorage.getItem("biotrack-density");
    const densitySelector = document.getElementById("densitySelect");
    if (density && densitySelector) densitySelector.value = density;

    ["dateFormat", "timeFormat"].forEach(id => {
        const element = document.getElementById(id);
        const saved = localStorage.getItem(id);
        if (element && saved) element.value = saved;
    });

}

function saveDropdown(id) {

    const element = document.getElementById(id);

    if (!element) return;

    const saved = localStorage.getItem(id);

    if (saved) {

        element.value = saved;

    }

    element.addEventListener("change", () => {

        localStorage.setItem(id, element.value);

    });

}

/* ==========================================================
   GLOBAL BUTTON EFFECT
========================================================== */

/* ==========================================================
   BUTTON EFFECTS
========================================================== */

function initializeButtonEffects() {

    if (window.settingsButtonEffectsBound) return;
    window.settingsButtonEffectsBound = true;

    document.addEventListener("click", function (event) {

        const button = event.target.closest("button");

        if (!button) return;

        button.style.transform = "scale(.97)";

        setTimeout(() => {

            button.style.transform = "";

        }, 120);

    });

}

/* ==========================================================
   CARD HOVER EFFECT
========================================================== */

function initializeCardEffects(){

    document.querySelectorAll(".settings-card")
        .forEach(card=>{

            card.style.transition=".3s ease";

        });

}

/* ==========================================================
   KEYBOARD SHORTCUTS
========================================================== */

function initializeKeyboardShortcuts(){

    if (window.settingsKeyboardShortcutsBound) return;
    window.settingsKeyboardShortcutsBound = true;

    document.addEventListener("keydown", event => {

        if (!document.querySelector(".settings-page")) return;

        if(event.ctrlKey &&
           event.key.toLowerCase()==="s"){

            event.preventDefault();

            showToast(
                "Settings Saved",
                "Your preferences have been saved.",
                "fa-floppy-disk"
            );

        }

    });

}

/* ==========================================================
   FINAL INITIALIZATION
========================================================== */

console.log(
    "%cBioTrack Settings Module Loaded",
    "color:#2563eb;font-size:16px;font-weight:bold;"
);

console.log("Version : 1.0.0");

console.log("Status  : Ready");

 
