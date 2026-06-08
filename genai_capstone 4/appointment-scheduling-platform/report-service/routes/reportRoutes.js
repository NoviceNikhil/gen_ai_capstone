const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");

// ─── Admin Reports ────────────────────────────────────────────────────────────
// GET /reports/admin/appointments?status=&from_date=&to_date=
router.get("/admin/appointments", reportController.adminAppointments);

// GET /reports/admin/users
router.get("/admin/users", reportController.adminUsers);

// GET /reports/admin/providers
router.get("/admin/providers", reportController.adminProviders);

// ─── Provider Reports ─────────────────────────────────────────────────────────
// GET /reports/provider/:provider_id/schedule?month=5&year=2026
router.get("/provider/:provider_id/schedule", reportController.providerSchedule);

// ─── Customer Reports ─────────────────────────────────────────────────────────
// GET /reports/customer/:customer_id/history
router.get("/customer/:customer_id/history", reportController.customerHistory);

module.exports = router;
