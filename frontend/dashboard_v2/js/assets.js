// ==========================================
// ASSET IMPORT
// ==========================================

export function initializeAssetImport() {

    const importButton = document.getElementById("importExcelBtn");
    const fileInput = document.getElementById("excelFileInput");

    if (!importButton || !fileInput) return;

    importButton.onclick = () => {

        fileInput.click();

    };

    fileInput.onchange = async () => {

        const file = fileInput.files[0];

        if (!file) return;

        // Allow only Excel files
        const allowedTypes = [
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel"
        ];

        if (!allowedTypes.includes(file.type)) {

            alert("Please select a valid Excel (.xlsx or .xls) file.");

            fileInput.value = "";

            return;

        }

        importButton.disabled = true;
        importButton.textContent = "Importing...";

        const formData = new FormData();
        formData.append("file", file);

        try {

            const response = await fetch("/api/assets/upload", {
                method: "POST",
                body: formData
            });

            if (!response.ok) {
                throw new Error("Upload failed.");
            }

            const result = await response.json();

            alert(
                `Import Complete\n\n` +
                `Imported : ${result.imported}\n` +
                `Skipped : ${result.skipped}\n` +
                `Errors : ${result.errors}`
            );

            // Refresh assets and dashboard
            if (typeof loadAssets === "function") {
                await loadAssets();
            }

            if (typeof loadDashboard === "function") {
                await loadDashboard();
            }

        } catch (error) {

            console.error(error);

            alert(error.message || "Import failed.");

        } finally {

            importButton.disabled = false;
            importButton.textContent = "Import Excel";

            fileInput.value = "";

        }

    };

}