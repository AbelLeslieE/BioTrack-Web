
let usersCache=[];
let filteredUsers=[];
const usersPagination = { page: 1, pageSize: 10 };

function renderUsers(){

pageContent.innerHTML=`
<div class="users-page">
<div class="users-page-header">
<h2>User Management</h2>
<button class="add-btn" onclick="showRegisterUser()">+ Register User</button>
</div>

<div class="controls">
<input id="userSearch" placeholder="Search users..." onkeyup="filterUsers()">

<select id="deptFilter" onchange="filterUsers()">
<option value="">All Departments</option>
</select>

<select id="roleFilter" onchange="filterUsers()">
<option value="">All Roles</option>
</select>

<select id="sortUsers" onchange="filterUsers()">
<option value="">Sort</option>
<option value="name">Name</option>
<option value="username">Username</option>
<option value="department">Department</option>
<option value="role">Role</option>
</select>
</div>

<div class="users-table-scroll"><table class="users-table">
<thead><tr>
<th>Name</th><th>Username</th><th>Department</th><th>Role</th>
<th>Email</th><th>Phone</th><th>Actions</th>
</tr></thead>
<tbody id="usersBody"></tbody>
</table></div>
<div id="usersPagination" class="table-pagination"></div>
</div>

<div id="userModal"></div>
`;

loadUsers();
}


function loadUsers(){
fetch('/api/users')
.then(r=>r.json())
.then(data=>{
usersCache=data;

let depts=[...new Set(data.map(x=>x.department))];
let roles=[...new Set(data.map(x=>x.role))];

deptFilter.innerHTML='<option value="">All Departments</option>'+depts.map(x=>`<option>${x}</option>`).join('');
roleFilter.innerHTML='<option value="">All Roles</option>'+roles.map(x=>`<option>${x}</option>`).join('');

filteredUsers=data;
displayUsers(filteredUsers);
});
}


function displayUsers(data){

if (!data.length) {
usersBody.innerHTML='<tr><td colspan="7">No users found.</td></tr>';
TablePagination.render(document.getElementById("usersPagination"), usersPagination, 0, () => displayUsers(filteredUsers), "users");
return;
}

const pageItems=TablePagination.pageItems(data, usersPagination);

usersBody.innerHTML=pageItems.map(u=>`
<tr>
<td>${u.name}</td>
<td>${u.username}</td>
<td>${u.department}</td>
<td>${u.role}</td>
<td>${u.email}</td>
<td>${u.phone}</td>
<td class="actions">
<button class="edit-btn" onclick="editUser(${u.id})">Edit</button>
<button class="delete-btn" onclick="deleteUser(${u.id})">Delete</button>
</td>
</tr>
`).join('');

TablePagination.render(
document.getElementById("usersPagination"),
usersPagination,
data.length,
() => displayUsers(filteredUsers),
"users"
);

}


function filterUsers(){

let text=userSearch.value.toLowerCase();

let result=usersCache.filter(u=>
((u.name || "").toLowerCase().includes(text) ||
u.username.toLowerCase().includes(text)) &&
(!deptFilter.value || u.department==deptFilter.value) &&
(!roleFilter.value || u.role==roleFilter.value)
);

if(sortUsers.value)
result.sort((a,b)=>(a[sortUsers.value] || "").localeCompare(b[sortUsers.value] || ""));

filteredUsers=result;
usersPagination.page=1;
displayUsers(filteredUsers);

}


let editingUserId=null;

function showRegisterUser(){

userModal.innerHTML=`
<div class="modal">
<h3>${editingUserId ? "Edit User" : "Register User"}</h3>

<input id="newName" placeholder="Name">
<input id="newDept" placeholder="Department">
<select id="newRole">

    <option value="">Select Role</option>

    <option value="Manager">Administrator</option>

    <option value="BME">Biomedical Engineer</option>

    <option value="Electrical">Electrical Engineer</option>

    <option value="IT">IT Department</option>

    <option value="User">Department User</option>

</select>
<input id="newEmail" placeholder="Email">
<input id="newPhone" placeholder="Phone">
<input id="newUsername" placeholder="Username">
<label for="newPassword">${editingUserId ? "New password (leave blank to keep the current password)" : "Password"}</label>
<input id="newPassword" type="password" placeholder="${editingUserId ? "Set a new password" : "Create a password"}">

<div class="form-actions">
<button onclick="registerUser()">Save User</button>
<button class="cancel-btn" onclick="closeUserModal()">Cancel</button>
</div>
</div>`;
}


function validateUserForm(){
 const email=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
 const phone=/^(?:\+91|91)?[6-9][0-9]{9}$/;
 if(!email.test(newEmail.value)){alert("Enter valid email address"); return false;}
 if(!phone.test(newPhone.value.replace(/\s|-/g,""))){alert("Enter valid Indian mobile number"); return false;}
 return true;
}

function registerUser(){

    if(!validateUserForm()) return;

    if(editingUserId){
        console.log("Updating user:", editingUserId);
    }

    const payload = {

        name: newName.value,
        department: newDept.value,
        role: newRole.value,
        email: newEmail.value,
        phone: newPhone.value,
        username: newUsername.value,
        password: newPassword.value

    };

    console.log("Payload being sent:", payload);

    fetch(
        editingUserId
            ? `/api/users/${editingUserId}`
            : "/api/users/register",
        {
            method: editingUserId ? "PUT" : "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(payload)
        }
    )
    .then(r => r.json())
    .then(r => {

        alert(r.message);

        renderUsers();

    })
    .catch(err => {

        console.error(err);

    });

}


function editUser(id){
 const u=usersCache.find(x=>x.id===id);
 editingUserId=id;
 showRegisterUser();
 setTimeout(()=>{
 newName.value=u.name;
 newDept.value=u.department;
 newRole.value=u.role;
 newEmail.value=u.email;
 newPhone.value=u.phone;
 newUsername.value=u.username;
 newPassword.value="";
 },100);
}

function deleteUser(id){
 if(!confirm("Delete this user?")) return;
 fetch(`/api/users/${id}`,{method:"DELETE"})
 .then(r=>r.json())
 .then(()=>{
   renderUsers();
 });
}


function closeUserModal(){
 userModal.innerHTML="";
 editingUserId=null;
}
