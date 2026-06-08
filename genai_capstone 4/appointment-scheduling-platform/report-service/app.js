const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env"), override: true });

const express = require("express");
const cors = require("cors");
const reportRoutes = require("./routes/reportRoutes");

const app = express();

// ================= MIDDLEWARE =================
app.use(express.json());
app.use(cors());

// ================= INTERNAL AUTH GUARD =================
// All routes are protected by shared secret header
app.use((req, res, next) => {
  const secret = req.headers["x-report-secret"];
  if (secret !== process.env.REPORT_SERVICE_SECRET) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  next();
});

// ================= ROUTES =================
app.use("/reports", reportRoutes);

// ================= HEALTH =================
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Sigslot Report Service running" });
});

// ================= SERVER =================
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`  Report Service running on port ${PORT}`);
});
