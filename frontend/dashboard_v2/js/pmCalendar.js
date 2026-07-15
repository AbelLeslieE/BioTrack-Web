// ==========================================
// PM CALENDAR ENGINE
// ==========================================


// ==========================================
// CURRENT DATE
// ==========================================

let pmCurrentDate = new Date();

let pmSelectedDate = null;


// ==========================================
// MONTHS
// ==========================================

const pmMonths = [

    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"

];


// ==========================================
// WEEK DAYS
// ==========================================

const pmWeekDays = [

    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
    "Sun"

];


// ==========================================
// DEMO EVENTS
// (Temporary until backend integration)
// ==========================================

let pmEvents = [

    {
        date:"2026-07-15",
        status:"Scheduled"
    },

    {
        date:"2026-07-18",
        status:"Completed"
    },

    {
        date:"2026-07-21",
        status:"Due"
    },

    {
        date:"2026-07-24",
        status:"Overdue"
    }

];


// ==========================================
// INITIALIZE
// ==========================================

function initializePMCalendar(){

    initializePMCalendarButtons();

    renderPMCalendar();

}


// ==========================================
// BUTTON EVENTS
// ==========================================

function initializePMCalendarButtons(){

    document

        .getElementById("pmPrevMonth")

        .addEventListener(

            "click",

            previousPMMonth

        );

    document

        .getElementById("pmNextMonth")

        .addEventListener(

            "click",

            nextPMMonth

        );

    document

        .getElementById("pmTodayButton")

        .addEventListener(

            "click",

            goToTodayPM

        );

}


// ==========================================
// PREVIOUS MONTH
// ==========================================

function previousPMMonth(){

    pmCurrentDate.setMonth(

        pmCurrentDate.getMonth()-1

    );

    renderPMCalendar();

}


// ==========================================
// NEXT MONTH
// ==========================================

function nextPMMonth(){

    pmCurrentDate.setMonth(

        pmCurrentDate.getMonth()+1

    );

    renderPMCalendar();

}


// ==========================================
// TODAY
// ==========================================

function goToTodayPM(){

    pmCurrentDate = new Date();

    renderPMCalendar();

}
// ==========================================
// RENDER CALENDAR
// ==========================================

function renderPMCalendar() {

    const calendar =
        document.getElementById("pmCalendar");

    if (!calendar) return;

    const year =
        pmCurrentDate.getFullYear();

    const month =
        pmCurrentDate.getMonth();

    document.getElementById("pmCurrentMonth").textContent =
        `${pmMonths[month]} ${year}`;

    calendar.innerHTML = "";

    renderWeekHeader(calendar);

    renderCalendarDays(calendar);

}


// ==========================================
// WEEK HEADER
// ==========================================

function renderWeekHeader(calendar){

    const grid =
        document.createElement("div");

    grid.className =
        "pm-calendar-grid";

    pmWeekDays.forEach(day=>{

        const weekday =
            document.createElement("div");

        weekday.className =
            "pm-weekday";

        weekday.textContent =
            day;

        grid.appendChild(weekday);

    });

    calendar.appendChild(grid);

}
// ==========================================
// RENDER CALENDAR DAYS
// ==========================================

function renderCalendarDays(calendar){

    const grid =
        document.createElement("div");

    grid.className =
        "pm-calendar-grid";

    const year =
        pmCurrentDate.getFullYear();

    const month =
        pmCurrentDate.getMonth();

    // First day of month
    const firstDay =
        new Date(year, month, 1);

    // Last day of month
    const lastDay =
        new Date(year, month + 1, 0);

    // Monday = first column
    let startingDay =
        firstDay.getDay();

    startingDay =
        startingDay === 0 ? 6 : startingDay - 1;

    // Previous month
    const previousMonthLastDay =
        new Date(year, month, 0).getDate();

    // Previous month dates
    for(

        let i = startingDay;

        i > 0;

        i--

    ){

        grid.appendChild(

            createDayCard(

                previousMonthLastDay - i + 1,

                true

            )

        );

    }

    // Current month dates
    for(

        let day = 1;

        day <= lastDay.getDate();

        day++

    ){

        const currentDate =

            new Date(

                year,

                month,

                day

            );

        grid.appendChild(

            createDayCard(

                day,

                false,

                currentDate

            )

        );

    }

    // Fill remaining cells
    const totalCells =
        grid.children.length;

    const remaining =
        42 - totalCells;

    for(

        let day = 1;

        day <= remaining;

        day++

    ){

        grid.appendChild(

            createDayCard(

                day,

                true

            )

        );

    }

    calendar.appendChild(grid);

}
// ==========================================
// CREATE DAY CARD
// ==========================================

function createDayCard(day, otherMonth = false, date = null) {

    const card =
        document.createElement("div");

    card.className =
        "pm-day";

    if (otherMonth) {

        card.classList.add("other-month");

    }

    // Today's Date
    if (date && isToday(date)) {

        card.classList.add("today");

    }

    // Day Number
    const number =
        document.createElement("div");

    number.className =
        "pm-day-number";

    number.textContent =
        day;

    card.appendChild(number);

    // Event
    if (date) {

        const event =
            getPMEvent(date);

        if (event) {

            // Status Dot
            const dot =
                document.createElement("div");

            dot.className =
                `pm-status-dot ${event.status.toLowerCase()}`;

            card.appendChild(dot);

            // Event Chip
            const chip =
                document.createElement("div");

            chip.className =
                `pm-event ${event.status.toLowerCase()}`;

            chip.textContent =
                event.status;

            card.appendChild(chip);

        }

        card.addEventListener("click", () => {

            selectPMDate(date);

            openPMDrawer(date);

        });

    }

    return card;

}


// ==========================================
// TODAY CHECK
// ==========================================

function isToday(date){

    const today = new Date();

    return (

        today.getFullYear() === date.getFullYear()

        &&

        today.getMonth() === date.getMonth()

        &&

        today.getDate() === date.getDate()

    );

}


// ==========================================
// GET EVENT
// ==========================================

function getPMEvent(date){

    const formatted =
        formatPMDate(date);

    return pmEvents.find(event =>

        event.date === formatted

    );

}


// ==========================================
// FORMAT DATE
// ==========================================

function formatPMDate(date){

    const year =
        date.getFullYear();

    const month =
        String(

            date.getMonth() + 1

        ).padStart(2,"0");

    const day =
        String(

            date.getDate()

        ).padStart(2,"0");

    return `${year}-${month}-${day}`;

}


// ==========================================
// SELECT DATE
// ==========================================

function selectPMDate(date){

    pmSelectedDate = date;

    console.log(

        "Selected PM Date:",

        formatPMDate(date)

    );

    // Next Phase:
    // openPMScheduleDrawer(date);

}
// ==========================================
// SET EVENTS
// ==========================================

function setPMEvents(events = []) {

    pmEvents = Array.isArray(events)

        ? events

        : [];

    refreshPMCalendar();

}


// ==========================================
// ADD EVENT
// ==========================================

function addPMEvent(event) {

    if (!event) return;

    pmEvents.push(event);

    refreshPMCalendar();

}


// ==========================================
// REMOVE EVENT
// ==========================================

function removePMEvent(date) {

    pmEvents = pmEvents.filter(event =>

        event.date !== date

    );

    refreshPMCalendar();

}


// ==========================================
// CLEAR EVENTS
// ==========================================

function clearPMEvents() {

    pmEvents = [];

    refreshPMCalendar();

}


// ==========================================
// REFRESH
// ==========================================

function refreshPMCalendar() {

    renderPMCalendar();

}


// ==========================================
// GET SELECTED DATE
// ==========================================

function getSelectedPMDate() {

    return pmSelectedDate;

}


// ==========================================
// GET CURRENT MONTH
// ==========================================

function getCurrentPMMonth() {

    return {

        month: pmCurrentDate.getMonth(),

        year: pmCurrentDate.getFullYear()

    };

}


// ==========================================
// GO TO DATE
// ==========================================

function goToPMDate(date) {

    if (!(date instanceof Date)) {

        date = new Date(date);

    }

    if (isNaN(date)) return;

    pmCurrentDate = new Date(date);

    refreshPMCalendar();

}


// ==========================================
// INITIALIZE SAFELY
// ==========================================

function initializePMCalendarSafely() {

    if (

        !document.getElementById("pmCalendar")

    ) {

        return;

    }

    initializePMCalendar();

}


// ==========================================
// PUBLIC API
// ==========================================

window.initializePMCalendar =
    initializePMCalendar;

window.refreshPMCalendar =
    refreshPMCalendar;

window.setPMEvents =
    setPMEvents;

window.addPMEvent =
    addPMEvent;

window.removePMEvent =
    removePMEvent;

window.clearPMEvents =
    clearPMEvents;

window.goToPMDate =
    goToPMDate;

window.getCurrentPMMonth =
    getCurrentPMMonth;

window.getSelectedPMDate =
    getSelectedPMDate;