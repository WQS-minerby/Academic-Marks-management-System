const express = require("express");
const cors = require("cors");
const XLSX = require("xlsx");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.text({ type: "text/csv" }));
app.use(express.raw({
  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  limit: "10mb"
}));

const users = new Map();
const marks = [];
let nextMarkId = 1;

app.get("/", (req, res) => {
  res.json({ ok: true, message: "SmartAPP API running" });
});

app.post("/signup", (req, res) => {
  const { username, role, password, moduleTitle, moduleCode } = req.body || {};
  if (!username || !role || !password) {
    return res.status(400).json({ error: "Missing fields" });
  }
  if (role === "teacher" && (!moduleTitle || !moduleCode)) {
    return res.status(400).json({ error: "Missing module details" });
  }
  if (users.has(username)) {
    return res.status(409).json({ error: "Username already exists" });
  }
  users.set(username, { username, role, password, moduleTitle, moduleCode });
  res.json({ ok: true });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Missing fields" });
  }
  const user = users.get(username);
  if (!user || user.password !== password) {
    return res.status(401).json({ error: "Invalid username or password" });
  }
  res.json({ ok: true, role: user.role });
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
  res.json({ ok: true });
});

app.get("/users", (req, res) => {
  const list = Array.from(users.values()).map(u => ({
    username: u.username,
    role: u.role,
    moduleTitle: u.moduleTitle || "",
    moduleCode: u.moduleCode || ""
  }));
  res.json(list);
});

app.post("/marks", (req, res) => {
  const { studentUsername, course, score, maxScore } = req.body || {};
  if (!studentUsername || !course || score === undefined || score === null || score === "" || maxScore === undefined || maxScore === null || maxScore === "") {
    return res.status(400).json({ error: "Missing fields" });
  }
  const exists = marks.find(
    m => m.studentUsername === studentUsername && m.course === course
  );
  if (exists) {
    return res.status(409).json({ error: "Student already has marks for this course" });
  }
  const mark = { id: nextMarkId++, studentUsername, course, score, maxScore };
  marks.push(mark);
  res.json({ ok: true, mark });
});

app.get("/marks", (req, res) => {
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
  marks[idx] = { id, studentUsername, course, score, maxScore };
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
  const deleted = marks.splice(idx, 1)[0];
  res.json({ ok: true, mark: deleted });
});

app.delete("/marks", (req, res) => {
  const { studentUsername, course } = req.query || {};
  if (!studentUsername || !course) {
    return res.status(400).json({ error: "Missing studentUsername or course" });
  }
  const idx = marks.findIndex(
    m => m.studentUsername === studentUsername && m.course === course
  );
  if (idx === -1) {
    return res.status(404).json({ error: "Mark not found" });
  }
  const deleted = marks.splice(idx, 1)[0];
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
  const header = "studentUsername,course,score,maxScore";
  const lines = marks.map(m =>
    [m.studentUsername, m.course, m.score, m.maxScore ?? "100"].map(escapeCsv).join(",")
  );
  const csv = [header, ...lines].join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=marks.csv");
  res.send(csv);
});

app.post("/marks/import", (req, res) => {
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
    const mark = { id: nextMarkId++, studentUsername, course, score, maxScore: maxScore || "100" };
    marks.push(mark);
    imported += 1;
  });

  res.json({ ok: true, imported });
});

app.get("/marks/export.xlsx", (req, res) => {
  const rows = [
    ["studentUsername", "course", "score", "maxScore"],
    ...marks.map(m => [m.studentUsername, m.course, m.score, m.maxScore ?? "100"])
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
    const mark = { id: nextMarkId++, studentUsername, course, score, maxScore: maxScore || "100" };
    marks.push(mark);
    imported += 1;
  });
  res.json({ ok: true, imported });
});

app.get("/marks/:username", (req, res) => {
  const { username } = req.params;
  const result = marks.filter(m => m.studentUsername === username);
  res.json(result);
});

app.listen(PORT, () => {
  console.log(`SmartAPP API listening on http://localhost:${PORT}`);
});
