import api from "./axios";

// ─── Download helper ──────────────────────────────────────────────────────────
const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const getReportBlob = (url, config = {}) =>
  api.get(url, { ...config, responseType: "blob" });

// ─── Admin Reports ────────────────────────────────────────────────────────────
export const downloadAdminAppointmentsReport = async (params = {}) => {
  const res = await getReportBlob("/api/reports/admin/appointments", { params });
  downloadBlob(res.data, "appointments_report.xlsx");
};

export const downloadAdminUsersReport = async () => {
  const res = await getReportBlob("/api/reports/admin/users");
  downloadBlob(res.data, "users_report.xlsx");
};

export const downloadAdminProvidersReport = async () => {
  const res = await getReportBlob("/api/reports/admin/providers");
  downloadBlob(res.data, "providers_report.xlsx");
};

// ─── Provider Schedule ────────────────────────────────────────────────────────
export const downloadProviderSchedule = async (providerId, month, year) => {
  const res = await getReportBlob(`/api/reports/provider/${providerId}/schedule`, {
    params: { month, year },
  });
  downloadBlob(res.data, `schedule_${month}_${year}.xlsx`);
};

// ─── Customer History ─────────────────────────────────────────────────────────
export const downloadCustomerHistory = async (customerId) => {
  const res = await getReportBlob(`/api/reports/customer/${customerId}/history`);
  downloadBlob(res.data, "appointment_history.xlsx");
};
