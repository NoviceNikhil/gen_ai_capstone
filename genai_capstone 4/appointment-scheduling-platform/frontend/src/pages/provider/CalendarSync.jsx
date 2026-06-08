import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  RefreshCw,
  Clock,
  Link as LinkIcon,
  ExternalLink,
  Unlink,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  getGoogleCalendarConnectUrlAPI,
  getGoogleCalendarStatusAPI,
  syncGoogleCalendarAPI,
  disconnectGoogleCalendarAPI,
} from "../../services/apiService";

export default function ProviderCalendarSync() {
  const [statusLoading, setStatusLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [googleStatus, setGoogleStatus] = useState({
    connected: false,
    provider: "google",
    email: null,
    sync_status: "disconnected",
    last_sync_at: null,
  });
  const [events, setEvents] = useState([]);
  const googleCalendarWebUrl = "https://calendar.google.com";

  const openGoogleCalendar = () => {
    const popup = window.open(
      googleCalendarWebUrl,
      "_blank",
      "noopener,noreferrer",
    );
    if (!popup) {
      toast("Popup blocked. Use Open Google Calendar button.", { icon: "ℹ️" });
    }
  };

  const refreshStatus = async () => {
    setStatusLoading(true);
    try {
      const res = await getGoogleCalendarStatusAPI();
      setGoogleStatus(res.data?.data || {});
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to load calendar status",
      );
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const state = params.get("googleCalendar");
    if (!state) return;

    if (state === "connected") {
      toast.success("Google Calendar connected");
      refreshStatus();
      openGoogleCalendar();
      window.history.replaceState({}, "", "/provider/calendar-sync");
      return;
    }

    if (state === "error") {
      const reason = params.get("reason");
      toast.error(`Google connect failed${reason ? `: ${reason}` : ""}`);
      window.history.replaceState({}, "", "/provider/calendar-sync");
    }
  }, []);

  const handleGoogleConnect = async () => {
    try {
      const res = await getGoogleCalendarConnectUrlAPI();
      const url = res?.data?.data?.url;
      if (!url) {
        toast.error("Unable to start Google connect");
        return;
      }
      window.location.href = url;
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to start Google connect",
      );
    }
  };

  const handleGoogleSync = async () => {
    setSyncing(true);
    try {
      const res = await syncGoogleCalendarAPI();
      const data = res?.data?.data || {};
      setEvents(data.events || []);
      await refreshStatus();

      const pushed = data.appointments_pushed || 0;
      const failed = data.appointments_failed || 0;
      const message =
        failed > 0
          ? `${pushed} appointments added (${failed} failed)`
          : `${pushed} appointments added`;

      toast.success(message);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Google sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectGoogleCalendarAPI();
      setEvents([]);
      await refreshStatus();
      toast.success("Google calendar disconnected");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Disconnect failed");
    } finally {
      setDisconnecting(false);
    }
  };

  const syncHealth = useMemo(() => {
    if (!googleStatus?.connected) return "0";
    return googleStatus.sync_status === "healthy" ? "100" : "50";
  }, [googleStatus]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">
          Calendar Sync Manager
        </h1>
        <p className="text-sm md:text-base text-text-muted font-medium">
          Sync external calendars and prevent scheduling conflicts
        </p>
      </div>

      {/* ─── Health & Status Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="glass-card p-5">
          <p className="text-[11px] uppercase tracking-widest font-black text-text-faint mb-3 flex items-center gap-2">
            <LinkIcon size={14} /> Linked Calendars
          </p>
          <p className="text-2xl font-black">
            {googleStatus.connected ? 1 : 0}
          </p>
          <p className="text-xs text-text-muted mt-2">Google only (for now)</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-[11px] uppercase tracking-widest font-black text-text-faint mb-3 flex items-center gap-2">
            <RefreshCw size={14} /> Sync Health
          </p>
          <p className="text-2xl font-black">{syncHealth}%</p>
          <p className="text-xs text-text-muted mt-2">
            {googleStatus.sync_status || "disconnected"}
          </p>
        </div>
        <div className="glass-card p-5">
          <p className="text-[11px] uppercase tracking-widest font-black text-text-faint mb-3 flex items-center gap-2">
            <Calendar size={14} /> Synced Events
          </p>
          <p className="text-2xl font-black">{events.length}</p>
          <p className="text-xs text-text-muted mt-2">Current sync payload</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-[11px] uppercase tracking-widest font-black text-text-faint mb-3 flex items-center gap-2">
            <Clock size={14} /> Last Sync
          </p>
          <p className="text-sm font-black break-words">
            {googleStatus.last_sync_at
              ? new Date(googleStatus.last_sync_at).toLocaleString()
              : "Never"}
          </p>
          <p className="text-xs text-text-muted mt-2">Google Calendar</p>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="text-xl font-black mb-5">Google Calendar</h2>
        <div className="glass-card p-6">
          {statusLoading ? (
            <div className="text-sm text-text-muted">
              Loading calendar status...
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="font-bold">Connection Status</p>
                  <p className="text-sm text-text-muted">
                    {googleStatus.connected
                      ? `Connected${googleStatus.email ? ` as ${googleStatus.email}` : ""}`
                      : "Not connected"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!googleStatus.connected ? (
                    <button
                      onClick={handleGoogleConnect}
                      className="px-4 py-2 rounded-lg bg-primary text-white font-bold hover:opacity-90 transition-all"
                    >
                      Connect Google Calendar
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={openGoogleCalendar}
                        className="px-4 py-2 rounded-lg border border-border font-bold hover:bg-surface-2 transition-all flex items-center gap-2"
                      >
                        <ExternalLink size={14} />
                        Open Google Calendar
                      </button>
                      <button
                        onClick={handleGoogleSync}
                        disabled={syncing}
                        className="px-4 py-2 rounded-lg bg-primary text-white font-bold hover:opacity-90 transition-all disabled:opacity-60 flex items-center gap-2"
                      >
                        <RefreshCw
                          size={14}
                          className={syncing ? "animate-spin" : ""}
                        />
                        {syncing ? "Syncing..." : "Sync Now"}
                      </button>
                      <button
                        onClick={handleGoogleDisconnect}
                        disabled={disconnecting}
                        className="px-4 py-2 rounded-lg border border-border font-bold hover:bg-surface-2 transition-all disabled:opacity-60 flex items-center gap-2"
                      >
                        <Unlink size={14} />
                        Disconnect
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="text-xs text-text-muted p-3 bg-surface-2 rounded-lg">
                Scope currently enabled:{" "}
                <span className="font-mono">calendar.readonly</span>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-black mb-5 flex items-center gap-2">
          <Calendar size={20} /> Upcoming Google Events
        </h2>
        <div className="space-y-3">
          {events.length === 0 ? (
            <div className="glass-card p-5 text-sm text-text-muted">
              No synced events yet. Connect Google and click{" "}
              <strong>Sync Now</strong>.
            </div>
          ) : (
            events.map((ev) => (
              <div key={ev.id} className="glass-card p-5">
                <p className="font-bold">{ev.summary}</p>
                <p className="text-sm text-text-muted mt-1">
                  {ev.start} → {ev.end}
                </p>
                {ev.html_link ? (
                  <a
                    href={ev.html_link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline mt-2 inline-block"
                  >
                    Open in Google Calendar
                  </a>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
