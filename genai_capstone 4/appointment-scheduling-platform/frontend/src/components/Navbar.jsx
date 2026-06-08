import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  Calendar,
  LogIn,
  LogOut,
  Menu,
  Sparkles,
  Bell,
  ExternalLink,
} from "lucide-react";
import { logoutUser, fullLogout } from "../store/authSlice";
import { memo, useCallback, useEffect, useState } from "react";
import {
  getNotificationsNewAPI,
  markNotificationReadNewAPI,
} from "../services/apiService";
import { markAllNotificationsReadNewAPI } from "../services/apiService";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function Navbar() {
  const { isAuthenticated, role, user } = useSelector((s) => s.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const dashboardMap = {
    customer: "/customer/dashboard",
    provider: "/provider/dashboard",
    admin: "/admin/dashboard",
  };

  const handleLogout = useCallback(async () => {
    await dispatch(logoutUser());
    dispatch(fullLogout());
    navigate("/login");
  }, [dispatch, navigate]);

  useEffect(() => {
    let mounted = true;
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const loadNotifications = async () => {
      try {
        const res = await getNotificationsNewAPI({
          limit: 8,
          offset: 0,
          unread_only: true,
        });
        if (!mounted) return;
        const notifs = res.data?.data?.notifications || [];
        setNotifications(notifs);
        setUnreadCount(notifs.length);
      } catch (e) {
        if (!mounted) return;
        console.error("Failed to load notifications:", e);
        setNotifications([]);
        setUnreadCount(0);
      }
    };

    loadNotifications();
    const timer = setInterval(loadNotifications, 15000); // Refresh every 15 seconds
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [isAuthenticated]);

  // Allow other flows (booking/cancel) to trigger immediate refresh.
  useEffect(() => {
    const handleRefresh = () => {
      if (!isAuthenticated) return;
      // Reuse the existing polling: just force a quick fetch by toggling state via direct call.
      getNotificationsNewAPI({ limit: 8, offset: 0, unread_only: true })
        .then((res) => {
          const notifs = res.data?.data?.notifications || [];
          setNotifications(notifs);
          setUnreadCount(notifs.length);
        })
        .catch(() => {});
    };
    window.addEventListener("notifications-refresh", handleRefresh);
    return () => window.removeEventListener("notifications-refresh", handleRefresh);
  }, [isAuthenticated]);

  useEffect(() => {
    const handleSyncRead = (e) => {
      const readId = e.detail?.id;
      if (readId) {
        setNotifications((prev) => prev.filter((item) => item.id !== readId));
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    };

    window.addEventListener("notification-read", handleSyncRead);
    const handleSyncReadAll = () => {
      setNotifications([]);
      setUnreadCount(0);
    };
    window.addEventListener("notifications-read-all", handleSyncReadAll);
    return () => {
      window.removeEventListener("notification-read", handleSyncRead);
      window.removeEventListener("notifications-read-all", handleSyncReadAll);
    };
  }, []);

  const handlePopoverOpenChange = useCallback(
    async (open) => {
      // When the popover is being closed after being opened,
      // mark all as read and clear the bell badge + list.
      if (notificationsOpen && !open) {
        try {
          await markAllNotificationsReadNewAPI();
        } catch (e) {
          console.error("Failed to mark all notifications read:", e);
        }
        setNotifications([]);
        setUnreadCount(0);
        window.dispatchEvent(new CustomEvent("notifications-read-all"));
      }
      setNotificationsOpen(open);
    },
    [notificationsOpen],
  );

  const handleNotificationClick = useCallback(async (notificationId) => {
    try {
      await markNotificationReadNewAPI(notificationId);
    } catch (e) {
      console.error("Failed to mark notification as read:", e);
    }
    setNotifications((prev) =>
      prev.filter((item) => item.id !== notificationId),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    // Dispatch event to sync other views (e.g. notifications page) instantly
    window.dispatchEvent(
      new CustomEvent("notification-read", { detail: { id: notificationId } }),
    );
  }, []);

  const getNotificationTarget = useCallback((item) => {
    if (item?.type === "waitlist_lock") {
      return item?.action_url || "/customer/waitlist";
    }
    return item?.action_url;
  }, []);

  return (
    <>
      <nav className="sticky top-0 z-50 w-full bg-card/85 backdrop-blur-md border-b border-border px-6 py-3.5 pr-28">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* ── Logo ──────────────────────────────────────── */}
          <Link
            to="/"
            className="flex items-center gap-2 group transition-transform duration-200 active:scale-95"
          >
            <div className="relative">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary shadow-sm transition-all">
                <Calendar size={18} className="text-primary-foreground" />
              </div>
              <Sparkles
                size={10}
                className="absolute -top-1 -right-1 text-accent"
              />
            </div>
            <span className="font-heading font-extrabold text-lg tracking-tight text-foreground">
              Schedex
            </span>
          </Link>

          {/* ── Desktop Actions ───────────────────────────── */}
          <div className="hidden md:flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <Button
                  variant="ghost"
                  className="text-xs font-semibold h-9 px-3"
                  render={<Link to={dashboardMap[role]} />}
                >
                  Dashboard
                </Button>
                <div className="h-4 w-[1px] bg-border mx-1" />

                {/* Notification Popover */}
                <Popover open={notificationsOpen} onOpenChange={handlePopoverOpenChange}>
                  <PopoverTrigger
                    render={
                      <Button
                        variant="outline"
                        size="icon"
                        className="relative h-9 w-9 border-border bg-card/50 hover:bg-muted"
                        aria-label="Notifications"
                      />
                    }
                  >
                    <Bell size={16} className="text-muted-foreground" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-4.5 h-4.5 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    className="w-96 p-0 border-border bg-popover text-popover-foreground"
                  >
                    <div className="px-3 py-2.5 border-b border-border">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Unread Notifications
                      </p>
                    </div>
                    {notifications.length === 0 ? (
                      <p className="px-3 py-6 text-sm text-muted-foreground text-center">
                        No unread notifications
                      </p>
                    ) : (
                      <>
                        <div className="max-h-[350px] overflow-y-auto divide-y divide-border">
                          {notifications.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => {
                                handleNotificationClick(item.id);
                                const target = getNotificationTarget(item);
                                if (target) {
                                  navigate(target);
                                }
                              }}
                              className="w-full px-3 py-2.5 hover:bg-muted/60 transition-colors text-left text-sm focus:outline-none"
                            >
                              <p className="font-semibold text-foreground text-xs leading-snug mb-1">
                                {item.title}
                              </p>
                              <p className="text-xs text-muted-foreground leading-snug">
                                {item.message}
                              </p>
                              {item.type === "waitlist_lock" &&
                                item.claim_expires_at && (
                                  <p className="text-[10px] text-warning font-semibold mt-1">
                                    ⏱️ Limited time offer
                                  </p>
                                )}
                            </button>
                          ))}
                        </div>
                        <Link
                          to={`/${role}/notifications`}
                          className="flex items-center justify-between px-3 py-2 border-t border-border text-xs font-semibold text-primary hover:bg-muted/40 transition-colors"
                        >
                          View All Notifications
                          <ExternalLink size={12} />
                        </Link>
                      </>
                    )}
                  </PopoverContent>
                </Popover>

                {/* User profile capsule */}
                <div className="flex items-center gap-2 pl-2 pr-4 py-1 rounded-full bg-muted/50 border border-border h-9">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-primary/10 text-primary font-bold uppercase text-[10px]">
                      {user?.full_name ? user.full_name[0] : "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-semibold text-foreground">
                    {user?.full_name?.split(" ")[0]}
                  </span>
                </div>

                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-xs font-bold text-destructive hover:bg-destructive/10 hover:text-destructive h-9 px-3"
                >
                  <LogOut size={14} />
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  className="h-9 px-4 text-xs font-semibold"
                  render={
                    <Link to="/login" className="flex items-center gap-2" />
                  }
                >
                  <LogIn size={14} /> Sign In
                </Button>
                <Button
                  className="h-9 px-4 text-xs font-semibold"
                  render={<Link to="/signup" />}
                >
                  Get Started
                </Button>
              </>
            )}
          </div>

          {/* ── Mobile Menu Toggle ────────────────────────── */}
          <button
            className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Menu size={20} />
          </button>
        </div>
      </nav>
    </>
  );
}

export default memo(Navbar);
