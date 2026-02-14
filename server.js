const express = require("express");
const cors = require("cors");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ override: true });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.text({ type: "text/csv" }));
app.use(express.raw({
  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  limit: "10mb"
}));

const DB_FILE = path.join(__dirname, "database.json");
const NETLIFY_DATABASE_URL = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL || "";
const ONLINE_STATE_ID = "main";
const HAS_REAL_NEON_URL = NETLIFY_DATABASE_URL
  && !NETLIFY_DATABASE_URL.includes("<")
  && (NETLIFY_DATABASE_URL.startsWith("postgres://") || NETLIFY_DATABASE_URL.startsWith("postgresql://"));

const users = new Map();
const marks = [];
const passwordResetOtps = new Map();
let nextMarkId = 1;
let sql = null;

function applyState(data) {
  users.clear();
  marks.length = 0;

  const userList = Array.isArray(data.users) ? data.users : [];
  const markList = Array.isArray(data.marks) ? data.marks : [];
  userList.forEach(u => users.set(u.username, u));
  markList.forEach(m => marks.push(m));
  nextMarkId = Number.isFinite(data.nextMarkId) && data.nextMarkId > 0
    ? data.nextMarkId
    : (marks.reduce((max, m) => Math.max(max, Number(m.id) || 0), 0) + 1);
}

function getCurrentState() {
  return {
    users: Array.from(users.values()),
    marks,
    nextMarkId
  };
}

async function loadDatabase() {
  if (HAS_REAL_NEON_URL) {
    try {
      const { neon } = await import("@netlify/neon");
      sql = neon();
      await sql`
        CREATE TABLE IF NOT EXISTS app_state (
          id TEXT PRIMARY KEY,
          state JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      const rows = await sql`
        SELECT state
        FROM app_state
        WHERE id = ${ONLINE_STATE_ID}
        LIMIT 1
      `;

      if (rows.length) {
        const rawState = rows[0].state;
        const parsedState = typeof rawState === "string" ? JSON.parse(rawState || "{}") : rawState;
        applyState(parsedState || {});
      } else {
        if (fs.existsSync(DB_FILE)) {
          try {
            const raw = fs.readFileSync(DB_FILE, "utf8");
            const parsed = JSON.parse(raw || "{}");
            applyState(parsed);
          } catch (err) {
            console.error("Failed to import local database.json into Neon.", err.message);
          }
        }
        const stateJson = JSON.stringify(getCurrentState());
        await sql`
          INSERT INTO app_state (id, state, updated_at)
          VALUES (${ONLINE_STATE_ID}, ${stateJson}::jsonb, NOW())
        `;
      }

      console.log("Using Netlify Neon online database.");
      return;
    } catch (err) {
      console.error("Neon connection failed. Falling back to local database.json.", err.message);
      sql = null;
    }
  }
  if (NETLIFY_DATABASE_URL && !HAS_REAL_NEON_URL) {
    console.log("NETLIFY_DATABASE_URL is not set to a real value. Using local database.json.");
  }

  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(getCurrentState(), null, 2), "utf8");
    return;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    const parsed = JSON.parse(raw || "{}");
    applyState(parsed);
  } catch (err) {
    console.error("Failed to load database.json", err);
  }
}

function saveDatabase() {
  const data = getCurrentState();
  if (sql) {
    const stateJson = JSON.stringify(data);
    sql`
      INSERT INTO app_state (id, state, updated_at)
      VALUES (${ONLINE_STATE_ID}, ${stateJson}::jsonb, NOW())
      ON CONFLICT (id)
      DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()
    `.catch(err => {
      console.error("Failed to save to Neon:", err.message);
    });
    return;
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
}

async function sendOtpSms(phone, otp) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_PHONE;
  if (!sid || !token || !from) {
    return false;
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const body = new URLSearchParams({
    To: phone,
    From: from,
    Body: `Your SmartAPP password reset OTP is ${otp}. It expires in 5 minutes.`
  });
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  return response.ok;
}

app.get("/", (req, res) => {
  res.json({ ok: true, message: "SmartAPP API running" });
});

app.post("/signup", (req, res) => {
  const { username, regNumber, phone, role, password, moduleTitle, moduleCode } = req.body || {};
  if (!username || !regNumber || !phone || !role || !password) {
    return res.status(400).json({ error: "Missing fields" });
  }
  if (!/^\+?[1-9]\d{7,14}$/.test(phone)) {
    return res.status(400).json({ error: "Invalid phone number" });
  }
  if (role === "teacher" && (!moduleTitle || !moduleCode)) {
    return res.status(400).json({ error: "Missing module details" });
  }
  if (users.has(username)) {
    return res.status(409).json({ error: "Username already exists" });
  }
  const regExists = Array.from(users.values()).some(u => u.regNumber === regNumber);
  if (regExists) {
    return res.status(409).json({ error: "Registration number already exists" });
  }
  users.set(username, { username, regNumber, phone, role, password, moduleTitle, moduleCode });
  saveDatabase();
  res.json({ ok: true });
});

app.post("/login", (req, res) => {
  const { username, regNumber, password } = req.body || {};
  if (!username || !regNumber || !password) {
    return res.status(400).json({ error: "Missing fields" });
  }
  const user = users.get(username);
  if (!user || user.password !== password || user.regNumber !== regNumber) {
    return res.status(401).json({ error: "Invalid username or password" });
  }
  res.json({ ok: true, role: user.role });
});

app.post("/forgot-password/request-otp", (req, res) => {
  const { username, regNumber } = req.body || {};
  if (!username || !regNumber) {
    return res.status(400).json({ error: "Missing fields" });
  }
  const user = users.get(username);
  if (!user || user.regNumber !== regNumber) {
    return res.status(404).json({ error: "User not found" });
  }
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = Date.now() + 5 * 60 * 1000;
  passwordResetOtps.set(username, { otp, expiresAt, regNumber });
  const sent = sendOtpSms(user.phone || "", otp).catch(() => false);
  Promise.resolve(sent).then(ok => {
    if (ok) {
      return res.json({ ok: true, message: "OTP sent to phone" });
    }
    console.log(`[SmartAPP OTP FALLBACK] ${username} (${user.phone || "no-phone"}): ${otp}`);
    return res.json({ ok: true, message: "OTP generated (SMS not configured; check server log)" });
  });
});

app.post("/forgot-password/verify-otp-reset", (req, res) => {
  const { username, regNumber, otp, newPassword } = req.body || {};
  if (!username || !regNumber || !otp || !newPassword) {
    return res.status(400).json({ error: "Missing fields" });
  }
  const user = users.get(username);
  if (!user || user.regNumber !== regNumber) {
    return res.status(404).json({ error: "User not found" });
  }
  const otpRecord = passwordResetOtps.get(username);
  if (!otpRecord || otpRecord.regNumber !== regNumber) {
    return res.status(400).json({ error: "OTP not requested" });
  }
  if (Date.now() > otpRecord.expiresAt) {
    passwordResetOtps.delete(username);
    return res.status(400).json({ error: "OTP expired" });
  }
  if (otpRecord.otp !== otp) {
    return res.status(400).json({ error: "Invalid OTP" });
  }
  user.password = newPassword;
  users.set(username, user);
  passwordResetOtps.delete(username);
  saveDatabase();
  res.json({ ok: true });
});

app.get("/teacher/:username", (req, res) => {
  const { username } = req.params;
  const user = users.get(username);
  if (!user || user.role !== "teacher") {
    return res.status(404).json({ error: "Teacher not found" });
  }
  res.json({
    username: user.username,
    moduleTitle: user.moduleTitle || "",
    moduleCode: user.moduleCode || ""
  });
});

app.put("/teacher/:username", (req, res) => {
  const { username } = req.params;
  const user = users.get(username);
  if (!user || user.role !== "teacher") {
    return res.status(404).json({ error: "Teacher not found" });
  }
  const { moduleTitle, moduleCode } = req.body || {};
  if (!moduleTitle || !moduleCode) {
    return res.status(400).json({ error: "Missing module details" });
  }
  user.moduleTitle = moduleTitle;
  user.moduleCode = moduleCode;
  users.set(username, user);
  saveDatabase();
  res.json({ ok: true });
});

app.get("/users", (req, res) => {
  const list = Array.from(users.values()).map(u => ({
    username: u.username,
    regNumber: u.regNumber || "",
    phone: u.phone || "",
    role: u.role,
    moduleTitle: u.moduleTitle || "",
    moduleCode: u.moduleCode || ""
  }));
  res.json(list);
});

app.put("/users/:username", (req, res) => {
  const { role } = req.query || {};
  if (role !== "admin") {
    return res.status(403).json({ error: "Not allowed" });
  }
  const { username } = req.params;
  const user = users.get(username);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  const { newRole, password, moduleTitle, moduleCode } = req.body || {};
  if (newRole && !["student", "teacher", "admin"].includes(newRole)) {
    return res.status(400).json({ error: "Invalid role" });
  }
  if (newRole) user.role = newRole;
  if (password) user.password = password;
  if (user.role === "teacher") {
    if (moduleTitle !== undefined) user.moduleTitle = moduleTitle;
    if (moduleCode !== undefined) user.moduleCode = moduleCode;
  } else {
    user.moduleTitle = "";
    user.moduleCode = "";
  }
  users.set(username, user);
  saveDatabase();
  res.json({ ok: true });
});

app.post("/marks", (req, res) => {
  const { studentRegNumber, course, score, maxScore, createdBy } = req.body || {};
  if (!studentRegNumber || !course || score === undefined || score === null || score === "" || maxScore === undefined || maxScore === null || maxScore === "") {
    return res.status(400).json({ error: "Missing fields" });
  }
  const student = Array.from(users.values()).find(
    u => u.role === "student" && u.regNumber === studentRegNumber
  );
  if (!student) {
    return res.status(404).json({ error: "Student registration number not found" });
  }
  const studentUsername = student.username;
  const exists = marks.find(
    m => m.studentUsername === studentUsername && m.course === course
  );
  if (exists) {
    return res.status(409).json({ error: "Student already has marks for this course" });
  }
  const mark = { id: nextMarkId++, studentUsername, course, score, maxScore, createdBy: createdBy || "" };
  marks.push(mark);
  saveDatabase();
  res.json({ ok: true, mark });
});

app.get("/marks", (req, res) => {
  const { teacher, role } = req.query || {};
  if (teacher) {
    return res.json(marks.filter(m => m.createdBy === teacher));
  }
  if (role !== "admin") {
    return res.status(403).json({ error: "Not allowed" });
  }
  res.json(marks);
});

app.put("/marks/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }
  const { studentUsername, course, score, maxScore } = req.body || {};
  if (!studentUsername || !course || score === undefined || score === null || score === "" || maxScore === undefined || maxScore === null || maxScore === "") {
    return res.status(400).json({ error: "Missing fields" });
  }
  const idx = marks.findIndex(m => m.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "Mark not found" });
  }
  const { teacher, role } = req.query || {};
  if (teacher && marks[idx].createdBy !== teacher) {
    return res.status(403).json({ error: "Not allowed" });
  }
  if (!teacher && role !== "admin") {
    return res.status(403).json({ error: "Not allowed" });
  }
  marks[idx] = { id, studentUsername, course, score, maxScore, createdBy: marks[idx].createdBy || "" };
  saveDatabase();
  res.json({ ok: true, mark: marks[idx] });
});

app.delete("/marks/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }
  const idx = marks.findIndex(m => m.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "Mark not found" });
  }
  const { teacher, role } = req.query || {};
  if (teacher && marks[idx].createdBy !== teacher) {
    return res.status(403).json({ error: "Not allowed" });
  }
  if (!teacher && role !== "admin") {
    return res.status(403).json({ error: "Not allowed" });
  }
  const deleted = marks.splice(idx, 1)[0];
  saveDatabase();
  res.json({ ok: true, mark: deleted });
});

app.delete("/marks", (req, res) => {
  const { studentUsername, course, teacher, role } = req.query || {};
  if (!studentUsername || !course) {
    return res.status(400).json({ error: "Missing studentUsername or course" });
  }
  const idx = marks.findIndex(
    m => m.studentUsername === studentUsername && m.course === course
  );
  if (idx === -1) {
    return res.status(404).json({ error: "Mark not found" });
  }
  if (teacher && marks[idx].createdBy !== teacher) {
    return res.status(403).json({ error: "Not allowed" });
  }
  if (!teacher && role !== "admin") {
    return res.status(403).json({ error: "Not allowed" });
  }
  const deleted = marks.splice(idx, 1)[0];
  saveDatabase();
  res.json({ ok: true, mark: deleted });
});

function escapeCsv(value) {
  const s = String(value ?? "");
  if (s.includes("\"") || s.includes(",") || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, "\"\"")}"`;
  }
  return s;
}

app.get("/marks/export", (req, res) => {
  const { teacher, role } = req.query || {};
  if (!teacher && role !== "admin") {
    return res.status(403).json({ error: "Not allowed" });
  }
  const header = "studentUsername,course,score,maxScore";
  const list = teacher ? marks.filter(m => m.createdBy === teacher) : marks;
  const lines = list.map(m =>
    [m.studentUsername, m.course, m.score, m.maxScore ?? "100"].map(escapeCsv).join(",")
  );
  const csv = [header, ...lines].join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=marks.csv");
  res.send(csv);
});

app.post("/marks/import", (req, res) => {
  const { teacher, role } = req.query || {};
  if (!teacher && role !== "admin") {
    return res.status(403).json({ error: "Not allowed" });
  }
  const csv = req.body;
  if (!csv || typeof csv !== "string") {
    return res.status(400).json({ error: "Missing CSV body" });
  }
  const lines = csv.split(/\r?\n/).filter(l => l.trim() !== "");
  if (!lines.length) {
    return res.status(400).json({ error: "Empty CSV" });
  }
  const [headerLine, ...dataLines] = lines;
  const headers = headerLine.split(",").map(h => h.trim());
  const idxUser = headers.indexOf("studentUsername");
  const idxCourse = headers.indexOf("course");
  const idxScore = headers.indexOf("score");
  const idxMax = headers.indexOf("maxScore");
  if (idxUser === -1 || idxCourse === -1 || idxScore === -1) {
    return res.status(400).json({ error: "CSV must include studentUsername, course, score columns" });
  }

  let imported = 0;
  dataLines.forEach(line => {
    const cols = line.split(",");
    const studentUsername = (cols[idxUser] || "").trim();
    const course = (cols[idxCourse] || "").trim();
    const score = (cols[idxScore] || "").trim();
    const maxScore = idxMax >= 0 ? (cols[idxMax] || "").trim() : "100";
    if (!studentUsername || !course || score === "") return;
    const mark = { id: nextMarkId++, studentUsername, course, score, maxScore: maxScore || "100", createdBy: teacher || "" };
    marks.push(mark);
    imported += 1;
  });

  saveDatabase();
  res.json({ ok: true, imported });
});

app.get("/marks/export.xlsx", (req, res) => {
  const { teacher, role } = req.query || {};
  if (!teacher && role !== "admin") {
    return res.status(403).json({ error: "Not allowed" });
  }
  const list = teacher ? marks.filter(m => m.createdBy === teacher) : marks;
  const rows = [
    ["studentUsername", "course", "score", "maxScore"],
    ...list.map(m => [m.studentUsername, m.course, m.score, m.maxScore ?? "100"])
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Marks");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", "attachment; filename=marks.xlsx");
  res.send(buf);
});

app.get("/marks/template.xlsx", (req, res) => {
  const rows = [
    ["studentUsername", "course", "score", "maxScore"],
    ["john", "Math", 95, 100]
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Template");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", "attachment; filename=marks_template.xlsx");
  res.send(buf);
});

app.post("/marks/import.xlsx", (req, res) => {
  const { teacher, role } = req.query || {};
  if (!teacher && role !== "admin") {
    return res.status(403).json({ error: "Not allowed" });
  }
  const fileBuf = req.body;
  if (!fileBuf || !fileBuf.length) {
    return res.status(400).json({ error: "Missing Excel body" });
  }
  let wb;
  try {
    wb = XLSX.read(fileBuf, { type: "buffer" });
  } catch (err) {
    return res.status(400).json({ error: "Invalid Excel file" });
  }
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  if (!rows.length) {
    return res.status(400).json({ error: "Empty sheet" });
  }
  const [header, ...dataRows] = rows;
  const idxUser = header.indexOf("studentUsername");
  const idxCourse = header.indexOf("course");
  const idxScore = header.indexOf("score");
  const idxMax = header.indexOf("maxScore");
  if (idxUser === -1 || idxCourse === -1 || idxScore === -1) {
    return res.status(400).json({ error: "Missing required columns" });
  }
  let imported = 0;
  dataRows.forEach(r => {
    const studentUsername = String(r[idxUser] ?? "").trim();
    const course = String(r[idxCourse] ?? "").trim();
    const score = String(r[idxScore] ?? "").trim();
    const maxScore = idxMax >= 0 ? String(r[idxMax] ?? "").trim() : "100";
    if (!studentUsername || !course || score === "") return;
    const mark = { id: nextMarkId++, studentUsername, course, score, maxScore: maxScore || "100", createdBy: teacher || "" };
    marks.push(mark);
    imported += 1;
  });
  saveDatabase();
  res.json({ ok: true, imported });
});

app.get("/marks/:username", (req, res) => {
  const { username } = req.params;
  const { teacher, role } = req.query || {};
  if (role === "teacher" && !teacher) {
    return res.status(403).json({ error: "Not allowed" });
  }
  const result = marks.filter(m => m.studentUsername === username && (!teacher || m.createdBy === teacher));
  res.json(result);
});

async function startServer() {
  await loadDatabase();
  app.listen(PORT, () => {
    console.log(`SmartAPP API listening on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start SmartAPP server:", err);
  process.exit(1);
});
