import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  Star,
  MapPin,
  Calendar as CalendarIcon,
  Clock,
  Briefcase,
  ArrowLeft,
  ShieldCheck,
  Wallet,
  CheckCircle2,
  Users,
  Building2,
  AlertCircle,
} from "lucide-react";
import { fetchProviderById } from "../../store/providerSlice";
import {
  getAvailableSlotsAPI,
  getProviderBookingConfigAPI,
  releaseWaitlistLockAPI,
  joinProviderWaitlistAPI,
  getProviderWaitlistStatsAPI,
} from "../../services/apiService";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { DAY_NAMES } from "../../utils/constants";
import toast from "react-hot-toast";
import { getProviderPortrait } from "../../utils/portraits";

export default function ProviderDetail() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = location;
  const { selected: provider, loading } = useSelector((s) => s.providers);
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [waitlistEntryId, setWaitlistEntryId] = useState("");
  const [passingLock, setPassingLock] = useState(false);
  const [bookingConfig, setBookingConfig] = useState({
    offerings: [],
    intake_form: null,
    packages: [],
  });

  // Waitlist states
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [joinedWaitlist, setJoinedWaitlist] = useState(false);
  const [hasOpenLock, setHasOpenLock] = useState(false);

  useEffect(() => {
    dispatch(fetchProviderById(id));
  }, [dispatch, id]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const queryDate = params.get("waitlistDate");
    const queryWaitlistEntryId = params.get("waitlistEntryId");
    const fromWaitlist =
      state?.fromWaitlist || params.get("fromWaitlist") === "true";
    const nextDate = state?.selectedDate || queryDate || "";

    if (fromWaitlist && nextDate) {
      setSelectedDate(nextDate);
    }

    setHasOpenLock(fromWaitlist);
    setWaitlistEntryId(state?.waitlistEntryId || queryWaitlistEntryId || "");
  }, [location.search, state]);

  useEffect(() => {
    getProviderBookingConfigAPI(id)
      .then((res) =>
        setBookingConfig(
          res.data?.data || { offerings: [], intake_form: null, packages: [] },
        ),
      )
      .catch(() =>
        setBookingConfig({ offerings: [], intake_form: null, packages: [] }),
      );
  }, [id]);

  // Fetch current provider waitlist count (for display before user joins)
  useEffect(() => {
    let mounted = true;
    getProviderWaitlistStatsAPI(id)
      .then((res) => {
        if (!mounted) return;
        const waitingCount = res.data?.data?.waiting_count;
        if (Number.isFinite(waitingCount)) {
          setWaitlistCount(waitingCount);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [id]);

  // Auto-fetch slots when date is set from waitlist
  useEffect(() => {
    if (selectedDate) {
      fetchSlots(selectedDate);
    }
  }, [selectedDate]);

  const fetchSlots = async (date) => {
    setSelectedDate(date);
    setSlotsLoading(true);
    try {
      const res = await getAvailableSlotsAPI(id, date);
      // backend now returns [{time_slot, slot_type}] — handle both old string[] and new dict[]
      const raw = res.data?.data?.available_slots || [];
      const normalised = raw.map((s) =>
        typeof s === "string" ? { time_slot: s, slot_type: "recurring" } : s
      );
      setSlots(normalised);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleBookSlot = (slotObj) => {
    const timeSlot = typeof slotObj === "string" ? slotObj : slotObj.time_slot;
    navigate(`/customer/book/${id}`, {
      state: {
        date: selectedDate,
        timeSlot,
        provider,
        bookingConfig,
        waitlistEntryId,
        fromWaitlist: Boolean(state?.fromWaitlist || waitlistEntryId),
      },
    });
  };

  const handlePassLock = async () => {
    if (!waitlistEntryId) {
      toast.error("No lock found to pass");
      return;
    }

    try {
      setPassingLock(true);
      const res = await releaseWaitlistLockAPI(waitlistEntryId);
      toast.success(res.data?.message || "Lock passed");
      navigate("/customer/waitlist");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to pass lock");
    } finally {
      setPassingLock(false);
    }
  };

  const handleWaitlist = async () => {
    try {
      const res = await joinProviderWaitlistAPI(id, {
        preferred_date: selectedDate || null,
      });

      // Get actual queue position from response
      const position = res.data?.data?.waitlist_entry?.queue_position || 1;
      setWaitlistCount(position);
      setJoinedWaitlist(true);
      toast.success("Successfully added to waitlist!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Unable to join waitlist");
    }
  };

  const handleDateSelect = (date) => {
    if (!date) return;
    const formatted = format(date, "yyyy-MM-dd");
    fetchSlots(formatted);
  };

  const formatSelectedDate = (dateStr) => {
    if (!dateStr) return "Pick a date";
    return format(parseISO(dateStr), "PPP");
  };

  if (loading || !provider) {
    return (
      <div className="p-8 max-w-6xl mx-auto animate-pulse min-h-screen text-foreground relative">
        <div className="skeleton w-16 h-8 rounded-lg mb-6" />

        <div className="grid md:grid-cols-3 gap-6">
          {/* Left Sidebar Skeleton */}
          <div className="md:col-span-1 space-y-4">
            <Card className="border-border bg-card/45">
              <CardContent className="p-6 text-center flex flex-col items-center">
                <div className="skeleton w-20 h-20 rounded-2xl mb-4" />
                <div className="skeleton w-[160px] h-[18px] mb-2" />
                <div className="skeleton w-[100px] h-[14px] mb-3" />
                <div className="skeleton w-24 h-6 rounded-full mb-3" />
                <div className="skeleton w-16 h-4 mb-5" />
                <div className="space-y-2 w-full">
                  <div className="skeleton w-full h-4" />
                  <div className="skeleton w-full h-4" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-border bg-card/45">
              <CardContent className="p-5">
                <div className="skeleton w-[140px] h-[14px] mb-4" />
                <div className="space-y-2">
                  <div className="skeleton w-full h-10 rounded-xl" />
                  <div className="skeleton w-full h-10 rounded-xl" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Main Content Skeleton */}
          <div className="md:col-span-2 space-y-4">
            <Card className="border-border bg-card/45">
              <CardContent className="p-5">
                <div className="skeleton w-16 h-5 mb-2" />
                <div className="skeleton w-full h-16" />
              </CardContent>
            </Card>
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="border-border bg-card/45 p-4 h-16">
                  <div className="skeleton w-full h-full" />
                </Card>
              ))}
            </div>
            <Card className="border-border bg-card/45">
              <CardContent className="p-5">
                <div className="skeleton w-[140px] h-[18px] mb-4" />
                <div className="grid grid-cols-7 gap-2 mb-4">
                  {[...Array(7)].map((_, i) => (
                    <div key={i} className="skeleton h-14 rounded-xl" />
                  ))}
                </div>
                <div className="skeleton w-full h-12 rounded-lg" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];
  const quickDates = Array.from({ length: 7 }, (_, index) => {
    const d = new Date();
    d.setDate(d.getDate() + index + 1);
    return {
      value: d.toISOString().split("T")[0],
      label: d.toLocaleDateString("en-IN", { weekday: "short" }),
      day: d.toLocaleDateString("en-IN", { day: "2-digit" }),
    };
  });
  const activeSlots = (provider.availability_slots || []).filter(
    (slot) => slot.is_active,
  );

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fade-in text-foreground min-h-screen relative">
      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-xs font-semibold mb-6 h-9 px-3 border border-border/40 hover:bg-muted"
      >
        <ArrowLeft size={16} /> Back
      </Button>

      {/* Waitlist Open Lock Banner */}
      {hasOpenLock && (
        <Card
          variant="glass"
          className="p-4 mb-6 border-l-4 border-l-primary bg-primary/5"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2
              size={20}
              className="text-primary mt-0.5 flex-shrink-0"
            />
            <div className="flex-1">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <span>🎉 Slot Available Now!</span>
              </h3>
              <p className="text-xs text-text-muted mt-1">
                A slot has opened for your preferred date:{" "}
                <strong>{formatSelectedDate(selectedDate)}</strong>. Claim it
                now before it expires!
              </p>
              {waitlistEntryId && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    onClick={handlePassLock}
                    disabled={passingLock}
                    variant="outline"
                    className="h-9 text-xs font-bold"
                  >
                    {passingLock ? "Passing..." : "Pass Lock"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Provider Info Sidebar */}
        <div className="md:col-span-1 space-y-4">
          <Card className="border-border bg-card">
            <CardContent className="p-6 text-center flex flex-col items-center">
              <Avatar className="w-20 h-20 mb-4 rounded-2xl overflow-hidden border border-white/10 shadow-sm">
                <img
                  src={getProviderPortrait(
                    provider.id,
                    provider.specialization,
                    provider.user?.full_name,
                  )}
                  className="w-full h-full object-cover"
                  alt={provider.user?.full_name}
                />
              </Avatar>

              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {provider.user?.full_name}
              </h1>
              <p className="text-sm font-semibold text-primary mt-1">
                {provider.specialization}
              </p>

              {provider.is_verified && (
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/10 border border-success/20 text-success text-[10px] font-bold uppercase tracking-wider">
                  <ShieldCheck size={13} /> Verified Expert
                </div>
              )}

              <div className="flex justify-center items-center gap-1 mt-3">
                <Star size={14} className="fill-warning text-warning" />
                <span className="font-extrabold text-sm text-foreground">
                  {parseFloat(provider.avg_rating || 0).toFixed(1)}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({provider.total_reviews} reviews)
                </span>
              </div>

              <div className="mt-5 flex flex-col gap-2 text-xs text-muted-foreground w-full font-medium border-t border-border pt-4">
                {provider.location && (
                  <span className="flex items-center gap-2 justify-center">
                    <MapPin size={14} className="text-muted-foreground/60" />
                    {provider.location}
                  </span>
                )}
                {provider.experience_years > 0 && (
                  <span className="flex items-center gap-2 justify-center">
                    <Briefcase size={14} className="text-muted-foreground/60" />
                    {provider.experience_years} Years Experience
                  </span>
                )}
                {provider.organization && (
                  <span className="flex items-center gap-2 justify-center text-primary font-semibold mt-2 pt-2 border-t border-border/40">
                    <Building2 size={14} className="text-primary" />
                    {provider.organization.name}
                  </span>
                )}
              </div>

              <div className="mt-5 p-4 rounded-xl bg-success/5 border border-success/20 text-center w-full">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Consultation Fee
                </p>
                <p className="text-2xl font-bold mt-1 text-success">
                  ₹{
                    bookingConfig.offerings?.find(o => o.title === "Standard Session")?.price
                    || provider.consultation_fee
                    || 199
                  }
                </p>
                {bookingConfig.offerings?.length > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1">Standard Session</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-4">
                Weekly Schedule
              </h3>
              <div className="space-y-2">
                {activeSlots.length > 0 ? (
                  activeSlots.map((slot) => {
                    const isSpecific = slot.specific_date != null;
                    const label = isSpecific
                      ? new Date(slot.specific_date).toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" })
                      : DAY_NAMES[slot.day_of_week] ?? "—";
                    return (
                      <div
                        key={slot.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          isSpecific
                            ? "bg-accent/5 border-accent/30"
                            : "bg-background border-border"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">{label}</span>
                          {isSpecific && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/25">
                              One-off
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">
                          {String(slot.start_time).slice(0, 5)} – {String(slot.end_time).slice(0, 5)}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-muted-foreground">No hours configured.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Waitlist Position Tracker widget */}
          <Card className="border-border bg-card overflow-hidden">
            <CardContent className="p-5 relative">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                  <Users size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Provider Waitlist
                  </h3>
                  <p className="text-sm font-extrabold text-foreground mt-0.5">
                    {joinedWaitlist
                      ? "You are on the list! 🎉"
                      : "Highly Demanded Expert"}
                  </p>
                </div>
              </div>

              <div className="mt-4 p-3 rounded-lg bg-background border border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">
                  Position Queue
                </span>
                <span className="text-xs font-bold text-foreground font-mono bg-surface-1 border border-border px-2 py-0.5 rounded-full">
                  {joinedWaitlist
                    ? `Place #${waitlistCount}`
                    : `${waitlistCount} Waiting`}
                </span>
              </div>

              {!joinedWaitlist ? (
                <Button
                  onClick={handleWaitlist}
                  className="w-full mt-4 h-9 text-xs font-bold uppercase tracking-wider bg-accent/10 border-accent/20 hover:bg-accent text-accent hover:text-accent-foreground transition-all cursor-pointer"
                  variant="outline"
                >
                  Join Waiting Queue
                </Button>
              ) : (
                <div className="mt-4 p-3 rounded-lg bg-success/5 border border-success/20 text-center">
                  <p className="text-[10px] text-success font-bold uppercase tracking-wider leading-relaxed">
                    We will notify you immediately once a conflict slot frees
                    up!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Booking and Details Panel */}
        <div className="md:col-span-2 flex flex-col gap-4">
          {provider.profile_description && (
            <Card className="border-border bg-card">
              <CardContent className="p-5">
                <h2 className="font-bold text-base text-foreground mb-2">
                  About
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {provider.profile_description}
                </p>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="border-border bg-card">
              <CardContent className="p-4 flex items-center gap-3">
                <CheckCircle2 className="text-success shrink-0" size={18} />
                <div>
                  <p className="text-xs font-bold text-foreground">
                    Instant Slot Vetting
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Live conflict checks verify every slot
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="p-4 flex items-center gap-3">
                <Wallet className="text-warning shrink-0" size={18} />
                <div>
                  <p className="text-xs font-bold text-foreground">
                    Fee Locked
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Original fee is held at booking time
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="p-4 flex items-center gap-3">
                <Clock className="text-primary shrink-0" size={18} />
                <div>
                  <p className="text-xs font-bold text-foreground">
                    Flexible Policies
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Reschedule or cancel inline easily
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border bg-card">
            <CardContent className="p-5 space-y-6">
              <h2 className="font-bold text-base text-foreground flex items-center gap-2">
                <CalendarIcon size={18} className="text-primary" /> Book an
                Appointment
              </h2>

              {/* Quick Select Buttons */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground ml-0.5">
                  Quick Date Selection
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {quickDates.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => fetchSlots(item.value)}
                      className={cn(
                        "p-2.5 rounded-lg border text-center transition-all cursor-pointer",
                        selectedDate === item.value
                          ? "bg-primary/10 border-primary text-primary font-bold"
                          : "bg-background border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <span className="block text-[8px] font-bold uppercase tracking-wider">
                        {item.label}
                      </span>
                      <span className="block text-sm font-extrabold mt-0.5">
                        {item.day}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Full Date Picker Popover */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground ml-0.5">
                  Select Date
                </label>
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full h-12 bg-background border-border pl-4 justify-start text-left font-medium",
                          !selectedDate && "text-muted-foreground",
                        )}
                      />
                    }
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {selectedDate ? (
                      formatSelectedDate(selectedDate)
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-0 border-border bg-popover"
                    align="start"
                  >
                    <Calendar
                      mode="single"
                      selected={
                        selectedDate ? new Date(selectedDate) : undefined
                      }
                      onSelect={handleDateSelect}
                      disabled={(date) => date < new Date(minDate)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {selectedDate && (
                <div className="mt-4 space-y-3 pt-4 border-t border-border">
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground ml-0.5">
                    Available Time Slots
                  </label>
                  {slotsLoading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="skeleton h-10 rounded-lg" />
                      ))}
                    </div>
                  ) : slots.length > 0 ? (
                    <div>
                      {/* Legend */}
                      {slots.some(s => s.slot_type === "specific_date") && (
                        <div className="flex items-center gap-4 mb-3 text-[10px] font-bold uppercase tracking-wider">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-primary/70 inline-block" />
                            Recurring
                          </span>
                          <span className="flex items-center gap-1.5 text-orange-500 dark:text-orange-300">
                            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />
                            Special date
                          </span>
                        </div>
                      )}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {slots.map((slotObj) => {
                          const isSpecific = slotObj.slot_type === "specific_date";
                          return (
                            <Button
                              key={slotObj.time_slot}
                              variant="outline"
                              onClick={() => handleBookSlot(slotObj)}
                              className={`h-10 text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 ${
                                isSpecific
                                  ? "border-orange-400/60 bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-400/40 dark:hover:bg-orange-500 dark:hover:text-white"
                                  : "border-primary/30 bg-primary/5 text-primary hover:bg-primary hover:text-primary-foreground"
                              }`}
                            >
                              <Clock size={12} />
                              {slotObj.time_slot}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 p-4 rounded-xl bg-muted/30 border border-border text-center">
                      <p className="text-sm text-muted-foreground">
                        No available slots on this date.
                      </p>
                      <Button
                        onClick={handleWaitlist}
                        className="px-5 py-2 text-xs font-bold uppercase tracking-wider"
                      >
                        Join Waitlist
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
