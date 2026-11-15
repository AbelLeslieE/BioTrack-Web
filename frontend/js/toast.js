(function installBioTrackToasts() {
    "use strict";

    const TYPES = {
        success: { icon: "✓", title: "Success" },
        error: { icon: "!", title: "Something went wrong" },
        warning: { icon: "!", title: "Attention needed" },
        info: { icon: "i", title: "BioTrack" },
    };
    const activeToasts = new Set();

    function ensureRegion() {
        let region = document.getElementById("appToastRegion");
        if (region || !document.body) return region;
        region = document.createElement("div");
        region.id = "appToastRegion";
        region.className = "app-toast-region";
        region.setAttribute("aria-label", "BioTrack notifications");
        region.setAttribute("aria-live", "polite");
        region.setAttribute("aria-relevant", "additions");
        document.body.appendChild(region);
        return region;
    }

    function dismiss(toast) {
        if (!toast || !toast.isConnected || toast.classList.contains("is-leaving")) return;
        toast.classList.add("is-leaving");
        activeToasts.delete(toast);
        window.setTimeout(() => toast.remove(), 240);
    }

    function show({ title, message, type = "info", duration = 5200 } = {}) {
        const normalizedType = Object.hasOwn(TYPES, type) ? type : "info";
        const metadata = TYPES[normalizedType];
        const region = ensureRegion();
        if (!region) {
            document.addEventListener(
                "DOMContentLoaded",
                () => show({ title, message, type: normalizedType, duration }),
                { once: true },
            );
            return null;
        }

        while (activeToasts.size >= 4) dismiss(activeToasts.values().next().value);

        const toast = document.createElement("section");
        toast.className = `app-toast app-toast--${normalizedType}`;
        toast.setAttribute("role", normalizedType === "error" ? "alert" : "status");
        toast.style.setProperty("--toast-duration", `${Math.max(2500, duration)}ms`);

        const icon = document.createElement("span");
        icon.className = "app-toast__icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = metadata.icon;

        const copy = document.createElement("div");
        copy.className = "app-toast__copy";
        const heading = document.createElement("h3");
        heading.className = "app-toast__title";
        heading.textContent = String(title || metadata.title);
        const body = document.createElement("p");
        body.className = "app-toast__message";
        body.textContent = String(message || "");
        copy.append(heading, body);

        const close = document.createElement("button");
        close.className = "app-toast__close";
        close.type = "button";
        close.setAttribute("aria-label", "Dismiss notification");
        close.textContent = "×";
        close.addEventListener("click", () => dismiss(toast));

        const progress = document.createElement("span");
        progress.className = "app-toast__progress";
        progress.setAttribute("aria-hidden", "true");

        toast.append(icon, copy, close, progress);
        region.appendChild(toast);
        activeToasts.add(toast);
        requestAnimationFrame(() => toast.classList.add("is-visible"));

        window.setTimeout(() => dismiss(toast), Math.max(2500, duration));
        return toast;
    }

    const api = {
        show,
        success: (title, message, options = {}) => show({ ...options, title, message, type: "success" }),
        error: (title, message, options = {}) => show({ ...options, title, message, type: "error" }),
        warning: (title, message, options = {}) => show({ ...options, title, message, type: "warning" }),
        info: (title, message, options = {}) => show({ ...options, title, message, type: "info" }),
        dismissAll: () => [...activeToasts].forEach(dismiss),
    };

    window.BioTrackToast = api;
    window.notifyUser = function notifyUser(message, type = "info", title) {
        return show({ title, message, type });
    };

    // Safety net for older modules: native alerts become non-blocking BioTrack
    // notifications, so users never see the browser's "page says" dialog.
    window.alert = function toastInsteadOfAlert(message) {
        const text = String(message || "");
        const type = /failed|failure|error|unable|invalid|not found/i.test(text)
            ? "error"
            : /success|saved|imported|scheduled|updated|completed/i.test(text)
                ? "success"
                : /select|required|please|attention/i.test(text)
                    ? "warning"
                    : "info";
        return show({ message: text, type });
    };
})();
