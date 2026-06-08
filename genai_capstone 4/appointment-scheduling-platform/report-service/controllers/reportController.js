const reportService = require("../services/reportService");

// ─── Helper to send Excel buffer ─────────────────────────────────────────────
const sendExcel = (res, buffer, filename) => {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.xlsx"`);
  res.send(buffer);
};

// ─── Admin Reports ────────────────────────────────────────────────────────────

exports.adminAppointments = async (req, res) => {
  try {
    const { status, from_date, to_date } = req.query;
    const buffer = await reportService.generateAdminAppointmentsReport({ status, from_date, to_date });
    sendExcel(res, buffer, "appointments_report");
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.adminUsers = async (req, res) => {
  try {
    const buffer = await reportService.generateUsersReport();
    sendExcel(res, buffer, "users_report");
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.adminProviders = async (req, res) => {
  try {
    const buffer = await reportService.generateProvidersReport();
    sendExcel(res, buffer, "providers_report");
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Provider Schedule ────────────────────────────────────────────────────────

exports.providerSchedule = async (req, res) => {
  try {
    const { provider_id } = req.params;
    const { month, year } = req.query;
    const buffer = await reportService.generateProviderSchedule({
      provider_id,
      month: parseInt(month) || new Date().getMonth() + 1,
      year: parseInt(year) || new Date().getFullYear(),
    });
    sendExcel(res, buffer, `schedule_${month}_${year}`);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Customer History ─────────────────────────────────────────────────────────

exports.customerHistory = async (req, res) => {
  try {
    const { customer_id } = req.params;
    const buffer = await reportService.generateCustomerHistory({ customer_id });
    sendExcel(res, buffer, `customer_history_${customer_id.slice(0, 8)}`);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
