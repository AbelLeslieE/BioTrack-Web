let usersCache = [];
let filteredUsers = [];
let editingUserId = null;
const usersPagination = { page: 1, pageSize: 10 };

const USER_ROLE_LABELS = {
    Manager: "Administrator",
    BME: "Biomedical Engineer",
    Electrical: "Electrical Engineer",
    IT: "IT Department",
    User: "Department User",
    WardBoy: "Ward Boy",
    CentralStore: "Central Store",
    Business: "Business Office",
};

function renderUsers() {
    pageContent.innerHTML = `
        <div class="users-page">
            <section class="users-hero">
                <div>
                    <span class="users-eyebrow"><i data-lucide="users-round"></i> Access control</span>
                    <h1>User Management</h1>
                    <p>Manage staff accounts, departments and access roles from one place.</p>
                </div>
                <button class="users-primary-button" type="button" onclick="showRegisterUser()">
                    <i data-lucide="user-plus"></i><span>Register user</span>
                </button>
            </section>

            <section class="users-stats" aria-label="User summary">
                <article><span class="is-blue"><i data-lucide="users"></i></span><div><small>Total users</small><strong id="usersTotalCount">—</strong></div></article>
                <article><span class="is-violet"><i data-lucide="shield-check"></i></span><div><small>Administrators</small><strong id="usersAdminCount">—</strong></div></article>
                <article><span class="is-green"><i data-lucide="wrench"></i></span><div><small>Engineering staff</small><strong id="usersEngineerCount">—</strong></div></article>
                <article><span class="is-orange"><i data-lucide="building-2"></i></span><div><small>Departments</small><strong id="usersDepartmentCount">—</strong></div></article>
            </section>

            <section class="users-directory-card">
                <header class="users-directory-header">
                    <div><h2>Staff directory</h2><p id="usersResultLabel">Loading user accounts…</p></div>
                    <button class="users-refresh-button" type="button" onclick="loadUsers()"><i data-lucide="refresh-cw"></i><span>Refresh</span></button>
                </header>

                <div class="users-controls">
                    <label class="users-search-field">
                        <span class="sr-only">Search users</span><i data-lucide="search"></i>
                        <input id="userSearch" type="search" placeholder="Search name, username or email" autocomplete="off" oninput="filterUsers()">
                    </label>
                    <label class="users-filter-field"><span>Department</span><select id="deptFilter" onchange="filterUsers()"><option value="">All departments</option></select></label>
                    <label class="users-filter-field"><span>Role</span><select id="roleFilter" onchange="filterUsers()"><option value="">All roles</option></select></label>
                    <label class="users-filter-field users-sort-field"><span>Sort by</span><select id="sortUsers" onchange="filterUsers()"><option value="name">Name A–Z</option><option value="username">Username A–Z</option><option value="department">Department A–Z</option><option value="role">Role A–Z</option></select></label>
                    <button id="clearUserFilters" class="users-clear-button" type="button" onclick="clearUserFilters()" hidden><i data-lucide="x"></i> Clear</button>
                </div>

                <div class="users-table-scroll">
                    <table class="users-table">
                        <thead><tr><th>User</th><th>Department</th><th>Role</th><th>Contact</th><th class="users-actions-heading">Actions</th></tr></thead>
                        <tbody id="usersBody"><tr><td colspan="5"><div class="users-state"><span class="users-spinner"></span><strong>Loading users</strong><p>Fetching the latest staff directory.</p></div></td></tr></tbody>
                    </table>
                </div>
                <div id="usersPagination" class="table-pagination users-pagination"></div>
            </section>
        </div>
        <div id="userModal"></div>
    `;

    if (window.lucide) lucide.createIcons();
    loadUsers();
}

async function loadUsers() {
    const refreshButton = document.querySelector(".users-refresh-button");
    refreshButton?.classList.add("is-loading");
    try {
        const data = await fetchPaginatedList("/api/users", { cache: "no-store" });
        usersCache = Array.isArray(data) ? data : [];
        populateUserFilters(usersCache);
        renderUserStats(usersCache);
        filterUsers();
    } catch (error) {
        usersCache = [];
        filteredUsers = [];
        renderUserStats([]);
        renderUsersState("wifi-off", "Unable to load users", error.message || "Please refresh and try again.", true);
        const label = document.getElementById("usersResultLabel");
        if (label) label.textContent = "Directory unavailable";
    } finally {
        refreshButton?.classList.remove("is-loading");
        if (window.lucide) lucide.createIcons();
    }
}

function populateUserFilters(users) {
    const departmentSelect = document.getElementById("deptFilter");
    const roleSelect = document.getElementById("roleFilter");
    if (!departmentSelect || !roleSelect) return;
    const selectedDepartment = departmentSelect.value;
    const selectedRole = roleSelect.value;
    const departments = [...new Set(users.map(user => String(user.department || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const roles = [...new Set(users.map(user => String(user.role || "").trim()).filter(Boolean))].sort((a, b) => (USER_ROLE_LABELS[a] || a).localeCompare(USER_ROLE_LABELS[b] || b));
    departmentSelect.innerHTML = '<option value="">All departments</option>' + departments.map(value => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join("");
    roleSelect.innerHTML = '<option value="">All roles</option>' + roles.map(value => `<option value="${escapeHTML(value)}">${escapeHTML(USER_ROLE_LABELS[value] || value)}</option>`).join("");
    departmentSelect.value = departments.includes(selectedDepartment) ? selectedDepartment : "";
    roleSelect.value = roles.includes(selectedRole) ? selectedRole : "";
}

function renderUserStats(users) {
    const setValue = (id, value) => { const element = document.getElementById(id); if (element) element.textContent = value; };
    setValue("usersTotalCount", users.length);
    setValue("usersAdminCount", users.filter(user => user.role === "Manager").length);
    setValue("usersEngineerCount", users.filter(user => ["BME", "Electrical", "IT"].includes(user.role)).length);
    setValue("usersDepartmentCount", new Set(users.map(user => String(user.department || "").trim().toLowerCase()).filter(Boolean)).size);
}

function displayUsers(data) {
    const body = document.getElementById("usersBody");
    const pagination = document.getElementById("usersPagination");
    const resultLabel = document.getElementById("usersResultLabel");
    if (!body || !pagination) return;
    if (resultLabel) resultLabel.textContent = `${data.length} ${data.length === 1 ? "account" : "accounts"} found`;

    if (!data.length) {
        renderUsersState("user-search", "No users found", "Try a different search or clear the active filters.");
        TablePagination.render(pagination, usersPagination, 0, () => displayUsers(filteredUsers), "users");
        return;
    }

    const pageItems = TablePagination.pageItems(data, usersPagination);
    body.innerHTML = pageItems.map(user => {
        const roleClass = userRoleClass(user.role);
        const name = user.name || user.username || "Unnamed user";
        return `
            <tr>
                <td><div class="users-identity"><span class="users-avatar is-${roleClass}">${escapeHTML(userInitials(name))}</span><div><strong>${escapeHTML(name)}</strong><small>@${escapeHTML(user.username || "—")}</small></div></div></td>
                <td><div class="users-department"><i data-lucide="building-2"></i><span>${escapeHTML(user.department || "Not assigned")}</span></div></td>
                <td><span class="users-role-badge is-${roleClass}"><i data-lucide="${userRoleIcon(user.role)}"></i>${escapeHTML(USER_ROLE_LABELS[user.role] || user.role || "Unknown")}</span></td>
                <td><div class="users-contact"><a href="mailto:${escapeHTML(user.email || "")}">${escapeHTML(user.email || "No email")}</a><span>${escapeHTML(user.phone || "No phone")}</span></div></td>
                <td class="users-actions"><button class="users-icon-button is-edit" type="button" onclick="editUser(${Number(user.id)})" aria-label="Edit ${escapeHTML(name)}"><i data-lucide="pencil"></i><span>Edit</span></button><button class="users-icon-button is-delete" type="button" onclick="deleteUser(${Number(user.id)})" aria-label="Delete ${escapeHTML(name)}"><i data-lucide="trash-2"></i><span>Delete</span></button></td>
            </tr>`;
    }).join("");

    TablePagination.render(pagination, usersPagination, data.length, () => displayUsers(filteredUsers), "users");
    if (window.lucide) lucide.createIcons();
}

function renderUsersState(icon, title, message, showRetry = false) {
    const body = document.getElementById("usersBody");
    const pagination = document.getElementById("usersPagination");
    if (!body) return;
    body.innerHTML = `<tr><td colspan="5"><div class="users-state"><span><i data-lucide="${icon}"></i></span><strong>${escapeHTML(title)}</strong><p>${escapeHTML(message)}</p>${showRetry ? '<button type="button" onclick="loadUsers()">Try again</button>' : ""}</div></td></tr>`;
    if (pagination) pagination.innerHTML = "";
    if (window.lucide) lucide.createIcons();
}

function filterUsers() {
    const search = document.getElementById("userSearch");
    const department = document.getElementById("deptFilter");
    const role = document.getElementById("roleFilter");
    const sort = document.getElementById("sortUsers");
    if (!search || !department || !role || !sort) return;
    const query = search.value.trim().toLowerCase();
    filteredUsers = usersCache.filter(user => {
        const haystack = [user.name, user.username, user.email, user.phone, user.department, USER_ROLE_LABELS[user.role], user.role].join(" ").toLowerCase();
        return (!query || haystack.includes(query)) && (!department.value || user.department === department.value) && (!role.value || user.role === role.value);
    });
    const sortKey = sort.value || "name";
    filteredUsers.sort((a, b) => String(a[sortKey] || "").localeCompare(String(b[sortKey] || ""), undefined, { sensitivity: "base" }));
    usersPagination.page = 1;
    const clearButton = document.getElementById("clearUserFilters");
    if (clearButton) clearButton.hidden = !(query || department.value || role.value || sortKey !== "name");
    displayUsers(filteredUsers);
}

function clearUserFilters() {
    document.getElementById("userSearch").value = "";
    document.getElementById("deptFilter").value = "";
    document.getElementById("roleFilter").value = "";
    document.getElementById("sortUsers").value = "name";
    filterUsers();
    document.getElementById("userSearch").focus();
}

function showRegisterUser() {
    const currentUser = editingUserId ? usersCache.find(user => user.id === editingUserId) : null;
    const modalRoot = document.getElementById("userModal");
    if (!modalRoot) return;
    modalRoot.innerHTML = `
        <div class="user-modal-backdrop" role="presentation" onclick="if(event.target===this) closeUserModal()">
            <section class="user-editor-modal" role="dialog" aria-modal="true" aria-labelledby="userModalTitle">
                <header><span class="user-modal-icon"><i data-lucide="${currentUser ? "user-cog" : "user-plus"}"></i></span><div><h2 id="userModalTitle">${currentUser ? "Edit user" : "Register a new user"}</h2><p>${currentUser ? "Update account details and access." : "Create a staff account and assign its access role."}</p></div><button type="button" class="user-modal-close" onclick="closeUserModal()" aria-label="Close"><i data-lucide="x"></i></button></header>
                <form class="user-editor-form" onsubmit="event.preventDefault();registerUser()">
                    <div class="user-form-grid">
                        <label><span>Full name</span><input id="newName" maxlength="120" autocomplete="name" placeholder="e.g. Anjali Thomas" required></label>
                        <label><span>Username</span><input id="newUsername" minlength="3" maxlength="80" autocomplete="username" placeholder="e.g. anjali.thomas" required></label>
                        <label><span>Department</span><select id="newDept" required>${renderHospitalDepartmentOptions(currentUser?.department)}</select></label>
                        <label><span>Access role</span><select id="newRole" required><option value="">Select a role</option><option value="Manager">Administrator</option><option value="BME">Biomedical Engineer</option><option value="Electrical">Electrical Engineer</option><option value="IT">IT Department</option><option value="User">Department User</option><option value="WardBoy">Ward Boy</option><option value="CentralStore">Central Store</option><option value="Business">Business Office</option></select></label>
                        <label><span>Email address</span><input id="newEmail" type="email" autocomplete="email" placeholder="name@hospital.org" required></label>
                        <label><span>Phone number</span><input id="newPhone" type="tel" autocomplete="tel" placeholder="10-digit mobile number" required></label>
                        <label class="user-password-field"><span>${currentUser ? "New password" : "Password"}</span><div><input id="newPassword" type="password" minlength="12" maxlength="72" autocomplete="new-password" placeholder="${currentUser ? "Leave blank to keep current" : "At least 12 characters"}" ${currentUser ? "" : "required"}><button type="button" onclick="toggleUserPassword()" aria-label="Show password"><i data-lucide="eye"></i></button></div><small>${currentUser ? "Only enter a password if it needs to change." : "Use 12–72 characters."}</small></label>
                        ${currentUser ? `<label><span>Account status</span><select id="newAccountStatus"><option value="active">Active</option><option value="disabled">Disabled</option></select><small>Disabling immediately revokes all sessions.</small></label>` : ""}
                        ${currentUser?.mfa_enabled ? `<label><span>MFA recovery</span><span class="user-security-check"><input id="resetUserMfa" type="checkbox"> Reset authenticator setup</span><small>The user must enroll again at next login.</small></label>` : ""}
                    </div>
                    <footer><button class="user-modal-cancel" type="button" onclick="closeUserModal()">Cancel</button><button class="user-modal-save" type="submit"><i data-lucide="save"></i><span>${currentUser ? "Save changes" : "Create user"}</span></button></footer>
                </form>
            </section>
        </div>`;
    if (currentUser) {
        document.getElementById("newName").value = currentUser.name || "";
        document.getElementById("newRole").value = currentUser.role || "";
        document.getElementById("newEmail").value = currentUser.email || "";
        document.getElementById("newPhone").value = currentUser.phone || "";
        document.getElementById("newUsername").value = currentUser.username || "";
        document.getElementById("newAccountStatus").value = currentUser.is_active === false ? "disabled" : "active";
    }
    const roleSelect = document.getElementById("newRole");
    const departmentSelect = document.getElementById("newDept");
    if (departmentSelect) departmentSelect.dataset.previousDepartment = ["WardBoy", "CentralStore", "Business"].includes(currentUser?.role) ? "" : (currentUser?.department || "");
    roleSelect?.addEventListener("change", syncServiceRoleDepartment);
    syncServiceRoleDepartment();
    document.body.classList.add("user-modal-open");
    if (window.lucide) lucide.createIcons();
    requestAnimationFrame(() => document.getElementById("newName")?.focus());
}

function syncServiceRoleDepartment() {
    const roleSelect = document.getElementById("newRole");
    const departmentSelect = document.getElementById("newDept");
    if (!roleSelect || !departmentSelect) return;
    const lockedDepartment = roleSelect.value === "WardBoy"
        ? "Hospital Support Services"
        : roleSelect.value === "CentralStore" ? "Central Store"
        : roleSelect.value === "Business" ? "Business Office" : "";
    if (lockedDepartment) {
        if (!departmentSelect.disabled) departmentSelect.dataset.previousDepartment = departmentSelect.value || "";
        departmentSelect.innerHTML = `<option value="${lockedDepartment}">${lockedDepartment}</option>`;
        departmentSelect.value = lockedDepartment;
        departmentSelect.disabled = true;
        departmentSelect.closest("label")?.classList.add("is-role-locked");
        return;
    }
    if (departmentSelect.disabled) {
        departmentSelect.disabled = false;
        departmentSelect.innerHTML = renderHospitalDepartmentOptions(departmentSelect.dataset.previousDepartment || "");
        departmentSelect.closest("label")?.classList.remove("is-role-locked");
    }
}

function toggleUserPassword() {
    const input = document.getElementById("newPassword");
    const button = input?.nextElementSibling;
    if (!input || !button) return;
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    button.setAttribute("aria-label", show ? "Hide password" : "Show password");
    button.innerHTML = `<i data-lucide="${show ? "eye-off" : "eye"}"></i>`;
    if (window.lucide) lucide.createIcons();
}

function validateUserForm() {
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phone = /^(?:\+91|91)?[6-9][0-9]{9}$/;
    const fields = [newName, newDept, newRole, newEmail, newPhone, newUsername];
    if (fields.some(field => !field.value.trim())) { BioTrackToast.warning("Required fields missing", "Complete all required user details."); return false; }
    if (!email.test(newEmail.value.trim())) { BioTrackToast.warning("Invalid email", "Enter a valid email address."); newEmail.focus(); return false; }
    if (!phone.test(newPhone.value.replace(/[\s-]/g, ""))) { BioTrackToast.warning("Invalid phone number", "Enter a valid Indian mobile number."); newPhone.focus(); return false; }
    if ((!editingUserId || newPassword.value) && (newPassword.value.length < 12 || newPassword.value.length > 72 || !newPassword.value.trim())) { BioTrackToast.warning("Invalid password", "Password must contain 12 to 72 characters and cannot be blank."); newPassword.focus(); return false; }
    return true;
}

async function registerUser() {
    if (!validateUserForm()) return;
    const saveButton = document.querySelector(".user-modal-save");
    saveButton?.classList.add("is-loading");
    if (saveButton) saveButton.disabled = true;
    const wasEditing = Boolean(editingUserId);
    try {
        const payload = { name: newName.value.trim(), department: newDept.value.trim(), role: newRole.value, email: newEmail.value.trim(), phone: newPhone.value.trim(), username: newUsername.value.trim(), password: newPassword.value, is_active: document.getElementById("newAccountStatus")?.value !== "disabled", reset_mfa: Boolean(document.getElementById("resetUserMfa")?.checked) };
        const response = await fetch(editingUserId ? `/api/users/${editingUserId}` : "/api/users/register", { method: editingUserId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            const detail = Array.isArray(result.detail) ? result.detail.map(item => item.msg).filter(Boolean).join(" ") : result.detail;
            throw new Error(detail || "Unable to save user.");
        }
        closeUserModal();
        if (typeof showSuccess === "function") showSuccess({ title: wasEditing ? "User updated" : "User registered", message: result.message || "The staff account was saved successfully.", buttonText: "Continue" });
        await loadUsers();
    } catch (error) {
        BioTrackToast.error("User not saved", error.message || "Unable to save this user.");
    } finally {
        saveButton?.classList.remove("is-loading");
        if (saveButton) saveButton.disabled = false;
    }
}

function editUser(id) {
    if (!usersCache.some(user => user.id === id)) return;
    editingUserId = id;
    showRegisterUser();
}

async function deleteUser(id) {
    const user = usersCache.find(item => item.id === id);
    if (!user || !confirm(`Delete ${user.name || user.username}? This account will no longer be able to sign in.`)) return;
    try {
        const response = await fetch(`/api/users/${id}`, { method: "DELETE" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.detail || "Unable to delete user.");
        await loadUsers();
        BioTrackToast.success("User deleted", "The staff account was removed successfully.");
    } catch (error) {
        BioTrackToast.error("User not deleted", error.message || "Unable to delete this user.");
    }
}

function closeUserModal() {
    const modalRoot = document.getElementById("userModal");
    if (modalRoot) modalRoot.innerHTML = "";
    document.body.classList.remove("user-modal-open");
    editingUserId = null;
}

function userInitials(value) {
    return String(value || "U").trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join("").toUpperCase() || "U";
}

function userRoleClass(role) {
    return ({ Manager: "admin", BME: "biomedical", Electrical: "electrical", IT: "it", User: "user", WardBoy: "ward-boy", CentralStore: "central-store", Business: "business" })[role] || "user";
}

function userRoleIcon(role) {
    return ({ Manager: "shield-check", BME: "heart-pulse", Electrical: "zap", IT: "monitor-cog", User: "user-round", WardBoy: "truck", CentralStore: "warehouse", Business: "landmark" })[role] || "user-round";
}
