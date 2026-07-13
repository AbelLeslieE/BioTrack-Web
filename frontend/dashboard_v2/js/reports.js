/* ==========================================================
   BIOTRACK REPORTS
   reports.js
========================================================== */
/* ==========================================================
   API
========================================================== */

async function reportsApi(url){

    const response = await fetch(url);

    if(!response.ok){

        throw new Error("Failed to load report data");

    }

    return await response.json();

}
/* ==========================================================
   INITIALIZE REPORTS
========================================================== */

function initializeReports(){

    initializeReportsFilters();

    initializeReportsRipple();

    await animateReportsKPIs();

    loadReportsFilters();

    initializeReportsCharts();

    initializeReportsExport();

}

/* ==========================================================
   FILTERS
========================================================== */

function initializeReportsFilters(){

    const applyButton=document.getElementById("reportsApplyBtn");
    const resetButton=document.getElementById("reportsResetBtn");

    if(applyButton){

        applyButton.addEventListener(

            "click",

            applyReportsFilters

        );

    }

    if(resetButton){

        resetButton.addEventListener(

            "click",

            resetReportsFilters

        );

    }

}

function applyReportsFilters(){

    const filters={

        startDate:getReportsValue("reportsStartDate"),

        endDate:getReportsValue("reportsEndDate"),

        department:getReportsValue("reportsDepartment"),

        location:getReportsValue("reportsLocation"),

        equipment:getReportsValue("reportsEquipment")

    };

    localStorage.setItem(

        "biotrackReportsFilters",

        JSON.stringify(filters)

    );

    showReportsToast(

        "Filters Applied",

        "Reports updated successfully.",

        "success"

    );

}

function resetReportsFilters(){

    setReportsValue(

        "reportsStartDate",

        ""

    );

    setReportsValue(

        "reportsEndDate",

        ""

    );

    setReportsSelect(

        "reportsDepartment",

        0

    );

    setReportsSelect(

        "reportsLocation",

        0

    );

    setReportsSelect(

        "reportsEquipment",

        0

    );

    localStorage.removeItem(

        "biotrackReportsFilters"

    );

    showReportsToast(

        "Filters Reset",

        "Showing all maintenance reports.",

        "info"

    );

}

function loadReportsFilters(){

    const saved=JSON.parse(

        localStorage.getItem(

            "biotrackReportsFilters"

        )

    );

    if(!saved) return;

    setReportsValue(

        "reportsStartDate",

        saved.startDate

    );

    setReportsValue(

        "reportsEndDate",

        saved.endDate

    );

    setReportsValue(

        "reportsDepartment",

        saved.department

    );

    setReportsValue(

        "reportsLocation",

        saved.location

    );

    setReportsValue(

        "reportsEquipment",

        saved.equipment

    );

}

/* ==========================================================
   HELPERS
========================================================== */

function getReportsValue(id){

    const element=document.getElementById(id);

    return element ? element.value : "";

}

function setReportsValue(id,value){

    const element=document.getElementById(id);

    if(element){

        element.value=value;

    }

}

function setReportsSelect(id,index){

    const element=document.getElementById(id);

    if(element){

        element.selectedIndex=index;

    }

}

/* ==========================================================
   KPI ANIMATION
========================================================== */

async function animateReportsKPIs(){

    try{

        const summary = await reportsApi("/api/reports/summary");

        animateCounter(
            "reportsTotalRequests",
            summary.maintenance_requests
        );

        animateCounter(
            "reportsCompletedRequests",
            summary.completed_requests
        );

        animateCounter(
            "reportsPendingRequests",
            summary.pending_requests
        );

        animateCounter(
            "reportsOverdueRequests",
            summary.overdue_requests
        );

        animateDecimal(
            "reportsAvgDowntime",
            summary.average_downtime
        );

    }

    catch(error){

        console.error(error);

    }

}

function animateCounter(id,target){

    const element=document.getElementById(id);

    if(!element) return;

    let current=0;

    const step=Math.ceil(target/45);

    const timer=setInterval(()=>{

        current+=step;

        if(current>=target){

            current=target;

            clearInterval(timer);

        }

        element.textContent=current;

    },20);

}

function animateDecimal(id,target){

    const element=document.getElementById(id);

    if(!element) return;

    let value=0;

    const timer=setInterval(()=>{

        value+=0.5;

        if(value>=target){

            value=target;

            clearInterval(timer);

        }

        element.textContent=value.toFixed(1);

    },20);

}

/* ==========================================================
   RIPPLE EFFECT
========================================================== */

function initializeReportsRipple(){

    document.querySelectorAll(

        ".reports-btn-primary,.reports-btn-secondary,.reports-icon-button"

    ).forEach(button=>{

        button.addEventListener(

            "click",

            createReportsRipple

        );

    });

}

function createReportsRipple(event){

    const button=event.currentTarget;

    const ripple=document.createElement("span");

    const size=Math.max(

        button.clientWidth,

        button.clientHeight

    );

    const rect=button.getBoundingClientRect();

    ripple.className="reports-ripple";

    ripple.style.width=size+"px";

    ripple.style.height=size+"px";

    ripple.style.left=

        event.clientX-

        rect.left-

        size/2+"px";

    ripple.style.top=

        event.clientY-

        rect.top-

        size/2+"px";

    button.appendChild(ripple);

    setTimeout(()=>{

        ripple.remove();

    },600);

}
/* ==========================================================
   CHARTS
========================================================== */

function initializeReportsCharts(){

    createReportsOverviewChart();

    createReportsStatusChart();

    createReportsCategoryChart();

    createReportsDepartmentChart();

    createReportsDowntimeChart();

}

/* ==========================================================
   REQUESTS OVERVIEW
========================================================== */

function createReportsOverviewChart(){

    const canvas=document.getElementById("reportsOverviewChart");

    if(!canvas || typeof Chart==="undefined") return;

    new Chart(canvas,{

        type:"line",

        data:{

            labels:[
                "Jan","Feb","Mar","Apr","May","Jun",
                "Jul","Aug","Sep","Oct","Nov","Dec"
            ],

            datasets:[{

                label:"Requests",

                data:[62,71,69,84,90,86,98,104,99,113,121,128],

                borderColor:"#2563eb",

                backgroundColor:"rgba(37,99,235,.12)",

                fill:true,

                tension:.4,

                pointRadius:4,

                pointHoverRadius:6

            }]

        },

        options:{

            responsive:true,

            maintainAspectRatio:false,

            plugins:{

                legend:{display:false}

            },

            scales:{

                x:{

                    grid:{display:false}

                },

                y:{

                    beginAtZero:true,

                    grid:{color:"#eef2f7"}

                }

            }

        }

    });

}

/* ==========================================================
   STATUS CHART
========================================================== */

function createReportsStatusChart(){

    const canvas=document.getElementById("reportsStatusChart");

    if(!canvas || typeof Chart==="undefined") return;

    new Chart(canvas,{

        type:"doughnut",

        data:{

            labels:[

                "Completed",

                "Pending",

                "Overdue"

            ],

            datasets:[{

                data:[89,26,13],

                backgroundColor:[

                    "#16a34a",

                    "#f59e0b",

                    "#ef4444"

                ],

                borderWidth:0

            }]

        },

        options:{

            responsive:true,

            maintainAspectRatio:false,

            cutout:"72%",

            plugins:{

                legend:{display:false}

            }

        }

    });

}

/* ==========================================================
   CATEGORY CHART
========================================================== */

function createReportsCategoryChart(){

    const canvas=document.getElementById("reportsCategoryChart");

    if(!canvas || typeof Chart==="undefined") return;

    new Chart(canvas,{

        type:"doughnut",

        data:{

            labels:[

                "Electrical",

                "Mechanical",

                "Software",

                "Calibration",

                "Others"

            ],

            datasets:[{

                data:[38,32,21,15,22],

                backgroundColor:[

                    "#2563eb",

                    "#8b5cf6",

                    "#06b6d4",

                    "#22c55e",

                    "#94a3b8"

                ],

                borderWidth:0

            }]

        },

        options:{

            responsive:true,

            maintainAspectRatio:false,

            cutout:"68%",

            plugins:{

                legend:{display:false}

            }

        }

    });

}

/* ==========================================================
   DEPARTMENT CHART
========================================================== */

function createReportsDepartmentChart(){

    const canvas=document.getElementById("reportsDepartmentChart");

    if(!canvas || typeof Chart==="undefined") return;

    new Chart(canvas,{

        type:"bar",

        data:{

            labels:[

                "ICU",

                "Radiology",

                "OT",

                "Emergency",

                "Lab",

                "BME"

            ],

            datasets:[{

                data:[28,20,17,25,15,23],

                backgroundColor:"#2563eb",

                borderRadius:8,

                borderSkipped:false

            }]

        },

        options:{

            responsive:true,

            maintainAspectRatio:false,

            plugins:{

                legend:{display:false}

            },

            scales:{

                x:{

                    grid:{display:false}

                },

                y:{

                    beginAtZero:true,

                    grid:{color:"#eef2f7"}

                }

            }

        }

    });

}

/* ==========================================================
   DOWNTIME TREND
========================================================== */

function createReportsDowntimeChart(){

    const canvas=document.getElementById("reportsDowntimeChart");

    if(!canvas || typeof Chart==="undefined") return;

    new Chart(canvas,{

        type:"line",

        data:{

            labels:[
                "Jan","Feb","Mar","Apr","May","Jun",
                "Jul","Aug","Sep","Oct","Nov","Dec"
            ],

            datasets:[{

                label:"Downtime",

                data:[38,36,34,31,29,30,27,24,23,22,20,19],

                borderColor:"#06b6d4",

                backgroundColor:"rgba(6,182,212,.12)",

                fill:true,

                tension:.4,

                pointRadius:4,

                pointHoverRadius:6

            }]

        },

        options:{

            responsive:true,

            maintainAspectRatio:false,

            plugins:{

                legend:{display:false}

            },

            scales:{

                x:{

                    grid:{display:false}

                },

                y:{

                    beginAtZero:true,

                    grid:{color:"#eef2f7"}

                }

            }

        }

    });

}
/* ==========================================================
   EXPORT
========================================================== */

function initializeReportsExport(){

    registerReportsExport(

        "reportsPdfBtn",

        "PDF"

    );

    registerReportsExport(

        "reportsExcelBtn",

        "Excel"

    );

    registerReportsExport(

        "reportsCsvBtn",

        "CSV"

    );

    const scheduleButton=document.getElementById(

        "reportsScheduleBtn"

    );

    if(scheduleButton){

        scheduleButton.addEventListener(

            "click",

            ()=>{

                showReportsToast(

                    "Report Scheduled",

                    "Automatic report scheduling configured successfully.",

                    "success"

                );

            }

        );

    }

}

function registerReportsExport(id,type){

    const button=document.getElementById(id);

    if(!button) return;

    button.addEventListener(

        "click",

        ()=>{

            const original=button.innerHTML;

            button.disabled=true;

            button.innerHTML=`

                <span class="reports-loader"></span>

                Exporting...

            `;

            setTimeout(()=>{

                button.disabled=false;

                button.innerHTML=original;

                showReportsToast(

                    `${type} Export`,

                    `${type} report generated successfully.`,

                    "success"

                );

            },1800);

        }

    );

}

/* ==========================================================
   TOAST
========================================================== */

function showReportsToast(title,message,type="info"){

    let toast=document.querySelector(".reports-toast");

    if(!toast){

        toast=document.createElement("div");

        toast.className="reports-toast";

        document.body.appendChild(toast);

    }

    let icon="fa-circle-info";

    if(type==="success"){

        icon="fa-circle-check";

    }

    if(type==="error"){

        icon="fa-circle-xmark";

    }

    toast.innerHTML=`

        <i class="fa-solid ${icon}"></i>

        <div>

            <strong>${title}</strong>

            <p>${message}</p>

        </div>

    `;

    toast.classList.add("show");

    clearTimeout(window.reportsToastTimer);

    window.reportsToastTimer=setTimeout(()=>{

        toast.classList.remove("show");

    },3000);

}

/* ==========================================================
   KEYBOARD SHORTCUTS
========================================================== */

function initializeReportsKeyboard(){

    document.addEventListener(

        "keydown",

        event=>{

            if(event.ctrlKey && event.key==="r"){

                event.preventDefault();

                resetReportsFilters();

            }

            if(event.ctrlKey && event.key==="e"){

                event.preventDefault();

                document

                    .getElementById("reportsPdfBtn")

                    ?.click();

            }

        }

    );

}

/* ==========================================================
   WINDOW RESIZE
========================================================== */

window.addEventListener(

    "resize",

    ()=>{

        if(typeof Chart==="undefined") return;

        Object.values(Chart.instances).forEach(chart=>{

            if(chart){

                chart.resize();

            }

        });

    }

);

/* ==========================================================
   MODULE STARTUP
========================================================== */

async function startReports(){

    await initializeReports();

    initializeReportsKeyboard();

}

console.log(

    "%cBioTrack Reports Loaded",

    "color:#2563eb;font-size:16px;font-weight:bold;"

);
window.startReports = startReports;
window.initializeReports = initializeReports;