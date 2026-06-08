import { useState, useMemo } from "react";
import {
  ArrowUp,
  Clock,
  CheckCircle2,
  X,
  AlertCircle,
  Users,
  Zap,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";

export default function ProviderWaitlist() {
  const [waitlistEntries, setWaitlistEntries] = useState([
    {
      id: 1,
      name: "Alex Johnson",
      service: "Initial Consultation",
      preferredDate: "2025-06-05",
      priority: "high",
      addedMinutesAgo: 45,
      status: "pending",
    },
    {
      id: 2,
      name: "Sarah Chen",
      service: "Follow-up Session",
      preferredDate: "2025-06-10",
      priority: "medium",
      addedMinutesAgo: 120,
      status: "pending",
    },
    {
      id: 3,
      name: "Mike Rodriguez",
      service: "Premium Assessment",
      preferredDate: "2025-06-08",
      priority: "high",
      addedMinutesAgo: 15,
      status: "pending",
    },
    {
      id: 4,
      name: "Emma Davis",
      service: "Initial Consultation",
      preferredDate: "2025-06-12",
      priority: "low",
      addedMinutesAgo: 240,
      status: "matched",
    },
    {
      id: 5,
      name: "James Park",
      service: "Follow-up Session",
      preferredDate: "2025-06-07",
      priority: "medium",
      addedMinutesAgo: 30,
      status: "pending",
    },
  ]);

  const [slotReleases, setSlotReleases] = useState([
    {
      id: 1,
      date: "2025-06-05",
      time: "2:00 PM",
      service: "Initial Consultation",
      matched: 3,
      claimed: 1,
    },
    {
      id: 2,
      date: "2025-06-06",
      time: "10:00 AM",
      service: "Follow-up Session",
      matched: 2,
      claimed: 2,
    },
    {
      id: 3,
      date: "2025-06-07",
      time: "3:30 PM",
      service: "Premium Assessment",
      matched: 1,
      claimed: 0,
    },
  ]);

  const [selectedEntry, setSelectedEntry] = useState(null);
  const [notificationModal, setNotificationModal] = useState(false);

  const priorityColors = { high: "#C4441A", medium: "#C4941A", low: "#A8A39D" };
  const statusColors = {
    pending: "#3D5A47",
    matched: "#2563eb",
    claimed: "#10b981",
  };

  const priorityDistribution = [
    {
      name: "High",
      value: waitlistEntries.filter((e) => e.priority === "high").length,
      fill: priorityColors.high,
    },
    {
      name: "Medium",
      value: waitlistEntries.filter((e) => e.priority === "medium").length,
      fill: priorityColors.medium,
    },
    {
      name: "Low",
      value: waitlistEntries.filter((e) => e.priority === "low").length,
      fill: priorityColors.low,
    },
  ];

  const matchingRate = useMemo(() => {
    const matched = waitlistEntries.filter(
      (e) => e.status === "matched",
    ).length;
    return ((matched / waitlistEntries.length) * 100).toFixed(1);
  }, [waitlistEntries]);

  const handleRemoveEntry = (id) => {
    setWaitlistEntries(waitlistEntries.filter((e) => e.id !== id));
  };

  const handleNotifyCustomer = (entry) => {
    setSelectedEntry(entry);
    setNotificationModal(true);
  };

  const handleReleaseSlot = (releaseId) => {
    const release = slotReleases.find((r) => r.id === releaseId);
    alert(
      `Releasing slot: ${release.service} on ${release.date} at ${release.time}`,
    );
  };

  const pendingEntries = waitlistEntries
    .filter((e) => e.status === "pending")
    .sort((a, b) => {
      const priorityOrder = { high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

  const avgWaitTime = (
    waitlistEntries.reduce((sum, e) => sum + e.addedMinutesAgo, 0) /
    waitlistEntries.length
  ).toFixed(0);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">
          Waitlist Operations
        </h1>
        <p className="text-sm md:text-base text-text-muted font-medium">
          Manage waitlist priority and automate slot matching
        </p>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="glass-card p-5">
          <p className="text-[11px] uppercase tracking-widest font-black text-text-faint mb-3 flex items-center gap-2">
            <Users size={14} /> Pending Requests
          </p>
          <p className="text-2xl font-black">{pendingEntries.length}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-[11px] uppercase tracking-widest font-black text-text-faint mb-3 flex items-center gap-2">
            <Zap size={14} /> Match Success Rate
          </p>
          <p className="text-2xl font-black">{matchingRate}%</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-[11px] uppercase tracking-widest font-black text-text-faint mb-3 flex items-center gap-2">
            <Clock size={14} /> Avg Wait Time
          </p>
          <p className="text-2xl font-black">{avgWaitTime}m</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-[11px] uppercase tracking-widest font-black text-text-faint mb-3">
            Slots This Week
          </p>
          <p className="text-2xl font-black">{slotReleases.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* ─── Priority Distribution Chart ─── */}
        <div className="glass-card p-6">
          <h3 className="text-xs font-black uppercase tracking-widest text-text-faint mb-4">
            Priority Distribution
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={priorityDistribution}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                dataKey="value"
              >
                {priorityDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip cursor={false} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* ─── Slot Release Timeline ─── */}
        <div className="lg:col-span-2 glass-card p-6">
          <h3 className="text-xs font-black uppercase tracking-widest text-text-faint mb-4">
            Upcoming Slot Releases
          </h3>
          <div className="space-y-3">
            {slotReleases.map((release) => (
              <div
                key={release.id}
                className="border border-border rounded-lg p-4 hover:bg-surface-2 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-sm">{release.service}</p>
                    <p className="text-xs text-text-muted">
                      {release.date} at {release.time}
                    </p>
                  </div>
                  <button
                    onClick={() => handleReleaseSlot(release.id)}
                    className="px-3 py-1 bg-primary text-white rounded text-xs font-bold hover:opacity-90 transition-all"
                  >
                    Release Now
                  </button>
                </div>
                <div className="flex gap-4 text-xs">
                  <span className="text-text-muted">
                    Matches:{" "}
                    <span className="font-bold">{release.matched}</span>
                  </span>
                  <span className="text-text-muted">
                    Claimed:{" "}
                    <span className="font-bold text-success">
                      {release.claimed}
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Waitlist Priority Queue ─── */}
      <section className="mb-8">
        <h2 className="text-xl font-black mb-5">
          Waitlist Queue (Prioritized)
        </h2>
        <div className="space-y-3">
          {pendingEntries.map((entry, index) => (
            <div
              key={entry.id}
              className="glass-card p-5 border-l-4"
              style={{ borderLeftColor: priorityColors[entry.priority] }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-surface-2">
                      #{index + 1}
                    </span>
                    <h3 className="font-bold">{entry.name}</h3>
                    <span
                      className="text-xs font-bold px-2 py-1 rounded text-white"
                      style={{
                        backgroundColor: priorityColors[entry.priority],
                      }}
                    >
                      {entry.priority.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex gap-6 text-sm text-text-muted">
                    <span>📅 {entry.service}</span>
                    <span>🗓️ Preferred: {entry.preferredDate}</span>
                    <span>⏱️ Added {entry.addedMinutesAgo}m ago</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleNotifyCustomer(entry)}
                    className="px-4 py-2 bg-accent text-white rounded font-bold text-sm hover:opacity-90 transition-all"
                  >
                    Notify
                  </button>
                  <button
                    onClick={() => handleRemoveEntry(entry.id)}
                    className="px-4 py-2 border border-border rounded font-bold text-sm hover:bg-surface-2 transition-all"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Matched Entries ─── */}
      {waitlistEntries.filter((e) => e.status === "matched").length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-black mb-5 flex items-center gap-2">
            <CheckCircle2 size={20} className="text-success" /> Recently Matched
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {waitlistEntries
              .filter((e) => e.status === "matched")
              .map((entry) => (
                <div
                  key={entry.id}
                  className="glass-card p-5 border-l-4 border-success"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold">{entry.name}</h3>
                      <p className="text-sm text-text-muted">{entry.service}</p>
                    </div>
                    <CheckCircle2 size={20} className="text-success" />
                  </div>
                  <p className="text-xs text-text-muted">
                    ✅ Matched on {entry.preferredDate}
                  </p>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* ─── Notification Modal ─── */}
      {notificationModal && selectedEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass-card p-8 max-w-md w-full rounded-2xl">
            <h2 className="text-xl font-black mb-4">Notify Customer</h2>
            <div className="mb-6 p-4 bg-surface-2 rounded-lg">
              <p className="text-sm mb-2">
                <span className="font-bold">Customer:</span>{" "}
                {selectedEntry.name}
              </p>
              <p className="text-sm mb-2">
                <span className="font-bold">Service:</span>{" "}
                {selectedEntry.service}
              </p>
              <p className="text-sm">
                <span className="font-bold">Preferred Date:</span>{" "}
                {selectedEntry.preferredDate}
              </p>
            </div>
            <div className="space-y-3">
              <button className="w-full px-4 py-3 bg-primary text-white rounded-lg font-bold hover:opacity-90 transition-all">
                Send Email
              </button>
              <button className="w-full px-4 py-3 bg-accent text-white rounded-lg font-bold hover:opacity-90 transition-all">
                Send SMS
              </button>
              <button
                onClick={() => setNotificationModal(false)}
                className="w-full px-4 py-3 border border-border rounded-lg font-bold hover:bg-surface-2 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
