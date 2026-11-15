(function exposeHospitalDepartments(global) {
    const departments = [
        "Anaesthesiology and Critical Care",
        "Audiology and Speech Language Pathology",
        "Cardiothoracic Surgery",
        "Dental and Maxillofacial Surgery",
        "Dermatology",
        "ENT (Ear, Nose and Throat)",
        "Gastroenterology",
        "General Medicine",
        "General Surgery",
        "Haemato-Oncology",
        "Heart Care Centre (Cardiology)",
        "Neonatology",
        "Nephrology",
        "Neurology",
        "Neurosurgery",
        "Obstetrics and Gynaecology",
        "Ophthalmology",
        "Orthopaedics and Trauma Surgery",
        "Paediatrics",
        "Physiotherapy",
        "Pathology",
        "Plastic Surgery",
        "Psychiatry",
        "Pulmonology",
        "Radiology",
        "Urology",
        "Research",
    ];

    function escapeOption(value) {
        if (typeof global.escapeHTML === "function") return global.escapeHTML(value);
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    global.HOSPITAL_DEPARTMENTS = Object.freeze(departments.slice());
    global.renderHospitalDepartmentOptions = function renderHospitalDepartmentOptions(
        selectedDepartment = "",
        placeholder = "Select a department",
    ) {
        const selected = String(selectedDepartment || "").trim();
        const knownDepartment = departments.includes(selected);
        const placeholderOption = `<option value="" ${selected ? "" : "selected"} disabled>${escapeOption(placeholder)}</option>`;
        const existingOption = selected && !knownDepartment
            ? `<option value="${escapeOption(selected)}" selected>${escapeOption(selected)} (existing)</option>`
            : "";
        const options = departments.map(department => (
            `<option value="${escapeOption(department)}" ${department === selected ? "selected" : ""}>${escapeOption(department)}</option>`
        )).join("");
        return placeholderOption + existingOption + options;
    };
})(window);
