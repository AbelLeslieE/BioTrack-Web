// ==========================================
// QR SCANNER
// ==========================================

let html5QrScanner = null;
let qrScannerStarting = false;
let qrResultHandled = false;
let qrScannerSessionId = 0;
let qrScannerCloseRequested = false;

function setQRScannerStatus(message, isError = false) {
    const status = document.getElementById("qrScannerStatus");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", isError);
}

// Open the device camera immediately. The browser will show its native
// permission prompt the first time a user scans on a device.
async function openQRScanner() {
    if (document.querySelector(".qr-scanner-overlay") || qrScannerStarting) return;

    const sessionId = ++qrScannerSessionId;
    qrScannerCloseRequested = false;

    const modal = document.createElement("div");
    modal.className = "qr-scanner-overlay";
    modal.innerHTML = `
        <div class="qr-scanner-modal" role="dialog" aria-modal="true" aria-labelledby="qrScannerTitle">
            <div class="qr-scanner-header">
                <h2 id="qrScannerTitle">Scan Equipment QR</h2>
                <button id="closeScannerBtn" type="button" aria-label="Close scanner">✕</button>
            </div>
            <div class="qr-scanner-body">
                <div id="reader"></div>
                <p class="scanner-note" id="qrScannerStatus" role="status">Starting your camera…</p>
            </div>
            <div class="qr-scanner-footer">
                <button id="stopScannerBtn" type="button" class="scanner-stop-btn">Close Scanner</button>
            </div>
        </div>`;

    document.body.appendChild(modal);
    document.getElementById("closeScannerBtn").onclick = closeQRScanner;
    document.getElementById("stopScannerBtn").onclick = closeQRScanner;
    modal.addEventListener("click", event => {
        if (event.target === modal) closeQRScanner();
    });

    if (typeof Html5Qrcode === "undefined") {
        setQRScannerStatus("The camera scanner could not be loaded. Refresh the page and try again.", true);
        return;
    }

    qrScannerStarting = true;
    qrResultHandled = false;
    const scanner = new Html5Qrcode("reader");
    html5QrScanner = scanner;

    try {
        await scanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 260, height: 260 } },
            onQRCodeDetected,
            () => {}
        );

        if (qrScannerCloseRequested || sessionId !== qrScannerSessionId || !modal.isConnected) {
            await stopQRScannerInstance(scanner, modal);
            return;
        }
        setQRScannerStatus("Position the QR code inside the scanning frame.");
    } catch (error) {
        if (qrScannerCloseRequested || sessionId !== qrScannerSessionId) return;
        console.error("Unable to start QR camera", error);
        setQRScannerStatus(
            "Camera access is unavailable. Allow camera permission in your browser, then open the scanner again.",
            true
        );
    } finally {
        if (sessionId === qrScannerSessionId) qrScannerStarting = false;
    }
}

async function onQRCodeDetected(decodedText) {
    if (qrResultHandled) return;
    qrResultHandled = true;
    setQRScannerStatus("QR code found. Opening the asset…");

    try {
        await closeQRScanner();
        const response = await fetch(`/api/assets/code/${encodeURIComponent(decodedText)}`);
        const result = await response.json().catch(() => ({}));

        if (!response.ok || !result.success || !result.asset?.id) {
            alert(result.detail || result.message || "Asset not found.");
            return;
        }

        openAssetPage(result.asset.id);
    } catch (error) {
        console.error(error);
        alert("Unable to locate this asset. Please try again.");
    }
}

async function closeQRScanner() {
    qrScannerCloseRequested = true;
    qrScannerSessionId += 1;
    const scanner = html5QrScanner;
    html5QrScanner = null;
    qrScannerStarting = false;
    qrResultHandled = false;
    const overlay = document.querySelector(".qr-scanner-overlay");

    stopQRMediaTracks(overlay);
    overlay?.remove();
    await stopQRScannerInstance(scanner, overlay);
}

function stopQRMediaTracks(root = document) {
    if (!root?.querySelectorAll) return;
    root.querySelectorAll("video").forEach(video => {
        const stream = video.srcObject;
        if (stream?.getTracks) {
            stream.getTracks().forEach(track => track.stop());
            video.srcObject = null;
        }
    });
}

async function stopQRScannerInstance(scanner, root) {
    stopQRMediaTracks(root);
    if (!scanner) return;

    try {
        await scanner.stop();
    } catch (_) {
        // A pending permission request may not be stoppable until start resolves.
    }
    try {
        scanner.clear();
    } catch (_) {}
    stopQRMediaTracks(root);
}

function isQRScannerActive() {
    return Boolean(
        html5QrScanner
        || qrScannerStarting
        || document.querySelector(".qr-scanner-overlay")
    );
}

document.addEventListener("visibilitychange", () => {
    if (document.hidden && isQRScannerActive()) void closeQRScanner();
});
window.addEventListener("pagehide", () => {
    if (isQRScannerActive()) void closeQRScanner();
});

window.openQRScanner = openQRScanner;
window.closeQRScanner = closeQRScanner;
window.isQRScannerActive = isQRScannerActive;
