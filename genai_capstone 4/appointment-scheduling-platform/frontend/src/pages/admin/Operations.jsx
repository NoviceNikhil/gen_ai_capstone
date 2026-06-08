import { useEffect, useMemo, useState } from "react";
import { getAdminAppointmentsAPI, getAdminProvidersAPI, getAdminUsersAPI } from "../../services/apiService";
import { AlertTriangle, Clock3, ShieldAlert, CheckCircle2, RefreshCw, Download } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AdminPieChart, AdminLineChart } from "@/components/admin/AdminCharts";
import { APPOINTMENT_STATUSES } from "../../utils/constants";

const OpsSkeleton = () => (
  <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
    <div className="space-y-2">
      <div className="skeleton w-64 h-10" />
      <div className="skeleton w-96 h-5" />
    </div>

    {/* Metrics */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, idx) => (
        <div key={idx} className="skeleton w-full h-[96px]" />
      ))}
    </div>

    {/* Content Grid */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="skeleton w-full h-[320px]" />
      <div className="skeleton w-full h-[320px]" />
    </div>
  </div>
);

export default function AdminOperations() {
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [providers, setProviders] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const [apptRes, providerRes, userRes] = await Promise.all([
        getAdminAppointmentsAPI({ limit: 50 }),
        getAdminProvidersAPI({ limit: 50 }),
        getAdminUsersAPI({ limit: 50 }),
      ]);
      setAppointments(apptRes.data?.data?.appointments || []);
      setProviders(providerRes.data?.data?.providers || []);
      setUsers(userRes.data?.data?.users || []);
      setLoading(false);
    };
    run().catch(() => setLoading(false));
  }, []);

  const ops = useMemo(() => {
    const pending = appointments.filter((a) => a.status === "pending").length;
    const cancelled = appointments.filter((a) => a.status === "cancelled").length;
    const unverified = providers.filter((p) => !p.is_verified).length;
    const inactiveUsers = users.filter((u) => !u.is_active).length;
    return { pending, cancelled, unverified, inactiveUsers };
  }, [appointments, providers, users]);

  const queueMix = useMemo(() => {
    const counts = {};
    for (const a of appointments) {
      const k = String(a.status || "pending");
      counts[k] = (counts[k] || 0) + 1;
    }
    const palette = ["#f59e0b", "#2563eb", "#10b981", "#ef4444"];
    return APPOINTMENT_STATUSES.map((s, idx) => ({
      name: String(s),
      key: s,
      value: counts[s] || 0,
      fill: palette[idx % palette.length],
    })).filter((d) => d.value > 0);
  }, [appointments]);

  const timelineData = useMemo(() => {
    const map = new Map();
    for (const a of appointments) {
      if (["pending", "cancelled"].includes(a.status)) {
        const day = a.appointment_date ? String(a.appointment_date) : "unknown";
        map.set(day, (map.get(day) || 0) + 1);
      }
    }
    const entries = Array.from(map.entries())
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      .slice(-7);

    return entries.map(([d, count]) => ({
      x: d === "unknown" ? "Unknown" : d.slice(5),
      y: count,
    }));
  }, [appointments]);

  if (loading) return <OpsSkeleton />;

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in space-y-8">
      <div className="border-b border-border/40 pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Operations Console</h1>
        <p className="text-sm text-text-muted mt-1">SLA risks, verification queue, and booking exceptions</p>
        <div className="flex gap-3 mt-4">
          <Button variant="outline" size="sm" className="h-8 cursor-pointer">
            <RefreshCw size={14} className="mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" className="h-8 cursor-pointer">
            <Download size={14} className="mr-1" /> Export Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <OpsCard icon={Clock3} title="Pending Appointments" value={ops.pending} />
        <OpsCard icon={AlertTriangle} title="Cancelled Appointments" value={ops.cancelled} />
        <OpsCard icon={ShieldAlert} title="Unverified Providers" value={ops.unverified} />
        <OpsCard icon={AlertTriangle} title="Inactive Users" value={ops.inactiveUsers} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AdminPieChart
          title="Queue Status Distribution"
          subtitle="Overview of all appointments"
          data={queueMix}
          height={260}
        />
        <AdminLineChart
          title="Exceptions Timeline"
          subtitle="Pending & Cancelled over last 7 days"
          data={timelineData}
          xKey="x"
          height={260}
          lines={[{ dataKey: "y", name: "Exceptions", stroke: "#ef4444", strokeWidth: 3 }]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card variant="glass" className="p-6">
          <CardContent className="space-y-4">
            <h2 className="font-bold text-base text-foreground">Recent Appointment Exceptions</h2>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
              {appointments
                .filter((a) => ["pending", "cancelled"].includes(a.status))
                .slice(0, 8)
                .map((a) => (
                  <Card key={a.id} className="border border-border/40 bg-surface-1/40 p-3.5 rounded-xl">
                    <CardContent className="p-0 flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-sm text-foreground">{a.provider?.user?.full_name || "Provider"} · {a.customer?.full_name || "Customer"}</p>
                        <p className="text-xs text-text-muted mt-1 font-mono">{a.appointment_date} {a.time_slot}</p>
                      </div>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${
                        a.status === "cancelled"
                          ? "bg-destructive/10 text-destructive border-destructive/20"
                          : "bg-status-pending/10 text-status-pending border-status-pending/20"
                        }`}>
                        {a.status}
                      </span>
                    </CardContent>
                  </Card>
                ))}
              {appointments.filter((a) => ["pending", "cancelled"].includes(a.status)).length === 0 && (
                <p className="text-xs text-text-muted">No exceptions found</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card variant="glass" className="p-6">
          <CardContent className="space-y-4">
            <h2 className="font-bold text-base text-foreground flex items-center gap-2">
              <ShieldAlert className="text-warning size-5" /> Provider Verification Queue
            </h2>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
              {providers
                .filter((p) => !p.is_verified)
                .slice(0, 8)
                .map((p) => (
                  <VerificationRow key={p.id} provider={p} />
                ))}
              {providers.filter((p) => !p.is_verified).length === 0 && (
                <p className="text-xs text-text-muted leading-relaxed">No pending verification</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function OpsCard({ icon: Icon, title, value }) {
  return (
    <Card variant="glass" className="p-5">
      <CardContent className="p-0 flex flex-col justify-between h-full">
        <div className="flex items-center gap-2 text-text-faint/80 mb-2">
          <Icon size={14} className="text-primary shrink-0" />
          <p className="text-[10px] font-bold uppercase tracking-wider">{title}</p>
        </div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

const VerificationRow = ({ provider }) => {
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      await toast.promise(
        new Promise((resolve) => setTimeout(() => resolve(), 800)),
        {
          loading: "Verifying provider...",
          success: "Provider verified successfully",
          error: "Verification failed",
        }
      );
    } catch (err) {
      console.error(err);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Card className="border border-border/40 bg-surface-1/40 p-4 rounded-xl hover:border-primary/30 transition-colors">
      <CardContent className="p-0 flex justify-between items-center">
        <div>
          <p className="font-semibold text-sm text-foreground">{provider.user?.full_name || "Provider"}</p>
          <p className="text-xs text-text-muted mt-1">
            {provider.specialization} · {provider.location || "Location n/a"}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10px] font-mono text-text-faint">Registered: 2 days ago</span>
            <span className="text-[10px] text-warning">Pending approval</span>
          </div>
        </div>
        <Button
          size="sm"
          className="h-8 gap-1.5 cursor-pointer"
          onClick={handleVerify}
          disabled={verifying}
        >
          {verifying ? "..." : <><CheckCircle2 size={14} /> Verify</>}
        </Button>
      </CardContent>
    </Card>
  );
};
