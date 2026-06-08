import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";

export default function RoleRoute({ allowedRoles }) {
  const { role, isAuthenticated } = useSelector((s) => s.auth);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (!allowedRoles.includes(role)) {
    // Redirect to correct dashboard based on actual role
    const dashboardMap = {
      customer: "/customer/dashboard",
      provider: "/provider/dashboard",
      organization: "/organization/dashboard",
      admin: "/admin/dashboard",
    };
    return <Navigate to={dashboardMap[role] || "/"} replace />;
  }

  return <Outlet />;
}
