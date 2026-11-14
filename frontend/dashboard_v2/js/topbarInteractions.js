// Functional top-bar search, alerts and account menu.
document.addEventListener("DOMContentLoaded", () => {
    const search = document.getElementById("globalNavigationSearch");
    const notification = document.querySelector(".notification-btn");
    const profile = document.querySelector(".profile-button");
    if (!search || !notification || !profile) return;

    const makePopup = (className, label) => {
        const popup = document.createElement("div");
        popup.className = `topbar-popover ${className}`;
        popup.setAttribute("role", "menu");
        popup.setAttribute("aria-label", label);
        popup.hidden = true;
        document.body.appendChild(popup);
        return popup;
    };
    const searchResults = makePopup("topbar-search-results", "Search results");
    const accountMenu = makePopup("topbar-account-menu", "Account menu");
    const alertsPanel = makePopup("topbar-alerts-panel", "Dashboard alerts");
    let activePopup = null;

    const positionPopup = (popup, anchor, alignRight = false) => {
        const rect = anchor.getBoundingClientRect();
        popup.style.top = `${rect.bottom + window.scrollY + 8}px`;
        popup.style.left = alignRight ? "auto" : `${rect.left + window.scrollX}px`;
        popup.style.right = alignRight ? `${window.innerWidth - rect.right - window.scrollX}px` : "auto";
    };
    const closePopups = () => {
        [searchResults, accountMenu, alertsPanel].forEach(popup => { popup.hidden = true; });
        profile.setAttribute("aria-expanded", "false");
        notification.setAttribute("aria-expanded", "false");
        activePopup = null;
    };
    const openPopup = (popup, anchor, alignRight = false) => {
        closePopups();
        popup.hidden = false;
        positionPopup(popup, anchor, alignRight);
        activePopup = popup;
    };
    const addMenuAction = (popup, label, action, iconName) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "topbar-popover-action";
        button.setAttribute("role", "menuitem");
        const icon = document.createElement("i");
        icon.dataset.lucide = iconName;
        const text = document.createElement("span");
        text.textContent = label;
        button.append(icon, text);
        button.addEventListener("click", () => { closePopups(); action(); });
        popup.appendChild(button);
    };
    const homePage = () => {
        const role = (localStorage.getItem("role") || "").toLowerCase();
        return ({ manager: "dashboard", admin: "dashboard", bme: "engineerDashboard", engineer: "engineerDashboard", electrical: "electricalDashboard", it: "itDashboard", user: "userDashboard" })[role] || "dashboard";
    };

    accountMenu.classList.add("is-account-menu");
    addMenuAction(accountMenu, "Settings", () => window.navigate?.("settings"), "settings");
    addMenuAction(accountMenu, "Log out", () => document.querySelector(".logout-btn")?.click(), "log-out");
    profile.addEventListener("click", () => {
        if (!accountMenu.hidden) return closePopups();
        profile.setAttribute("aria-expanded", "true");
        openPopup(accountMenu, profile, true);
        profile.setAttribute("aria-expanded", "true");
        if (window.lucide) window.lucide.createIcons();
    });

    const renderSearchResults = () => {
        const query = search.value.trim().toLowerCase();
        searchResults.replaceChildren();
        if (!query) {
            searchResults.hidden = true;
            activePopup = null;
            return;
        }
        const pages = [...document.querySelectorAll(".nav-item[data-page]")]
            .map(item => ({ page: item.dataset.page, label: item.innerText.trim().replace(/\s+/g, " ") }))
            .filter(item => item.label.toLowerCase().includes(query) || item.page.toLowerCase().includes(query))
            .slice(0, 8);
        if (!pages.length) {
            const empty = document.createElement("p");
            empty.className = "topbar-search-empty";
            empty.textContent = "No matching sections. Try assets, calls, stock, PM, reports, or settings.";
            searchResults.appendChild(empty);
        } else {
            pages.forEach(item => addMenuAction(searchResults, item.label, () => window.navigate?.(item.page), "arrow-up-right"));
        }
        openPopup(searchResults, search);
        if (window.lucide) window.lucide.createIcons();
    };
    search.addEventListener("focus", renderSearchResults);
    search.addEventListener("input", renderSearchResults);
    search.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            const first = searchResults.querySelector("button");
            if (first && !searchResults.hidden) {
                event.preventDefault();
                first.click();
            }
        }
        if (event.key === "Escape") closePopups();
    });

    notification.addEventListener("click", async () => {
        if (!alertsPanel.hidden) return closePopups();
        if (window.BioTrackNotifications) {
            await window.BioTrackNotifications.renderPanel(alertsPanel);
        } else {
            alertsPanel.replaceChildren();
            const description = document.createElement("p");
            description.className = "topbar-search-empty";
            description.textContent = "Notifications are temporarily unavailable. Refresh this page to try again.";
            alertsPanel.append(description);
            addMenuAction(alertsPanel, "Open dashboard", () => window.navigate?.(homePage()), "layout-dashboard");
        }
        openPopup(alertsPanel, notification, true);
        notification.setAttribute("aria-expanded", "true");
        if (window.lucide) window.lucide.createIcons();
    });

    document.addEventListener("click", event => {
        if (event.target.closest(".topbar-popover, .search-box, .profile-button, .notification-btn")) return;
        closePopups();
    });
    document.addEventListener("keydown", event => { if (event.key === "Escape") closePopups(); });
    window.addEventListener("resize", closePopups);
    window.addEventListener("scroll", closePopups, true);
});
