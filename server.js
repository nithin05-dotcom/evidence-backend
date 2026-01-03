const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");

const app = express();
app.use(cors());
app.use(express.json());

const USERS_FILE = path.join(__dirname, "users.json");
const EVIDENCE_FILE = path.join(__dirname, "evidence.json");

/* 🔐 PINATA KEYS (REAL) */
const PINATA_API_KEY = "1e792a29fcf1a3727146";
const PINATA_SECRET_KEY = "783cca76e086f9b826092bb13fafca412c1c34856f77b81343e5f08adfe9df93";

/* ---------- ENSURE FILE ---------- */
function ensureEvidenceFile() {
  if (!fs.existsSync(EVIDENCE_FILE)) {
    fs.writeFileSync(EVIDENCE_FILE, "[]");
  }
}

/* ---------- LOGIN ---------- */
app.post("/login", (req, res) => {
  const { email, password, role } = req.body;
  const users = JSON.parse(fs.readFileSync(USERS_FILE));

  const user = users.find(
    u => u.email === email && u.password === password && u.role === role
  );

  if (!user) return res.status(401).json({ message: "Invalid credentials" });
  res.json({ role });
});

/* ---------- MULTER ---------- */
const upload = multer({ dest: "temp/" });

/* ---------- POLICE UPLOAD (FILE → IPFS) ---------- */
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    ensureEvidenceFile();

    const caseId = req.body.caseId;
    if (!req.file || !caseId) {
      return res.status(400).json({ error: "Missing file or caseId" });
    }

    const data = new FormData();
    data.append("file", fs.createReadStream(req.file.path));

    const pinataRes = await axios.post(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      data,
      {
        headers: {
          ...data.getHeaders(),
          pinata_api_key:"1e792a29fcf1a3727146",
          pinata_secret_api_key:"783cca76e086f9b826092bb13fafca412c1c34856f77b81343e5f08adfe9df93",
        }
      }
    );

    fs.unlinkSync(req.file.path); // delete temp file

    const record = {
      caseId: String(caseId),
      ipfsHash: pinataRes.data.IpfsHash,
      fileName: req.file.originalname,
      status: "Pending"
    };

    const evidence = JSON.parse(fs.readFileSync(EVIDENCE_FILE));
    evidence.push(record);
    fs.writeFileSync(EVIDENCE_FILE, JSON.stringify(evidence, null, 2));

    res.json(record);

  } catch (err) {
    console.error("UPLOAD ERROR:", err.response?.data || err.message);
    res.status(500).json({ error: "Upload failed" });
  }
});

/* ---------- COURT VIEW ---------- */
app.get("/cases", (req, res) => {
  ensureEvidenceFile();
  res.json(JSON.parse(fs.readFileSync(EVIDENCE_FILE)));
});

/* ---------- APPROVE / REJECT ---------- */
app.post("/update-status", (req, res) => {
  const { caseId, status } = req.body;
  let data = JSON.parse(fs.readFileSync(EVIDENCE_FILE));

  data = data.map(e =>
    e.caseId === String(caseId) ? { ...e, status } : e
  );

  fs.writeFileSync(EVIDENCE_FILE, JSON.stringify(data, null, 2));
  res.json({ message: "Updated" });
});

/* ---------- CLEAR ---------- */
app.post("/clear", (req, res) => {
  const { caseId } = req.body;
  let data = JSON.parse(fs.readFileSync(EVIDENCE_FILE));

  data = data.filter(e => e.caseId !== String(caseId));
  fs.writeFileSync(EVIDENCE_FILE, JSON.stringify(data, null, 2));
  res.json({ message: "Cleared" });
});
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

