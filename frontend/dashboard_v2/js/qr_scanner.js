// ==========================================
// QR SCANNER
// ==========================================

let html5QrScanner = null;

// ==========================================
// OPEN QR SCANNER
// ==========================================

function openQRScanner() {

    const modal = document.createElement("div");

    modal.className = "qr-scanner-overlay";

    modal.innerHTML = `

    <div class="qr-scanner-modal">

        <div class="qr-scanner-header">

            <h2>Scan Equipment QR</h2>

            <button id="closeScannerBtn">
                ✕
            </button>

        </div>

        <div class="qr-scanner-body">

            <div id="reader"></div>

            <p class="scanner-note">
                Position the QR code inside the scanning frame.
            </p>

        </div>

        <div class="qr-scanner-footer">

            <button
                id="stopScannerBtn"
                class="scanner-stop-btn"
            >

                Stop Scanning

            </button>

        </div>

    </div>

    `;

    document.body.appendChild(modal);

    document
        .getElementById("closeScannerBtn")
        .onclick = closeQRScanner;
    document
    .getElementById("stopScannerBtn")
    .onclick = closeQRScanner;    

    html5QrScanner = new Html5Qrcode("reader");

    html5QrScanner.start(

        {
            facingMode: "environment"
        },

        {
            fps: 10,
            qrbox: 260
        },

        onQRCodeDetected

    );

}
// ==========================================
// QR DETECTED
// ==========================================

async function onQRCodeDetected(decodedText){

    console.log("QR Detected:", decodedText);

    


    try{

        

        closeQRScanner();

        const response = await fetch(

            `/api/assets/code/${encodeURIComponent(decodedText)}`

        );

        const result = await response.json();

        if(!result.success){

            alert("Asset not found.");

            return;

        }

        openAssetPage(result.asset.id);

    }

    catch(error){

        console.error(error);

        alert("Unable to locate asset.");

    }

}
// ==========================================
// CLOSE QR SCANNER
// ==========================================

function closeQRScanner(){

    if(html5QrScanner){

        html5QrScanner
            .stop()
            .then(() => html5QrScanner.clear())
            .catch(() => {})
            .finally(() => {

                html5QrScanner = null;

                document
                    .querySelector(".qr-scanner-overlay")
                    ?.remove();

            });

    }else{

        document
            .querySelector(".qr-scanner-overlay")
            ?.remove();

    }

}

window.openQRScanner = openQRScanner;