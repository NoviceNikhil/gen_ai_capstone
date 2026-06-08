import { useEffect, useMemo, useState } from "react";
import { getDisputesAPI, resolveDisputeAPI } from "../../services/apiService";
import { Gavel, AlertCircle, CheckCircle2, XCircle, Search, Filter, DollarSign, TrendingUp, BarChart3, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DisputesSkeleton = () => (
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
  </div>
);

export default function AdminDisputes() {
  const [loading, setLoading] = useState(true);
  const [disputes, setDisputes] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [isResolving, setIsResolving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getDisputesAPI();
      setDisputes(res.data?.data || []);
    } catch {
      toast.error("Failed to load disputes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredDisputes = useMemo(() => {
    return disputes.filter((d) => {
      const term = searchTerm.toLowerCase();
      return (
        d.reason?.toLowerCase().includes(term) ||
        d.customer_name?.toLowerCase().includes(term) ||
        d.provider_name?.toLowerCase().includes(term)
      );
    });
  }, [disputes, searchTerm]);

  const stats = useMemo(() => {
    const open = disputes.filter((d) => d.status === "pending");
    const resolved = disputes.filter((d) => d.status !== "pending");
    const refunded = disputes.filter((d) => d.status === "resolved_refunded");
    const totalPipeline = disputes.reduce((sum, d) => sum + (d.amount || 0), 0);

    return { open, resolved, refunded, totalPipeline };
  }, [disputes]);

  const handleResolve = async (disputeId, action) => {
    setIsResolving(true);
    try {
      await resolveDisputeAPI(disputeId, { action });
      toast.success(`Dispute resolved via ${action}`);
      setSelectedDispute(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to resolve dispute");
    } finally {
      setIsResolving(false);
    }
  };

  if (loading) return <DisputesSkeleton />;

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in space-y-8">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Gavel className="text-primary size-7" /> Disputes & Refunds
          </h1>
          <p className="text-sm text-text-muted mt-1">Review refund requests, service disputes, and resolution outcomes.</p>
        </div>
        
        <div className="flex gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
            <Input
              placeholder="Search disputes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-56 h-9 bg-surface-1/60 border-border-light"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DisputeStatCard
          icon={AlertCircle}
          label="Open Disputes"
          value={stats.open.length}
          color="var(--color-warning)"
        />
        <DisputeStatCard
          icon={CheckCircle2}
          label="Resolved"
          value={stats.resolved.length}
          color="var(--color-success)"
        />
        <DisputeStatCard
          icon={DollarSign}
          label="Refund Pipeline"
          value={`₹${stats.totalPipeline}`}
          color="var(--color-primary)"
        />
        <DisputeStatCard
          icon={TrendingUp}
          label="Resolution Rate"
          value={disputes.length > 0 ? `${Math.round((stats.resolved.length / disputes.length) * 100)}%` : "100%"}
          color="var(--color-accent)"
        />
      </div>

      <Card variant="glass" className="p-6">
        <CardContent className="space-y-4">
          <h2 className="font-bold text-base text-foreground">Active Dispute Queue</h2>
          
          <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
            {filteredDisputes.length > 0 ? (
              filteredDisputes.map((d) => (
                <DisputeRow key={d.id} dispute={d} onSelect={setSelectedDispute} />
              ))
            ) : (
              <p className="text-xs text-text-muted py-4 text-center">No active disputes matching search</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedDispute} onOpenChange={() => { setSelectedDispute(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dispute Resolution</DialogTitle>
            <DialogDescription>
              Review case details and select payout/refund resolution.
            </DialogDescription>
          </DialogHeader>
          
          {selectedDispute && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[10px] font-bold uppercase text-text-faint">Customer Name</p>
                  <p className="text-foreground">{selectedDispute.customer_name}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-text-faint">Provider Name</p>
                  <p className="text-foreground">{selectedDispute.provider_name}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-text-faint">Disputed Amount</p>
                  <p className="text-foreground">₹{selectedDispute.amount}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-text-faint">Dispute Raised By</p>
                  <p className="text-foreground">{selectedDispute.raised_by_name} ({selectedDispute.raised_by_role})</p>
                </div>
              </div>
              
              <div className="p-3 bg-muted/20 border rounded-lg">
                <p className="text-[10px] font-bold uppercase text-text-faint">Claim Reason</p>
                <p className="text-xs mt-1 text-foreground leading-relaxed">{selectedDispute.reason}</p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedDispute(null)} className="cursor-pointer" disabled={isResolving}>
              Cancel
            </Button>
            {selectedDispute && selectedDispute.status === "pending" && (
              <>
                <Button
                  variant="outline"
                  className="cursor-pointer text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => handleResolve(selectedDispute.id, "discharge")}
                  disabled={isResolving}
                >
                  Discharge Provider (Keep Payment)
                </Button>
                <Button className="cursor-pointer gap-1.5" onClick={() => handleResolve(selectedDispute.id, "refund")} disabled={isResolving}>
                  <CheckCircle2 size={14} /> Full Refund Customer
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DisputeStatCard({ icon: Icon, label, value, color }) {
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

function DisputeRow({ dispute, onSelect }) {
  return (
    <Card className="border border-border/40 bg-surface-1/40 p-4 rounded-xl hover:border-primary/30 transition-colors cursor-pointer" onClick={() => onSelect(dispute)}>
      <CardContent className="p-0 flex justify-between items-start">
        <div>
          <p className="font-semibold text-sm text-foreground">
            {dispute.customer_name} ↔ {dispute.provider_name}
          </p>
          <p className="text-xs text-text-muted mt-1 font-mono">
            Amount: ₹{dispute.amount}
          </p>
          <p className="text-xs text-text-faint mt-1.5 max-w-xs truncate">
            Reason: {dispute.reason}
          </p>
        </div>
        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${
          dispute.status === "pending"
            ? "bg-warning/10 text-warning border-warning/20"
            : "bg-success/10 text-success border-success/20"
        }`}>
          {dispute.status}
        </span>
      </CardContent>
    </Card>
  );
}