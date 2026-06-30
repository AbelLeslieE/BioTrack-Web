
document.getElementById("registerUserBtn")?.addEventListener("click", function(e){
    e.preventDefault();

    const panel=document.getElementById("devicePanel");
    panel.style.display="block";

    panel.innerHTML=`
    <div class="device-card">
        <h2>Register User</h2>

        <input id="u_name" placeholder="Name">
        <input id="u_email" type="email" placeholder="Email">
        <input id="u_department" placeholder="Department">

        <select id="u_role" required>
            <option value="">Select Role</option>

            <!-- Keep database values -->
            <option value="Manager">Administrator</option>
            <option value="BME">Biomedical Engineer</option>
            <option value="User">Department User</option>
        </select>

        <input id="u_phone" placeholder="Phone">
        <input id="u_username" placeholder="Username">
        <input id="u_password" type="password" placeholder="Password">

        <button id="saveUserBtn">Submit</button>

        <div id="userMsg" class="form-message"></div>
    </div>`;

    document.getElementById("saveUserBtn").addEventListener("click", async function(){

        const name=document.getElementById("u_name").value.trim();
        const email=document.getElementById("u_email").value.trim();
        const department=document.getElementById("u_department").value.trim();
        const role=document.getElementById("u_role").value;
        const phone=document.getElementById("u_phone").value.trim();
        const username=document.getElementById("u_username").value.trim();
        const password=document.getElementById("u_password").value;

        const msg=document.getElementById("userMsg");

        if(!name || !department || !email || !role || !phone || !username || !password){
            msg.innerHTML="Please fill all fields";
            msg.className="form-message error";
            return;
        }

        const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if(!emailPattern.test(email)){
            msg.innerHTML="Please enter a valid email address";
            msg.className="form-message error";
            return;
        }

        try{

            const response=await fetch("/api/users/register",{
                method:"POST",
                headers:{
                    "Content-Type":"application/json"
                },
                body:JSON.stringify({
                    name,
                    department,
                    email,
                    role,
                    phone,
                    username,
                    password
                })
            });

            const data=await response.json();

            if(response.ok){
                msg.innerHTML="User registered successfully";
                msg.className="form-message success";
            }else{
                msg.innerHTML=data.detail || "Registration failed";
                msg.className="form-message error";
            }

        }catch(error){
            msg.innerHTML="Server connection error";
            msg.className="form-message error";
        }

    });

});
