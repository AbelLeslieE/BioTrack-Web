// Department-user maintenance complaint workflow.

const REQUEST_DRAFT_KEY = "biotrackMaintenanceRequestDraft";
let requestDepartmentAssets = [];
let requestSubmitting = false;

async function initializeNewRequest() {
    initializeRequesterFields();
    restoreRequestDraft();
    initializeRequestFormEvents();
    initializePrioritySelector();
    initializeDescriptionHelpers();
    initializeEquipmentControls();
    applyQRMaintenancePrefill();
    updateRequestExperience();
    await loadRequestDepartmentAssets();
}

function initializeRequesterFields() {
    const department = document.getElementById("departmentSearch");
    const reportedBy = document.getElementById("reportedBy");
    const assignedDepartment = (localStorage.getItem("department") || "").trim();
    const requesterName = (localStorage.getItem("name") || localStorage.getItem("username") || "").trim();

    if (department) {
        department.value = assignedDepartment;
        department.readOnly = true;
    }
    if (reportedBy) {
        reportedBy.value = requesterName;
        reportedBy.readOnly = true;
    }
}

function getQRMaintenancePrefill() {
    try {
        return JSON.parse(sessionStorage.getItem("qrMaintenancePrefill") || "null");
    } catch (error) {
        console.warn("Unable to read QR maintenance prefill", error);
        sessionStorage.removeItem("qrMaintenancePrefill");
        return null;
    }
}

function applyQRMaintenancePrefill() {
    const prefill = getQRMaintenancePrefill();
    if (!prefill) return;

    const values = {
        departmentSearch: prefill.department,
        locationRoom: prefill.location,
        equipmentIdentifier: prefill.equipment_identifier,
        equipmentName: prefill.equipment_name,
        makeModel: prefill.make_model,
        serviceTeam: prefill.service_team,
    };
    const lockableFields = new Set([
        "departmentSearch",
        "locationRoom",
        "equipmentIdentifier",
        "equipmentName",
        "makeModel",
    ]);

    Object.entries(values).forEach(([id, value]) => {
        const field = document.getElementById(id);
        if (!field) return;
        const suppliedValue = String(value ?? "").trim();
        if (suppliedValue) field.value = suppliedValue;
        clearRequestFieldError(field);
        if (!lockableFields.has(id)) return;

        field.readOnly = Boolean(suppliedValue);
        if (id === "departmentSearch") field.readOnly = true;
        field.classList.toggle("qr-prefill-locked", field.readOnly);
        field.classList.toggle("qr-prefill-missing", !field.readOnly);
        const existingHint = field.closest(".request-field")?.querySelector(".qr-missing-field-hint");
        if (existingHint) existingHint.remove();
        if (!field.readOnly) {
            const hint = document.createElement("small");
            hint.className = "qr-missing-field-hint";
            hint.textContent = "Not stored on this asset — please add it.";
            field.closest(".request-field")?.appendChild(hint);
        }
    });

    const serviceTeam = document.getElementById("serviceTeam");
    if (serviceTeam) {
        const hasServiceTeam = ["Biomedical", "Electrical", "IT"].includes(prefill.service_team);
        if (hasServiceTeam) serviceTeam.value = prefill.service_team;
        serviceTeam.disabled = hasServiceTeam;
        serviceTeam.classList.toggle("qr-prefill-locked", hasServiceTeam);
        serviceTeam.classList.toggle("qr-prefill-missing", !hasServiceTeam);
    }

    const problemCategory = document.getElementById("problemCategory");
    if (problemCategory && !problemCategory.value) problemCategory.value = "Breakdown";

    const mount = document.getElementById("qrRequestPrefillMount");
    if (mount) {
        mount.innerHTML = '<div id="qrRequestPrefillBanner" class="qr-request-prefill-banner"><span><i data-lucide="badge-check"></i></span><div><strong>Equipment identified from its QR code</strong><p>Verified values are locked. Complete any highlighted missing information, then describe the problem.</p></div><button id="removeQRPrefill" type="button">Use different equipment</button></div>';
        document.getElementById("removeQRPrefill")?.addEventListener("click", clearQRRequestPrefill);
    }
    if (window.lucide) lucide.createIcons();
}

function clearQRRequestPrefill() {
    sessionStorage.removeItem("qrMaintenancePrefill");
    document.getElementById("qrRequestPrefillBanner")?.remove();
    unlockRequestEquipmentFields();
    document.getElementById("departmentSearch").readOnly = true;
    document.getElementById("serviceTeam").disabled = false;
    document.getElementById("departmentAssetPicker")?.focus();
    updateRequestExperience();
}

function initializeRequestFormEvents() {
    const form = document.getElementById("maintenanceRequestForm");
    form?.addEventListener("submit", submitRequest);
    form?.addEventListener("input", handleRequestFieldUpdate);
    form?.addEventListener("change", handleRequestFieldUpdate);
    document.querySelector(".clear-btn")?.addEventListener("click", () => clearForm());
    document.getElementById("openRequestScanner")?.addEventListener("click", () => navigate("qr"));
}

function handleRequestFieldUpdate(event) {
    const field = event.target;
    if (field?.matches("input, select, textarea")) clearRequestFieldError(field);
    updateDescriptionCount();
    updateRequestExperience();
    saveRequestDraft();
}

function initializePrioritySelector() {
    document.querySelectorAll("[data-request-priority]").forEach(button => {
        button.setAttribute("aria-pressed", String(button.classList.contains("is-selected")));
        button.addEventListener("click", () => setRequestPriority(button.dataset.requestPriority));
    });
}

function setRequestPriority(priority) {
    const field = document.getElementById("priority");
    if (!field || !["Low", "Medium", "High", "Critical"].includes(priority)) return;
    field.value = priority;
    document.querySelectorAll("[data-request-priority]").forEach(button => {
        const selected = button.dataset.requestPriority === priority;
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-pressed", String(selected));
    });
    document.getElementById("priorityGuidance")?.classList.toggle("is-critical", priority === "Critical");
    updateRequestExperience();
    saveRequestDraft();
}

function initializeDescriptionHelpers() {
    document.querySelectorAll("[data-description-prompt]").forEach(button => {
        button.addEventListener("click", () => {
            const field = document.getElementById("failureDescription");
            if (!field) return;
            const prompt = button.dataset.descriptionPrompt || "";
            field.value = field.value.trim() ? `${field.value.trim()} ${prompt}` : prompt;
            field.focus();
            updateDescriptionCount();
            saveRequestDraft();
        });
    });
    updateDescriptionCount();
}

function updateDescriptionCount() {
    const field = document.getElementById("failureDescription");
    const counter = document.getElementById("failureDescriptionCount");
    if (field && counter) counter.textContent = `${field.value.length} / 4000`;
}

function initializeEquipmentControls() {
    document.getElementById("departmentAssetPicker")?.addEventListener("change", event => {
        const asset = requestDepartmentAssets.find(item => String(item.id) === event.target.value);
        if (asset) applyRegisteredAsset(asset);
        else unlockRequestEquipmentFields();
    });
    document.getElementById("useManualEquipment")?.addEventListener("click", () => {
        const picker = document.getElementById("departmentAssetPicker");
        if (picker) picker.value = "";
        unlockRequestEquipmentFields();
        document.getElementById("equipmentIdentifier")?.focus();
        updateRequestExperience();
    });
}

async function loadRequestDepartmentAssets() {
    const picker = document.getElementById("departmentAssetPicker");
    const help = document.getElementById("assetPickerHelp");
    if (!picker) return;
    try {
        const response = await fetch("/api/assets/department/mine", { cache: "no-store" });
        const data = await response.json().catch(() => ([]));
        if (!response.ok) throw new Error(data.detail || "Unable to load department equipment.");
        requestDepartmentAssets = Array.isArray(data) ? data : [];
        picker.replaceChildren(new Option("Select registered equipment", ""));
        requestDepartmentAssets.forEach(asset => {
            const identifier = asset.asset_code || asset.equipment_no || `Asset ${asset.id}`;
            const location = asset.location ? ` — ${asset.location}` : "";
            picker.add(new Option(`${identifier} · ${asset.equipment_name || "Unnamed equipment"}${location}`, String(asset.id)));
        });
        if (!requestDepartmentAssets.length) {
            picker.replaceChildren(new Option("No registered equipment — enter details manually", ""));
            picker.disabled = true;
            if (help) help.textContent = "No assets are registered to this department yet. Manual entry is available below.";
        }
        matchPrefilledRequestAsset();
    } catch (error) {
        picker.replaceChildren(new Option("Equipment list unavailable — enter manually", ""));
        picker.disabled = true;
        if (help) help.textContent = error.message || "Enter the equipment details manually.";
    }
}

function matchPrefilledRequestAsset() {
    const identifier = document.getElementById("equipmentIdentifier")?.value.trim().toLowerCase();
    if (!identifier) return;
    const asset = requestDepartmentAssets.find(item => [item.asset_code, item.equipment_no]
        .some(value => String(value || "").trim().toLowerCase() === identifier));
    if (asset) document.getElementById("departmentAssetPicker").value = String(asset.id);
}

function applyRegisteredAsset(asset) {
    const values = {
        equipmentIdentifier: asset.asset_code || asset.equipment_no,
        equipmentName: asset.equipment_name,
        makeModel: [asset.manufacturer, asset.model].filter(Boolean).join(" / "),
        locationRoom: asset.location,
        serviceTeam: asset.service_team,
    };
    Object.entries(values).forEach(([id, value]) => {
        const field = document.getElementById(id);
        if (!field || !String(value || "").trim()) return;
        field.value = value;
        clearRequestFieldError(field);
    });
    ["equipmentIdentifier", "equipmentName", "makeModel"].forEach(id => {
        const field = document.getElementById(id);
        if (field) field.readOnly = true;
    });
    const serviceTeam = document.getElementById("serviceTeam");
    if (serviceTeam && ["Biomedical", "Electrical", "IT"].includes(asset.service_team)) {
        serviceTeam.value = asset.service_team;
        serviceTeam.disabled = true;
    }
    const status = document.getElementById("selectedAssetStatus");
    if (status) {
        status.hidden = false;
        status.textContent = `${asset.equipment_name || "Equipment"} selected from your department registry. Verified details have been filled in.`;
    }
    updateRequestExperience();
    saveRequestDraft();
}

function unlockRequestEquipmentFields() {
    ["locationRoom", "equipmentIdentifier", "equipmentName", "makeModel"].forEach(id => {
        const field = document.getElementById(id);
        if (!field) return;
        field.readOnly = false;
        field.classList.remove("qr-prefill-locked", "qr-prefill-missing");
    });
    document.getElementById("serviceTeam").disabled = false;
    const status = document.getElementById("selectedAssetStatus");
    if (status) status.hidden = true;
}

function requestValue(id) {
    return String(document.getElementById(id)?.value || "").trim();
}

function updateRequestExperience() {
    const teamLabels = {
        Biomedical: "Biomedical Engineering",
        Electrical: "Electrical Engineering",
        IT: "IT Department",
    };
    const summaryValues = {
        summaryDepartment: requestValue("departmentSearch") || "Not available",
        summaryLocation: requestValue("locationRoom") || "Add a location",
        summaryEquipment: requestValue("equipmentName") || "Select equipment",
        summaryCategory: requestValue("problemCategory") || "Choose a category",
        summaryTeam: teamLabels[requestValue("serviceTeam")] || "Choose a team",
    };
    Object.entries(summaryValues).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    });

    const priority = requestValue("priority") || "Medium";
    const prioritySummary = document.getElementById("summaryPriority");
    if (prioritySummary) {
        prioritySummary.textContent = priority;
        prioritySummary.className = `request-summary-priority is-${priority.toLowerCase()}`;
    }

    const sectionState = {
        location: Boolean(requestValue("departmentSearch") && requestValue("reportedBy") && requestValue("locationRoom")),
        equipment: Boolean(requestValue("equipmentIdentifier") && requestValue("equipmentName")),
        problem: Boolean(requestValue("problemCategory") && requestValue("serviceTeam") && priority),
    };
    Object.entries(sectionState).forEach(([step, complete]) => {
        document.querySelector(`[data-request-step="${step}"]`)?.classList.toggle("is-complete", complete);
    });
    const ready = Object.values(sectionState).every(Boolean);
    const readyState = document.getElementById("requestReadyState");
    if (readyState) {
        readyState.classList.toggle("is-ready", ready);
        const title = readyState.querySelector("strong");
        const copy = readyState.querySelector("small");
        if (title) title.textContent = ready ? "Ready to submit" : "Complete the required fields";
        if (copy) copy.textContent = ready
            ? "Your request will be sent to the selected engineering team."
            : "Your ticket will be created instantly after submission.";
    }
}

function validateForm() {
    const requiredFields = [
        ["departmentSearch", "Your account needs an assigned department."],
        ["locationRoom", "Enter the exact location of the equipment."],
        ["reportedBy", "Your account needs a reporter name."],
        ["equipmentIdentifier", "Enter or select an equipment identifier."],
        ["equipmentName", "Enter the equipment name."],
        ["problemCategory", "Choose the type of problem."],
        ["serviceTeam", "Choose the engineering team."],
    ];
    let firstInvalid = null;
    requiredFields.forEach(([id, message]) => {
        const field = document.getElementById(id);
        if (!field) return;
        clearRequestFieldError(field);
        if (!String(field.value || "").trim()) {
            setRequestFieldError(field, message);
            if (!firstInvalid) firstInvalid = field;
        }
    });
    if (firstInvalid) {
        firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
        firstInvalid.focus({ preventScroll: true });
        return false;
    }
    return true;
}

function setRequestFieldError(field, message) {
    field.setAttribute("aria-invalid", "true");
    field.closest(".request-input-with-icon, .request-select-wrap")?.classList.add("input-error");
    const error = document.getElementById(`${field.id}Error`);
    if (error) error.textContent = message;
}

function clearRequestFieldError(field) {
    field.removeAttribute("aria-invalid");
    field.closest(".request-input-with-icon, .request-select-wrap")?.classList.remove("input-error");
    const error = document.getElementById(`${field.id}Error`);
    if (error) error.textContent = "";
}

function saveRequestDraft() {
    if (requestSubmitting) return;
    const draft = {
        locationRoom: requestValue("locationRoom"),
        equipmentIdentifier: requestValue("equipmentIdentifier"),
        equipmentName: requestValue("equipmentName"),
        makeModel: requestValue("makeModel"),
        problemCategory: requestValue("problemCategory"),
        serviceTeam: requestValue("serviceTeam"),
        priority: requestValue("priority"),
        failureDescription: document.getElementById("failureDescription")?.value || "",
        wardBoyAssistance: Boolean(document.getElementById("wardBoyAssistance")?.checked),
    };
    sessionStorage.setItem(REQUEST_DRAFT_KEY, JSON.stringify(draft));
}

function restoreRequestDraft() {
    if (getQRMaintenancePrefill()) return;
    try {
        const draft = JSON.parse(sessionStorage.getItem(REQUEST_DRAFT_KEY) || "null");
        if (!draft) return;
        ["locationRoom", "equipmentIdentifier", "equipmentName", "makeModel", "problemCategory", "serviceTeam", "failureDescription"]
            .forEach(id => {
                const field = document.getElementById(id);
                if (field && draft[id] != null) field.value = String(draft[id]);
            });
        document.getElementById("wardBoyAssistance").checked = Boolean(draft.wardBoyAssistance);
        setRequestPriority(draft.priority || "Medium");
    } catch (error) {
        sessionStorage.removeItem(REQUEST_DRAFT_KEY);
    }
}

function clearForm(options = {}) {
    const preserveQR = options.preserveQR !== false;
    sessionStorage.removeItem(REQUEST_DRAFT_KEY);
    document.getElementById("maintenanceRequestForm")?.reset();
    initializeRequesterFields();
    unlockRequestEquipmentFields();
    const picker = document.getElementById("departmentAssetPicker");
    if (picker && !picker.disabled) picker.value = "";
    setRequestPriority("Medium");
    document.querySelectorAll(".request-field-error").forEach(error => { error.textContent = ""; });
    document.querySelectorAll('[aria-invalid="true"]').forEach(field => field.removeAttribute("aria-invalid"));
    if (preserveQR && getQRMaintenancePrefill()) applyQRMaintenancePrefill();
    else document.getElementById("qrRequestPrefillBanner")?.remove();
    updateDescriptionCount();
    updateRequestExperience();
    if (!options.silent) showRequestToast("The form has been reset.", "success");
}

function setRequestSubmitting(submitting) {
    requestSubmitting = submitting;
    const button = document.getElementById("submitRequestBtn");
    if (!button) return;
    button.disabled = submitting;
    button.classList.toggle("is-loading", submitting);
    const title = button.querySelector(".request-submit-copy strong");
    const copy = button.querySelector(".request-submit-copy small");
    if (title) title.textContent = submitting ? "Submitting request…" : "Submit maintenance request";
    if (copy) copy.textContent = submitting ? "Please keep this page open" : "Create a trackable ticket";
}

async function submitRequest(event) {
    event?.preventDefault();
    if (requestSubmitting || !validateForm()) {
        if (!requestSubmitting) showRequestToast("Check the highlighted fields and try again.", "error");
        return;
    }
    setRequestSubmitting(true);
    try {
        const response = await fetch("/api/requests", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                department: requestValue("departmentSearch"),
                location: requestValue("locationRoom"),
                equipment_identifier: requestValue("equipmentIdentifier"),
                equipment_name: requestValue("equipmentName"),
                make_model: requestValue("makeModel"),
                priority: requestValue("priority"),
                problem_category: requestValue("problemCategory"),
                service_team: requestValue("serviceTeam"),
                failure_description: document.getElementById("failureDescription").value.trim(),
                request_ward_boy_pickup: Boolean(document.getElementById("wardBoyAssistance")?.checked),
            }),
        });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401 && typeof expireDashboardSession === "function") {
            await expireDashboardSession(data.detail);
            return;
        }
        if (!response.ok) {
            const detail = Array.isArray(data.detail)
                ? data.detail.map(item => item.msg).filter(Boolean).join(" ")
                : data.detail;
            throw new Error(detail || "Unable to save this maintenance request.");
        }

        sessionStorage.removeItem(REQUEST_DRAFT_KEY);
        showSuccess({
            title: "Request submitted",
            message: data.ward_boy_pickup_requested
                ? `Ticket ${data.ticket_number} was created. A Ward Boy pickup job is also available.`
                : `Ticket ${data.ticket_number} was created and sent to the engineering team.`,
            buttonText: "Create another request",
            onClose() {
                sessionStorage.removeItem("qrMaintenancePrefill");
                clearForm({ preserveQR: false, silent: true });
                document.getElementById("locationRoom")?.focus();
            },
        });
    } catch (error) {
        console.error(error);
        showRequestToast(error.message || "Unable to submit this request.", "error");
    } finally {
        setRequestSubmitting(false);
    }
}

function showRequestToast(message, type = "success") {
    const title = type === "success" ? "Maintenance request" : "Request needs attention";
    BioTrackToast.show({ title, message, type });
}
