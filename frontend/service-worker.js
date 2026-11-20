const CACHE_VERSION = "biotrack-shell-v32";
const OFFLINE_URL = "/offline";
const PRECACHE_URLS = [
    OFFLINE_URL,
    "/manifest.webmanifest",
    "/static/css/login.css",
    "/static/js/login.js",
    "/static/js/pwa.js",
    "/static/vendor/lucide.min.js?v=1.76.0",
    "/static/vendor/fontawesome/css/all.min.css?v=7.3.1",
    "/static/vendor/fontawesome/webfonts/fa-regular-400.woff2",
    "/static/vendor/fontawesome/webfonts/fa-solid-900.woff2",
    "/static/assets/icons/biotrack-192.png",
    "/static/assets/icons/biotrack-512.png",
    "/static/assets/icons/biotrack-maskable-512.png"
];

self.addEventListener("install", function (event) {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then(function (cache) {
                return cache.addAll(PRECACHE_URLS);
            })
            .then(function () {
                return self.skipWaiting();
            })
    );
});

self.addEventListener("activate", function (event) {
    event.waitUntil(
        caches.keys()
            .then(function (keys) {
                return Promise.all(
                    keys
                        .filter(function (key) {
                            return key.startsWith("biotrack-") && key !== CACHE_VERSION;
                        })
                        .map(function (key) {
                            return caches.delete(key);
                        })
                );
            })
            .then(function () {
                return self.clients.claim();
            })
    );
});

self.addEventListener("fetch", function (event) {
    const request = event.request;
    const url = new URL(request.url);

    if (request.method !== "GET" || url.origin !== self.location.origin) {
        return;
    }

    // Never cache authenticated endpoints or data returned by the hospital API.
    if (url.pathname.startsWith("/api/")) {
        event.respondWith(fetch(request));
        return;
    }

    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request).catch(function () {
                return caches.match(OFFLINE_URL);
            })
        );
        return;
    }

    if (url.pathname.startsWith("/static/") || url.pathname === "/manifest.webmanifest") {
        event.respondWith(
            caches.match(request).then(function (cachedResponse) {
                const networkResponse = fetch(request, { cache: "no-cache" })
                    .then(function (response) {
                        if (response.ok) {
                            const responseCopy = response.clone();
                            caches.open(CACHE_VERSION).then(function (cache) {
                                cache.put(request, responseCopy);
                            });
                        }
                        return response;
                    })
                    .catch(function () {
                        return cachedResponse || Response.error();
                    });
                return cachedResponse || networkResponse;
            })
        );
    }
});

self.addEventListener("notificationclick", function (event) {
    event.notification.close();
    const page = event.notification.data && event.notification.data.page;
    const targetUrl = page
        ? `/dashboard_v2?page=${encodeURIComponent(page)}`
        : "/dashboard_v2";
    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (windowClients) {
            const dashboardClient = windowClients.find(function (client) {
                return new URL(client.url).pathname.startsWith("/dashboard_v2");
            });
            if (dashboardClient) {
                dashboardClient.postMessage({ type: "BIOTRACK_NAVIGATE", page: page });
                return dashboardClient.focus();
            }
            return clients.openWindow(targetUrl);
        })
    );
});
