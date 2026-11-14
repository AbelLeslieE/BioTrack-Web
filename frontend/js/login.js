// ==========================================
// LOGIN ELEMENTS
// ==========================================

const form = document.getElementById("loginForm");
const msg = document.getElementById("message");

const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const submitButton = form.querySelector("button[type='submit']");

// ==========================================
// SLOW CONNECTION FALLBACK
// ==========================================

const BACKGROUND_WAIT_MS = 8000;
const desktopBackground = "/static/assets/little-flower-hospital-campus.png";
const mobileBackground = "/static/assets/little-flower-hospital-campus-mobile.png";
const mobileBackgroundQuery = window.matchMedia("(max-width: 900px)");
let backgroundTimer;
let backgroundAttempt = 0;
let fallbackLocked = false;

function activateLowBandwidthLogin(message = "") {
    if (!fallbackLocked) {
        fallbackLocked = true;
        clearTimeout(backgroundTimer);
        document.body.classList.add("low-bandwidth-login");
        usernameInput.placeholder = "Username";
        passwordInput.placeholder = "Password";
    }

    if (message && !msg.textContent) {
        msg.style.color = "#475569";
        msg.textContent = message;
    }
}

function monitorLoginBackground() {
    if (fallbackLocked) return;

    const attempt = ++backgroundAttempt;
    const source = mobileBackgroundQuery.matches
        ? mobileBackground
        : desktopBackground;
    const image = new Image();

    clearTimeout(backgroundTimer);
    backgroundTimer = setTimeout(() => {
        if (attempt === backgroundAttempt) activateLowBandwidthLogin();
    }, BACKGROUND_WAIT_MS);

    image.addEventListener("load", () => {
        if (attempt === backgroundAttempt && !fallbackLocked) {
            clearTimeout(backgroundTimer);
            document.body.classList.add("login-background-ready");
        }
    }, { once:true });

    image.addEventListener("error", () => {
        if (attempt === backgroundAttempt) activateLowBandwidthLogin();
    }, { once:true });

    image.src = source;
}

window.activateLowBandwidthLogin = activateLowBandwidthLogin;

if (new URLSearchParams(window.location.search).has("lowBandwidth")) {
    activateLowBandwidthLogin();
} else {
    monitorLoginBackground();
}

mobileBackgroundQuery.addEventListener("change", monitorLoginBackground);

// ==========================================
// SHOW / HIDE PASSWORD
// ==========================================

togglePassword.addEventListener("click", () => {

    if (passwordInput.type === "password") {

        passwordInput.type = "text";

        togglePassword.innerHTML =
            '<i class="fa-regular fa-eye-slash"></i>';

    } else {

        passwordInput.type = "password";

        togglePassword.innerHTML =
            '<i class="fa-regular fa-eye"></i>';

    }

});

// ==========================================
// LOGIN
// ==========================================

form.addEventListener("submit", async (e) => {

    e.preventDefault();

    msg.textContent = "";

    const body = {

        username: usernameInput.value.trim().toLowerCase(),
        password: passwordInput.value

    };

    const slowRequestTimer = setTimeout(() => {
        activateLowBandwidthLogin("The connection is slower than usual. Still trying to sign you in…");
    }, BACKGROUND_WAIT_MS);

    submitButton.disabled = true;

    try {

        const res = await fetch("/api/auth/login", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(body)

        });

        const data = await res.json().catch(() => ({}));

        if (res.ok) {

            let role = (data.role || "").toLowerCase();

            if (role === "manager") {
                role = "admin";
            }
            else if (role === "bme") {
                role = "engineer";
            }
            else if (role === "electrical") {
                role = "electrical";
            }
            else if (role === "it") {
                role = "it";
            }
            else if (role === "user") {
                role = "user";
            }

            localStorage.setItem("role", role);
            localStorage.setItem("department", data.department);
            localStorage.setItem("username", data.username || body.username);
            localStorage.setItem("name", data.name || body.username);

            window.location.href = "/dashboard_v2";

        } else {

            msg.style.color = "#dc2626";
            msg.textContent = typeof data.detail === "string"
                ? data.detail
                : "Invalid username or password.";

        }

    } catch (err) {

        msg.style.color = "#dc2626";
        msg.textContent = "Unable to connect to the server.";

        console.error(err);

    } finally {

        clearTimeout(slowRequestTimer);
        submitButton.disabled = false;

    }

});
