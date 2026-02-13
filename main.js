function isValidPassword(value) {
  if (!value || value.length < 8) return false;
  const hasUpper = /[A-Z]/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasDigit = /\d/.test(value);
  return hasUpper && hasLower && hasDigit;
}

function isValidRegistrationNumber(value) {
  return /^[A-Za-z0-9-]{4,20}$/.test(value);
}

function isValidPhoneNumber(value) {
  return /^\+?[1-9]\d{7,14}$/.test(value);
}

async function signup() {
  const usernameEl = document.getElementById("username");
  const roleEl = document.getElementById("role");
  const moduleTitleEl = document.getElementById("moduleTitle");
  const moduleCodeEl = document.getElementById("moduleCode");
  const regNumberEl = document.getElementById("regNumber");
  const phoneEl = document.getElementById("phone");
  const passwordEl = document.getElementById("password");
  const confirmEl = document.getElementById("confirm");

  if (!usernameEl || !roleEl || !regNumberEl || !phoneEl || !passwordEl || !confirmEl) {
    return alert("Signup form is missing fields.");
  }

  const username = usernameEl.value.trim();
  const role = roleEl.value;
  const regNumber = regNumberEl.value.trim();
  const phone = phoneEl.value.trim();
  const password = passwordEl.value;

  if (!username || !regNumber || !phone || !password) {
    return alert("Please fill in all fields.");
  }
  if (!username) {
    return alert("Enter a valid username.");
  }
  if (!isValidRegistrationNumber(regNumber)) {
    return alert("Enter a valid registration number (4-20 letters, numbers, or hyphen).");
  }
  if (!isValidPhoneNumber(phone)) {
    return alert("Enter a valid phone number in international format.");
  }
  if (!isValidPassword(password)) {
    return alert("Password must be at least 8 characters and include uppercase, lowercase, and a number.");
  }
  if (password !== confirmEl.value) {
    return alert("Passwords not same");
  }

  const payload = { username, regNumber, phone, role, password };
  if (role === "teacher") {
    if (!moduleTitleEl || !moduleCodeEl) {
      return alert("Teacher fields are missing.");
    }
    const moduleTitle = moduleTitleEl.value.trim();
    const moduleCode = moduleCodeEl.value.trim();
    if (!moduleTitle || !moduleCode) {
      return alert("Please enter module title and code.");
    }
    payload.moduleTitle = moduleTitle;
    payload.moduleCode = moduleCode;
  }

  try {
    const res = await fetch("http://localhost:3000/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const text = await res.text();
      return alert(`Signup failed (${res.status}): ${text || "No response body"}`);
    }
    alert("Account created");
    location.href = "login.html";
  } catch (err) {
    alert(`Signup failed: ${err.message}`);
  }
}

async function login() {
  const usernameEl = document.getElementById("username");
  const regNumberEl = document.getElementById("regNumber");
  const passwordEl = document.getElementById("password");
  if (!usernameEl || !regNumberEl || !passwordEl) {
    return alert("Login form is missing fields.");
  }

  const username = usernameEl.value.trim();
  const regNumber = regNumberEl.value.trim();
  const password = passwordEl.value;
  if (!username) {
    return alert("Enter your username.");
  }
  if (!isValidRegistrationNumber(regNumber)) {
    return alert("Enter a valid registration number (4-20 letters, numbers, or hyphen).");
  }
  if (!password) {
    return alert("Enter your password.");
  }

  let res;
  try {
    res = await fetch("http://localhost:3000/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        regNumber,
        password
      })
    });
  } catch (err) {
    return alert(`Login failed: ${err.message}`);
  }

  if (!res.ok) {
    const text = await res.text();
    return alert(`Login failed (${res.status}): ${text || "No response body"}`);
  }

  const data = await res.json();
  if (data.error) return alert(data.error);

  localStorage.setItem("smartapp_username", username);
  localStorage.setItem("smartapp_role", data.role);

  if (data.role === "student") location.href = "student.html";
  if (data.role === "teacher") location.href = "lecture.html";
  if (data.role === "admin") location.href = "admin.html";
}

async function forgotPassword() {
  const usernameEl = document.getElementById("username");
  const regNumberEl = document.getElementById("regNumber");
  const otpEl = document.getElementById("otp");
  const newPasswordEl = document.getElementById("newPassword");
  const confirmPasswordEl = document.getElementById("confirmPassword");
  if (!usernameEl || !regNumberEl || !otpEl || !newPasswordEl || !confirmPasswordEl) {
    return alert("Reset form is missing fields.");
  }

  const username = usernameEl.value.trim();
  const regNumber = regNumberEl.value.trim();
  const otp = otpEl.value.trim();
  const newPassword = newPasswordEl.value;
  const confirmPassword = confirmPasswordEl.value;

  if (!username || !regNumber || !otp || !newPassword || !confirmPassword) {
    return alert("Please fill in all fields.");
  }
  if (!isValidRegistrationNumber(regNumber)) {
    return alert("Enter a valid registration number (4-20 letters, numbers, or hyphen).");
  }
  if (!/^\d{6}$/.test(otp)) {
    return alert("OTP must be 6 digits.");
  }
  if (!isValidPassword(newPassword)) {
    return alert("Password must be at least 8 characters and include uppercase, lowercase, and a number.");
  }
  if (newPassword !== confirmPassword) {
    return alert("New password and confirm password do not match.");
  }

  try {
    const res = await fetch("http://localhost:3000/forgot-password/verify-otp-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, regNumber, otp, newPassword })
    });
    if (!res.ok) {
      const text = await res.text();
      return alert(`Reset failed (${res.status}): ${text || "No response body"}`);
    }
    alert("Password reset successful. Please login.");
    location.href = "login.html";
  } catch (err) {
    alert(`Reset failed: ${err.message}`);
  }
}

async function sendPasswordResetOtp() {
  const usernameEl = document.getElementById("username");
  const regNumberEl = document.getElementById("regNumber");
  if (!usernameEl || !regNumberEl) {
    return alert("Reset form is missing fields.");
  }
  const username = usernameEl.value.trim();
  const regNumber = regNumberEl.value.trim();
  if (!username || !regNumber) {
    return alert("Enter username and registration number first.");
  }
  if (!isValidRegistrationNumber(regNumber)) {
    return alert("Enter a valid registration number (4-20 letters, numbers, or hyphen).");
  }

  try {
    const res = await fetch("http://localhost:3000/forgot-password/request-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, regNumber })
    });
    if (!res.ok) {
      const text = await res.text();
      return alert(`OTP send failed (${res.status}): ${text || "No response body"}`);
    }
    const data = await res.json();
    alert(data.message || "OTP sent.");
    const requestSection = document.getElementById("otpRequestSection");
    const verifySection = document.getElementById("otpVerifySection");
    if (requestSection) {
      requestSection.classList.add("hidden");
    }
    if (verifySection) {
      verifySection.classList.remove("hidden");
    }
  } catch (err) {
    alert(`OTP send failed: ${err.message}`);
  }
}

async function uploadMarks() {
  if (!hasRole("teacher", "admin")) {
    return showToast("error", "Not allowed");
  }
  const requester = localStorage.getItem("smartapp_username");
  const studentEl = document.getElementById("student");
  const courseEl = document.getElementById("course");
  const scoreEl = document.getElementById("score");
  const maxScoreEl = document.getElementById("maxScore");
  if (!studentEl || !courseEl || !scoreEl || !maxScoreEl) {
    return alert("Marks form is missing fields.");
  }
  const payload = {
    studentRegNumber: studentEl.value.trim(),
    course: courseEl.value.trim(),
    score: scoreEl.value,
    maxScore: maxScoreEl.value,
    createdBy: requester || ""
  };
  if (!payload.studentRegNumber || !payload.course || payload.score === "" || payload.maxScore === "") {
    return alert("Please fill in all fields.");
  }

  try {
    const res = await fetch("http://localhost:3000/marks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      if (res.status === 409) {
        return showToast("error", "Already exist");
      }
      return showToast("error", `Upload failed (${res.status})`);
    }
    showToast("success", "Marks uploaded");
    if (document.getElementById("marksList")) {
      loadAllMarks();
    }
  } catch (err) {
    showToast("error", `Upload failed: ${err.message}`);
  }
}

async function loadMarks() {
  const listEl = document.getElementById("list");
  if (!listEl) {
    return alert("Student page is missing fields.");
  }
  const username = localStorage.getItem("smartapp_username");
  if (!username) {
    return alert("Please log in again.");
  }
  let res;
  try {
    res = await fetch(`http://localhost:3000/marks/${username}?role=student`);
  } catch (err) {
    return alert(`Load failed: ${err.message}`);
  }
  if (!res.ok) {
    const text = await res.text();
    return alert(`Load failed (${res.status}): ${text || "No response body"}`);
  }
  const data = await res.json();
  listEl.innerHTML = "";
  if (!data.length) {
    listEl.innerHTML = "<li>No marks available.</li>";
    return;
  }
  data.forEach(m => {
    const maxScore = m.maxScore ?? 100;
    listEl.innerHTML += `<li>${m.course}: ${m.score}/${maxScore}</li>`;
  });
}

function logout() {
  localStorage.removeItem("smartapp_username");
  localStorage.removeItem("smartapp_role");
  location.href = "login.html";
}

async function loadTeacherProfile() {
  const username = localStorage.getItem("smartapp_username");
  const role = localStorage.getItem("smartapp_role");
  if (!username || role !== "teacher") return;
  const usernameEl = document.getElementById("teacherUsername");
  const moduleTitleEl = document.getElementById("teacherModuleTitle");
  const moduleCodeEl = document.getElementById("teacherModuleCode");
  const avatarEl = document.getElementById("teacherAvatar");
  if (!usernameEl || !moduleTitleEl || !moduleCodeEl) return;
  usernameEl.value = username;
  if (avatarEl) {
    const savedAvatar = localStorage.getItem(`smartapp_avatar_${username}`);
    avatarEl.src = savedAvatar || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><rect width='100%' height='100%' fill='%23e2e2e2'/><circle cx='48' cy='38' r='18' fill='%239aa4b2'/><rect x='18' y='60' width='60' height='26' rx='13' fill='%239aa4b2'/></svg>";
  }
  let res;
  try {
    res = await fetch(`http://localhost:3000/teacher/${username}`);
  } catch (err) {
    return alert(`Load profile failed: ${err.message}`);
  }
  if (!res.ok) {
    const text = await res.text();
    return alert(`Load profile failed (${res.status}): ${text || "No response body"}`);
  }
  const data = await res.json();
  moduleTitleEl.value = data.moduleTitle || "";
  moduleCodeEl.value = data.moduleCode || "";
}

function toggleProfile() {
  const bodyEl = document.getElementById("profileBody");
  const actionsEl = document.getElementById("sheetActions");
  if (!bodyEl) return;
  const open = bodyEl.style.display === "none";
  bodyEl.style.display = open ? "block" : "none";
  if (actionsEl) {
    actionsEl.style.display = open ? "none" : "block";
  }
}

function updateTeacherAvatar() {
  const username = localStorage.getItem("smartapp_username");
  const input = document.getElementById("teacherAvatarInput");
  const avatarEl = document.getElementById("teacherAvatar");
  if (!username || !input || !input.files || !input.files[0] || !avatarEl) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    localStorage.setItem(`smartapp_avatar_${username}`, dataUrl);
    avatarEl.src = dataUrl;
  };
  reader.readAsDataURL(file);
  input.value = "";
}

function loadAdminProfile() {
  const username = localStorage.getItem("smartapp_username");
  const role = localStorage.getItem("smartapp_role");
  if (!username || role !== "admin") return;
  const usernameEl = document.getElementById("adminUsername");
  const avatarEl = document.getElementById("adminAvatar");
  if (usernameEl) {
    usernameEl.value = username;
  }
  if (avatarEl) {
    const savedAvatar = localStorage.getItem(`smartapp_avatar_${username}`);
    avatarEl.src = savedAvatar || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><rect width='100%' height='100%' fill='%23e2e2e2'/><circle cx='48' cy='38' r='18' fill='%239aa4b2'/><rect x='18' y='60' width='60' height='26' rx='13' fill='%239aa4b2'/></svg>";
  }
}

function updateAdminAvatar() {
  const username = localStorage.getItem("smartapp_username");
  const input = document.getElementById("adminAvatarInput");
  const avatarEl = document.getElementById("adminAvatar");
  if (!username || !input || !input.files || !input.files[0] || !avatarEl) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    localStorage.setItem(`smartapp_avatar_${username}`, dataUrl);
    avatarEl.src = dataUrl;
  };
  reader.readAsDataURL(file);
  input.value = "";
}

async function saveTeacherProfile() {
  const username = localStorage.getItem("smartapp_username");
  const role = localStorage.getItem("smartapp_role");
  if (!username || role !== "teacher") return alert("Not authorized.");
  const moduleTitleEl = document.getElementById("teacherModuleTitle");
  const moduleCodeEl = document.getElementById("teacherModuleCode");
  if (!moduleTitleEl || !moduleCodeEl) return;
  const moduleTitle = moduleTitleEl.value.trim();
  const moduleCode = moduleCodeEl.value.trim();
  if (!moduleTitle || !moduleCode) {
    return alert("Please enter module title and code.");
  }
  let res;
  try {
    res = await fetch(`http://localhost:3000/teacher/${username}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleTitle, moduleCode })
    });
  } catch (err) {
    return alert(`Save profile failed: ${err.message}`);
  }
  if (!res.ok) {
    const text = await res.text();
    return alert(`Save profile failed (${res.status}): ${text || "No response body"}`);
  }
  alert("Profile updated");
}

async function loadAllMarks() {
  if (!hasRole("teacher", "admin")) {
    return showToast("error", "Not allowed");
  }
  const panelEl = document.getElementById("marksPanel");
  const listEl = document.getElementById("marksList");
  if (!listEl) {
    return alert("Marks list not found.");
  }
  if (panelEl) {
    const isHidden = panelEl.classList.contains("hidden");
    if (!isHidden) {
      panelEl.classList.add("hidden");
      return;
    }
    panelEl.classList.remove("hidden");
  }
  let res;
  try {
    const role = localStorage.getItem("smartapp_role");
    const username = localStorage.getItem("smartapp_username");
    let qs = "";
    if (role === "teacher" && username) qs = `?teacher=${encodeURIComponent(username)}`;
    if (role === "admin") qs = "?role=admin";
    res = await fetch(`http://localhost:3000/marks${qs}`);
  } catch (err) {
    return alert(`Load failed: ${err.message}`);
  }
  if (!res.ok) {
    const text = await res.text();
    return alert(`Load failed (${res.status}): ${text || "No response body"}`);
  }
  const data = await res.json();
  listEl.innerHTML = "";
  if (!data.length) {
    listEl.innerHTML = "<li>No marks yet.</li>";
    return;
  }
  const allowDelete = document.body.dataset.allowDelete === "true";
  data.forEach(m => {
    const maxScore = m.maxScore ?? 100;
    listEl.innerHTML += `
      <li id="mark-${m.id}">
        <div><strong>ID:</strong> ${m.id} - ${m.studentUsername} / ${m.course} / ${m.score}/${maxScore}</div>
        <button onclick="toggleEdit(${m.id}, true)">Edit</button>
        <div id="edit-${m.id}" style="display:none; margin-top:8px;">
          <label>Student</label>
          <input id="mark-student-${m.id}" value="${m.studentUsername}">
          <label>Course</label>
          <input id="mark-course-${m.id}" value="${m.course}">
          <label>Score</label>
          <input id="mark-score-${m.id}" type="number" value="${m.score}">
          <label>Max Score</label>
          <input id="mark-maxScore-${m.id}" type="number" value="${maxScore}">
          <button onclick="saveMark(${m.id})">Save</button>
          ${allowDelete ? `<button class="logout" onclick="deleteByStudentCourse(${m.id})">Delete This Course</button>` : ""}
          <button class="logout" onclick="toggleEdit(${m.id}, false)">Close</button>
        </div>
      </li>
    `;
  });
}

async function searchMarksByStudent() {
  if (!hasRole("teacher", "admin")) {
    return showToast("error", "Not allowed");
  }
  const inputEl = document.getElementById("marksSearch");
  const listEl = document.getElementById("marksList");
  const panelEl = document.getElementById("marksPanel");
  if (!inputEl || !listEl || !panelEl) return;
  const username = inputEl.value.trim();
  if (!username) {
    return alert("Enter a student username.");
  }
  panelEl.classList.remove("hidden");
  let res;
  try {
    const role = localStorage.getItem("smartapp_role");
    const requester = localStorage.getItem("smartapp_username");
    let qs = "";
    if (role === "teacher" && requester) qs = `?teacher=${encodeURIComponent(requester)}`;
    if (role === "admin") qs = "?role=admin";
    res = await fetch(`http://localhost:3000/marks/${encodeURIComponent(username)}${qs}`);
  } catch (err) {
    return alert(`Search failed: ${err.message}`);
  }
  if (!res.ok) {
    const text = await res.text();
    return alert(`Search failed (${res.status}): ${text || "No response body"}`);
  }
  const data = await res.json();
  listEl.innerHTML = "";
  if (!data.length) {
    listEl.innerHTML = "<li>No marks found for that student.</li>";
    return;
  }
  data.forEach(m => {
    const maxScore = m.maxScore ?? 100;
    listEl.innerHTML += `
      <li id="mark-${m.id}">
        <div><strong>ID:</strong> ${m.id} - ${m.studentUsername} / ${m.course} / ${m.score}/${maxScore}</div>
        <button onclick="toggleEdit(${m.id}, true)">Edit</button>
        <div id="edit-${m.id}" style="display:none; margin-top:8px;">
          <label>Student</label>
          <input id="mark-student-${m.id}" value="${m.studentUsername}">
          <label>Course</label>
          <input id="mark-course-${m.id}" value="${m.course}">
          <label>Score</label>
          <input id="mark-score-${m.id}" type="number" value="${m.score}">
          <label>Max Score</label>
          <input id="mark-maxScore-${m.id}" type="number" value="${maxScore}">
          <button onclick="saveMark(${m.id})">Save</button>
          <button class="logout" onclick="toggleEdit(${m.id}, false)">Close</button>
        </div>
      </li>
    `;
  });
}

async function loadUsers() {
  if (!hasRole("admin")) {
    return showToast("error", "Not allowed");
  }
  const listEl = document.getElementById("usersList");
  const panelEl = document.getElementById("usersPanel");
  if (!listEl) return;
  if (panelEl) panelEl.classList.remove("hidden");
  let res;
  try {
    res = await fetch("http://localhost:3000/users");
  } catch (err) {
    return showToast("error", "Load users failed");
  }
  if (!res.ok) {
    return showToast("error", `Load users failed (${res.status})`);
  }
  const data = await res.json();
  listEl.innerHTML = "";
  if (!data.length) {
    listEl.innerHTML = "<li>No users yet.</li>";
    return;
  }
  data.forEach(u => {
    const isTeacher = u.role === "teacher";
    listEl.innerHTML += `
      <li id="user-${u.username}">
        <div><strong>${u.username}</strong> (${u.role})</div>
        <div style="margin-top:8px;">
          <label>Role</label>
          <select id="user-role-${u.username}">
            <option value="student" ${u.role === "student" ? "selected" : ""}>student</option>
            <option value="teacher" ${u.role === "teacher" ? "selected" : ""}>teacher</option>
            <option value="admin" ${u.role === "admin" ? "selected" : ""}>admin</option>
          </select>
          <label>New Password (optional)</label>
          <input id="user-pass-${u.username}" type="password" placeholder="Leave blank to keep">
          <label>Module Title</label>
          <input id="user-moduleTitle-${u.username}" value="${u.moduleTitle || ""}" ${isTeacher ? "" : "disabled"}>
          <label>Module Code</label>
          <input id="user-moduleCode-${u.username}" value="${u.moduleCode || ""}" ${isTeacher ? "" : "disabled"}>
          <button class="sheet" onclick="saveUser('${u.username}')">Save</button>
        </div>
      </li>
    `;
  });
}

function toggleUsersPanel() {
  const panelEl = document.getElementById("usersPanel");
  if (!panelEl) return;
  const isHidden = panelEl.classList.contains("hidden");
  if (!isHidden) {
    panelEl.classList.add("hidden");
    return;
  }
  loadUsers();
}

async function searchUsers() {
  if (!hasRole("admin")) {
    return showToast("error", "Not allowed");
  }
  const inputEl = document.getElementById("usersSearch");
  const listEl = document.getElementById("usersList");
  const panelEl = document.getElementById("usersPanel");
  if (!inputEl || !listEl || !panelEl) return;
  const q = inputEl.value.trim().toLowerCase();
  if (!q) {
    return loadUsers();
  }
  let res;
  try {
    res = await fetch("http://localhost:3000/users");
  } catch (err) {
    return showToast("error", "Load users failed");
  }
  if (!res.ok) {
    return showToast("error", `Load users failed (${res.status})`);
  }
  const data = await res.json();
  const filtered = data.filter(u => u.username.toLowerCase().includes(q) && u.role === "teacher");
  listEl.innerHTML = "";
  if (!filtered.length) {
    listEl.innerHTML = "<li>No teachers found.</li>";
    return;
  }
  filtered.forEach(u => {
    const isTeacher = u.role === "teacher";
    listEl.innerHTML += `
      <li id="user-${u.username}">
        <div><strong>${u.username}</strong> (${u.role})</div>
        <div style="margin-top:8px;">
          <label>Role</label>
          <select id="user-role-${u.username}">
            <option value="student" ${u.role === "student" ? "selected" : ""}>student</option>
            <option value="teacher" ${u.role === "teacher" ? "selected" : ""}>teacher</option>
            <option value="admin" ${u.role === "admin" ? "selected" : ""}>admin</option>
          </select>
          <label>New Password (optional)</label>
          <input id="user-pass-${u.username}" type="password" placeholder="Leave blank to keep">
          <label>Module Title</label>
          <input id="user-moduleTitle-${u.username}" value="${u.moduleTitle || ""}" ${isTeacher ? "" : "disabled"}>
          <label>Module Code</label>
          <input id="user-moduleCode-${u.username}" value="${u.moduleCode || ""}" ${isTeacher ? "" : "disabled"}>
          <button class="sheet" onclick="saveUser('${u.username}')">Save</button>
        </div>
      </li>
    `;
  });
}

async function saveUser(username) {
  if (!hasRole("admin")) {
    return showToast("error", "Not allowed");
  }
  const roleEl = document.getElementById(`user-role-${username}`);
  const passEl = document.getElementById(`user-pass-${username}`);
  const moduleTitleEl = document.getElementById(`user-moduleTitle-${username}`);
  const moduleCodeEl = document.getElementById(`user-moduleCode-${username}`);
  if (!roleEl || !passEl || !moduleTitleEl || !moduleCodeEl) return;
  const newRole = roleEl.value;
  const payload = { newRole };
  const password = passEl.value.trim();
  if (password) payload.password = password;
  if (newRole === "teacher") {
    payload.moduleTitle = moduleTitleEl.value.trim();
    payload.moduleCode = moduleCodeEl.value.trim();
  }
  try {
    const res = await fetch(`http://localhost:3000/users/${encodeURIComponent(username)}?role=admin`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const text = await res.text();
      return showToast("error", `Save failed (${res.status}): ${text || "No response body"}`);
    }
    showToast("success", "User updated");
    loadUsers();
  } catch (err) {
    showToast("error", "Save failed");
  }
}

function toggleEdit(id, open) {
  const editEl = document.getElementById(`edit-${id}`);
  if (!editEl) return;
  editEl.style.display = open ? "block" : "none";
}

function downloadMarksExcel() {
  if (!hasRole("teacher", "admin")) {
    return showToast("error", "Not allowed");
  }
  const role = localStorage.getItem("smartapp_role");
  const username = localStorage.getItem("smartapp_username");
  let qs = "";
  if (role === "teacher" && username) qs = `?teacher=${encodeURIComponent(username)}`;
  if (role === "admin") qs = "?role=admin";
  fetch(`http://localhost:3000/marks/export.xlsx${qs}`)
    .then(res => {
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      return res.blob();
    })
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "marks.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    })
    .catch(err => alert(err.message));
}

function downloadTemplateExcel() {
  if (!hasRole("teacher", "admin")) {
    return showToast("error", "Not allowed");
  }
  fetch("http://localhost:3000/marks/template.xlsx")
    .then(res => {
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      return res.blob();
    })
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "marks_template.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    })
    .catch(err => alert(err.message));
}

function triggerUploadExcel() {
  if (!hasRole("teacher", "admin")) {
    return showToast("error", "Not allowed");
  }
  const input = document.getElementById("marksExcel");
  if (!input) return alert("Excel input not found.");
  input.click();
}

async function uploadMarksExcel() {
  if (!hasRole("teacher", "admin")) {
    return showToast("error", "Not allowed");
  }
  const input = document.getElementById("marksExcel");
  if (!input || !input.files || !input.files[0]) return;
  const file = input.files[0];
  try {
    const buf = await file.arrayBuffer();
    const role = localStorage.getItem("smartapp_role");
    const username = localStorage.getItem("smartapp_username");
    let qs = "";
    if (role === "teacher" && username) qs = `?teacher=${encodeURIComponent(username)}`;
    if (role === "admin") qs = "?role=admin";
    const res = await fetch(`http://localhost:3000/marks/import.xlsx${qs}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      },
      body: buf
    });
    if (!res.ok) {
      const msg = await res.text();
      return alert(`Upload failed (${res.status}): ${msg || "No response body"}`);
    }
    const data = await res.json();
    alert(`Imported ${data.imported} marks`);
    loadAllMarks();
  } catch (err) {
    alert(`Upload failed: ${err.message}`);
  } finally {
    input.value = "";
  }
}

async function saveMark(id) {
  if (!hasRole("teacher", "admin")) {
    return showToast("error", "Not allowed");
  }
  const studentEl = document.getElementById(`mark-student-${id}`);
  const courseEl = document.getElementById(`mark-course-${id}`);
  const scoreEl = document.getElementById(`mark-score-${id}`);
  const maxScoreEl = document.getElementById(`mark-maxScore-${id}`);
  if (!studentEl || !courseEl || !scoreEl || !maxScoreEl) {
    return alert("Edit fields not found.");
  }
  const payload = {
    studentUsername: studentEl.value.trim(),
    course: courseEl.value.trim(),
    score: scoreEl.value,
    maxScore: maxScoreEl.value
  };
  if (!payload.studentUsername || !payload.course || payload.score === "" || payload.maxScore === "") {
    return alert("Please fill in all fields.");
  }
  let res;
  try {
    const role = localStorage.getItem("smartapp_role");
    const username = localStorage.getItem("smartapp_username");
    let qs = "";
    if (role === "teacher" && username) qs = `?teacher=${encodeURIComponent(username)}`;
    if (role === "admin") qs = "?role=admin";
    res = await fetch(`http://localhost:3000/marks/${id}${qs}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    return showToast("error", "Save failed");
  }
  if (!res.ok) {
    return showToast("error", `Save failed (${res.status})`);
  }
  showToast("success", "Marks updated");
  toggleEdit(id, false);
  loadAllMarks();
}

async function deleteMark(id) {
  if (!hasRole("teacher", "admin")) {
    return showToast("error", "Not allowed");
  }
  if (!confirm("Delete this mark?")) return;
  let res;
  try {
    const role = localStorage.getItem("smartapp_role");
    const username = localStorage.getItem("smartapp_username");
    let qs = "";
    if (role === "teacher" && username) qs = `?teacher=${encodeURIComponent(username)}`;
    if (role === "admin") qs = "?role=admin";
    res = await fetch(`http://localhost:3000/marks/${id}${qs}`, {
      method: "DELETE"
    });
  } catch (err) {
    return showToast("error", "Delete failed");
  }
  if (!res.ok) {
    return showToast("error", `Delete failed (${res.status})`);
  }
  showToast("success", "Mark deleted");
  loadAllMarks();
}

async function deleteByStudentCourse(id) {
  if (!hasRole("teacher", "admin")) {
    return showToast("error", "Not allowed");
  }
  const studentEl = document.getElementById(`mark-student-${id}`);
  const courseEl = document.getElementById(`mark-course-${id}`);
  if (!studentEl || !courseEl) {
    return alert("Edit fields not found.");
  }
  const studentUsername = studentEl.value.trim();
  const course = courseEl.value.trim();
  if (!studentUsername || !course) {
    return alert("Please provide student and course.");
  }
  if (!confirm(`Delete ${studentUsername} for ${course}?`)) return;
  let res;
  try {
    const qs = new URLSearchParams({ studentUsername, course });
    const role = localStorage.getItem("smartapp_role");
    const username = localStorage.getItem("smartapp_username");
    if (role === "teacher" && username) {
      qs.set("teacher", username);
    }
    if (role === "admin") {
      qs.set("role", "admin");
    }
    res = await fetch(`http://localhost:3000/marks?${qs.toString()}`, {
      method: "DELETE"
    });
  } catch (err) {
    return showToast("error", "Delete failed");
  }
  if (!res.ok) {
    return showToast("error", `Delete failed (${res.status})`);
  }
  showToast("success", "Mark deleted");
  loadAllMarks();
}

function showToast(type, message) {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  const icon = type === "success" ? "V" : "X";
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("show");
  }, 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 200);
  }, 2200);
}

function hasRole(...roles) {
  const role = localStorage.getItem("smartapp_role");
  return roles.includes(role);
}

// Admin and teacher have the same permissions.
