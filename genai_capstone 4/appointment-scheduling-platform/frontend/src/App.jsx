import { lazy, Suspense, useEffect, useState } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useSelector } from "react-redux";

// ─── Layout Components ────────────────────────────────────────────────────────
import Navbar from "./components/Navbar";
import Sidebar from "./components/layout/Sidebar";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";
import ThemeToggle from "./components/ThemeToggle";

// ─── Auth Pages ───────────────────────────────────────────────────────────────
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import VerifyOtp from "./pages/auth/VerifyOtp";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";

// ─── Public ───────────────────────────────────────────────────────────────────
import LandingPage from "./pages/LandingPage";

// ─── Customer Pages ───────────────────────────────────────────────────────────
import CustomerDashboard from "./pages/customer/Dashboard";
import ProviderList from "./pages/customer/ProviderList";
import ProviderDetail from "./pages/customer/ProviderDetail";
import BookAppointment from "./pages/customer/BookAppointment";
import AppointmentHistory from "./pages/customer/AppointmentHistory";
import AppointmentsCalendar from "./pages/customer/AppointmentsCalendar";
import CustomerAppointmentDetail from "./pages/customer/AppointmentDetail";
import CustomerWaitlist from "./pages/customer/Waitlist";
const CustomerPayments = lazy(() => import("./pages/customer/Payments"));
const CustomerNotifications = lazy(
  () => import("./pages/customer/Notifications"),
);
const CustomerReviews = lazy(() => import("./pages/customer/Reviews"));
const RebookPage = lazy(() => import("./pages/customer/Rebook"));

// ─── Provider Pages ───────────────────────────────────────────────────────────
import ProviderDashboard from "./pages/provider/Dashboard";
import ProviderOnboarding from "./pages/provider/Onboarding";
import ProviderProfile from "./pages/provider/Profile";
import ProviderAvailability from "./pages/provider/Availability";
import ProviderAppointments from "./pages/provider/Appointments";
import ProviderAppointmentDetail from "./pages/provider/AppointmentDetail";
import ProviderServices from "./pages/provider/Services";
import ProviderOrganization from "./pages/provider/Organization";
import ProviderCalendarSync from "./pages/provider/CalendarSync";
import ProviderTeam from "./pages/provider/Team";
import ProviderInsights from "./pages/provider/Insights";
import ProviderReviewsRatings from "./pages/provider/ReviewsRatings";
import OrganizationDashboard from "./pages/organization/Dashboard";
import OrganisationOnboarding from "./pages/organization/Onboarding";
// ─── Admin Pages ──────────────────────────────────────────────────────────────
import AdminDashboard from "./pages/admin/Dashboard";
import AdminUsers from "./pages/admin/Users";
import AdminProviders from "./pages/admin/Providers";
import AdminAppointments from "./pages/admin/Appointments";
import AdminCategories from "./pages/admin/Categories";
import AdminOrganizations from "./pages/admin/Organizations";
import AdminOrganizationRequests from "./pages/admin/OrganizationRequests";
const AdminOperations = lazy(() => import("./pages/admin/Operations"));
const AdminDisputes = lazy(() => import("./pages/admin/Disputes"));
const AdminCompliance = lazy(() => import("./pages/admin/Compliance"));
const AdminGrowth = lazy(() => import("./pages/admin/Growth"));
const AdminAutomation = lazy(() => import("./pages/admin/Automation"));
import RoleFeaturePage from "./pages/shared/RoleFeaturePage";

// ── chatbot changes start ─────────────────────────────────────────────────────
import SchedullyChatWidget from "./components/SchedullyChatWidget";
// ── chatbot changes end ───────────────────────────────────────────────────────

const AUTH_ROUTES = [
  "/login",
  "/signup",
  "/verify-otp",
  "/forgot-password",
  "/reset-password",
];
const SIDEBAR_ROUTES = ["/customer", "/provider", "/admin", "/organization"];

export default function App() {
  const location = useLocation();
  const { isAuthenticated, role } = useSelector((s) => s.auth);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "light",
  );
  const showNavbar = !AUTH_ROUTES.some((r) => location.pathname.startsWith(r));
  const showSidebar =
    isAuthenticated &&
    SIDEBAR_ROUTES.some((r) => location.pathname.startsWith(r)) &&
    location.pathname !== "/provider/onboarding" &&
    location.pathname !== "/onboarding/organisation";

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--color-surface)" }}
    >
      <div className="fixed right-5 top-5 z-[60]">
        <ThemeToggle
          theme={theme}
          onToggle={() =>
            setTheme((current) => (current === "dark" ? "light" : "dark"))
          }
        />
      </div>

      {/* ── Navbar ───────────────────────────────────────── */}
      {showNavbar && <Navbar />}

      <div className="relative z-10" style={{ display: "flex" }}>
        {/* ── Sidebar ──────────────────────────────────── */}
        {showSidebar && <Sidebar />}

        {/* ── Main Content ──────────────────────────────── */}
        <main style={{ flex: 1, minHeight: "100vh" }}>
          <Suspense
            fallback={
              <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            }
          >
            <Routes>
              {/* Public */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/verify-otp" element={<VerifyOtp />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Customer routes */}
              <Route element={<ProtectedRoute />}>
                <Route element={<RoleRoute allowedRoles={["customer"]} />}>
                  <Route
                    path="/customer/dashboard"
                    element={<CustomerDashboard />}
                  />
                  <Route
                    path="/customer/providers"
                    element={<ProviderList />}
                  />
                  <Route
                    path="/customer/providers/:id"
                    element={<ProviderDetail />}
                  />
                  <Route
                    path="/customer/book/:providerId"
                    element={<BookAppointment />}
                  />
                  <Route
                    path="/customer/appointments"
                    element={<AppointmentHistory />}
                  />
                  <Route
                    path="/customer/appointments/calendar"
                    element={<AppointmentsCalendar />}
                  />
                  <Route
                    path="/customer/appointments/:id"
                    element={<CustomerAppointmentDetail />}
                  />
                  <Route
                    path="/customer/waitlist"
                    element={<CustomerWaitlist />}
                  />
                  <Route path="/customer/rebook" element={<RebookPage />} />
                  <Route
                    path="/customer/payments"
                    element={<CustomerPayments />}
                  />
                  <Route
                    path="/customer/notifications"
                    element={<CustomerNotifications />}
                  />
                  <Route
                    path="/customer/reviews"
                    element={<CustomerReviews />}
                  />
                </Route>
              </Route>

              {/* Provider routes */}
              <Route element={<ProtectedRoute />}>
                <Route element={<RoleRoute allowedRoles={["provider"]} />}>
                  <Route
                    path="/provider/onboarding"
                    element={<ProviderOnboarding />}
                  />
                  <Route
                    path="/provider/dashboard"
                    element={<ProviderDashboard />}
                  />
                  <Route
                    path="/provider/profile"
                    element={<ProviderProfile />}
                  />
                  <Route
                    path="/provider/availability"
                    element={<ProviderAvailability />}
                  />
                  <Route
                    path="/provider/appointments"
                    element={<ProviderAppointments />}
                  />
                  <Route
                    path="/provider/appointments/:id"
                    element={<ProviderAppointmentDetail />}
                  />
                  <Route
                    path="/provider/services"
                    element={<ProviderServices />}
                  />
                  <Route
                    path="/provider/organization"
                    element={<ProviderOrganization />}
                  />
                  <Route
                    path="/provider/calendar-sync"
                    element={<ProviderCalendarSync />}
                  />
                  <Route path="/provider/team" element={<ProviderTeam />} />
                  <Route
                    path="/provider/insights"
                    element={<ProviderInsights />}
                  />
                  <Route
                    path="/provider/reviews"
                    element={<ProviderReviewsRatings />}
                  />
                </Route>
              </Route>

              {/* Organization routes */}
              <Route element={<ProtectedRoute />}>
                <Route element={<RoleRoute allowedRoles={["organization"]} />}>
                  <Route
                    path="/organization/dashboard"
                    element={<OrganizationDashboard />}
                  />
                  <Route
                    path="/onboarding/organisation"
                    element={<OrganisationOnboarding />}
                  />
                </Route>
              </Route>

              {/* Admin routes */}
              <Route element={<ProtectedRoute />}>
                <Route element={<RoleRoute allowedRoles={["admin"]} />}>
                  <Route path="/admin/dashboard" element={<AdminDashboard />} />
                  <Route path="/admin/users" element={<AdminUsers />} />
                  <Route path="/admin/providers" element={<AdminProviders />} />
                  <Route
                    path="/admin/appointments"
                    element={<AdminAppointments />}
                  />
                  <Route
                    path="/admin/categories"
                    element={<AdminCategories />}
                  />
                  <Route
                    path="/admin/organizations"
                    element={<AdminOrganizations />}
                  />
                  <Route
                    path="/admin/organization-requests"
                    element={<AdminOrganizationRequests />}
                  />
                  <Route
                    path="/admin/operations"
                    element={<AdminOperations />}
                  />
                  <Route path="/admin/disputes" element={<AdminDisputes />} />
                  <Route
                    path="/admin/compliance"
                    element={<AdminCompliance />}
                  />
                  <Route path="/admin/growth" element={<AdminGrowth />} />
                  <Route
                    path="/admin/automation"
                    element={<AdminAutomation />}
                  />
                </Route>
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
        {/* ── chatbot changes start ─────────────────────────────────────────── */}
        {isAuthenticated && <SchedullyChatWidget />}
        {/* ── chatbot changes end ───────────────────────────────────────────── */}
      </div>
    </div>
  );
}
