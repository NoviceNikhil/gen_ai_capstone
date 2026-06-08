export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
export const REPORT_SERVICE_URL = import.meta.env.VITE_REPORT_SERVICE_URL || "http://localhost:4000";
export const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || "";

export const APPOINTMENT_STATUSES = ["pending", "confirmed", "completed", "cancelled"];

export const STATUS_COLORS = {
  pending: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
  confirmed: { bg: "bg-info/10", text: "text-info", dot: "bg-info" },
  completed: { bg: "bg-success/10", text: "text-success", dot: "bg-success" },
  cancelled: { bg: "bg-error/10", text: "text-error", dot: "bg-error" },
};

export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
