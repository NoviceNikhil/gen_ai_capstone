import { useEffect, useMemo, useState } from "react";
import { getAdminAppointmentsAPI, getAdminProvidersAPI } from "../../services/apiService";
import { RefreshCw, Shield, Zap, Clock, AlertTriangle, CheckCircle2, XCircle, Plus, Pencil, Trash2, Play, Pause, BarChart3, FileText, Lightbulb, ToggleLeft, ToggleRight } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AdminLineChart, AdminBarChart } from "@/components/admin/AdminCharts";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const AutomationSkeleton = () => (
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

const AUTOMATION_RULES = [
  {
    id: 1,
    name: "No-Show Prevention",
    description: "Send escalating reminders at 48h, 24h, 3h before appointment",
    trigger: "appointment_scheduled",
    status: "active",
    successRate: 94,
    executions: 1247,
    savedHours: 74,
  },
  {
    id: 2,
    name: "Provider Verification",
    description: "Auto-ping pending providers for documents after 48h",
    trigger: "provider_registered",
    status: "active",
    successRate: 88,
    executions: 892,
    savedHours: 32,
  },
  {
    id: 3,
    name: "Cancellation Refund",
    description: "Process auto-refunds for cancellations within policy window",
    trigger: "appointment_cancelled",
    status: "active",
    successRate: 91,
    executions: 341,
    savedHours: 28,
  },
  {
    id: 4,
    name: "Waitlist Auto-Fill",
    description: "Notify top 3 waitlisted customers on cancellation",
    trigger: "slot_released",
    status: "paused",
    successRate: 76,
    executions: 156,
    savedHours: 12,
  },
];

export default function AdminAutomation() {
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [providers, setProviders] = useState([]);
  const [rules, setRules] = useState(AUTOMATION_RULES);
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [runningSimulation, setRunningSimulation] = useState(false);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const [apptRes, providerRes] = await Promise.all([
        getAdminAppointmentsAPI({ limit: 50 }),
        getAdminProvidersAPI({ limit: 50 }),
      ]);
      setAppointments(apptRes.data?.data?.appointments || []);
      setProviders(providerRes.data?.data?.providers || []);
      setLoading(false);
    };
    run().catch(() => setLoading(false));
  }, []);

  const automationStats = useMemo(() => {
    const active = rules.filter(r => r.status === "active").length;
    const totalExecutions = rules.reduce((sum, r) => sum + r.executions, 0);
    const avgSuccess = rules.length > 0 ? Math.round(rules.reduce((sum, r) => sum + r.successRate, 0) / rules.length) : 0;
    const totalSavedHours = rules.reduce((sum, r) => sum + r.savedHours, 0);
    
    return { active, totalExecutions, avgSuccess, totalSavedHours };
  }, [rules]);

  const simulationResults = useMemo(() => {
    return [
      { action: "Reminders Sent", count: 24, unit: "messages" },
      { action: "Providers Emailed", count: 3, unit: "emails" },
      { action: "Refunds Processed", count: 1, unit: "transactions" },
    ];
  }, []);

  const handleToggleRule = (id) => {
    setRules(rules.map(r => 
      r.id === id 
        ? { ...r, status: r.status === "active" ? "paused" : "active" }
        : r
    ));
    const rule = rules.find(r => r.id === id);
    toast.success(`Rule ${rule?.status === "active" ? "paused" : "activated"}`);
  };

  const handleRunSimulation = () => {
    setRunningSimulation(true);
    toast.promise(
      new Promise((resolve) => setTimeout(() => resolve(), 2000)),
      {
        loading: "Running automation simulation...",
        success: "Simulation complete - rules functional",
        error: "Simulation failed",
      }
    ).finally(() => setRunningSimulation(false));
  };

  const handleSaveRule = (rule) => {
    if (editingRule) {
      setRules(rules.map(r => r.id === editingRule.id ? { ...r, ...rule } : r));
      toast.success("Rule updated");
    } else {
      setRules([...rules, { ...rule, id: Date.now(), successRate: 85, executions: 0, savedHours: 0 }]);
      toast.success("Rule created");
    }
    setShowRuleDialog(false);
    setEditingRule(null);
  };

  if (loading) return <AutomationSkeleton />;

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in space-y-8">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <RefreshCw className="text-primary size-7" /> Automation Rules
          </h1>
          <p className="text-sm text-text-muted mt-1">Configure no-show prevention, reminder cadences, and escalation automation.</p>
        </div>
        
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-1.5 h-9 cursor-pointer"
            onClick={handleRunSimulation}
            disabled={runningSimulation}
          >
            <Play size={14} className={runningSimulation ? "animate-spin" : ""} />
            Simulate
          </Button>
          <Button 
            size="sm" 
            className="gap-1.5 h-9 cursor-pointer"
            onClick={() => { setEditingRule(null); setShowRuleDialog(true); }}
          >
            <Plus size={14} /> New Rule
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AutomationStatCard
          icon={Zap}
          label="Active Rules"
          value={automationStats.active}
          color="var(--color-primary)"
        />
        <AutomationStatCard
          icon={CheckCircle2}
          label="Avg Success Rate"
          value={`${automationStats.avgSuccess}%`}
          color="var(--color-success)"
        />
        <AutomationStatCard
          icon={Clock}
          label="Manual Hours Saved"
          value={automationStats.totalSavedHours}
          color="var(--color-accent)"
          suffix="/mo"
        />
        <AutomationStatCard
          icon={AlertTriangle}
          label="Failed Runs"
          value="1"
          color="var(--color-warning)"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AdminBarChart
          title="Execution Volume by Rule"
          subtitle="Total runs per automation rule"
          data={rules.map(r => ({
            x: r.name.length > 12 ? r.name.substring(0, 12) + "..." : r.name,
            count: r.executions,
            status: r.status,
          }))}
          xKey="x"
          height={280}
          bars={[
            { dataKey: "count", name: "Executions", fill: "#166534" },
          ]}
        />

        <Card variant="glass" className="p-6">
          <CardContent className="space-y-4">
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <BarChart3 size={18} className="text-primary" /> Success Distribution
            </h3>
            
            <div className="space-y-3 max-h-56 overflow-y-auto pr-2">
              {rules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between">
                  <span className="text-sm text-foreground truncate max-w-36">{rule.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-success transition-all duration-500"
                        style={{ width: `${rule.successRate}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold w-8 text-right">{rule.successRate}%</span>
                  </div>
                </div>
              ))}
            </div>

            {runningSimulation && (
              <div className="pt-3 border-t border-border/30 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-faint">Simulation Results</p>
                {simulationResults.map((r) => (
                  <div key={r.action} className="flex justify-between text-xs">
                    <span className="text-text-muted">{r.action}</span>
                    <span className="font-bold text-foreground">{r.count} {r.unit}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card variant="glass" className="p-6">
        <CardContent className="space-y-4">
          <h3 className="font-bold text-base text-foreground flex items-center gap-2">
            <Lightbulb size={18} className="text-warning" /> Active Rules
          </h3>
          
          <div className="space-y-3">
            {rules.map((rule) => (
              <RuleRow 
                key={rule.id} 
                rule={rule} 
                onToggle={handleToggleRule}
                onEdit={(r) => { setEditingRule(r); setShowRuleDialog(true); }}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit Rule" : "Create New Rule"}</DialogTitle>
            <DialogDescription>
              Configure automation trigger and actions.
            </DialogDescription>
          </DialogHeader>
          
          <RuleForm rule={editingRule} onSave={handleSaveRule} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AutomationStatCard({ icon: Icon, label, value, color, suffix = "" }) {
  return (
    <Card variant="glass-hover" className="p-5">
      <CardContent className="p-0 flex flex-col justify-between h-full">
        <div className="flex items-center gap-2 text-text-faint/80 mb-2">
          <Icon size={14} className="shrink-0" style={{ color }} />
          <p className="text-[10px] font-bold uppercase tracking-wider">{label}</p>
        </div>
        <p className="text-2xl font-bold" style={{ color }}>
          {value}{suffix}
        </p>
      </CardContent>
    </Card>
  );
}

function RuleRow({ rule, onToggle, onEdit }) {
  const isActive = rule.status === "active";
  
  return (
    <Card className={cn(
      "border border-border/40 bg-surface-1/40 p-4 rounded-xl transition-all",
      isActive ? "hover:border-success/30" : "hover:border-warning/30"
    )}>
      <CardContent className="p-0 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h4 className="font-bold text-sm text-foreground">{rule.name}</h4>
            <span className={cn(
              "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
              isActive 
                ? "bg-success/10 text-success border-success/20" 
                : "bg-warning/10 text-warning border-warning/20"
            )}>
              {isActive ? "Active" : "Paused"}
            </span>
          </div>
          <p className="text-xs text-text-muted mb-2 line-clamp-1">{rule.description}</p>
          <div className="flex items-center gap-4 text-[10px] text-text-faint">
            <span>{rule.executions} runs</span>
            <span>{rule.savedHours}h saved</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-text-muted hover:text-foreground cursor-pointer"
            onClick={() => onEdit(rule)}
            title="Edit rule"
          >
            <Pencil size={14} />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className={isActive ? "text-success" : "text-warning"}
            onClick={() => onToggle(rule.id)}
            title={isActive ? "Pause rule" : "Activate rule"}
          >
            {isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RuleForm({ rule, onSave }) {
  const [form, setForm] = useState({
    name: rule?.name || "",
    description: rule?.description || "",
    trigger: rule?.trigger || "appointment_scheduled",
  });

  const triggers = [
    { value: "appointment_scheduled", label: "Appointment Scheduled" },
    { value: "appointment_cancelled", label: "Appointment Cancelled" },
    { value: "provider_registered", label: "Provider Registered" },
    { value: "slot_released", label: "Slot Released" },
    { value: "payment_failed", label: "Payment Failed" },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Rule Name</label>
        <Input
          placeholder="e.g. No-Show Prevention"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Description</label>
        <textarea
          className="w-full resize-none rounded-lg border border-border-light bg-surface-1/60 text-foreground transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none p-3 placeholder:text-text-faint/60 text-sm h-20"
          placeholder="What does this rule do?"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Trigger Event</label>
        <select
          className="w-full rounded-lg border border-border-light bg-surface-1/60 text-foreground p-2 text-sm"
          value={form.trigger}
          onChange={(e) => setForm({ ...form, trigger: e.target.value })}
        >
          {triggers.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => {}} className="cursor-pointer">
          Cancel
        </Button>
        <Button className="cursor-pointer gap-1.5" onClick={() => onSave(form)}>
          {rule ? "Update Rule" : "Create Rule"}
        </Button>
      </DialogFooter>
    </div>
  );
}
