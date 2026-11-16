/* ==========================================================
   BIOTRACK REPORTS
   reports.js
========================================================== */
/* ==========================================================
   API
========================================================== */

let reportScheduleTimers = [];

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

async function initializeReports(){

    initializeReportsFilters();

    initializeReportsRipple();

    initializeReportChartExpanders();

    await animateReportsKPIs();

    loadReportsFilters();

    initializeReportsCharts();

    initializeReportsExport();

}

function initializeReportChartExpanders(){
    document.querySelectorAll(".reports-icon-button").forEach(button=>{
        button.addEventListener("click",()=>{
            const card=button.closest(".reports-card");
            const canvas=card?.querySelector("canvas");
            const chart=canvas&&typeof Chart!=="undefined"?Chart.getChart(canvas):null;
            if(!card||!canvas||!chart){
                showReportsToast("Chart is not ready yet. Please try again.");
                return;
            }
            let dialog=document.getElementById("reportsChartDialog");
            if(!dialog){
                dialog=document.createElement("dialog");
                dialog.id="reportsChartDialog";
                dialog.className="reports-chart-dialog";
                dialog.innerHTML='<form method="dialog"><button class="reports-chart-dialog-close" aria-label="Close expanded chart">×</button></form><h2></h2><img alt="Expanded report chart">';
                dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close();});
                document.body.appendChild(dialog);
            }
            dialog.querySelector("h2").textContent=card.querySelector("h3")?.textContent||"Report chart";
            dialog.querySelector("img").src=chart.toBase64Image();
            if(!dialog.open)dialog.showModal();
        });
    });
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

function reportsDarkModeEnabled(){
    return document.body.classList.contains("dark-theme");
}

function reportsChartGridColor(){
    return reportsDarkModeEnabled() ? "rgba(148,163,184,.18)" : "#eef2f7";
}

function applyReportsChartTheme(){
    if(typeof Chart === "undefined") return;
    Chart.defaults.color = reportsDarkModeEnabled() ? "#aebed2" : "#64748b";
    Chart.defaults.borderColor = reportsChartGridColor();
}

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

    applyReportsChartTheme();

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

                    grid:{color:reportsChartGridColor()}

                }

            }

        }

    });

}

/* ==========================================================
   STATUS CHART
========================================================== */

function createReportsStatusChart(){

    applyReportsChartTheme();

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

    applyReportsChartTheme();

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

    applyReportsChartTheme();

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

                    grid:{color:reportsChartGridColor()}

                }

            }

        }

    });

}

/* ==========================================================
   DOWNTIME TREND
========================================================== */

function createReportsDowntimeChart(){

    applyReportsChartTheme();

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

                    grid:{color:reportsChartGridColor()}

                }

            }

        }

    });

}
/* ==========================================================
   EXPORT
========================================================== */

function initializeReportsExport(){

    registerReportsExport("reportsPdfBtn", "pdf");
    registerReportsExport("reportsExcelBtn", "xlsx");
    registerReportsExport("reportsCsvBtn", "csv");

    const scheduleButton=document.getElementById(

        "reportsScheduleBtn"

    );

    if(scheduleButton){

        scheduleButton.addEventListener(

            "click",

            openReportsScheduleDialog

        );

    }

    void loadAndArmReportSchedules();

}

function currentReportsFilters(){
    const normalize = (value, allPrefix) => value && !value.toLowerCase().startsWith(allPrefix) ? value : "";
    return {
        start_date:getReportsValue("reportsStartDate"),
        end_date:getReportsValue("reportsEndDate"),
        department:normalize(getReportsValue("reportsDepartment"), "all department"),
        location:normalize(getReportsValue("reportsLocation"), "all location"),
        equipment:normalize(getReportsValue("reportsEquipment"), "all equipment"),
    };
}

function reportsExportUrl(type,filters=currentReportsFilters()){
    const params=new URLSearchParams();
    Object.entries(filters||{}).forEach(([key,value])=>{if(value)params.set(key,value);});
    const query=params.toString();
    return `/api/reports/export/${type}${query?`?${query}`:""}`;
}

async function downloadReportsExport(type,button=null,filters=currentReportsFilters(),notify=true){
    const labels={pdf:"PDF",xlsx:"Excel",csv:"CSV"};
    const original=button?.innerHTML;
    if(button){
        button.disabled=true;
        button.innerHTML='<span class="reports-loader"></span> Generating...';
    }
    try{
        const response=await fetch(reportsExportUrl(type,filters));
        if(!response.ok){
            const result=await response.json().catch(()=>({}));
            throw new Error(result.detail||`Unable to generate the ${labels[type]||type} report.`);
        }
        const blob=await response.blob();
        const disposition=response.headers.get("Content-Disposition")||"";
        const filenameMatch=disposition.match(/filename="?([^";]+)"?/i);
        const filename=filenameMatch?.[1]||`BioTrack-report.${type}`;
        const url=URL.createObjectURL(blob);
        const anchor=document.createElement("a");
        anchor.href=url;
        anchor.download=filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(()=>URL.revokeObjectURL(url),1000);
        if(notify)showReportsToast(`${labels[type]||type} report ready`,`${filename} was downloaded.`,"success");
        return true;
    }catch(error){
        showReportsToast("Report export failed",error.message||"The report could not be generated.","error");
        return false;
    }finally{
        if(button){
            button.disabled=false;
            button.innerHTML=original;
        }
    }
}

function registerReportsExport(id,type){

    const button=document.getElementById(id);

    if(!button) return;

    button.addEventListener(

        "click",

        ()=>downloadReportsExport(type,button)

    );

}

function localDateTimeInputValue(date){
    const local=new Date(date.getTime()-date.getTimezoneOffset()*60000);
    return local.toISOString().slice(0,16);
}

function closeReportsScheduleDialog(){
    document.getElementById("reportsScheduleOverlay")?.remove();
}

function cleanupReportsSchedules(){
    closeReportsScheduleDialog();
    reportScheduleTimers.forEach(timer=>window.clearTimeout(timer));
    reportScheduleTimers=[];
}

function openReportsScheduleDialog(){
    closeReportsScheduleDialog();
    const firstRun=new Date(Date.now()+60*60*1000);
    firstRun.setMinutes(Math.ceil(firstRun.getMinutes()/15)*15,0,0);
    const overlay=document.createElement("div");
    overlay.id="reportsScheduleOverlay";
    overlay.className="reports-schedule-overlay";
    overlay.innerHTML=`
        <section class="reports-schedule-dialog" role="dialog" aria-modal="true" aria-labelledby="reportsScheduleTitle">
            <header><span><i class="fa-solid fa-calendar-days"></i></span><div><h2 id="reportsScheduleTitle">Schedule a report</h2><p>Save a recurring export. BioTrack will download it when Reports is open at the scheduled time.</p></div><button type="button" class="reports-schedule-close" aria-label="Close">×</button></header>
            <form id="reportsScheduleForm">
                <label>Report format<select id="scheduledReportFormat"><option value="pdf">PDF</option><option value="xlsx">Excel</option><option value="csv">CSV</option></select></label>
                <label>Frequency<select id="scheduledReportFrequency"><option value="once">One time</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
                <label class="is-wide">First run<input id="scheduledReportDate" type="datetime-local" required value="${localDateTimeInputValue(firstRun)}"></label>
                <div class="reports-schedule-filter-note is-wide"><i class="fa-solid fa-filter"></i><span>The current report filters will be saved with this schedule.</span></div>
                <footer class="is-wide"><button type="button" class="reports-btn-secondary" id="cancelReportSchedule">Cancel</button><button type="submit" class="reports-btn-primary" id="saveReportSchedule"><i class="fa-solid fa-calendar-check"></i> Save schedule</button></footer>
            </form>
        </section>`;
    document.body.appendChild(overlay);
    overlay.querySelector(".reports-schedule-close").onclick=closeReportsScheduleDialog;
    overlay.querySelector("#cancelReportSchedule").onclick=closeReportsScheduleDialog;
    overlay.addEventListener("click",event=>{if(event.target===overlay)closeReportsScheduleDialog();});
    overlay.querySelector("#reportsScheduleForm").onsubmit=saveReportSchedule;
}

async function saveReportSchedule(event){
    event.preventDefault();
    const button=document.getElementById("saveReportSchedule");
    button.disabled=true;
    try{
        const response=await fetch("/api/reports/schedules",{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({
                report_format:getReportsValue("scheduledReportFormat"),
                frequency:getReportsValue("scheduledReportFrequency"),
                next_run_at:getReportsValue("scheduledReportDate"),
                filters:currentReportsFilters(),
            }),
        });
        const result=await response.json().catch(()=>({}));
        if(!response.ok||!result.success)throw new Error(result.detail||"Unable to save this report schedule.");
        closeReportsScheduleDialog();
        showReportsToast("Report scheduled",`First export: ${new Date(result.next_run_at).toLocaleString()}.`,"success");
        await loadAndArmReportSchedules();
    }catch(error){
        showReportsToast("Schedule not saved",error.message||"Unable to save this report schedule.","error");
        button.disabled=false;
    }
}

async function runScheduledReport(schedule){
    const downloaded=await downloadReportsExport(schedule.report_format,null,schedule.filters,false);
    if(!downloaded)return;
    const response=await fetch(`/api/reports/schedules/${Number(schedule.id)}/complete`,{method:"POST"});
    if(response.ok){
        showReportsToast("Scheduled report ready",`${String(schedule.report_format).toUpperCase()} report downloaded automatically.`,"success");
        await loadAndArmReportSchedules();
    }
}

async function loadAndArmReportSchedules(){
    reportScheduleTimers.forEach(timer=>window.clearTimeout(timer));
    reportScheduleTimers=[];
    try{
        const response=await fetch("/api/reports/schedules");
        if(!response.ok)return;
        const schedules=await response.json();
        schedules.forEach(schedule=>{
            const delay=new Date(schedule.next_run_at).getTime()-Date.now();
            if(delay>2147483647)return;
            const timer=window.setTimeout(()=>runScheduledReport(schedule),Math.max(0,delay));
            reportScheduleTimers.push(timer);
        });
    }catch(error){
        console.error("Unable to arm report schedules",error);
    }
}

/* ==========================================================
   TOAST
========================================================== */

function showReportsToast(title,message,type="info"){
    BioTrackToast.show({ title, message, type });
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
