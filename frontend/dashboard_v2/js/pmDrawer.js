// PM scheduling drawer: one API-driven form, no fragmented dropdown calls.
let selectedPMDate = null;
let pmFormData = { departments: [], assets: [], engineers: [] };

const pmDrawerOverlay = () => document.getElementById("pmDrawerOverlay");
const pmDateInput = () => document.getElementById("pmDate");

function initializePMDrawer() {
    if (!pmDrawerOverlay()) return;
    document.getElementById("pmDrawerClose")?.addEventListener("click", closePMDrawer);
    document.getElementById("pmCancelButton")?.addEventListener("click", closePMDrawer);
    pmDrawerOverlay().addEventListener("click", event => {
        if (event.target === pmDrawerOverlay()) closePMDrawer();
    });
    document.getElementById("pmScheduleButton")?.addEventListener("click", savePMSchedule);
    document.getElementById("pmDepartment")?.addEventListener("change", event => populateDepartmentAssets(event.target.value));
    document.getElementById("pmEquipment")?.addEventListener("change", event => setPMFrequencyFromAsset(event.target.value));
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && pmDrawerOverlay()?.classList.contains("active")) closePMDrawer();
    });
}

async function openPMDrawer(date) {
    selectedPMDate = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(selectedPMDate.getTime())) return;
    pmDateInput().value = formatDrawerDate(selectedPMDate);
    document.getElementById("pmDepartment").value = "";
    document.getElementById("pmEquipment").innerHTML = '<option value="">Select a department first</option>';
    document.getElementById("pmEquipment").disabled = true;
    document.getElementById("pmEngineer").value = "";
    document.getElementById("pmFrequency").value = "90";
    document.getElementById("pmRemarks").value = "";
    pmDrawerOverlay().classList.add("active");
    await loadPMDrawerData();
}

function closePMDrawer() {
    pmDrawerOverlay()?.classList.remove("active");
}

function formatDrawerDate(date) {
    return date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

async function loadPMDrawerData() {
    const department = document.getElementById("pmDepartment");
    const equipment = document.getElementById("pmEquipment");
    const engineer = document.getElementById("pmEngineer");
    const button = document.getElementById("pmScheduleButton");
    try {
        if (button) button.disabled = true;
        department.innerHTML = '<option value="">Loading departments…</option>';
        equipment.innerHTML = '<option value="">Select a department first</option>';
        equipment.disabled = true;
        engineer.innerHTML = '<option value="">Loading engineers…</option>';
        const response = await fetch("/api/pm/form-data", { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || "Unable to load PM scheduling data.");
        pmFormData = {
            departments: Array.isArray(result.departments) ? result.departments : [],
            assets: Array.isArray(result.assets) ? result.assets : [],
            engineers: Array.isArray(result.engineers) ? result.engineers : [],
        };
        department.innerHTML = '<option value="">Select Department</option>' + pmFormData.departments.map(item => `<option value="${pmDrawerEscape(item)}">${pmDrawerEscape(item)}</option>`).join("");
        engineer.innerHTML = '<option value="">Assign Biomedical Engineer</option>' + pmFormData.engineers.map(item => `<option value="${item.id}">${pmDrawerEscape(item.name)}</option>`).join("");
        if (!pmFormData.departments.length) {
            department.innerHTML = '<option value="">No department users are available</option>';
        }
        if (!pmFormData.engineers.length) {
            engineer.innerHTML = '<option value="">No biomedical engineer is available</option>';
        }
    } catch (error) {
        console.error(error);
        department.innerHTML = '<option value="">Could not load departments</option>';
        engineer.innerHTML = '<option value="">Could not load engineers</option>';
        alert(error.message);
    } finally {
        if (button) button.disabled = false;
    }
}

function populateDepartmentAssets(department) {
    const equipment = document.getElementById("pmEquipment");
    equipment.innerHTML = '<option value="">Select Equipment</option>';
    if (!department) {
        equipment.disabled = true;
        return;
    }
    const matching = pmFormData.assets.filter(asset => !asset.department || asset.department === department);
    matching.forEach(asset => {
        const assignment = asset.department ? "" : " — unassigned (will be assigned)";
        equipment.innerHTML += `<option value="${asset.id}">${pmDrawerEscape(asset.equipment_name || asset.asset_code || "Unnamed asset")}${assignment}</option>`;
    });
    equipment.disabled = matching.length === 0;
    if (!matching.length) equipment.innerHTML = '<option value="">No biomedical assets are available</option>';
}

function setPMFrequencyFromAsset(assetId) {
    const asset = pmFormData.assets.find(item => String(item.id) === String(assetId));
    const frequency = document.getElementById("pmFrequency");
    if (asset && asset.pm_frequency && frequency.querySelector(`option[value="${asset.pm_frequency}"]`)) {
        frequency.value = String(asset.pm_frequency);
    } else {
        frequency.value = "90";
    }
}

async function savePMSchedule() {
    const department = document.getElementById("pmDepartment").value;
    const equipment = document.getElementById("pmEquipment").value;
    const engineer = document.getElementById("pmEngineer").value;
    const frequency = Number(document.getElementById("pmFrequency").value);
    const remarks = document.getElementById("pmRemarks").value.trim();
    const button = document.getElementById("pmScheduleButton");
    if (!department || !equipment || !engineer || !selectedPMDate) {
        alert("Select a department, equipment and biomedical engineer before scheduling.");
        return;
    }
    if (!Number.isInteger(frequency) || frequency <= 0) {
        alert("Choose a valid PM frequency.");
        return;
    }
    const payload = {
        asset_id: Number(equipment),
        department,
        frequency_days: frequency,
        scheduled_date: formatPMDate(selectedPMDate),
        engineer_id: Number(engineer),
        remarks,
    };
    try {
        button.disabled = true;
        button.textContent = "Scheduling…";
        const response = await fetch("/api/pm/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || "Unable to schedule preventive maintenance.");
        closePMDrawer();
        if (typeof loadEngineeringPMSchedules === "function") await loadEngineeringPMSchedules();
        if (typeof showSuccess === "function") {
            showSuccess({ title: "PM scheduled", message: "The department will now be able to approve or decline the planned visit.", buttonText: "Continue" });
        } else {
            alert("Preventive maintenance scheduled successfully.");
        }
    } catch (error) {
        console.error(error);
        alert(error.message);
    } finally {
        button.disabled = false;
        button.textContent = "Schedule PM";
    }
}

function getSelectedPMDate() {
    return selectedPMDate;
}
function pmDrawerEscape(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

window.openPMDrawer = openPMDrawer;
window.closePMDrawer = closePMDrawer;
window.getSelectedPMDate = getSelectedPMDate;
