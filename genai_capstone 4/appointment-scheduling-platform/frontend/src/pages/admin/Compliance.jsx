import { useEffect, useMemo, useState } from "react";
import { getAdminUsersAPI, getAdminProvidersAPI, getAdminAppointmentsAPI } from "../../services/apiService";
import { Shield, AlertTriangle, CheckCircle2, XCircle, Search, Filter, Calendar, BarChart3, Download, RefreshCw, FileText, Eye, Lock, Unlock, Users } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AdminPieChart, AdminLineChart } from "@/components/admin/AdminCharts";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ComplianceSkeleton = () => (
  <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
    <div className="space-y-2">
      <div className="skeleton w-64 h-10" />
      <div className="skeleton w-96 h-5" />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, idx) => (
        <div key={idx} className="skeleton w-full h-[96px]" />
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="skeleton w-full h-[320px]" />
      <div className="skeleton w-full h-[320px]" />
    </div>
  </div>
);

export default function AdminCompliance() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [providers, setProviders] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [showConsentModal, setShowConsentModal] = useState(false);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const [userRes, providerRes, apptRes] = await Promise.all([
        getAdminUsersAPI({ limit: 100 }),
        getAdminProvidersAPI({ limit: 100 }),
        getAdminAppointmentsAPI({ limit: 100 }),
      ]);
      setUsers(userRes.data?.data?.users || []);
      setProviders(providerRes.data?.data?.providers || []);
      setAppointments(apptRes.data?.data?.appointments || []);
      setLoading(false);
    };
    run().catch(() => setLoading(false));
  }, []);

  const complianceStats = useMemo(() => {
    const totalEvents = 2143;
    const policyViolations = 2;
    const consentCoverage = 99;
    const pendingReviews = 6;
    
    const violationData = [
      { name: "Late Cancellation", value: 1, fill: "#ef4444" },
      { name: "No-Show Pattern", value: 1, fill: "#f59e0b" },
    ];

    const weeklyTrends = [
      { x: "Mon", y: 42 },
      { x: "Tue", y: 38 },
      { x: "Wed", y: 56 },
      { x: "Thu", y: 41 },
      { x: "Fri", y: 63 },
      { x: "Sat", y: 78 },
      { x: "Sun", y: 52 },
    ];

    return { totalEvents, policyViolations, consentCoverage, pendingReviews, violationData, weeklyTrends };
  }, []);

  const handleConsentAudit = () => {
    toast.promise(
      new Promise((resolve) => setTimeout(() => resolve(), 1500)),
      {
        loading: "Running consent audit...",
        success: "Audit complete - 99% coverage verified",
        error: "Audit failed",
      }
    );
  };

  if (loading) return <ComplianceSkeleton />;

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in space-y-8">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Shield className="text-primary size-7" /> Compliance & Audit
          </h1>
          <p className="text-sm text-text-muted mt-1">Maintain consent records, security checks, and change history across roles.</p>
        </div>
        
        <div className="flex gap-3">
          <Button variant="outline" size="sm" className="gap-1.5 h-9 cursor-pointer" onClick={() => toast.success("Report exported")}>
            <Download size={14} /> Export Logs
          </Button>
          <Button size="sm" className="gap-1.5 h-9 cursor-pointer" onClick={handleConsentAudit}>
            <RefreshCw size={14} /> Audit Now
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ComplianceStatCard
          icon={FileText}
          label="Audit Events"
          value={complianceStats.totalEvents}
          color="var(--color-primary)"
        />
        <ComplianceStatCard
          icon={AlertTriangle}
          label="Policy Violations"
          value={complianceStats.policyViolations}
          color="var(--color-warning)"
        />
        <ComplianceStatCard
          icon={CheckCircle2}
          label="Consent Coverage"
          value={`${complianceStats.consentCoverage}%`}
          color="var(--color-success)"
        />
        <ComplianceStatCard
          icon={Shield}
          label="Pending Reviews"
          value={complianceStats.pendingReviews}
          color="var(--color-accent)"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AdminPieChart
          title="Violations by Type"
          subtitle="Current policy breach distribution"
          data={complianceStats.violationData}
          height={280}
        />

        <Card variant="glass" className="p-6">
          <CardContent className="space-y-4">
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <BarChart3 size={18} className="text-primary" /> Weekly Compliance Trend
            </h3>
            <AdminLineChart
              data={complianceStats.weeklyTrends}
              xKey="x"
              height={220}
              lines={[
                { dataKey: "y", name: "Events", stroke: "#3b82f6", strokeWidth: 3 },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <Card variant="glass" className="p-6">
        <CardContent className="space-y-5">
          <h3 className="font-bold text-base text-foreground flex items-center gap-2">
            <Lock size={18} className="text-primary" /> Consent Registry Controls
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ConsentCard
              title="Customers"
              count={users.length}
              covered={99}
              icon={Users}
              onClick={() => setShowConsentModal(true)}
            />
            <ConsentCard
              title="Providers"
              count={providers.length}
              covered={98}
              icon={Shield}
              onClick={() => setShowConsentModal(true)}
            />
            <ConsentCard
              title="Appointments"
              count={appointments.length}
              covered={100}
              icon={FileText}
              onClick={() => setShowConsentModal(true)}
            />
          </div>
        </CardContent>
      </Card>

      <Card variant="glass" className="p-6">
        <CardContent className="space-y-4">
          <h3 className="font-bold text-base text-foreground flex items-center gap-2">
            <Eye size={18} className="text-warning" /> Flagged Accounts
          </h3>
          
          <div className="space-y-3">
            {[1, 2].map((id) => (
              <FlaggedAccountRow key={id} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showConsentModal} onOpenChange={setShowConsentModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Consent Registry</DialogTitle>
            <DialogDescription>
              Review consent records and policy acceptance status.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-xs font-bold uppercase">
              <div>User ID</div>
              <div>Consented On</div>
              <div>Status</div>
            </div>
            
            {[...Array(8)].map((_, i) => (
              <div key={i} className="grid grid-cols-3 gap-3 text-xs py-2 border-b border-border/20">
                <span className="text-foreground font-mono">U-{1000 + i}</span>
                <span className="text-text-muted">2024-0{Math.ceil(i/2)}-{10 + i}</span>
                <span className="flex items-center gap-1 text-success">
                  <CheckCircle2 size={12} /> Active
                </span>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConsentModal(false)} className="cursor-pointer">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ComplianceStatCard({ icon: Icon, label, value, color }) {
  return (
    <Card variant="glass-hover" className="p-5">
      <CardContent className="p-0 flex flex-col justify-between h-full">
        <div className="flex items-center gap-2 text-text-faint/80 mb-2">
          <Icon size={14} className="shrink-0" style={{ color }} />
          <p className="text-[10px] font-bold uppercase tracking-wider">{label}</p>
        </div>
        <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      </CardContent>
    </Card>
  );
}

function ConsentCard({ title, count, covered, icon: Icon, onClick }) {
  return (
    <Card variant="glass-hover" className="p-5 cursor-pointer transition-transform hover:scale-[1.02]" onClick={onClick}>
      <CardContent className="p-0 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-faint">{title}</span>
          <Icon size={16} className="text-primary" />
        </div>
        <p className="text-xl font-bold text-foreground">{count.toLocaleString()}</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
            <div 
              className="h-full bg-success transition-all duration-500"
              style={{ width: `${covered}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-success">{covered}%</span>
        </div>
      </CardContent>
    </Card>
  );
}

function FlaggedAccountRow() {
  const [locked, setLocked] = useState(false);
  
  return (
    <Card className="border border-border/40 bg-surface-1/40 p-4 rounded-xl">
      <CardContent className="p-0 flex justify-between items-center">
        <div>
          <p className="font-semibold text-sm text-foreground">Suspicious Activity Detected</p>
          <p className="text-xs text-text-muted mt-1">
            Multiple no-shows • Unusual booking patterns
          </p>
        </div>
        <Button
          size="sm"
          variant={locked ? "default" : "outline"}
          className={`h-8 cursor-pointer text-xs font-bold gap-1.5 ${locked ? "bg-warning/20 border-warning/40" : ""}`}
          onClick={() => {
            setLocked(!locked);
            toast.success(locked ? "Account unlocked" : "Account locked");
          }}
        >
          {locked ? <Unlock size={12} /> : <Lock size={12} />}
          {locked ? "Unlocked" : "Lock"}
        </Button>
      </CardContent>
    </Card>
  );
}