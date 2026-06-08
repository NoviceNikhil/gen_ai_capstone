import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";

export default function ProtectedRoute() {
  const { isAuthenticated } = useSelector((s) => s.auth);
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}
