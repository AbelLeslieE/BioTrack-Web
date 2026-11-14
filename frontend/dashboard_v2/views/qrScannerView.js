function renderQRScannerModule() {
    pageContent.innerHTML = `
        <section class="qr-scanner-module-page" aria-labelledby="qrModuleTitle">
            <header class="qr-module-hero">
                <div class="qr-module-copy">
                    <span class="qr-module-eyebrow"><i data-lucide="scan-line"></i> Equipment identification</span>
                    <h1 id="qrModuleTitle">QR Scanner</h1>
                    <p>Scan an equipment label to open its asset profile, service history, preventive-maintenance schedule and current status.</p>
                    <div class="qr-module-actions">
                        <button class="qr-module-primary" id="reopenQrCamera" type="button"><i data-lucide="camera"></i> Open camera</button>
                        <button class="qr-module-secondary" type="button" onclick="navigate('assets')"><i data-lucide="monitor-cog"></i> Open asset register</button>
                    </div>
                </div>
                <div class="qr-module-visual" aria-hidden="true">
                    <span class="qr-module-corner top-left"></span>
                    <span class="qr-module-corner top-right"></span>
                    <span class="qr-module-corner bottom-left"></span>
                    <span class="qr-module-corner bottom-right"></span>
                    <i data-lucide="qr-code"></i>
                    <div class="qr-module-scan-line"></div>
                </div>
            </header>

            <div class="qr-module-status" role="status">
                <span class="qr-module-live-dot"></span>
                <div><strong>Scanner ready</strong><p>The camera opens automatically when this module is selected.</p></div>
            </div>

            <div class="qr-module-grid">
                <article><span><i data-lucide="camera"></i></span><div><small>Step 1</small><h2>Allow camera access</h2><p>Your browser may ask for permission the first time you scan on a device.</p></div></article>
                <article><span><i data-lucide="focus"></i></span><div><small>Step 2</small><h2>Frame the equipment QR</h2><p>Hold the code inside the scanning frame until it is recognized.</p></div></article>
                <article><span><i data-lucide="external-link"></i></span><div><small>Step 3</small><h2>Open the asset record</h2><p>BioTrack takes you directly to the matching equipment profile.</p></div></article>
            </div>

            <aside class="qr-module-note">
                <i data-lucide="shield-check"></i>
                <div><strong>Secure, role-aware lookup</strong><p>Only equipment available to your signed-in department and role can be opened.</p></div>
            </aside>
        </section>`;

    document.getElementById("reopenQrCamera")?.addEventListener("click", openQRScanner);
    if (window.lucide) lucide.createIcons();
}

window.renderQRScannerModule = renderQRScannerModule;
