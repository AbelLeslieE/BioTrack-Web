// Shared output-encoding helpers for HTML assembled by dashboard views.
(function registerSecurityHelpers(global) {
    "use strict";

    global.escapeHTML = function escapeHTML(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    };
})(window);
