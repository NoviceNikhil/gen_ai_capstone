import { useEffect, useMemo, useState, useCallback } from "react";
import {
  TrendingUp, BarChart3, PieChart as PieIcon, Clock,
  DollarSign, Users, AlertCircle, Calendar, Download,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { getProviderAppointmentsAPI } from "../../services/apiService";
import { downloadProviderSchedule } from "../../services/reportService";
import toast from "react-hot-toast";

const palette = ["#C4441A", "#3D5A47", "#C4941A", "#4F46E5", "#0EA5E9", "#F97316"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function dateToKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function hourLabel(h) {
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${ampm}`;
}

// ─── Time range presets ───────────────────────────────────────────────────────
const RANGE_PRESETS = [
  { label: "Last 7 Days",  days: 7  },
  { label: "Last 15 Days", days: 15 },
  { label: "Last 30 Days", days: 30 },
  { label: "Last 60 Days", days: 60 },
  { label: "Last 90 Days", days: 90 },
];

// ─── Status filter options ────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: "all",       label: "All Statuses" },
  { value: "completed", label: "Completed"    },
  { value: "confirmed", label: "Confirmed"    },
  { value: "cancelled", label: "Cancelled"    },
  { value: "pending",   label: "Pending"      },
];

// ─── Chip button ──────────────────────────────────────────────────────────────
function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
        active
          ? "bg-accent text-white border-accent"
          : "bg-surface-2/60 text-text-muted border-border/40 hover:border-accent/40"
      }`}
    >
      {children}
    </button>
  );
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-1 border border-border/60 rounded-xl p-3 text-xs shadow-lg">
      <p className="font-black text-foreground mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {p.name?.includes("₹") ? `₹${Number(p.value).toFixed(0)}` : p.value}
        </p>
      ))}
    </div>
  );
}

export default function ProviderInsights() {
  const [loading, setLoading]       = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [rangeDays, setRangeDays]   = useState(7);
  const [statusFilter, setStatusFilter] = useState("all");

  // Derive date range from rangeDays
  const { fromDate, toDate, dayKeys } = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const from  = new Date(today); from.setDate(today.getDate() - (rangeDays - 1));
    const keys = Array.from({ length: rangeDays }, (_, i) => {
      const d = new Date(from); d.setDate(from.getDate() + i);
      return {
        key:   dateToKey(d),
        label: rangeDays <= 15
          ? d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" })
          : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      };
    });
    return { fromDate: dateToKey(from), toDate: dateToKey(today), dayKeys: keys };
  }, [rangeDays]);

  // Fetch all pages for the selected range
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let page = 1; const limit = 50; const all = [];
      while (true) {
        const res = await getProviderAppointmentsAPI({ from_date: fromDate, to_date: toDate, page, limit });
        const payload = res?.data?.data || {};
        all.push(...(payload.appointments || []));
        if (page >= (payload.total_pages || 1)) break;
        page++;
      }
      setAppointments(all);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load insights");
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Apply status filter
  const filtered = useMemo(() =>
    statusFilter === "all" ? appointments : appointments.filter(a => a?.status === statusFilter),
    [appointments, statusFilter]
  );

  // ── Revenue + booking trend by day ────────────────────────────────────────
  const revenueTrend = useMemo(() => {
    return dayKeys.map(({ key, label }) => {
      const dayAppts = appointments.filter(a => a?.appointment_date === key);
      const revenue  = dayAppts.filter(a => ["confirmed","completed"].includes(a?.status))
        .reduce((s, a) => s + Number(a?.consultation_fee_snapshot || 0), 0);
      const bookings     = dayAppts.filter(a => ["pending","confirmed","completed"].includes(a?.status)).length;
      const cancellations = dayAppts.filter(a => a?.status === "cancelled").length;
      return { date: label, revenue, bookings, cancellations };
    });
  }, [appointments, dayKeys]);

  // ── Demand by hour (across selected range + status filter) ────────────────
  const demandByHour = useMemo(() => {
    const counts = new Map();
    filtered.forEach(a => {
      const h = parseInt(String(a?.time_slot || "").split(":")[0], 10);
      if (!Number.isFinite(h)) return;
      counts.set(h, (counts.get(h) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([h, demand]) => ({ hour: hourLabel(h), demand, _h: h }));
  }, [filtered]);

  // ── Service type preference ───────────────────────────────────────────────
  const serviceTypePreference = useMemo(() => {
    const counts = new Map();
    filtered
      .filter(a => ["pending","confirmed","completed"].includes(a?.status))
      .forEach(a => {
        (a?.service_selections?.length ? a.service_selections : [{ service_title: "Standard Session" }])
          .forEach(sel => {
            const t = sel?.service_title || "Standard Session";
            counts.set(t, (counts.get(t) || 0) + 1);
          });
      });
    const total = Array.from(counts.values()).reduce((s, n) => s + n, 0);
    if (!total) return [];
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([name, count], i) => ({
        name, count,
        value: Math.round((count / total) * 1000) / 10,
        fill: palette[i % palette.length],
      }));
  }, [filtered]);

  // ── Cancellation reasons ──────────────────────────────────────────────────
  const cancellationReasons = useMemo(() => {
    const cancelled = appointments.filter(a => a?.status === "cancelled");
    const counts = new Map();
    cancelled.forEach(a => {
      const r = (a?.cancellation_reason || "Unspecified").trim() || "Unspecified";
      counts.set(r, (counts.get(r) || 0) + 1);
    });
    const total = cancelled.length; if (!total) return [];
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([category, count]) => ({ category, count, percentage: Math.round((count / total) * 100) }));
  }, [appointments]);

  // ── KPI totals ────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const totalRevenue = revenueTrend.reduce((s, d) => s + d.revenue, 0);
    const totalBookings = revenueTrend.reduce((s, d) => s + d.bookings, 0);
    const totalCancellations = revenueTrend.reduce((s, d) => s + d.cancellations, 0);
    const completed = appointments.filter(a => a?.status === "completed").length;
    const cancellationRate = totalBookings + totalCancellations > 0
      ? ((totalCancellations / (totalBookings + totalCancellations)) * 100).toFixed(1) : "0.0";
    const peakHour = demandByHour.reduce((mx, h) => h.demand > mx.demand ? h : mx, { hour: "N/A", demand: 0 });
    const avgRev = completed > 0 ? (totalRevenue / completed).toFixed(0) : "0";
    return { totalRevenue, totalBookings, totalCancellations, completed, cancellationRate, peakHour, avgRev };
  }, [revenueTrend, demandByHour, appointments]);

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto animate-pulse">
        <div className="skeleton w-64 h-10 mb-4" />
        <div className="skeleton w-full h-12 rounded-xl mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton glass-card p-5 h-[110px]" />)}
        </div>
        <div className="skeleton glass-card p-6 h-[360px]" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-1">
            Business Insights & Analytics
          </h1>
          <p className="text-sm text-text-muted font-medium">
            Demand, revenue and cancellation trends across your appointments
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            const now = new Date();
            try {
              await downloadProviderSchedule("self", now.getMonth() + 1, now.getFullYear());
              toast.success("Report downloaded!");
            } catch {
              toast.error("Export failed — ensure report service is running");
            }
          }}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg border border-border/40 bg-surface-2/60 hover:bg-surface-2 transition-colors flex-shrink-0"
        >
          <Download size={14} /> Export Schedule
        </button>
      </div>

      {/* ── Filter bar ── */}
      <div className="glass-card p-4 mb-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        {/* Time range */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] uppercase tracking-widest font-black text-text-faint flex items-center gap-1">
            <Calendar size={12} /> Range
          </span>
          {RANGE_PRESETS.map(p => (
            <Chip key={p.days} active={rangeDays === p.days} onClick={() => setRangeDays(p.days)}>
              {p.label}
            </Chip>
          ))}
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-6 bg-border/40" />

        {/* Status filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] uppercase tracking-widest font-black text-text-faint">
            Status
          </span>
          {STATUS_OPTIONS.map(o => (
            <Chip key={o.value} active={statusFilter === o.value} onClick={() => setStatusFilter(o.value)}>
              {o.label}
            </Chip>
          ))}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="glass-card p-5">
          <p className="text-[11px] uppercase tracking-widest font-black text-text-faint mb-3 flex items-center gap-2">
            <DollarSign size={14} /> Revenue
          </p>
          <p className="text-2xl font-black">₹{Number(totals.totalRevenue).toLocaleString("en-IN")}</p>
          <p className="text-xs text-text-muted mt-2">Last {rangeDays} days</p>
        </div>

        <div className="glass-card p-5">
          <p className="text-[11px] uppercase tracking-widest font-black text-text-faint mb-3 flex items-center gap-2">
            <Users size={14} /> Total Appointments
          </p>
          <p className="text-2xl font-black">{totals.totalBookings}</p>
          <p className="text-xs text-text-muted mt-2">{totals.completed} completed</p>
        </div>

        <div className="glass-card p-5">
          <p className="text-[11px] uppercase tracking-widest font-black text-text-faint mb-3 flex items-center gap-2">
            <AlertCircle size={14} /> Cancellation Rate
          </p>
          <p className="text-2xl font-black">{totals.cancellationRate}%</p>
          <p className="text-xs text-warning mt-2">{totals.totalCancellations} cancelled</p>
        </div>

        <div className="glass-card p-5">
          <p className="text-[11px] uppercase tracking-widest font-black text-text-faint mb-3 flex items-center gap-2">
            <Clock size={14} /> Peak Hour
          </p>
          <p className="text-2xl font-black">{totals.peakHour.hour}</p>
          <p className="text-xs text-text-muted mt-2">{totals.peakHour.demand} bookings</p>
        </div>
      </div>

      {/* ── Revenue & Booking Trend ── */}
      <div className="glass-card p-6 mb-8">
        <h3 className="text-xs font-black uppercase tracking-widest text-text-faint mb-4 flex items-center gap-2">
          <TrendingUp size={14} /> Revenue &amp; Booking Trend ({rangeDays} Days)
        </h3>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={revenueTrend} margin={{ left: 10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="date" stroke="var(--color-text-faint)" tick={{ fontSize: 11 }}
              interval={rangeDays > 15 ? Math.floor(rangeDays / 10) : 0} />
            <YAxis stroke="var(--color-text-faint)" tick={{ fontSize: 11 }} />
            <Tooltip content={<ChartTooltip />} cursor={false} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="revenue"      stroke="#C4441A" strokeWidth={2.5} dot={rangeDays <= 15} name="Revenue (₹)" />
            <Line type="monotone" dataKey="bookings"     stroke="#3D5A47" strokeWidth={2}   dot={rangeDays <= 15} name="Appointments" />
            <Line type="monotone" dataKey="cancellations" stroke="#C4941A" strokeWidth={1.5} dot={false} strokeDasharray="4 3" name="Cancellations" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Demand by Hour + Service Type Pie ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Demand by hour */}
        <div className="glass-card p-6">
          <h3 className="text-xs font-black uppercase tracking-widest text-text-faint mb-4 flex items-center gap-2">
            <BarChart3 size={14} /> Demand by Hour
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={demandByHour.length ? demandByHour : [{ hour: "N/A", demand: 0 }]}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="hour" stroke="var(--color-text-faint)" tick={{ fontSize: 11 }} />
              <YAxis stroke="var(--color-text-faint)" tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ fill: "var(--color-surface-2)", opacity: 0.3 }}
              />
              <Bar dataKey="demand" fill="#C4441A" name="Bookings" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Service type pie */}
        <div className="glass-card p-6">
          <h3 className="text-xs font-black uppercase tracking-widest text-text-faint mb-4 flex items-center gap-2">
            <PieIcon size={14} /> Service Type Preference
          </h3>
          {serviceTypePreference.length === 0 ? (
            <div className="flex items-center justify-center h-[280px] text-sm text-text-muted">
              No service data for this range.
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={serviceTypePreference} cx="50%" cy="50%"
                    innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value" labelLine={false}>
                    {serviceTypePreference.map((e, i) => (
                      <Cell key={i} fill={e.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${v}%`, n]}
                    contentStyle={{ backgroundColor: "var(--color-surface-1)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
                    cursor={false} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1.5">
                {serviceTypePreference.map((e, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 inline-block" style={{ backgroundColor: e.fill }} />
                      <span className="text-text-muted truncate">{e.name}</span>
                    </div>
                    <span className="font-bold text-foreground ml-2 flex-shrink-0">{e.value}% ({e.count})</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Status breakdown stacked bar ── */}
      <div className="glass-card p-6 mb-8">
        <h3 className="text-xs font-black uppercase tracking-widest text-text-faint mb-4 flex items-center gap-2">
          <BarChart3 size={14} /> Completed vs Cancelled per Day
        </h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={revenueTrend} margin={{ left: 10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="date" stroke="var(--color-text-faint)" tick={{ fontSize: 10 }}
              interval={rangeDays > 15 ? Math.floor(rangeDays / 10) : 0} />
            <YAxis stroke="var(--color-text-faint)" tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-surface-2)", opacity: 0.3 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="bookings"      stackId="a" fill="#3D5A47" name="Active"     radius={[0, 0, 0, 0]} />
            <Bar dataKey="cancellations" stackId="a" fill="#C4441A" name="Cancelled"  radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Cancellation reasons ── */}
      <section className="glass-card p-6 mb-8">
        <h3 className="text-lg font-black mb-6 flex items-center gap-2">
          <AlertCircle size={20} className="text-warning" /> Cancellation Breakdown
        </h3>
        {cancellationReasons.length === 0 ? (
          <div className="text-sm text-text-muted border border-border/40 rounded-xl bg-surface-1/10 p-4">
            No cancellations in the selected period.
          </div>
        ) : (
          <div className="space-y-3">
            {cancellationReasons.map((r) => (
              <div key={r.category} className="flex items-center gap-4">
                <div className="w-44 flex-shrink-0">
                  <p className="text-sm font-bold text-text-muted truncate">{r.category}</p>
                </div>
                <div className="flex-1">
                  <div className="w-full h-7 bg-surface-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-warning to-error rounded-full flex items-center justify-end pr-2 transition-all"
                      style={{ width: `${r.percentage}%` }}
                    >
                      {r.percentage > 12 && (
                        <span className="text-xs font-bold text-white">{r.percentage}%</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="w-16 text-right flex-shrink-0">
                  <p className="text-sm font-bold">{r.count}</p>
                  <p className="text-xs text-text-muted">{r.percentage}%</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
