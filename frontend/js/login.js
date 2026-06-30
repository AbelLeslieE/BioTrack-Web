// ==========================================
// LOGIN
// ==========================================

const form = document.getElementById("loginForm");
const msg = document.getElementById("message");

// ==========================================
// SHOW / HIDE PASSWORD
// ==========================================

document.getElementById("togglePassword").onclick = () => {

    const p = document.getElementById("password");

    p.type = p.type === "password"
        ? "text"
        : "password";

};

// ==========================================
// LOGIN
// ==========================================

form.addEventListener("submit", async (e) => {

    e.preventDefault();

    const body = {

        username: username.value.trim().toLowerCase(),
        password: password.value

    };

    const res = await fetch("/api/auth/login", {

        method: "POST",

        headers: {

            "Content-Type": "application/json"

        },

        body: JSON.stringify(body)

    });

    const data = await res.json().catch(() => ({}));

    if (res.ok) {

        // ======================================
        // Convert old database roles to new roles
        // ======================================

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

        // Save user information
        localStorage.setItem("username", data.username || body.username);
        localStorage.setItem("name", data.name || body.username);

        window.location.href = "/dashboard_v2";
    }

    else {

        msg.innerHTML = data.detail || "Login failed";

    }

});