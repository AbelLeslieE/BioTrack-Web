// ==========================================
// LOGIN ELEMENTS
// ==========================================

const form = document.getElementById("loginForm");
const msg = document.getElementById("message");

const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");

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

    msg.innerHTML = "";

    const body = {

        username: usernameInput.value.trim().toLowerCase(),
        password: passwordInput.value

    };

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
            msg.innerHTML = data.detail || "Invalid username or password.";

        }

    } catch (err) {

        msg.style.color = "#dc2626";
        msg.innerHTML = "Unable to connect to the server.";

        console.error(err);

    }

});