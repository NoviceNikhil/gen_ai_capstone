import { memo, useCallback, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Calendar,
  Settings,
  LogOut,
  Tag,
  Clock,
  UserCheck,
  Shield,
  ChevronRight,
  Lock,
  Bell,
  CreditCard,
  Star,
  RefreshCw,
  ListOrdered,
  Package,
  Link2,
  FileWarning,
  BarChart3,
  Workflow,
  Gavel,
  Building2,
} from "lucide-react";
import { logoutUser, fullLogout } from "../../store/authSlice";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import ProfileEditModal from "../ui/ProfileEditModal";

const NAV_ITEMS = {
  customer: [
    { to: "/customer/dashboard", icon: LayoutDashboard, label: "Overview" },
    { to: "/customer/providers", icon: Users, label: "Marketplace" },
    { to: "/customer/appointments", icon: Calendar, label: "Appointments" },
    {
      to: "/customer/appointments/calendar",
      icon: Calendar,
      label: "Calendar",
    },
    { to: "/customer/waitlist", icon: ListOrdered, label: "Waitlist" },
    { to: "/customer/rebook", icon: RefreshCw, label: "Rebook" },
    { to: "/customer/payments", icon: CreditCard, label: "Payments" },
    { to: "/customer/notifications", icon: Bell, label: "Notifications" },
    { to: "/customer/reviews", icon: Star, label: "Reviews" },
  ],
  provider: [
    { to: "/provider/dashboard", icon: LayoutDashboard, label: "Analytics" },
    { to: "/provider/appointments", icon: Calendar, label: "Booking Queue" },
    { to: "/provider/availability", icon: Clock, label: "Schedule" },
    { to: "/provider/services", icon: Package, label: "Services" },
    { to: "/provider/reviews", icon: Star, label: "Reviews and Ratings" },
    { to: "/provider/organization", icon: Building2, label: "Organization" },
    { to: "/provider/calendar-sync", icon: Link2, label: "Calendar Sync" },
    { to: "/provider/insights", icon: BarChart3, label: "Insights" },
  ],
  admin: [
    { to: "/admin/dashboard", icon: LayoutDashboard, label: "Platform" },
    { to: "/admin/users", icon: Users, label: "User Control" },
    { to: "/admin/providers", icon: UserCheck, label: "Verification" },
    { to: "/admin/organizations", icon: Building2, label: "Organizations" },
    { to: "/admin/organization-requests", icon: Clock, label: "Org Requests" },
    { to: "/admin/appointments", icon: Calendar, label: "System Logs" },
    { to: "/admin/categories", icon: Tag, label: "Taxonomy" },
    { to: "/admin/operations", icon: Workflow, label: "Operations" },
    { to: "/admin/disputes", icon: Gavel, label: "Disputes" },
    { to: "/admin/compliance", icon: Shield, label: "Compliance" },
    { to: "/admin/growth", icon: BarChart3, label: "Growth" },
    { to: "/admin/automation", icon: RefreshCw, label: "Automation" },
  ],
  organization: [
    {
      to: "/organization/dashboard",
      icon: LayoutDashboard,
      label: "Overview",
    },
    { to: "/organization/dashboard?tab=employees", icon: Users, label: "Employees" },
    { to: "/organization/dashboard?tab=join-requests", icon: UserCheck, label: "Join Requests" },
    { to: "/organization/dashboard?tab=appointments", icon: Calendar, label: "Appointments" },
    { to: "/organization/dashboard?tab=revenue", icon: Briefcase, label: "Revenue" },
  ],
};

function Sidebar() {
  const { role, user } = useSelector((s) => s.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const navItems = NAV_ITEMS[role] || [];

  const handleLogout = useCallback(async () => {
    await dispatch(logoutUser());
    dispatch(fullLogout());
    navigate("/login");
  }, [dispatch, navigate]);

  return (
    <>
      <aside className="w-64 min-w-[256px] h-[calc(100vh-70px)] sticky top-[70px] flex flex-col border-r border-border bg-sidebar/70 backdrop-blur-md px-4 py-6 group/sidebar">
        {/* ── Role Badge ─────────────────────────────────── */}
        <div
          className="mb-6 cursor-pointer group/profile"
          onClick={() => setIsProfileModalOpen(true)}
        >
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card/70 backdrop-blur-md border border-border shadow-sm group-hover/profile:border-primary/50 transition-colors">
            <Avatar className="w-9 h-9">
              <AvatarFallback className="bg-primary/10 text-primary font-extrabold text-sm uppercase">
                {user?.full_name?.[0]?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-bold truncate leading-none mb-1.5 text-foreground">
                {user?.full_name}
              </p>
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${role === "admin" ? "bg-destructive" : "bg-success"}`}
                />
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                  {role}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Navigation ─────────────────────────────────── */}
        <nav className="flex-1 flex flex-col gap-1 overflow-y-auto pr-1">
          <p className="px-4 text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80 mb-2">
            Main Menu
          </p>
          {navItems.map(({ to, icon: Icon, label }) => {
            const basePath = to.split("?")[0];
            const isLocked =
              role === "organization" &&
              user?.org_status === "pending" &&
              basePath !== "/organization/dashboard";

            if (isLocked) {
              return (
                <div
                  key={to}
                  className="group/item flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold text-muted-foreground/50 cursor-not-allowed bg-transparent"
                  title="Waiting for admin approval"
                >
                  <Lock
                    size={16}
                    className="text-muted-foreground/30 shrink-0"
                  />
                  <span className="flex-1 min-w-0 truncate">{label}</span>
                </div>
              );
            }

            return (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `group/item flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-[3px] border-primary pl-[13px]"
                      : "text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      size={16}
                      className={`${isActive ? "text-primary" : "text-muted-foreground group-hover/item:text-foreground"} transition-colors duration-150 shrink-0`}
                    />
                    <span className="flex-1 min-w-0 truncate">{label}</span>
                    {isActive && (
                      <ChevronRight size={12} className="opacity-50 ml-auto" />
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* ── Footer / Logout ────────────────────────────── */}
        <div className="mt-auto pt-4 border-t border-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold w-full text-destructive hover:bg-destructive/10 transition-all group/logout cursor-pointer border-0"
          >
            <LogOut
              size={16}
              className="group-hover/logout:-translate-x-0.5 transition-transform shrink-0"
            />
            <span>Exit Session</span>
          </button>
        </div>

        <ProfileEditModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
        />
      </aside>
    </>
  );
}

export default memo(Sidebar);
