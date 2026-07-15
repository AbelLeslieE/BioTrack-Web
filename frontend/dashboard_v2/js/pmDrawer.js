// ==========================================
// PM DRAWER
// ==========================================

let selectedPMDate = null;


// ==========================================
// ELEMENTS
// ==========================================

const pmDrawerOverlay =
    () => document.getElementById("pmDrawerOverlay");

const pmDrawer =
    () => document.getElementById("pmDrawer");

const pmDateInput =
    () => document.getElementById("pmDate");

const pmCloseButton =
    () => document.getElementById("pmDrawerClose");

const pmCancelButton =
    () => document.getElementById("pmCancelButton");

const pmScheduleButton =
    () => document.getElementById("pmScheduleButton");


// ==========================================
// INITIALIZE
// ==========================================

function initializePMDrawer(){

    if(!pmDrawerOverlay()) return;

    pmCloseButton()?.addEventListener(

        "click",

        closePMDrawer

    );

    pmCancelButton()?.addEventListener(

        "click",

        closePMDrawer

    );

    pmDrawerOverlay()?.addEventListener(

        "click",

        function(e){

            if(e.target === pmDrawerOverlay()){

                closePMDrawer();

            }

        }

    );
    pmScheduleButton()

        ?.addEventListener(

            "click",

            savePMSchedule

        );
    // Department Changed

    document

        .getElementById("pmDepartment")

        ?.addEventListener(

            "change",

            function(){

                populateDepartmentAssets(

                    this.value

                );

            }

        );
    document.addEventListener(

        "keydown",

        function(e){

            if(

                e.key === "Escape" &&

                pmDrawerOverlay().classList.contains("active")

            ){

                closePMDrawer();

            }

        }

    );

}


// ==========================================
// OPEN
// ==========================================

function openPMDrawer(date){

    selectedPMDate = date;

    if(pmDateInput()){

        pmDateInput().value =

            formatDrawerDate(date);
            loadPMDrawerData();

    }

    pmDrawerOverlay()

        .classList

        .add("active");

}


// ==========================================
// CLOSE
// ==========================================

function closePMDrawer(){

    pmDrawerOverlay()

        .classList

        .remove("active");

}


// ==========================================
// FORMAT DATE
// ==========================================

function formatDrawerDate(date){

    return date.toLocaleDateString(

        "en-IN",

        {

            weekday:"long",

            day:"numeric",

            month:"long",

            year:"numeric"

        }

    );

}


// ==========================================
// GET SELECTED DATE
// ==========================================

function getSelectedPMDate(){

    return selectedPMDate;

}


// ==========================================
// GLOBAL
// ==========================================

window.openPMDrawer =
    openPMDrawer;

window.closePMDrawer =
    closePMDrawer;

window.getSelectedPMDate =
    getSelectedPMDate;

// ==========================================
// LOAD FORM DATA
// ==========================================

async function loadPMDrawerData(){

    await Promise.all([

        loadPMDepartments(),

        loadPMEngineers(),

        loadPMAssets()

    ]);

}

// ==========================================
// LOAD DEPARTMENTS
// ==========================================

async function loadPMDepartments(){

    const departmentSelect =

        document.getElementById("pmDepartment");

    if(!departmentSelect) return;

    try{

        const response = await fetch(

            "/api/departments"

        );

        const departments = await response.json();

        departmentSelect.innerHTML =

            `<option value="">Select Department</option>`;

        departments.forEach(department=>{

            departmentSelect.innerHTML += `

                <option value="${department.name}">

                    ${department.name}

                </option>

            `;

        });

    }

    catch(error){

        console.error(

            "Unable to load departments.",

            error

        );

    }

}
// ==========================================
// LOAD ENGINEERS
// ==========================================

async function loadPMEngineers(){

    const engineerSelect =

        document.getElementById("pmEngineer");

    if(!engineerSelect) return;

    try{

        const response = await fetch(

            "/api/users"

        );

        const users = await response.json();

        engineerSelect.innerHTML =

            `<option value="">Assign Engineer</option>`;

        users

        .filter(user=>

            user.role.toLowerCase()==="engineer"

        )

        .forEach(engineer=>{

            engineerSelect.innerHTML += `

                <option value="${engineer.id}">

                    ${engineer.name}

                </option>

            `;

        });

    }

    catch(error){

        console.error(

            "Unable to load engineers.",

            error

        );

    }

}

// ==========================================
// LOAD EQUIPMENT
// ==========================================

let pmAssets = [];

async function loadPMAssets(){

    try{

        const response = await fetch(

            "/api/assets/"

        );

        pmAssets = await response.json();

    }

    catch(error){

        console.error(

            error

        );

    }

}
// ==========================================
// POPULATE EQUIPMENT
// ==========================================

function populateDepartmentAssets(

    department

){

    const equipment =

        document.getElementById(

            "pmEquipment"

        );

    equipment.innerHTML =

        `<option value="">

            Select Equipment

        </option>`;

    pmAssets

    .filter(asset=>

        asset.department === department

    )

    .forEach(asset=>{

        equipment.innerHTML += `

            <option value="${asset.id}">

                ${asset.equipment_name}

            </option>

        `;

    });

}
// ==========================================
// SAVE PM SCHEDULE
// ==========================================

async function savePMSchedule(){

    const equipment =
        document.getElementById("pmEquipment");

    const engineer =
        document.getElementById("pmEngineer");

    const remarks =
        document.getElementById("pmRemarks");

    // Validation
    if(!equipment.value){

        alert("Please select equipment.");

        return;

    }

    if(!engineer.value){

        alert("Please assign an engineer.");

        return;

    }

    // Get selected asset
    const asset = pmAssets.find(

        item => item.id == equipment.value

    );

    if(!asset){

        alert("Asset not found.");

        return;

    }

    const payload = {

        asset_id: asset.id,

        frequency_days: asset.pm_frequency,

        scheduled_date:
            formatPMDate(selectedPMDate),

        engineer_id:
            parseInt(engineer.value),

        remarks:
            remarks.value.trim()

    };

    try{

        const response = await fetch(

            "/api/pm/create",

            {

                method:"POST",

                headers:{

                    "Content-Type":"application/json"

                },

                body:JSON.stringify(payload)

            }

        );

        if(!response.ok){

            throw new Error(

                "Unable to create PM Schedule."

            );

        }

        showSuccess({

            title:"PM Scheduled",

            message:

                "Preventive maintenance has been scheduled successfully.",

            buttonText:"Continue",

            onClose(){

                closePMDrawer();

            }

        });

    }

    catch(error){

        console.error(error);

        alert(

            "Unable to schedule preventive maintenance."

        );

    }

}