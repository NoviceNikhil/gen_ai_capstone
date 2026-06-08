import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchAppointmentById, cancelAppointment, createPaymentOrder, verifyPayment } from "../../store/appointmentSlice";
import StatusBadge from "../../components/ui/StatusBadge";
import { ArrowLeft, Calendar, Clock, CreditCard, X, CreditCard as PayIcon, Gavel } from "lucide-react";
import {
  appointmentToastError,
  appointmentToastSuccess,
} from "../../utils/appointmentToast.jsx";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const DetailSkeleton = () => (
  <div className="p-6 max-w-2xl mx-auto space-y-6 animate-fade-in">
    <div className="skeleton w-16 h-6 rounded-md" />
    <div className="skeleton w-full h-[280px]" />
    <div className="skeleton w-full h-[150px]" />
  </div>
);

export default function CustomerAppointmentDetail() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { selected, loading, paymentLoading } = useSelector((s) => s.appointments);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelPreviewLoading, setCancelPreviewLoading] = useState(false);
  const [cancelPreviewData, setCancelPreviewData] = useState(null);

  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleSlot, setRescheduleSlot] = useState("");
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);

  const [showDispute, setShowDispute] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [isDisputing, setIsDisputing] = useState(false);

  useEffect(() => {
    dispatch(fetchAppointmentById(id));
  }, [dispatch, id]);

  const handleShowCancel = async () => {
    setShowCancel(true);
    setCancelPreviewLoading(true);
    setCancelPreviewData(null);
    try {
      const { fetchCancelPreview } = await import("../../store/appointmentSlice");
      const res = await dispatch(fetchCancelPreview(id));
      if (res.meta.requestStatus === "fulfilled") {
        setCancelPreviewData(res.payload?.data);
      }
    } catch (err) {
      console.error("Failed to load cancel preview", err);
    } finally {
      setCancelPreviewLoading(false);
    }
  };

  const handleCancel = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    const res = await dispatch(cancelAppointment({ id, reason: cancelReason }));
    if (res.meta.requestStatus === "fulfilled") {
      appointmentToastSuccess("Appointment cancelled");
      dispatch(fetchAppointmentById(id));
      window.dispatchEvent(new CustomEvent("notifications-refresh"));
    } else {
      appointmentToastError(res.payload?.message || "Cancel failed");
    }
    setShowCancel(false);
    setIsCancelling(false);
  };

  const handleRaiseDispute = async () => {
    if (!disputeReason.trim()) return appointmentToastError("Reason is required");
    setIsDisputing(true);
    try {
      const { raiseDisputeAPI } = await import("../../services/apiService");
      await raiseDisputeAPI({ appointment_id: id, reason: disputeReason });
      appointmentToastSuccess("Dispute raised successfully!");
      dispatch(fetchAppointmentById(id));
      setShowDispute(false);
      setDisputeReason("");
    } catch (err) {
      appointmentToastError(err.response?.data?.message || "Failed to submit dispute");
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
      const res = await getAvailableSlotsAPI(selected.provider_id, dateStr);
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
      appointmentToastError("Please select a date and time slot.");
      return;
    }
    setIsRescheduling(true);
    try {
      const { rescheduleAppointment } = await import("../../store/appointmentSlice");
      const res = await dispatch(rescheduleAppointment({
        id: selected.id,
        appointment_date: rescheduleDate,
        time_slot: rescheduleSlot
      }));
      if (res.meta.requestStatus === "fulfilled") {
        appointmentToastSuccess("Reschedule request sent to provider!");
        dispatch(fetchAppointmentById(id));
        setShowReschedule(false);
      } else {
        appointmentToastError(res.payload?.message || "Failed to request reschedule");
      }
    } catch (err) {
      appointmentToastError("An error occurred");
    } finally {
      setIsRescheduling(false);
    }
  };

  const handleRespondReschedule = async (reqId, action) => {
    try {
      const { respondRescheduleAppointment } = await import("../../store/appointmentSlice");
      const res = await dispatch(respondRescheduleAppointment({ requestId: reqId, action }));
      if (res.meta.requestStatus === "fulfilled") {
        appointmentToastSuccess(`Reschedule request ${action}`);
        dispatch(fetchAppointmentById(id));
      } else {
        appointmentToastError(res.payload?.message || "Failed to respond");
      }
    } catch (err) {
      appointmentToastError("An error occurred");
    }
  };

  const handlePayment = async () => {
    const orderRes = await dispatch(createPaymentOrder(id));
    if (!createPaymentOrder.fulfilled.match(orderRes)) {
      appointmentToastError(orderRes.payload?.message || "Failed to create payment order");
      return;
    }
    const orderData = orderRes.payload?.data;
    if (!orderData?.razorpay_order_id) {
      appointmentToastError("Invalid payment order response");
      return;
    }

    if (!window.Razorpay || !orderData.razorpay_key_id) {
      appointmentToastError("Payment gateway not loaded. Refresh and try again.");
      return;
    }

    const options = {
      key: orderData.razorpay_key_id,
      amount: orderData.amount,
      currency: "INR",
      name: "Schedex",
      description: "Complete your booking payment",
      order_id: orderData.razorpay_order_id,
      handler: async (response) => {
        const verifyRes = await dispatch(verifyPayment({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          appointment_id: id,
        }));
        if (verifyPayment.fulfilled.match(verifyRes)) {
          appointmentToastSuccess("Payment successful!");
          dispatch(fetchAppointmentById(id));
        } else {
          // No failure toast here; bell notifications handle payment failure updates.
        }
      },
      modal: {
        ondismiss: () => {
          // No failure toast here; bell notifications handle payment cancellation updates.
        }
      }
    };

    const rzp = new window.Razorpay(options);
    rzp.on("payment.failed", (response) => {
      // No failure toast here; bell notifications handle payment failure updates.
    });
    rzp.open();
  };

  if (loading || !selected) return <DetailSkeleton />;
  const appt = selected;

  return (
    <div className="p-6 max-w-2xl mx-auto animate-fade-in space-y-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-faint hover:text-foreground transition-all mb-4 group cursor-pointer">
        <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" /> Back
      </button>

      <Card variant="glass" className="p-6">
        <CardContent className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">Appointment Detail</h1>
              <p className="text-xs text-text-faint font-mono mt-0.5">ID: #{appt.id?.slice(0, 8)}</p>
            </div>
            <StatusBadge status={appt.status} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="border border-border/40 bg-surface-1/40 p-4 rounded-xl">
              <CardContent className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-faint">Provider</p>
                <p className="font-semibold text-sm text-foreground">{appt.provider?.user?.full_name}</p>
                <p className="text-xs text-text-muted">{appt.provider?.specialization}</p>
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

          {appt.consultation_fee_snapshot > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border" style={{
              background: appt.is_paid ? "rgba(34, 197, 94, 0.08)" : "rgba(245, 158, 11, 0.08)",
              borderColor: appt.is_paid ? "rgba(34, 197, 94, 0.15)" : "rgba(245, 158, 11, 0.15)"
            }}>
              <div className="flex items-center gap-2.5">
                <CreditCard size={16} className={appt.is_paid ? "text-success" : "text-warning"} />
                <span className="text-sm font-semibold" style={{ color: appt.is_paid ? "var(--color-success)" : "var(--color-warning)" }}>
                  {appt.is_paid ? `Paid ₹${appt.consultation_fee_snapshot}` : `₹${appt.consultation_fee_snapshot} (unpaid)`}
                </span>
              </div>
              {!appt.is_paid && appt.status !== "cancelled" && (
                <Button 
                  onClick={handlePayment} 
                  disabled={paymentLoading} 
                  size="sm"
                  className="w-full sm:w-auto text-xs font-bold gap-1 cursor-pointer bg-primary text-white hover:bg-primary/95"
                >
                  <PayIcon size={13} /> {paymentLoading ? "Processing..." : "Pay Now"}
                </Button>
              )}
            </div>
          )}

          {appt.status === "cancelled" && appt.is_paid && appt.consultation_fee_snapshot > 0 && (
            <div className="space-y-2 p-4 bg-muted/20 border border-border/40 rounded-xl">
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-faint">Refund Summary</p>
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Gross Amount Paid:</span>
                <span className="font-semibold text-foreground">₹{appt.consultation_fee_snapshot}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Cancellation Penalty ({appt.penalty_reason || "None"}):</span>
                <span className="font-semibold text-rose-500">₹{appt.penalty_fee_amount}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-border/20 font-bold">
                <span className="text-foreground">Total Refund Initiated:</span>
                <span className="text-emerald-500">₹{(appt.consultation_fee_snapshot - appt.penalty_fee_amount).toFixed(2)}</span>
              </div>
              <p className="text-[10px] text-text-faint italic pt-1">
                Note: Refunds are automatically processed back to the original Razorpay payment source.
              </p>
            </div>
          )}

          {appt.notes && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-faint">Notes</p>
              <p className="text-sm text-text-muted leading-relaxed">{appt.notes}</p>
            </div>
          )}

          {appt.cancellation_reason && (
            <div className="space-y-1 p-3 bg-error/5 border border-error/15 rounded-lg">
              <p className="text-[10px] font-bold uppercase tracking-wider text-error">Cancellation Reason</p>
              <p className="text-xs text-error">{appt.cancellation_reason}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-3 mt-2">
            {["pending", "confirmed"].includes(appt.status) && (
              <>
                <Button onClick={handleShowCancel} variant="destructive" className="w-full sm:w-auto h-9 text-xs font-semibold uppercase tracking-wider gap-1.5 cursor-pointer">
                  <X size={14} /> Cancel Appointment
                </Button>
                <Button onClick={() => setShowReschedule(true)} variant="outline" className="w-full sm:w-auto h-9 text-xs font-semibold uppercase tracking-wider gap-1.5 cursor-pointer text-primary border-primary hover:bg-primary/10">
                  <Clock size={14} /> Reschedule
                </Button>
              </>
            )}

            {["completed", "confirmed"].includes(appt.status) && appt.is_paid && (
              <Button onClick={() => setShowDispute(true)} variant="outline" className="w-full sm:w-auto h-9 text-xs font-semibold uppercase tracking-wider gap-1.5 cursor-pointer text-warning border-warning hover:bg-warning/10">
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
                  {req.status === "pending" && req.requested_by === "provider" && (
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

      {/* Status History */}
      {appt.history?.length > 0 && (
        <Card variant="glass" className="p-5">
          <CardContent className="space-y-4">
            <h2 className="font-bold text-sm tracking-tight text-foreground uppercase tracking-wider text-[10px] text-text-faint">Status History</h2>
            <div className="flex flex-col gap-3">
              {appt.history.map((h) => (
                <div key={h.id} className="flex items-start gap-3 text-xs leading-normal">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                  <span className="text-text-muted font-medium">{h.notes || `${h.previous_status} → ${h.new_status}`}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cancel Modal */}
      <Dialog open={showCancel} onOpenChange={setShowCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Appointment</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this booking? This slot will be released back to the expert's availability queue.
            </DialogDescription>
          </DialogHeader>

          {cancelPreviewLoading ? (
            <div className="py-6 text-center text-sm text-text-muted">Loading cancellation policy details...</div>
          ) : cancelPreviewData ? (
            <div className="space-y-3 bg-muted/20 p-4 rounded-xl border border-border/40">
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Appointment Fee:</span>
                <span className="font-semibold">₹{cancelPreviewData.base_fee}</span>
              </div>
              
              {cancelPreviewData.is_paid ? (
                <>
                  <div className="flex justify-between text-xs">
                    <span className="text-text-muted">Cancellation Penalty:</span>
                    <span className="font-semibold text-rose-500">₹{cancelPreviewData.penalty_amount}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t font-bold">
                    <span>Refund Amount:</span>
                    <span className={cancelPreviewData.refund_amount > 0 ? "text-emerald-500" : "text-rose-500"}>
                      ₹{cancelPreviewData.refund_amount}
                    </span>
                  </div>
                  {cancelPreviewData.penalty_amount > 0 && (
                    <p className="text-[10px] text-text-muted italic pt-1">
                      A late cancellation penalty has been applied as per the provider's policy.
                    </p>
                  )}
                </>
              ) : (
                <div className="flex justify-between text-sm pt-2 border-t font-bold">
                  <span>Refund Amount:</span>
                  <span className="text-emerald-500">Not Applicable (Unpaid)</span>
                </div>
              )}
            </div>
          ) : null}

          <textarea
            className="w-full resize-none rounded-lg border border-border-light bg-surface-1/60 text-foreground transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none p-3 placeholder:text-text-faint/60 text-sm"
            rows={3}
            placeholder="Reason for cancellation (optional)"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />

          <DialogFooter>
            <Button onClick={() => setShowCancel(false)} variant="outline" className="w-full sm:w-auto cursor-pointer">
              Keep Booking
            </Button>
            <Button onClick={handleCancel} disabled={cancelPreviewLoading} className="w-full sm:w-auto bg-destructive text-white hover:bg-destructive/80 cursor-pointer">
              Confirm Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispute Modal */}
      <Dialog open={showDispute} onOpenChange={setShowDispute}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Raise Appointment Dispute</DialogTitle>
            <DialogDescription>
              Describe the issue you experienced. Our operations team will review this claim and decide on payouts or full refunds.
            </DialogDescription>
          </DialogHeader>

          <textarea
            className="w-full resize-none rounded-lg border border-border-light bg-surface-1/60 text-foreground transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none p-3 placeholder:text-text-faint/60 text-sm"
            rows={4}
            placeholder="Describe your dispute details (e.g. expert did not show up, service was not rendered properly)..."
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
              Propose a new time for your appointment. Your provider will need to approve this request.
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
