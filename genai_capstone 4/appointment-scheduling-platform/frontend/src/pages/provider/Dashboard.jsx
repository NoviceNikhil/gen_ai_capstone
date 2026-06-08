import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { Calendar, Clock, CheckCircle, Users, ArrowRight, Download, ClipboardList, Settings, Sparkles, ShieldAlert } from "lucide-react";
import { fetchProviderDashboard } from "../../store/providerSlice";
import StatCard from "../../components/ui/StatCard";
import StatusBadge from "../../components/ui/StatusBadge";
import { downloadProviderSchedule } from "../../services/reportService";
import { getProviderOnboardingAPI } from "../../services/apiService";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const DashboardSkeleton = () => (
  <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
    {/* Header */}
    <div className="flex flex-col md:flex-row justify-between gap-4">
      <div className="space-y-2">
        <div className="skeleton w-64 h-10" />
        <div className="skeleton w-96 h-5" />
      </div>
      <div className="flex gap-3">
        <div className="skeleton w-28 h-9" />
        <div className="skeleton w-36 h-9" />
      </div>
    </div>

    {/* Metrics */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
      {[...Array(4)].map((_, idx) => (
        <div key={idx} className="skeleton w-full h-[108px]" />
      ))}
    </div>

    {/* Content Grid */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <div className="skeleton w-full h-[240px]" />
        <div className="skeleton w-full h-[180px]" />
      </div>
      <div className="space-y-6">
        <div className="skeleton w-full h-[160px]" />
        <div className="skeleton w-full h-[120px]" />
      </div>
    </div>
  </div>
);

export default function ProviderDashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { dashboardStats: stats, loading } = useSelector((s) => s.providers);
  const { user } = useSelector((s) => s.auth);
  const [onboardingStatus, setOnboardingStatus] = useState(null); // null | 'pending' | 'approved'

  useEffect(() => {
    dispatch(fetchProviderDashboard());
  }, [dispatch]);

  // Check if provider has completed and submitted onboarding
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        // Fetch provider profile details first
        const providerRes = await import("../../services/apiService").then(m => m.getProviderProfileAPI());
        const provider = providerRes.data?.data?.provider || {};
        if (provider.is_verified) {
          setOnboardingStatus("approved");
          return;
        }

        try {
          const res = await getProviderOnboardingAPI();
          const onboarding = res.data?.data?.onboarding;

          if (!onboarding || !onboarding.submitted_for_approval) {
            // Only force onboarding when the endpoint exists and tells us it's not submitted.
            navigate("/provider/onboarding");
            return;
          }

          // Submitted but not verified yet.
          setOnboardingStatus("pending");
        } catch (err) {
          // IMPORTANT: If onboarding endpoint is missing (404) or fails for any reason,
          // do NOT block seeded providers from logging in. Treat as "pending" and
          // allow dashboard access.
          const status = err?.response?.status;
          if (status === 404) {
            setOnboardingStatus("pending");
            return;
          }
          console.error("Failed to load onboarding data:", err);
          setOnboardingStatus("pending");
        }
      } catch (err) {
        console.error("Onboarding check failed:", err);
        // Don't hard-block dashboard on transient errors.
        setOnboardingStatus("pending");
      }
    };
    checkOnboarding();
  }, [navigate]);

  const handleExport = async () => {
    const now = new Date();
    try {
      await downloadProviderSchedule("self", now.getMonth() + 1, now.getFullYear());
      toast.success("Schedule exported!");
    } catch {
      toast.error("Export failed — ensure report service is running");
    }
  };

  if (loading || !stats) return <DashboardSkeleton />;

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in space-y-8">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-5 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2.5 text-foreground">
            <Sparkles className="text-primary size-7" /> Provider Dashboard
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {user?.full_name} · Manage requests, daily schedule, and upcoming work.
          </p>
        </div>
        <div className="flex gap-3">
          <Link to="/provider/availability">
            <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer">
              <Settings size={14} /> Availability
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5 cursor-pointer">
            <Download size={14} /> Export Schedule
          </Button>
        </div>
      </div>

      {onboardingStatus === "pending" && (
       <Card className="bg-white-500/10 border border-white-500/30 p-4 rounded-xl flex items-start gap-3.5 animate-pulse">
  <ShieldAlert className="text-black shrink-0 size-5 mt-0.5" />
  <div>
    <h3 className="font-bold text-sm text-black">
      Onboarding Pending Approval
    </h3>
    <p className="text-xs text-black mt-1 leading-relaxed">
      Your onboarding application has been successfully submitted and is currently being reviewed by our administrators.
      You will not be visible to customers in search results or the marketplace until your account is approved.
    </p>
  </div>
</Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <StatCard label="Total Appointments" value={stats.total_appointments} icon={Calendar} color="var(--color-primary)" />
        <StatCard label="Today's Slots" value={stats.today_count} icon={Clock} color="var(--color-info)" />
        <StatCard label="Pending" value={stats.pending_count} icon={Users} color="var(--color-status-pending)" />
        <StatCard label="Completed" value={stats.completed_count} icon={CheckCircle} color="var(--color-success)" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card variant="glass" className="p-6">
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-lg text-foreground flex items-center gap-2">
                  <Clock size={18} className="text-primary" /> Today's Schedule
                </h2>
                <Link to="/provider/appointments" className="text-[10px] font-bold uppercase tracking-wider text-primary hover:underline">
                  Queue
                </Link>
              </div>
              {stats.todays_appointments?.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {stats.todays_appointments.map((appt) => (
                    <Link key={appt.id} to={`/provider/appointments/${appt.id}`} className="block group">
                      <Card className="sweep-card animate-entrance p-4">
                        <CardContent className="p-0">
                          <div className="sweep-reveal-content flex items-center justify-between w-full">
                            <div className="flex items-center gap-3.5">
                              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary group-hover:scale-105 transition-transform duration-200 shrink-0">
                                {appt.customer?.full_name?.[0] || "C"}
                              </div>
                              <div>
                                <p className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                                  {appt.customer?.full_name}
                                </p>
                                <p className="text-xs text-text-muted mt-0.5 font-mono">{appt.time_slot}</p>
                              </div>
                            </div>
                            <StatusBadge status={appt.status} />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="p-10 rounded-xl bg-surface-1/30 border border-border/40 text-center">
                  <ClipboardList size={32} className="mx-auto mb-3 text-text-faint/80" />
                  <p className="font-bold text-sm text-foreground mb-0.5">No appointments today</p>
                  <p className="text-xs text-text-muted">Your seeded upcoming queue will still appear below if future appointments exist.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card variant="glass" className="p-6">
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-lg text-foreground">Upcoming</h2>
                <Link to="/provider/appointments" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                  View all <ArrowRight size={14} />
                </Link>
              </div>
              {stats.upcoming_appointments?.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {stats.upcoming_appointments.map((appt) => (
                    <Link key={appt.id} to={`/provider/appointments/${appt.id}`} className="block group">
                      <Card variant="glass-hover" className="p-3.5">
                        <CardContent className="flex items-center justify-between p-0 text-sm">
                          <p className="font-semibold text-foreground group-hover:text-primary transition-colors">{appt.customer?.full_name}</p>
                          <p className="text-xs text-text-muted font-mono">{appt.appointment_date} {appt.time_slot}</p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-muted leading-relaxed">
                  No upcoming appointments yet. Add availability and keep your profile accepting bookings.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card variant="glass" className="p-6">
            <CardContent className="space-y-5">
              <h2 className="font-bold text-lg text-foreground">Operations</h2>
              <div className="space-y-3">
                <Link to="/provider/appointments" className="block">
                  <Card className="bg-status-pending/10 hover:bg-status-pending/15 border border-status-pending/20 transition-colors p-4 rounded-xl">
                    <CardContent className="flex items-center justify-between p-0 text-sm font-bold text-status-pending uppercase tracking-wider text-xs">
                      PENDING DECISIONS
                      <span>{stats.pending_count || 0}</span>
                    </CardContent>
                  </Card>
                </Link>
                <Link to="/provider/availability" className="block">
                  <Card variant="glass-hover" className="p-4">
                    <CardContent className="flex items-center justify-between p-0 text-sm font-semibold text-foreground">
                      <span>Manage weekly hours</span>
                      <ArrowRight size={14} className="text-text-muted group-hover:translate-x-0.5 transition-transform" />
                    </CardContent>
                  </Card>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card variant="glass" className="p-6">
            <CardContent className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-faint">Demo Tip</p>
              <p className="text-xs text-text-muted leading-relaxed">
                Seeded provider accounts use the same password. Login as a seeded provider to see this dashboard populated with matching appointment data.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
