const XLSX = require("xlsx");
const mysql2 = require("mysql2/promise");

// ─── DB Connection pool ───────────────────────────────────────────────────────
const pool = mysql2.createPool({
  host: process.env.SQL_HOST,
  port: process.env.SQL_PORT,
  user: process.env.SQL_DB_USER,
  password: process.env.SQL_PASSWORD,
  database: process.env.SQL_DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  ...(process.env.SQL_SSL === "true" && {
    ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
  }),
});

// ─── Helper: query → xlsx buffer ─────────────────────────────────────────────
const buildExcelBuffer = (rows, sheetName = "Report") => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto-size columns
  const colWidths = Object.keys(rows[0] || {}).map((key) => ({
    wch: Math.max(key.length, 14),
  }));
  ws["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
};

// ─── Admin: All Appointments Report ──────────────────────────────────────────
const generateAdminAppointmentsReport = async ({ status, from_date, to_date }) => {
  let query = `
    SELECT
      a.id                       AS appointment_id,
      u.full_name                AS customer_name,
      u.email                    AS customer_email,
      pu.full_name               AS provider_name,
      sp.specialization,
      c.name                     AS category,
      a.appointment_date,
      a.time_slot,
      a.status,
      a.is_paid,
      a.consultation_fee_snapshot AS fee_inr,
      a.notes,
      a.cancellation_reason,
      a.created_at
    FROM appointments a
    JOIN users u       ON u.id = a.customer_id
    JOIN service_providers sp ON sp.id = a.provider_id
    JOIN users pu      ON pu.id = sp.user_id
    LEFT JOIN categories c ON c.id = a.category_id
    WHERE 1=1
  `;
  const params = [];

  if (status) { query += " AND a.status = ?"; params.push(status); }
  if (from_date) { query += " AND a.appointment_date >= ?"; params.push(from_date); }
  if (to_date) { query += " AND a.appointment_date <= ?"; params.push(to_date); }

  query += " ORDER BY a.appointment_date DESC, a.time_slot ASC";

  const [rows] = await pool.query(query, params);
  return buildExcelBuffer(rows, "All Appointments");
};

// ─── Admin: Users Report ──────────────────────────────────────────────────────
const generateUsersReport = async () => {
  const [rows] = await pool.query(`
    SELECT
      id, full_name, email, phone, role, is_active, created_at
    FROM users
    ORDER BY created_at DESC
  `);
  return buildExcelBuffer(rows, "Users");
};

// ─── Admin: Providers Report ──────────────────────────────────────────────────
const generateProvidersReport = async () => {
  const [rows] = await pool.query(`
    SELECT
      sp.id,
      u.full_name      AS provider_name,
      u.email,
      u.phone,
      sp.specialization,
      c.name           AS category,
      sp.experience_years,
      sp.location,
      sp.avg_rating,
      sp.total_reviews,
      sp.consultation_fee,
      sp.is_verified,
      sp.is_accepting_appointments,
      sp.created_at
    FROM service_providers sp
    JOIN users u ON u.id = sp.user_id
    LEFT JOIN categories c ON c.id = sp.category_id
    ORDER BY sp.created_at DESC
  `);
  return buildExcelBuffer(rows, "Service Providers");
};

// ─── Provider: Monthly Schedule ───────────────────────────────────────────────
const generateProviderSchedule = async ({ provider_id, month, year }) => {
  const [rows] = await pool.query(
    `
    SELECT
      a.appointment_date,
      a.time_slot,
      u.full_name  AS customer_name,
      u.email      AS customer_email,
      u.phone      AS customer_phone,
      a.status,
      a.is_paid,
      a.consultation_fee_snapshot AS fee_inr,
      a.notes,
      a.created_at AS booked_at
    FROM appointments a
    JOIN users u ON u.id = a.customer_id
    WHERE a.provider_id = ?
      AND MONTH(a.appointment_date) = ?
      AND YEAR(a.appointment_date) = ?
    ORDER BY a.appointment_date ASC, a.time_slot ASC
  `,
    [provider_id, month, year]
  );
  return buildExcelBuffer(rows, `Schedule_${month}_${year}`);
};

// ─── Customer: Appointment History ────────────────────────────────────────────
const generateCustomerHistory = async ({ customer_id }) => {
  const [rows] = await pool.query(
    `
    SELECT
      a.appointment_date,
      a.time_slot,
      pu.full_name  AS provider_name,
      sp.specialization,
      c.name        AS category,
      a.status,
      a.is_paid,
      a.consultation_fee_snapshot AS fee_inr,
      a.notes,
      a.cancellation_reason,
      a.created_at  AS booked_at
    FROM appointments a
    JOIN service_providers sp ON sp.id = a.provider_id
    JOIN users pu ON pu.id = sp.user_id
    LEFT JOIN categories c ON c.id = a.category_id
    WHERE a.customer_id = ?
    ORDER BY a.appointment_date DESC
  `,
    [customer_id]
  );
  return buildExcelBuffer(rows, "Appointment History");
};

module.exports = {
  generateAdminAppointmentsReport,
  generateUsersReport,
  generateProvidersReport,
  generateProviderSchedule,
  generateCustomerHistory,
};
