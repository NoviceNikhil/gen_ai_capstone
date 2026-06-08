import { useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  Calendar,
  Clock,
  CreditCard,
  FileText,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Star,
} from "lucide-react";
import {
  bookAppointment,
  bookOrJoinWaitlist,
  cancelAppointment,
  createPaymentOrder,
  verifyPayment,
  fetchMyAppointments,
} from "../../store/appointmentSlice";
import {
  appointmentToastError,
  appointmentToastSuccess,
} from "../../utils/appointmentToast.jsx";
import {
  purchasePackageAPI,
  claimWaitlistSlotAPI,
} from "../../services/apiService";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function BookAppointment() {
  const { providerId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { bookingLoading, paymentLoading } = useSelector((s) => s.appointments);

  const [notes, setNotes] = useState("");
  const [bookedApptId, setBookedApptId] = useState(null);
  const [bookingType, setBookingType] = useState(null); // "appointment" or "waitlist"
  const [step, setStep] = useState("confirm"); // confirm | payment
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [claimingWaitlist, setClaimingWaitlist] = useState(false);

  // Proactive payment order pre-fetching to prevent popup blocking
  const [orderData, setOrderData] = useState(null);
  const [orderLoading, setOrderLoading] = useState(false);

  const provider = state?.provider;
  const bookingConfig = state?.bookingConfig || {
    offerings: [],
    intake_form: null,
    packages: [],
  };
  const date = state?.date;
  const timeSlot = state?.timeSlot;
  const [selectedOfferingId, setSelectedOfferingId] = useState(
    bookingConfig.offerings?.[0]?.id || "",
  );
  const [intakeAnswers, setIntakeAnswers] = useState({});
  const [payableAmount, setPayableAmount] = useState(0);
  const selectedOffering = bookingConfig.offerings?.find(
    (o) => o.id === selectedOfferingId,
  );
  const fee = parseFloat(
    selectedOffering ? selectedOffering.price : provider?.consultation_fee || 0,
  );

  const handleBook = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Check if this is a waitlist claim operation
      if (state?.waitlistEntryId && state?.fromWaitlist) {
        setClaimingWaitlist(true);
        const claimData = {
          provider_id: providerId,
          appointment_date: date,
          time_slot: timeSlot,
          category_id: state?.provider?.category_id,
          notes: notes || "Claimed from waitlist",
          offering_id: selectedOfferingId || null,
          intake_answers: intakeAnswers,
        };

        const res = await claimWaitlistSlotAPI(
          state.waitlistEntryId,
          claimData,
        );

        if (res.data?.data?.appointment) {
          const apptId = res.data.data.appointment.id;
          setBookedApptId(apptId);
          setBookingType("appointment");

          const backendFee = parseFloat(
            res.data.data.appointment.consultation_fee_snapshot || 0,
          );
          setPayableAmount(backendFee);

          if (backendFee > 0) {
            setStep("payment");
            // Create payment order
            dispatch(createPaymentOrder(apptId))
              .then((orderRes) => {
                if (createPaymentOrder.fulfilled.match(orderRes)) {
                  setOrderData(orderRes.payload?.data);
                } else {
                  dispatch(
                    cancelAppointment({
                      id: apptId,
                      reason: "Payment order failed",
                    }),
                  );
                  appointmentToastError(
                    orderRes.payload?.message ||
                      "Payment could not be initialized. Reservation cancelled.",
                  );
                  navigate("/customer/waitlist");
                }
                window.dispatchEvent(new CustomEvent("notifications-refresh"));
                setClaimingWaitlist(false);
              })
              .catch(() => {
                dispatch(
                  cancelAppointment({
                    id: apptId,
                    reason: "Payment order failed",
                  }),
                );
                appointmentToastError(
                  "Payment could not be initialized. Reservation cancelled.",
                );
                setClaimingWaitlist(false);
                navigate("/customer/waitlist");
                window.dispatchEvent(new CustomEvent("notifications-refresh"));
              });
          } else {
            appointmentToastSuccess("Waitlist slot claimed successfully!");
            dispatch(fetchMyAppointments({ limit: 1000 }));
            setClaimingWaitlist(false);
            setTimeout(() => navigate("/customer/appointments"), 500);
            window.dispatchEvent(new CustomEvent("notifications-refresh"));
          }
        }
        return;
      }

      // Regular booking flow (not waitlist claim)
      const res = await dispatch(
        bookOrJoinWaitlist({
          provider_id: providerId,
          appointment_date: date,
          time_slot: timeSlot,
          notes,
          offering_id: selectedOfferingId || null,
          intake_answers: intakeAnswers,
        }),
      );

      if (bookOrJoinWaitlist.fulfilled.match(res)) {
        const responseType = res.payload?.data?.type;
        const responseData = res.payload?.data;

        if (responseType === "waitlist") {
          // User was added to waitlist
          appointmentToastSuccess(
            "Slot full! You've been added to the waitlist. We'll notify you when a slot opens.",
          );
          dispatch(fetchMyAppointments({ limit: 1000 }));
          setTimeout(() => navigate("/customer/appointments"), 500);
          window.dispatchEvent(new CustomEvent("notifications-refresh"));
        } else if (responseType === "appointment") {
          // User got an appointment
          const apptId = responseData?.appointment?.id;
          setBookedApptId(apptId);
          setBookingType("appointment");
          const backendFee = parseFloat(
            responseData?.appointment?.consultation_fee_snapshot || 0,
          );
          setPayableAmount(backendFee);
          if (backendFee > 0) {
            setStep("payment");
            // Proactively fetch payment order immediately to prevent async popup blocking on final click
            setOrderLoading(true);
            dispatch(createPaymentOrder(apptId))
              .then((orderRes) => {
                if (createPaymentOrder.fulfilled.match(orderRes)) {
                  setOrderData(orderRes.payload?.data);
                } else {
                  dispatch(
                    cancelAppointment({
                      id: apptId,
                      reason: "Payment order failed",
                    }),
                  );
                  appointmentToastError(
                    orderRes.payload?.message ||
                      "Payment could not be initialized. Reservation cancelled.",
                  );
                  navigate("/customer/providers");
                }
                setOrderLoading(false);
                window.dispatchEvent(new CustomEvent("notifications-refresh"));
              })
              .catch(() => {
                dispatch(
                  cancelAppointment({
                    id: apptId,
                    reason: "Payment order failed",
                  }),
                );
                appointmentToastError(
                  "Payment could not be initialized. Reservation cancelled.",
                );
                setOrderLoading(false);
                navigate("/customer/providers");
                window.dispatchEvent(new CustomEvent("notifications-refresh"));
              });
          } else {
            appointmentToastSuccess("Appointment booked successfully!");
            dispatch(fetchMyAppointments({ limit: 1000 }));
            setTimeout(() => navigate("/customer/appointments"), 500);
            window.dispatchEvent(new CustomEvent("notifications-refresh"));
          }
        }
      } else {
        appointmentToastError(res.payload?.message || "Booking failed");
      }
    } catch (error) {
      appointmentToastError(error.response?.data?.message || "Booking failed");
    } finally {
      setIsSubmitting(false);
      setClaimingWaitlist(false);
    }
  };

  const handlePayment = async () => {
    if (!bookedApptId) {
      appointmentToastError("Please reserve the slot first");
      return;
    }

    let activeOrderData = orderData;
    if (!activeOrderData) {
      setOrderLoading(true);
      const orderRes = await dispatch(createPaymentOrder(bookedApptId));
      if (createPaymentOrder.fulfilled.match(orderRes)) {
        activeOrderData = orderRes.payload?.data;
        setOrderData(activeOrderData);
      }
      setOrderLoading(false);
    }

    if (!activeOrderData || !activeOrderData.razorpay_order_id) {
      await dispatch(
        cancelAppointment({
          id: bookedApptId,
          reason: "Payment initialization failed",
        }),
      );
      appointmentToastError("Failed to initialize payment gateway. Please try again.");
      navigate("/customer/providers");
      return;
    }

    if (!window.Razorpay) {
      appointmentToastError("Payment gateway not loaded. Refresh and try again.");
      return;
    }

    const options = {
      key: activeOrderData.razorpay_key_id,
      amount: activeOrderData.amount,
      currency: "INR",
      name: "Schedex",
      description: `Consultation with ${provider?.user?.full_name}`,
      order_id: activeOrderData.razorpay_order_id,
      handler: async (response) => {
        const verifyRes = await dispatch(
          verifyPayment({
            appointment_id: bookedApptId,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          }),
        );
        if (verifyPayment.fulfilled.match(verifyRes)) {
          appointmentToastSuccess("Payment successful!");
          // Refresh appointment list so new booking appears immediately
          dispatch(fetchMyAppointments({ limit: 1000 }));
          setTimeout(() => navigate("/customer/appointments"), 100);
          window.dispatchEvent(new CustomEvent("notifications-refresh"));
        } else {
          await dispatch(
            cancelAppointment({
              id: bookedApptId,
              reason: "Payment verification failed",
            }),
          );
          navigate("/customer/providers");
          window.dispatchEvent(new CustomEvent("notifications-refresh"));
        }
      },
      modal: {
        ondismiss: () => {
          dispatch(
            cancelAppointment({
              id: bookedApptId,
              reason: "Payment checkout dismissed",
            }),
          );
          navigate("/customer/providers");
          window.dispatchEvent(new CustomEvent("notifications-refresh"));
        },
      },
      theme: { color: "hsl(241, 84%, 62%)" },
    };

    const rzp = new window.Razorpay(options);
    rzp.on("payment.failed", (response) => {
      const msg = response?.error?.description || "Payment failed";
      dispatch(cancelAppointment({ id: bookedApptId, reason: msg }));
      navigate("/customer/providers");
      window.dispatchEvent(new CustomEvent("notifications-refresh"));
    });
    rzp.open();
  };

  if (!provider || !date || !timeSlot) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center mt-20">
        <Card variant="glass" className="p-8 flex flex-col items-center">
          <AlertCircle size={48} className="text-cancelled mb-4" />
          <h2 className="text-2xl font-bold mb-2">Invalid Session</h2>
          <p className="text-text-muted mb-6">
            Please select a provider and a time slot first.
          </p>
          <Button
            onClick={() => navigate("/customer/providers")}
            size="lg"
            className="px-8 cursor-pointer"
          >
            Find Provider
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-text-faint hover:text-foreground transition-all mb-8 group cursor-pointer"
      >
        <ArrowLeft
          size={12}
          className="group-hover:-translate-x-0.5 transition-transform"
        />{" "}
        Back to Profile
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left Column: Details */}
        <div className="lg:col-span-3 space-y-6">
          <Card variant="glass" className="p-8">
            <h1 className="text-2xl font-bold tracking-tight mb-8">
              {step === "payment" ? "Complete Payment" : "Confirm Booking"}
            </h1>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-surface-1/40 border border-border/30">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Calendar size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-text-faint">
                    Date
                  </p>
                  <p className="font-semibold text-xs text-foreground truncate">
                    {new Date(date).toLocaleDateString("en-IN", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-surface-1/40 border border-border/30">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent shrink-0">
                  <Clock size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-text-faint">
                    Time Slot
                  </p>
                  <p className="font-semibold text-xs text-foreground truncate">
                    {timeSlot}
                  </p>
                </div>
              </div>
              {fee > 0 && (
                <div className="flex items-center justify-between p-4 rounded-xl bg-accent/10 border border-accent/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center text-accent shrink-0">
                      <CreditCard size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-accent/80">
                        Total Fee
                      </p>
                      <p className="font-black text-lg text-accent truncate">
                        ₹{fee}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {step === "confirm" ? (
              <div className="space-y-6">
                <div className="space-y-4">
                  {bookingConfig.offerings?.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-text-muted ml-0.5">
                        Service Type
                      </label>
                      <Select
                        value={selectedOfferingId}
                        onValueChange={setSelectedOfferingId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select offering">
                            {selectedOffering
                              ? `${selectedOffering.title} · ${selectedOffering.duration_minutes} min · ₹${selectedOffering.price}`
                              : "Select offering"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {bookingConfig.offerings.map((offering) => (
                            <SelectItem key={offering.id} value={offering.id}>
                              {offering.title} · {offering.duration_minutes} min
                              · ₹{offering.price}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {bookingConfig.intake_form?.fields?.length > 0 && (
                    <div className="space-y-3">
                      <label className="text-xs font-bold uppercase tracking-wider text-text-muted ml-0.5">
                        {bookingConfig.intake_form.title}
                      </label>
                      <div className="space-y-2">
                        {bookingConfig.intake_form.fields.map((field, idx) => (
                          <div
                            key={`${field.key || "field"}-${idx}`}
                            className="space-y-1"
                          >
                            <label className="text-xs text-text-faint font-medium ml-0.5">
                              {field.label}
                            </label>
                            <Input
                              placeholder={
                                field.label || field.key || `Field ${idx + 1}`
                              }
                              value={
                                intakeAnswers[field.key || `field_${idx}`] || ""
                              }
                              onChange={(e) =>
                                setIntakeAnswers((prev) => ({
                                  ...prev,
                                  [field.key || `field_${idx}`]: e.target.value,
                                }))
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-text-muted ml-0.5">
                      Additional Notes (Optional)
                    </label>
                    <div className="relative group">
                      <FileText
                        size={16}
                        className="absolute left-4 top-3 text-text-faint group-focus-within:text-primary transition-colors shrink-0 pointer-events-none"
                      />
                      <textarea
                        className="w-full pl-11 h-28 py-3 pr-4 resize-none rounded-lg border border-border-light bg-surface-1/60 text-foreground transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-text-faint/60 text-sm"
                        placeholder="Share any specific concerns or questions for the expert..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleBook}
                  className="w-full h-11 text-sm font-semibold uppercase tracking-wider gap-2 cursor-pointer mt-4"
                  disabled={bookingLoading || isSubmitting}
                >
                  {bookingLoading || isSubmitting
                    ? "Initializing Booking..."
                    : fee > 0
                      ? "Reserve & Pay"
                      : "Confirm Booking"}
                  <ArrowRight
                    size={16}
                    className="group-hover:translate-x-0.5 transition-transform"
                  />
                </Button>
              </div>
            ) : (
              <div className="space-y-6 animate-fade-in">
                <div className="p-4 rounded-xl bg-accent/10 border border-accent/20 flex items-center gap-3">
                  <CheckCircle2 size={20} className="text-accent shrink-0" />
                  <p className="text-xs font-medium text-accent">
                    Slot reserved! Complete payment within 10 minutes to
                    finalize.
                  </p>
                </div>
                <div className="space-y-4">
                  <Card
                    variant="glass"
                    className="p-5 border-border-light/50 shadow-sm bg-surface-1/50"
                  >
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-text-faint mb-3">
                      Cancellation & Refund Policy
                    </h3>
                    <div className="text-[11px] leading-relaxed text-text-muted space-y-1.5">
                      <p>
                        • <strong>Free Cancellation:</strong> You may cancel for
                        free up to 24 hours before the scheduled appointment.
                      </p>
                      <p>
                        • <strong>Late Cancellation:</strong> Canceling between
                        2 and 24 hours before the appointment will incur a{" "}
                        <span className="text-error font-semibold">
                          20% penalty
                        </span>{" "}
                        deducted from your refund.
                      </p>
                      <p>
                        • <strong>No Show / Last Minute:</strong> Canceling
                        within 2 hours or failing to attend will result in a{" "}
                        <span className="text-error font-semibold">
                          100% penalty
                        </span>{" "}
                        (No Refund).
                      </p>
                      <p className="mt-2 text-[10px] text-text-faint italic border-t border-border/40 pt-2">
                        By completing this booking, you explicitly agree to the
                        platform's cancellation terms. Eligible refunds are
                        processed to the original payment method within 5-7
                        business days.
                      </p>
                    </div>
                  </Card>

                  <div className="flex items-start gap-3 px-1 mb-2">
                    <input
                      type="checkbox"
                      id="terms"
                      className="mt-1 w-4 h-4 rounded border-border-light text-primary focus:ring-primary"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                    />
                    <label
                      htmlFor="terms"
                      className="text-xs text-text-muted leading-tight"
                    >
                      I agree to the{" "}
                      <span className="font-semibold text-foreground">
                        Terms and Conditions
                      </span>
                      , and acknowledge the Cancellation & Refund Policy
                      detailed above.
                    </label>
                  </div>

                  <Button
                    onClick={handlePayment}
                    className="w-full h-12 text-sm font-bold gap-2 cursor-pointer"
                    disabled={paymentLoading || orderLoading || !agreedToTerms}
                  >
                    <CreditCard size={18} />
                    {paymentLoading || orderLoading
                      ? "Contacting Gateway..."
                      : `Pay ₹${payableAmount || fee} Securely`}
                  </Button>
                </div>
                <div className="flex items-center justify-center gap-2 text-text-faint text-[10px] font-bold uppercase tracking-wider">
                  <ShieldCheck size={12} />
                  <span>Razorpay SSL Secured Checkout</span>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Expert Mini-Profile */}
        <div className="lg:col-span-2">
          <Card variant="glass" className="p-6 sticky top-28">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-text-faint mb-6">
              Expert Summary
            </h3>
            <div className="flex flex-col items-center text-center">
              <div
                className="w-20 h-20 rounded-2xl mb-4 border border-white/10 shadow-xl flex items-center justify-center text-3xl font-black text-white"
                style={{
                  background:
                    "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
                }}
              >
                {provider.user?.full_name?.[0]}
              </div>
              <h4 className="font-bold text-lg mb-0.5 text-foreground">
                {provider.user?.full_name}
              </h4>
              <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-4">
                {provider.specialization}
              </p>
              <div className="flex items-center gap-1.5 mb-6">
                <Star size={12} className="fill-pending text-pending" />
                <span className="text-xs font-bold text-foreground">
                  {parseFloat(provider.avg_rating).toFixed(1)}
                </span>
                <span className="text-xs text-text-faint">
                  • {provider.total_reviews} Reviews
                </span>
              </div>
              <div className="w-full space-y-2 border-t border-border/40 pt-4">
                <div className="flex justify-between text-xs py-1.5">
                  <span className="text-text-muted font-medium">
                    Consultation
                  </span>
                  <span className="text-foreground font-semibold">₹{fee}</span>
                </div>
                <div className="flex justify-between text-xs py-1.5">
                  <span className="text-text-muted font-medium">
                    Service Fee
                  </span>
                  <span className="text-accent font-semibold">Free</span>
                </div>
                <div className="flex justify-between text-base py-3 border-t border-border/40 mt-2">
                  <span className="font-bold text-foreground">Total</span>
                  <span className="font-bold text-primary">₹{fee}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
