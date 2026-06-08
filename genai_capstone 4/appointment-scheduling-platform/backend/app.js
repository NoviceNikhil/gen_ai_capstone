const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const passport = require("passport");

const errorHandler = require("./middleware/errorHandler");

// ================= ROUTES =================
const authRoute = require("./routes/authRoute");
const customerRoutes = require("./routes/customerRoutes");
const providerRoutes = require("./routes/providerRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const availabilityRoutes = require("./routes/availabilityRoutes");
const adminRoutes = require("./routes/adminRoutes");
const categoryRoutes = require("./routes/categoryRoutes");

const app = express();

// ─── Trust proxy (required for rate limiters behind Render/Heroku/etc.) ───
app.set("trust proxy", 1);

const localDevOriginPattern = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  ...(process.env.FRONTEND_URLS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
];

// ================= MIDDLEWARE =================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  cors({
    origin: (origin, callback) => {
      // allow server-to-server / curl requests (no Origin header)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || localDevOriginPattern.test(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

// ================= PASSPORT =================
require("./config/passport");
app.use(passport.initialize());

// ================= DATABASE =================
const { sequelize, connectSQL } = require("./config/sql");
connectSQL();

sequelize
  .sync()
  .then(() => console.log("  Tables synced successfully"))
  .catch((err) => console.error("  Table sync error:", err));

// ================= API ROUTES =================
app.use("/auth", authRoute);
app.use("/api/customer", customerRoutes);
app.use("/api/provider", providerRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/categories", categoryRoutes);

// ================= GLOBAL ERROR HANDLER =================
app.use(errorHandler);

// ================= SERVER =================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`  Server running on port ${PORT}`);
});
