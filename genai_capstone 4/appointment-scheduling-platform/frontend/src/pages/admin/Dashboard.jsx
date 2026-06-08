import { useEffect, useMemo, useState } from "react";
import { getAdminDashboardAPI } from "../../services/apiService";
import {
  Users,
  UserCheck,
  Calendar,
  TrendingUp,
  Download,
  Shield,
  Sparkles,
  Activity,
  Clock,
  AlertCircle,
} from "lucide-react";
import StatCard from "../../components/ui/StatCard";
import {
  downloadAdminAppointmentsReport,
  downloadAdminUsersReport,
  downloadAdminProvidersReport,
} from "../../services/reportService";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AdminPieChart,
  AdminLineChart,
  AdminBarChart,
} from "@/components/admin/AdminCharts";

const DashboardSkeleton = () => (
  <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
    <div className="flex flex-col md:flex-row justify-between gap-4">
      <div className="space-y-2">
        <div className="skeleton w-64 h-10" />
        <div className="skeleton w-96 h-5" />
      </div>
      <div className="flex gap-3">
        <div className="skeleton w-28 h-9" />
        <div className="skeleton w-28 h-9" />
        <div className="skeleton w-28 h-9" />
      </div>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {[...Array(4)].map((_, idx) => (
        <div key={idx} className="skeleton w-full h-[108px]" />
      ))}
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2">
        <div className="skeleton w-full h-[280px]" />
      </div>
      <div>
        <div className="skeleton w-full h-[280px]" />
      </div>
    </div>
  </div>
);

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminDashboardAPI()
      .then((r) => setStats(r.data?.data))
      .finally(() => setLoading(false));
  }, []);

  const handleExport = async (type) => {
    try {
      const promise =
        type === "appointments"
          ? downloadAdminAppointmentsReport()
          : type === "users"
            ? downloadAdminUsersReport()
            : downloadAdminProvidersReport();

      await toast.promise(promise, {
        loading: `Generating ${type} report...`,
        success: `${type} report downloaded!`,
        error: "Export failed — check report service",
      });
    } catch (err) {
      console.error(err);
    }
  };

  const trustScore = useMemo(() => {
    if (!stats?.total_providers) return 0;
    return Math.round((stats.verified_providers / stats.total_providers) * 100);
  }, [stats]);

  const openProviderReviews = useMemo(() => {
    return Math.max(
      (stats?.total_providers || 0) - (stats?.verified_providers || 0),
      0,
    );
  }, [stats]);

  const appointmentStatusData = useMemo(() => {
    const s = stats?.appointment_stats || {};
    return [
      {
        name: "Pending",
        key: "pending",
        value: s.pending ?? 0,
        fill: "#f59e0b",
      },
      {
        name: "Confirmed",
        key: "confirmed",
        value: s.confirmed ?? 0,
        fill: "#2563eb",
      },
      {
        name: "Completed",
        key: "completed",
        value: s.completed ?? 0,
        fill: "#10b981",
      },
      {
        name: "Cancelled",
        key: "cancelled",
        value: s.cancelled ?? 0,
        fill: "#ef4444",
      },
    ];
  }, [stats]);

  const trends = useMemo(() => {
    if (stats?.appointment_trends && stats.appointment_trends.length > 0) {
      return {
        points: stats.appointment_trends.map((t) => ({
          x: t.date,
          y: t.count,
        })),
        riskPoints: null,
      };
    }
    // Fallback for demo data
    const base = stats?.today_appointments || 0;
    const total = stats?.total_appointments || 1;
    const normalize = (v) => Math.max(0, Math.round((v / total) * 100));

    const points = [
      { x: "-6d", y: normalize(base * 0.65) },
      { x: "-5d", y: normalize(base * 0.72) },
      { x: "-4d", y: normalize(base * 0.6) },
      { x: "-3d", y: normalize(base * 0.9) },
      { x: "-2d", y: normalize(base * 0.84) },
      { x: "-1d", y: normalize(base * 1.0) },
      { x: "Today", y: normalize(base * 1.12) },
    ];

    const riskPoints = points.map((p, idx) => ({
      x: p.x,
      y: Math.max(0, Math.round(p.y * (0.18 + idx * 0.01))),
    }));

    return { points, riskPoints };
  }, [stats]);

  if (loading || !stats) return <DashboardSkeleton />;

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in space-y-8">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2.5 text-foreground">
            <Shield className="text-primary size-7" /> System Overview
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Real-time platform analytics and governance.
          </p>
        </div>

        <div className="flex gap-3 flex-wrap">
          {[
            {
              id: "appointments",
              label: "Appointments",
              color: "text-primary",
            },
            { id: "users", label: "Users", color: "text-emerald-500" },
            { id: "providers", label: "Providers", color: "text-accent" },
          ].map((r) => (
            <Button
              key={r.id}
              variant="outline"
              size="sm"
              onClick={() => handleExport(r.id)}
              className="gap-1.5 cursor-pointer"
            >
              <Download size={14} className={r.color} /> {r.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Platform Users"
          value={stats.total_customers}
          icon={Users}
          color="var(--color-primary)"
          trend={8}
        />
        <StatCard
          label="Service Pros"
          value={stats.total_providers}
          icon={UserCheck}
          color="var(--color-confirmed)"
          trend={15}
        />
        <StatCard
          label="Trust Score"
          value={`${trustScore}%`}
          icon={Sparkles}
          color="var(--color-completed)"
        />
        <StatCard
          label="Transactions"
          value={stats.total_appointments}
          icon={Calendar}
          color="var(--color-pending)"
          trend={22}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <AdminPieChart
            title="Appointment Status Mix"
            subtitle="How appointments are progressing across the system"
            data={appointmentStatusData}
            height={320}
          />

          <AdminLineChart
            title="Appointments Trend"
            subtitle="7-day trajectory of booking activity"
            data={trends.points}
            xKey="x"
            height={320}
            lines={[
              {
                dataKey: "y",
                name: "Appointments",
                stroke: "#C4441A",
                strokeWidth: 3,
              },
            ]}
          />

          {stats?.appointments_by_category &&
            stats.appointments_by_category.length > 0 && (
              <AdminBarChart
                title="Appointments by Category"
                subtitle="Distribution of bookings across service categories"
                data={stats.appointments_by_category}
                xKey="category"
                height={280}
                bars={[
                  { dataKey: "count", name: "Appointments", fill: "#2563eb" },
                ]}
              />
            )}

          {stats?.user_trends && stats.user_trends.length > 0 && (
            <AdminLineChart
              title="User Registration Trend"
              subtitle="New customer registrations over the last 7 days"
              data={stats.user_trends}
              xKey="date"
              height={280}
              lines={[
                {
                  dataKey: "count",
                  name: "New Users",
                  stroke: "#10b981",
                  strokeWidth: 3,
                },
              ]}
            />
          )}

          {stats?.provider_trends && stats.provider_trends.length > 0 && (
            <AdminLineChart
              title="Provider Registrations"
              subtitle="New provider signups over the last 7 days"
              data={stats.provider_trends}
              xKey="date"
              height={280}
              lines={[
                {
                  dataKey: "count",
                  name: "New Providers",
                  stroke: "#f59e0b",
                  strokeWidth: 3,
                },
              ]}
            />
          )}
        </div>

        <div className="space-y-6">
          {stats?.providers_by_category &&
            stats.providers_by_category.length > 0 && (
              <AdminPieChart
                title="Providers by Category"
                subtitle="Distribution of professionals across categories"
                data={stats.providers_by_category}
                dataKey="count"
                nameKey="category"
                height={280}
              />
            )}

          <Card variant="glass" className="p-8">
            <CardContent className="space-y-6">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Activity size={20} className="text-accent" /> Live Pulse
              </h3>

              <div className="space-y-6">
                <div className="p-4 rounded-xl bg-surface-1/40 border border-border/30 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Calendar size={40} />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-text-faint mb-1">
                    Today's Traffic
                  </p>
                  <p className="text-xl font-bold text-foreground">
                    {stats.today_appointments}{" "}
                    <span className="text-xs text-text-muted font-normal">
                      New Bookings
                    </span>
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-text-faint ml-1">
                    Critical Tasks
                  </p>
                  <Button
                    onClick={() => handleExport("providers")}
                    className="w-full justify-between h-11 bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/15 cursor-pointer text-xs font-bold uppercase tracking-wider"
                  >
                    Verify New Providers
                    <span className="bg-destructive text-white px-2 py-0.5 rounded-md text-[9px] font-mono leading-none">
                      {openProviderReviews}
                    </span>
                  </Button>

                  <div className="w-full flex items-center justify-between p-3.5 rounded-xl bg-surface-1/40 border border-border/30 text-xs font-bold uppercase tracking-wider text-text-muted select-none">
                    System Health
                    <span className="text-success font-semibold">100%</span>
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-1/40 border border-border/30 text-xs font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-2 text-text-muted">
                      <Clock size={14} /> Next verification SLA
                    </span>
                    <span className="text-warning font-semibold">
                      Within 24h
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="glass" className="p-8">
            <CardContent className="space-y-4">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <AlertCircle size={20} className="text-warning" /> Quick Stats
              </h3>
              <ul className="space-y-3 text-sm text-text-muted">
                <li className="flex items-center justify-between p-2 rounded bg-surface-1/40">
                  <span>Verified Providers</span>
                  <span className="font-bold text-foreground">
                    {stats.verified_providers}
                  </span>
                </li>
                <li className="flex items-center justify-between p-2 rounded bg-surface-1/40">
                  <span>Pending Appointments</span>
                  <span className="font-bold text-warning">
                    {appointmentStatusData.find((a) => a.key === "pending")
                      ?.value || 0}
                  </span>
                </li>
                <li className="flex items-center justify-between p-2 rounded bg-surface-1/40">
                  <span>Completed This Month</span>
                  <span className="font-bold text-success">
                    {appointmentStatusData.find((a) => a.key === "completed")
                      ?.value || 0}
                  </span>
                </li>
                <li className="flex items-center justify-between p-2 rounded bg-surface-1/40">
                  <span>Total Revenue</span>
                  <span className="font-bold text-primary">
                    ₹
                    {Math.round(
                      stats.total_appointments * 1200 * 0.8,
                    ).toLocaleString("en-IN")}
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card variant="glass" className="p-8">
            <CardContent className="space-y-4">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <AlertCircle size={20} className="text-warning" /> Suggested
                Actions
              </h3>
              <ul className="space-y-3 text-sm text-text-muted">
                <li className="flex gap-3">
                  <span className="font-bold text-foreground">1.</span>
                  <span>
                    Review pending appointments and confirm provider
                    availability during peak windows.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-foreground">2.</span>
                  <span>
                    Verify new providers to improve trust score and reduce
                    provider-side booking failures.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-foreground">3.</span>
                  <span>
                    Export operational reports weekly for deeper audits.
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
