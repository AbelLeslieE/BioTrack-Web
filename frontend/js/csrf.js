(function installCsrfFetchProtection(global) {
    "use strict";

    const originalFetch = global.fetch.bind(global);
    const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

    function cookieValue(name) {
        const prefix = `${encodeURIComponent(name)}=`;
        const item = document.cookie.split(";").map(value => value.trim()).find(value => value.startsWith(prefix));
        return item ? decodeURIComponent(item.slice(prefix.length)) : "";
    }

    function csrfToken() {
        return cookieValue("__Host-biotrack_csrf") || cookieValue("biotrack_csrf");
    }

    global.fetch = function protectedFetch(input, init = {}) {
        const request = input instanceof Request ? input : null;
        const method = String(init.method || request?.method || "GET").toUpperCase();
        const url = new URL(request?.url || String(input), global.location.href);

        if (url.origin === global.location.origin && unsafeMethods.has(method)) {
            const token = csrfToken();
            if (token) {
                const headers = new Headers(init.headers || request?.headers || undefined);
                headers.set("X-CSRF-Token", token);
                init = { ...init, headers };
            }
        }
        return originalFetch(input, init);
    };
})(window);
