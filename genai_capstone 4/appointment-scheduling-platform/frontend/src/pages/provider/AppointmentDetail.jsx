import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { getProviderAppointmentByIdAPI } from "../../services/apiService";
import { updateAppointmentStatus } from "../../store/providerSlice";
import StatusBadge from "../../components/ui/StatusBadge";
import { ArrowLeft, Calendar, Clock, User, CreditCard, Check, Flag, Gavel } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const DetailSkeleton = () => (
  <div className="p-6 max-w-2xl mx-auto space-y-6 animate-fade-in">
    <div className="skeleton w-16 h-6 rounded-md" />
    <div className="skeleton w-full h-[280px]" />
  </div>
);

export default function ProviderAppointmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [appt, setAppt] = useState(null);
  const [loading, setLoading] = useState(true);
  const { loading: actionLoading } = useSelector((s) => s.providers);

  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleSlot, setRescheduleSlot] = useState("");
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);

  const [showDispute, setShowDispute] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [isDisputing, setIsDisputing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getProviderAppointmentByIdAPI(id);
      setAppt(res.data?.data?.appointment);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleAction = async (action) => {
    const res = await dispatch(updateAppointmentStatus({ id, action }));
    if (updateAppointmentStatus.fulfilled.match(res)) {
      toast.success(`Appointment ${action}ed`);
      load();
    } else {
      toast.error(res.payload?.message || "Action failed");
    }
  };

  const handleRaiseDispute = async () => {
    if (!disputeReason.trim()) return toast.error("Reason is required");
    setIsDisputing(true);
    try {
      const { raiseDisputeAPI } = await import("../../services/apiService");
      await raiseDisputeAPI({ appointment_id: id, reason: disputeReason });
      toast.success("Dispute raised successfully!");
      load();
      setShowDispute(false);
      setDisputeReason("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit dispute");
    } finally {
      setIsDisputing(false);
    }
  };

  const handleFetchSlots = async (dateStr) => {
    setRescheduleDate(dateStr);
    setRescheduleSlot("");
    if (!dateStr) return;
    setLoadingSlots(true);
    try {
      const { getAvailableSlotsAPI } = await import("../../services/apiService");
      const res = await getAvailableSlotsAPI(appt.provider_id, dateStr);
      const raw = res.data?.data?.available_slots || [];
      const normalised = raw.map((s) =>
        typeof s === "string" ? { time_slot: s, slot_type: "recurring" } : s
      );
      setAvailableSlots(normalised);
    } catch {
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleDate || !rescheduleSlot) {
      toast.error("Please select a date and time slot.");
      return;
    }
    setIsRescheduling(true);
    try {
      const { rescheduleProviderAppointment } = await import("../../store/providerSlice");
      const res = await dispatch(rescheduleProviderAppointment({
        id: appt.id,
        appointment_date: rescheduleDate,
        time_slot: rescheduleSlot
      }));
      if (res.meta.requestStatus === "fulfilled") {
        toast.success("Reschedule request sent to customer!");
        load();
        setShowReschedule(false);
      } else {
        toast.error(res.payload?.message || "Failed to request reschedule");
      }
    } catch (err) {
      toast.error("An error occurred");
    } finally {
      setIsRescheduling(false);
    }
  };

  const handleRespondReschedule = async (reqId, action) => {
    try {
      const { respondProviderReschedule } = await import("../../store/providerSlice");
      const res = await dispatch(respondProviderReschedule({ requestId: reqId, action }));
      if (res.meta.requestStatus === "fulfilled") {
        toast.success(`Reschedule request ${action}`);
        load();
      } else {
        toast.error(res.payload?.message || "Failed to respond");
      }
    } catch (err) {
      toast.error("An error occurred");
    }
  };

  if (loading || !appt) return <DetailSkeleton />;

  return (
    <div className="p-6 max-w-2xl mx-auto animate-fade-in space-y-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-faint hover:text-foreground transition-all mb-4 group cursor-pointer">
        <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" /> Back
      </button>

      <Card variant="glass" className="p-6">
        <CardContent className="space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">Appointment Detail</h1>
              <p className="text-xs text-text-faint font-mono mt-0.5">ID: #{appt.id?.slice(0, 8)}</p>
            </div>
            <StatusBadge status={appt.status} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="border border-border/40 bg-surface-1/40 p-4 rounded-xl">
              <CardContent className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-faint">Customer</p>
                <p className="font-semibold text-sm text-foreground">{appt.customer?.full_name}</p>
                <p className="text-xs text-text-muted">{appt.customer?.email}</p>
              </CardContent>
            </Card>
            <Card className="border border-border/40 bg-surface-1/40 p-4 rounded-xl">
              <CardContent className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-faint">Schedule</p>
                <p className="font-semibold text-sm text-foreground flex items-center gap-1.5"><Calendar size={12} className="text-primary" />{appt.appointment_date}</p>
                <p className="text-xs text-text-muted flex items-center gap-1.5"><Clock size={11} className="text-accent" />{appt.time_slot}</p>
              </CardContent>
            </Card>
          </div>

          {appt.payment_details && appt.consultation_fee_snapshot > 0 && (
            <Card className="border border-border/40 bg-surface-1/40 p-4 rounded-xl space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-faint flex items-center gap-1">
                <CreditCard size={12} className="text-primary" /> Earning & Payout Details
              </p>
              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="p-2 bg-muted/20 rounded-lg">
                  <p className="text-[10px] text-text-muted font-medium">Gross Charged</p>
                  <p className="text-sm font-bold text-foreground">₹{appt.payment_details.gross_amount}</p>
                </div>
                <div className="p-2 bg-muted/20 rounded-lg">
                  <p className="text-[10px] text-text-muted font-medium">Platform Fee (10%)</p>
                  <p className="text-sm font-bold text-rose-500">₹{appt.payment_details.commission_amount}</p>
                </div>
                <div className="p-2 bg-primary/5 border border-primary/10 rounded-lg">
                  <p className="text-[10px] text-primary font-bold">Your Net Earning</p>
                  <p className="text-sm font-black text-emerald-500">₹{appt.payment_details.net_earnings}</p>
                </div>
              </div>
              <div className="flex justify-between items-center text-xs pt-1 border-t border-border/20">
                <span className="text-text-muted">Payout Status:</span>
                <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] border ${
                  appt.payment_details.payout_status === "Available" 
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                    : appt.payment_details.payout_status === "Escrowed"
                    ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                    : "bg-muted/10 text-text-faint border-border"
                }`}>
                  {appt.payment_details.payout_status}
                </span>
              </div>
              {appt.payment_details.payout_date && (
                <p className="text-[10px] text-text-faint text-right">
                  Est. Payout Date: {appt.payment_details.payout_date}
                </p>
              )}
            </Card>
          )}

          {appt.status === "cancelled" && appt.is_paid && appt.consultation_fee_snapshot > 0 && (
            <div className="space-y-2 p-4 bg-muted/20 border border-border/40 rounded-xl">
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-faint">Cancellation & Refund Impact</p>
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Customer Charged:</span>
                <span className="font-semibold text-foreground">₹{appt.consultation_fee_snapshot}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Customer Refunded:</span>
                <span className="font-semibold text-emerald-500">₹{(appt.consultation_fee_snapshot - appt.penalty_fee_amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-border/20 font-bold">
                <span className="text-foreground">Your Net Payout:</span>
                <span className="text-foreground">₹{appt.payment_details?.net_earnings || 0}</span>
              </div>
              <p className="text-[10px] text-text-faint italic pt-1">
                Note: In case of late cancellation or no-show, penalty distributions are updated automatically.
              </p>
            </div>
          )}

          {appt.notes && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-faint">Notes</p>
              <p className="text-sm text-text-muted leading-relaxed">{appt.notes}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            {appt.status === "pending" && (
              <Button onClick={() => handleAction("confirm")} disabled={actionLoading}
                className="bg-success/15 text-success hover:bg-success/20 border border-success/35 gap-1.5 cursor-pointer">
                <Check size={14} /> Confirm
              </Button>
            )}
            {["pending", "confirmed"].includes(appt.status) && (
              <Button onClick={() => setShowReschedule(true)} variant="outline" className="h-9 text-xs font-semibold uppercase tracking-wider gap-1.5 cursor-pointer text-primary border-primary hover:bg-primary/10">
                <Clock size={14} /> Reschedule
              </Button>
            )}
            {appt.status === "confirmed" && (
              <Button onClick={() => handleAction("complete")} disabled={actionLoading}
                className="bg-primary/15 text-primary hover:bg-primary/20 border border-primary/35 gap-1.5 cursor-pointer">
                <Flag size={14} /> Mark as Completed
              </Button>
            )}
            {["completed", "confirmed"].includes(appt.status) && appt.is_paid && (
              <Button onClick={() => setShowDispute(true)} variant="outline" className="h-9 text-xs font-semibold uppercase tracking-wider gap-1.5 cursor-pointer text-warning border-warning hover:bg-warning/10">
                <Gavel size={14} /> Raise Dispute
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reschedule Requests */}
      {appt.reschedule_requests?.length > 0 && (
        <Card variant="glass" className="p-5 border-warning/30 bg-warning/5">
          <CardContent className="space-y-4">
            <h2 className="font-bold text-sm tracking-tight text-warning uppercase tracking-wider text-[10px]">Reschedule Requests</h2>
            <div className="flex flex-col gap-3">
              {appt.reschedule_requests.map((req) => (
                <div key={req.id} className="flex flex-col gap-2 p-3 rounded-xl bg-surface-1/50 border border-warning/20 text-sm">
                  <div>
                    <span className="font-semibold text-foreground">Proposed by:</span>{" "}
                    <span className="capitalize">{req.requested_by}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Date:</span>{" "}
                    {req.proposed_date} at {req.proposed_time_slot}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Status:</span>{" "}
                    <StatusBadge status={req.status} />
                  </div>
                  {req.status === "pending" && req.requested_by === "customer" && (
                    <div className="flex gap-2 mt-2">
                      <Button onClick={() => handleRespondReschedule(req.id, "approved")} size="sm" className="bg-success text-white hover:bg-success/80 cursor-pointer h-8 text-xs">Accept</Button>
                      <Button onClick={() => handleRespondReschedule(req.id, "rejected")} size="sm" variant="destructive" className="cursor-pointer h-8 text-xs">Reject</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dispute Modal */}
      <Dialog open={showDispute} onOpenChange={setShowDispute}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Raise Appointment Dispute</DialogTitle>
            <DialogDescription>
              Describe the issue with this booking. Admin operations team will review this claim.
            </DialogDescription>
          </DialogHeader>

          <textarea
            className="w-full resize-none rounded-lg border border-border-light bg-surface-1/60 text-foreground transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none p-3 placeholder:text-text-faint/60 text-sm"
            rows={4}
            placeholder="Describe your dispute details..."
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
          />

          <DialogFooter>
            <Button onClick={() => setShowDispute(false)} variant="outline" className="w-full sm:w-auto cursor-pointer" disabled={isDisputing}>
              Dismiss
            </Button>
            <Button onClick={handleRaiseDispute} className="w-full sm:w-auto bg-warning text-white hover:bg-warning/80 cursor-pointer" disabled={isDisputing}>
              {isDisputing ? "Submitting..." : "Submit Dispute"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule Modal */}
      <Dialog open={showReschedule} onOpenChange={setShowReschedule}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Reschedule</DialogTitle>
            <DialogDescription>
              Propose a new time for this appointment. The customer will need to approve this request.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-text-muted">Select Date</label>
              <input
                type="date"
                min={new Date().toISOString().split("T")[0]}
                className="w-full resize-none rounded-lg border border-border-light bg-surface-1/60 text-foreground transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none p-2.5 text-sm"
                value={rescheduleDate}
                onChange={(e) => handleFetchSlots(e.target.value)}
              />
            </div>

            {rescheduleDate && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-text-muted">Available Slots</label>
                {loadingSlots ? (
                  <div className="text-sm text-text-muted">Loading slots...</div>
                ) : availableSlots.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {availableSlots.map((slotObj) => (
                      <button
                        key={slotObj.time_slot}
                        onClick={() => setRescheduleSlot(slotObj.time_slot)}
                        className={`p-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                          rescheduleSlot === slotObj.time_slot
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-surface-1/60 border-border-light text-foreground hover:border-primary/50"
                        }`}
                      >
                        {slotObj.time_slot}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-rose-500">No slots available on this date.</div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setShowReschedule(false)} variant="outline" className="w-full sm:w-auto cursor-pointer" disabled={isRescheduling}>
              Cancel
            </Button>
            <Button onClick={handleReschedule} className="w-full sm:w-auto cursor-pointer" disabled={isRescheduling || !rescheduleSlot}>
              {isRescheduling ? "Submitting..." : "Send Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
