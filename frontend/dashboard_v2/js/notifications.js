(function () {
    "use strict";

    const REFRESH_INTERVAL = 60000;
    const READ_STORAGE_KEY = "biotrack-notification-read";
    const SEEN_STORAGE_KEY = "biotrack-notification-seen";
    const PREFERENCE_KEY = "biotrack-notifications";
    const iconByKind = {
        "critical-call": "siren",
        stock: "package-x",
        maintenance: "calendar-clock",
        asset: "monitor-x",
        request: "clipboard-list",
    };
    let notifications = [];
    let refreshTimer = null;
    let firstLoadComplete = false;

    function userStorageKey(base) {
        return `${base}:${localStorage.getItem("username") || "anonymous"}`;
    }

    function readStoredSet(key) {
        try {
            const values = JSON.parse(localStorage.getItem(userStorageKey(key)) || "[]");
            return new Set(Array.isArray(values) ? values : []);
        } catch (error) {
            console.warn("Unable to read notification state:", error);
            return new Set();
        }
    }

    function storeSet(key, values) {
        localStorage.setItem(userStorageKey(key), JSON.stringify([...values].slice(-250)));
    }

    function getPreferences() {
        try {
            return {
                inAppNotification: true,
                desktopNotification: false,
                requestUpdates: true,
                pmReminder: true,
                ...JSON.parse(localStorage.getItem(PREFERENCE_KEY) || "{}"),
            };
        } catch (error) {
            return { desktopNotification: false, requestUpdates: true, pmReminder: true };
        }
    }

    function isEnabledForPreference(item, preferences) {
        if (item.kind === "request") return preferences.requestUpdates !== false;
        if (item.kind === "maintenance") return preferences.pmReminder !== false;
        return true;
    }

    function activeNotifications() {
        const preferences = getPreferences();
        if (preferences.inAppNotification === false) return [];
        return notifications.filter(item => isEnabledForPreference(item, preferences));
    }

    function unreadNotifications() {
        const read = readStoredSet(READ_STORAGE_KEY);
        return activeNotifications().filter(item => !read.has(item.id));
    }

    function updateBadge() {
        const badge = document.getElementById("notificationBadge");
        const button = document.querySelector(".notification-btn");
        if (!badge || !button) return;
        const count = unreadNotifications().length;
        badge.textContent = count > 99 ? "99+" : String(count);
        badge.hidden = count === 0;
        button.setAttribute("aria-label", count ? `Open notifications, ${count} unread` : "Open notifications");
    }

    async function fetchNotifications({ allowDesktop = true } = {}) {
        try {
            const response = await fetch("/api/notifications", { headers: { Accept: "application/json" } });
            if (!response.ok) throw new Error(`Notification feed failed (${response.status})`);
            const payload = await response.json();
            notifications = Array.isArray(payload.items) ? payload.items : [];
            updateBadge();
            if (allowDesktop) await notifyNewItems();
            document.dispatchEvent(new CustomEvent("biotrack:notifications-updated", { detail: { items: notifications } }));
            return notifications;
        } catch (error) {
            console.error("Unable to refresh notifications:", error);
            return notifications;
        } finally {
            firstLoadComplete = true;
        }
    }

    async function notifyNewItems() {
        const currentIds = new Set(notifications.map(item => item.id));
        const seen = readStoredSet(SEEN_STORAGE_KEY);
        if (!firstLoadComplete && seen.size === 0) {
            storeSet(SEEN_STORAGE_KEY, currentIds);
            return;
        }
        const preferences = getPreferences();
        if (!preferences.desktopNotification || !("Notification" in window) || Notification.permission !== "granted") {
            storeSet(SEEN_STORAGE_KEY, new Set([...seen, ...currentIds]));
            return;
        }
        const newItems = notifications.filter(item => !seen.has(item.id) && isEnabledForPreference(item, preferences));
        for (const item of newItems.slice(0, 3)) {
            await showSystemNotification(item.title, item.message, item.page, item.id);
        }
        storeSet(SEEN_STORAGE_KEY, new Set([...seen, ...currentIds]));
    }

    async function showSystemNotification(title, body, page = "", tag = "biotrack") {
        const options = {
            body,
            icon: "/static/assets/icons/biotrack-192.png",
            badge: "/static/assets/icons/biotrack-192.png",
            tag: `biotrack-${tag}`,
            renotify: true,
            data: { page },
        };
        try {
            if ("serviceWorker" in navigator) {
                const registration = await navigator.serviceWorker.ready;
                await registration.showNotification(title, options);
            } else {
                new Notification(title, options);
            }
        } catch (error) {
            console.warn("Unable to display desktop notification:", error);
        }
    }

    async function enableDesktopNotifications() {
        if (!("Notification" in window)) return { enabled: false, message: "This browser does not support desktop notifications." };
        const permission = await Notification.requestPermission();
        const preferences = getPreferences();
        preferences.desktopNotification = permission === "granted";
        localStorage.setItem(PREFERENCE_KEY, JSON.stringify(preferences));
        if (permission === "granted") {
            await showSystemNotification("BioTrack notifications enabled", "You will receive operational alerts while BioTrack is running.", "dashboard", "enabled");
            return { enabled: true, message: "Desktop alerts are enabled." };
        }
        return { enabled: false, message: "Notification permission was not granted." };
    }

    function markRead(id) {
        const read = readStoredSet(READ_STORAGE_KEY);
        read.add(id);
        storeSet(READ_STORAGE_KEY, read);
        updateBadge();
    }

    function markAllRead() {
        const read = readStoredSet(READ_STORAGE_KEY);
        activeNotifications().forEach(item => read.add(item.id));
        storeSet(READ_STORAGE_KEY, read);
        updateBadge();
    }

    function formatRelativeTime(value) {
        const timestamp = new Date(value).getTime();
        if (!Number.isFinite(timestamp)) return "Recently";
        const elapsed = Math.max(Date.now() - timestamp, 0);
        const minutes = Math.floor(elapsed / 60000);
        if (minutes < 1) return "Just now";
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }

    async function renderPanel(panel) {
        await fetchNotifications({ allowDesktop: false });
        panel.replaceChildren();
        panel.classList.add("is-notification-center");

        const read = readStoredSet(READ_STORAGE_KEY);
        const items = activeNotifications();
        const header = document.createElement("div");
        header.className = "notification-center-header";
        const heading = document.createElement("div");
        heading.innerHTML = "<strong>Notifications</strong><span>Live hospital operations</span>";
        const markButton = document.createElement("button");
        markButton.type = "button";
        markButton.textContent = "Mark all read";
        markButton.disabled = !items.some(item => !read.has(item.id));
        markButton.addEventListener("click", () => {
            markAllRead();
            renderPanel(panel);
        });
        header.append(heading, markButton);
        panel.appendChild(header);

        const preferences = getPreferences();
        if (!preferences.desktopNotification || !("Notification" in window) || Notification.permission !== "granted") {
            const permissionCard = document.createElement("div");
            permissionCard.className = "notification-permission-card";
            permissionCard.innerHTML = '<span><i data-lucide="bell-ring"></i></span><div><strong>Receive desktop alerts</strong><p>Get critical calls, stock and maintenance alerts without keeping this panel open.</p></div>';
            const enableButton = document.createElement("button");
            enableButton.type = "button";
            enableButton.textContent = "Enable";
            enableButton.addEventListener("click", async () => {
                enableButton.disabled = true;
                const result = await enableDesktopNotifications();
                permissionCard.querySelector("p").textContent = result.message;
                if (result.enabled) setTimeout(() => renderPanel(panel), 700);
                else enableButton.disabled = false;
            });
            permissionCard.appendChild(enableButton);
            panel.appendChild(permissionCard);
        }

        const list = document.createElement("div");
        list.className = "notification-center-list";
        if (!items.length) {
            list.innerHTML = '<div class="notification-center-empty"><i data-lucide="circle-check-big"></i><strong>You are all caught up</strong><p>No calls, stock alerts or maintenance reminders need attention.</p></div>';
        } else {
            items.forEach(item => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = `notification-center-item is-${item.priority || "info"}${read.has(item.id) ? " is-read" : ""}`;
                button.innerHTML = `<span class="notification-center-icon"><i data-lucide="${iconByKind[item.kind] || "bell"}"></i></span><span class="notification-center-copy"><strong></strong><small></small><time></time></span><span class="notification-center-dot" aria-label="Unread"></span>`;
                button.querySelector("strong").textContent = item.title;
                button.querySelector("small").textContent = item.message;
                button.querySelector("time").textContent = formatRelativeTime(item.created_at);
                button.addEventListener("click", () => {
                    markRead(item.id);
                    panel.hidden = true;
                    document.querySelector(".notification-btn")?.setAttribute("aria-expanded", "false");
                    if (item.page && typeof window.navigate === "function") window.navigate(item.page);
                });
                list.appendChild(button);
            });
        }
        panel.appendChild(list);

        const footer = document.createElement("div");
        footer.className = "notification-center-footer";
        footer.innerHTML = '<span><i data-lucide="refresh-cw"></i> Updates every minute</span>';
        const settingsButton = document.createElement("button");
        settingsButton.type = "button";
        settingsButton.textContent = "Notification settings";
        settingsButton.addEventListener("click", () => {
            panel.hidden = true;
            window.navigate?.("settings");
            setTimeout(() => document.getElementById("notifications")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
        });
        footer.appendChild(settingsButton);
        panel.appendChild(footer);
        if (window.lucide) window.lucide.createIcons();
    }

    function start() {
        fetchNotifications();
        clearInterval(refreshTimer);
        refreshTimer = setInterval(() => fetchNotifications(), REFRESH_INTERVAL);
    }

    document.addEventListener("DOMContentLoaded", start);
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) fetchNotifications();
    });
    document.addEventListener("biotrack:notification-preferences-changed", () => {
        updateBadge();
        fetchNotifications({ allowDesktop: false });
    });
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.addEventListener("message", event => {
            if (event.data?.type === "BIOTRACK_NAVIGATE" && event.data.page) window.navigate?.(event.data.page);
        });
    }

    window.BioTrackNotifications = {
        fetch: fetchNotifications,
        renderPanel,
        enableDesktopNotifications,
        markAllRead,
        updateBadge,
        getItems: () => [...notifications],
    };
}());
