import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  BellRing,
  Clock,
  CheckCircle2,
  XCircle,
  Trash2,
  ArrowLeft,
  Lock,
  AlertCircle,
  Zap,
  X,
} from "lucide-react";
import {
  getNotificationsNewAPI,
  markNotificationReadNewAPI,
  deleteNotificationAPI,
} from "../../services/apiService";
import toast from "react-hot-toast";
import LoadingSpinner from "../../components/LoadingSpinner";
import { useSelector } from "react-redux";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { markAllNotificationsReadNewAPI } from "../../services/apiService";

const NOTIFICATION_TYPE_CONFIG = {
  waitlist_lock: {
    icon: Lock,
    color: "text-warning bg-warning/10 border-warning/20",
    label: "Waitlist Lock",
    bgColor: "bg-warning/5 border-warning/30",
  },
  appointment_reminder: {
    icon: Clock,
    color: "text-info bg-info/10 border-info/20",
    label: "Appointment Reminder",
    bgColor: "bg-info/5 border-info/30",
  },
  cancellation: {
    icon: XCircle,
    color: "text-error bg-error/10 border-error/20",
    label: "Cancellation",
    bgColor: "bg-error/5 border-error/30",
  },
  other: {
    icon: AlertCircle,
    color: "text-primary bg-primary/10 border-primary/20",
    label: "Notification",
    bgColor: "bg-primary/5 border-primary/30",
  },
};

// Countdown timer component for waitlist locks
function CountdownTimer({ expiresAt }) {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const expiry = new Date(expiresAt);
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft("Expired");
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${minutes}m ${seconds}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const isExpired = timeLeft === "Expired";
  return (
    <span
      className={cn(
        "font-bold text-sm",
        isExpired ? "text-error" : "text-warning",
      )}
    >
      ⏱️ {timeLeft || "Calculating..."}
    </span>
  );
}

export default function CustomerNotifications() {
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [showLockBanner, setShowLockBanner] = useState(false);
  const [lockBannerData, setLockBannerData] = useState(null);
  const navigate = useNavigate();
  const { role } = useSelector((s) => s.auth);

  const fetchNotifications = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const res = await getNotificationsNewAPI({
        limit: 50,
        offset: 0,
        unread_only: false,
      });
      if (res.data?.success) {
        const newNotifications = res.data?.data?.notifications || [];
        setNotifications(newNotifications);

        // Check for new waitlist lock notifications
        const lockNotification = newNotifications.find(
          (n) => n.type === "waitlist_lock",
        );
        if (lockNotification && !lockBannerData) {
          setLockBannerData(lockNotification);
          setShowLockBanner(true);
        }
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load notifications");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    // Opening the notifications page should clear the bell badge (unread count),
    // but keep all notifications visible here until the user deletes them.
    (async () => {
      try {
        await markAllNotificationsReadNewAPI();
        window.dispatchEvent(new CustomEvent("notifications-read-all"));
      } catch {
        // Non-blocking; still show notifications list even if mark-all fails.
      } finally {
        fetchNotifications(true);
      }
    })();
    const intervalId = setInterval(() => fetchNotifications(false), 30000); // Refresh every 30 seconds
    return () => clearInterval(intervalId);
  }, []);

  const handleRead = async (notificationId, actionUrl, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      await markNotificationReadNewAPI(notificationId);
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notificationId ? { ...item, is_read: true } : item,
        ),
      );
      if (actionUrl) {
        navigate(actionUrl);
      }
    } catch {
      toast.error("Failed to mark notification as read");
    }
  };

  const handleDelete = async (notificationId, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      await deleteNotificationAPI(notificationId);
      toast.success("Notification deleted");
      setNotifications((prev) =>
        prev.filter((item) => item.id !== notificationId),
      );
    } catch {
      toast.error("Failed to delete notification");
    }
  };

  const handleClaimSlot = async (notification, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const target =
      notification.type === "waitlist_lock"
        ? notification.action_url || "/customer/waitlist"
        : notification.action_url;

    if (target) navigate(target);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in space-y-6">
      {/* Waitlist Lock Banner */}
      {showLockBanner && lockBannerData && (
        <Card className="border-2 border-warning bg-warning/10 p-5">
          <CardContent className="p-0 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="p-2 rounded-lg bg-warning/20 text-warning mt-1">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-warning mb-1">
                  🎯 Slot Unlocked!
                </h2>
                <p className="text-sm text-foreground mb-2">
                  {lockBannerData.message}
                </p>
                <CountdownTimer
                  expiresAt={
                    new Date(
                      new Date(lockBannerData.created_at).getTime() +
                        30 * 60000,
                    )
                  }
                />
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                className="gap-2 cursor-pointer"
                onClick={() => {
                  if (lockBannerData.action_url) {
                    navigate(lockBannerData.action_url);
                  }
                }}
              >
                <CheckCircle2 className="w-4 h-4" />
                Claim Now
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowLockBanner(false)}
                className="cursor-pointer"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header Area */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Bell className="w-5 h-5 animate-pulse" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
              Notifications
            </h1>
            {notifications.length > 0 && (
              <span className="ml-2 px-2.5 py-0.5 text-xs font-bold rounded-full bg-primary text-white">
                {notifications.length} items
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Stay updated on your appointments, waitlist status, and slot
            availability.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          render={
            <Link
              to={
                role === "provider"
                  ? "/provider/dashboard"
                  : "/customer/dashboard"
              }
            />
          }
          className="gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => {
            const config =
              NOTIFICATION_TYPE_CONFIG[notification.type] ||
              NOTIFICATION_TYPE_CONFIG.other;
            const TypeIcon = config.icon;
            const isWaitlistLock = notification.type === "waitlist_lock";

            return (
              <Card
                key={notification.id}
                className={cn(
                  "group border bg-card hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 overflow-hidden cursor-pointer",
                  config.bgColor,
                )}
              >
                <CardContent className="p-5 flex items-start gap-4 justify-between">
                  <div
                    onClick={() =>
                      handleRead(notification.id, notification.action_url)
                    }
                    className="flex-1 flex gap-4 text-left"
                  >
                    {/* Status Icon */}
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                        config.color,
                      )}
                    >
                      {isWaitlistLock ? (
                        <Zap className="w-5 h-5" />
                      ) : (
                        <TypeIcon className="w-5 h-5" />
                      )}
                    </div>

                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={cn(
                            "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
                            config.color,
                          )}
                        >
                          {config.label}
                        </span>
                        <span className="text-xs text-muted-foreground font-semibold">
                          {new Date(notification.created_at).toLocaleString()}
                        </span>
                      </div>

                      <p className="font-bold text-sm text-foreground group-hover:text-primary transition-colors leading-relaxed">
                        {notification.title}
                      </p>

                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {notification.message}
                      </p>

                      {isWaitlistLock && (
                        <div className="pt-2">
                          <CountdownTimer
                            expiresAt={
                              new Date(
                                new Date(notification.created_at).getTime() +
                                  30 * 60000,
                              )
                            }
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            ⏰ Hurry! Click "Claim Slot" to book this
                            appointment.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Area */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isWaitlistLock && notification.action_url && (
                      <Button
                        size="sm"
                        className="gap-2 cursor-pointer"
                        onClick={(e) => handleClaimSlot(notification, e)}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Claim Slot
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDelete(notification.id, e)}
                      title="Delete Notification"
                      className="text-muted-foreground hover:text-error hover:bg-error/10 rounded-xl w-9 h-9 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {notifications.length === 0 && (
            <Card className="border border-dashed border-border/80 bg-card/50 p-16 text-center shadow-sm">
              <CardContent className="flex flex-col items-center justify-center gap-4 p-0">
                <div className="w-16 h-16 rounded-2xl bg-muted/40 flex items-center justify-center text-muted-foreground">
                  <BellRing className="w-8 h-8 opacity-40" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-extrabold text-lg text-foreground">
                    All Clear!
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    You have no notifications. We'll notify you about waitlist
                    slot availability, appointment reminders, and other updates.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
