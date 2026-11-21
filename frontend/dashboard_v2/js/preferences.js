(function () {
    "use strict";

    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
    const profilePhotoPattern = /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\r\n]+$/i;

    function isSafeProfilePhoto(source) {
        return typeof source === "string"
            && source.length <= 2100000
            && profilePhotoPattern.test(source);
    }

    function applyBioTrackPreferences() {
        const selectedTheme = localStorage.getItem("biotrack-theme") || "light";
        const useDark = selectedTheme === "dark" || (selectedTheme === "system" && systemTheme.matches);
        document.body.classList.toggle("dark-theme", useDark);
        document.documentElement.style.colorScheme = useDark ? "dark" : "light";

        const density = localStorage.getItem("biotrack-density") || "comfortable";
        document.body.classList.toggle("compact-density", density === "compact");
    }

    function applySavedProfilePhoto() {
        const source = localStorage.getItem(`biotrack-profile-photo:${localStorage.getItem("username") || "user"}`);
        if (!isSafeProfilePhoto(source)) return;
        [document.getElementById("topAvatar"), document.getElementById("sidebarAvatar")].forEach(element => {
            if (!element) return;
            element.style.backgroundImage = `url("${source}")`;
            element.style.backgroundPosition = "center";
            element.style.backgroundSize = "cover";
            element.textContent = "";
        });
    }

    window.applyBioTrackPreferences = applyBioTrackPreferences;
    document.addEventListener("DOMContentLoaded", () => {
        applyBioTrackPreferences();
        window.setTimeout(applySavedProfilePhoto, 0);
    });
    systemTheme.addEventListener("change", () => {
        if ((localStorage.getItem("biotrack-theme") || "light") === "system") applyBioTrackPreferences();
    });
}());
