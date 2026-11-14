(function () {
    "use strict";

    let installPrompt = null;

    function setInstallButtonsVisible(visible) {
        document.querySelectorAll("[data-pwa-install]").forEach(function (button) {
            button.hidden = !visible;
        });
    }

    window.addEventListener("beforeinstallprompt", function (event) {
        event.preventDefault();
        installPrompt = event;
        setInstallButtonsVisible(true);
    });

    document.addEventListener("click", async function (event) {
        const button = event.target.closest("[data-pwa-install]");
        if (!button || !installPrompt) return;

        button.disabled = true;
        installPrompt.prompt();
        await installPrompt.userChoice;
        installPrompt = null;
        button.disabled = false;
        setInstallButtonsVisible(false);
    });

    window.addEventListener("appinstalled", function () {
        installPrompt = null;
        setInstallButtonsVisible(false);
    });

    if (!("serviceWorker" in navigator)) {
        return;
    }

    window.addEventListener("load", async function () {
        try {
            const registration = await navigator.serviceWorker.register("/service-worker.js", {
                scope: "/"
            });

            registration.addEventListener("updatefound", function () {
                const worker = registration.installing;
                if (!worker) return;

                worker.addEventListener("statechange", function () {
                    if (worker.state === "installed" && navigator.serviceWorker.controller) {
                        window.dispatchEvent(new CustomEvent("biotrack-pwa-update-ready", {
                            detail: { registration }
                        }));
                    }
                });
            });
        } catch (error) {
            console.warn("BioTrack offline support could not be started.", error);
        }
    });
})();
