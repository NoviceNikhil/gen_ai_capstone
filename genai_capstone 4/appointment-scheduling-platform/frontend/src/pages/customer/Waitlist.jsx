import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Clock,
  MapPin,
  X,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Hourglass,
} from "lucide-react";
import {
  getMyWaitlistAPI,
  leaveWaitlistAPI,
  releaseWaitlistLockAPI,
  claimWaitlistSlotAPI,
} from "../../services/apiService";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Countdown timer for lock window
function LockCountdown({ expiresAt }) {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const expiry = new Date(expiresAt);
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft("Expired");
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${minutes}m ${seconds}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const isExpired = timeLeft === "Expired";
  return (
    <p
      className={`text-xs mt-2 flex items-center gap-1 font-semibold ${isExpired ? "text-error" : "text-warning"}`}
    >
      <Hourglass size={12} />
      ⏱️ {timeLeft ? `Expires in ${timeLeft}` : "Calculating..."}
    </p>
  );
}

export default function CustomerWaitlist() {
  const navigate = useNavigate();
  const [waitlistEntries, setWaitlistEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(null);
  const [releasing, setReleasing] = useState(null);
  const [claiming, setClaiming] = useState(null);

  useEffect(() => {
    fetchWaitlist();
  }, []);

  const fetchWaitlist = async () => {
    try {
      setLoading(true);
      const response = await getMyWaitlistAPI();
      setWaitlistEntries(response.data.data.waitlist_entries || []);
    } catch (error) {
      toast.error("Failed to fetch waitlist");
      console.error("Error fetching waitlist:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveWaitlist = async (entryId) => {
    if (!window.confirm("Are you sure you want to leave this waitlist?"))
      return;

    try {
      setRemoving(entryId);
      await leaveWaitlistAPI(entryId);
      toast.success("Left waitlist");
      fetchWaitlist();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to leave waitlist");
    } finally {
      setRemoving(null);
    }
  };

  const handleReleaseLock = async (entryId) => {
    if (!window.confirm("Release this slot to the next customer in queue?"))
      return;

    try {
      setReleasing(entryId);
      const response = await releaseWaitlistLockAPI(entryId);
      toast.success(response.data.message);
      fetchWaitlist();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to release lock");
    } finally {
      setReleasing(null);
    }
  };

  const handleClaimSlot = async (entry) => {
    try {
      setClaiming(entry.id);
      const search = new URLSearchParams({
        fromWaitlist: "true",
        waitlistDate: entry.preferred_date || "",
        waitlistEntryId: entry.id,
      }).toString();

      // Navigate to provider detail page with waitlist context
      navigate(`/customer/providers/${entry.provider_id}?${search}`, {
        state: {
          selectedDate: entry.preferred_date,
          fromWaitlist: true,
          waitlistEntryId: entry.id, // Pass the entry ID so booking can claim it
          hasOpenLock: true,
        },
      });
    } catch (error) {
      toast.error("Failed to proceed with claiming slot");
    } finally {
      setClaiming(null);
    }
  };

  const handleBookWithProvider = (entry) => {
    // Navigate to provider detail with the waitlist date
    const search = new URLSearchParams({
      fromWaitlist: "true",
      waitlistDate: entry.preferred_date || "",
      waitlistEntryId: entry.id,
    }).toString();

    navigate(`/customer/providers/${entry.provider_id}?${search}`, {
      state: {
        selectedDate: entry.preferred_date,
        fromWaitlist: true,
        hasOpenLock: entry.has_open_lock,
      },
    });
  };

  const activeCount = waitlistEntries.filter(
    (e) => e.status === "waiting",
  ).length;
  const notifiedCount = waitlistEntries.filter(
    (e) => e.status === "notified",
  ).length;

  if (loading) {
    return (
      <div className="p-8 text-center">
        <p className="text-text-muted">Loading waitlist...</p>
      </div>
    );
  }

  if (waitlistEntries.length === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto animate-fade-in space-y-6">
        <div className="border-b border-border/40 pb-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Waitlist
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Join waitlists for providers to get notified when slots open up
          </p>
        </div>

        <Card variant="glass" className="p-8">
          <CardContent className="p-0 text-center space-y-4">
            <Calendar size={32} className="mx-auto text-text-muted/50" />
            <div>
              <p className="text-base font-medium text-foreground">
                No active waitlists
              </p>
              <p className="text-xs text-text-muted mt-1">
                Browse providers and join their waitlist to get priority when
                slots open up
              </p>
            </div>
            <Button
              onClick={() => navigate("/customer/providers")}
              className="mt-4"
            >
              <ArrowRight size={16} className="mr-2" />
              Browse Providers
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in space-y-6">
      <div className="border-b border-border/40 pb-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Waitlist
        </h1>
        <p className="text-xs text-text-muted mt-1">
          Manage your provider waitlists and claim available slots
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card variant="glass" className="p-4">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Total Queues
            </p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {waitlistEntries.length}
            </p>
          </div>
        </Card>
        <Card variant="glass" className="p-4">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Waiting
            </p>
            <p className="text-2xl font-bold text-text-muted mt-1">
              {activeCount}
            </p>
          </div>
        </Card>
        <Card variant="glass" className="p-4">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              Available Now
            </p>
            <p className="text-2xl font-bold text-primary mt-1">
              {notifiedCount}
            </p>
          </div>
        </Card>
      </div>

      {/* Waitlist Entries */}
      <div className="space-y-3">
        {notifiedCount > 0 && (
          <>
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary px-1">
              🎯 Slots Available Now
            </h3>
            <div className="space-y-3">
              {waitlistEntries
                .filter((entry) => entry.status === "notified")
                .map((entry) => (
                  <Card
                    key={entry.id}
                    variant="glass"
                    className="p-5 border-l-4 border-l-primary bg-primary/5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="p-2 rounded-full bg-primary/10">
                          <CheckCircle2
                            size={18}
                            className="text-primary animate-pulse"
                          />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-foreground">
                            {entry.provider?.name}
                          </h4>
                          {entry.provider && (
                            <>
                              <p className="text-xs text-text-muted mt-0.5">
                                {entry.provider.specialization}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-text-muted mt-1">
                                <MapPin size={12} />
                                {entry.provider.location}
                              </div>
                            </>
                          )}
                          {entry.preferred_date && (
                            <div className="flex items-center gap-2 text-xs text-primary font-semibold mt-2">
                              <Calendar size={12} />
                              Preferred:{" "}
                              {new Date(
                                entry.preferred_date,
                              ).toLocaleDateString()}
                            </div>
                          )}
                          {entry.claim_expires_at && (
                            <LockCountdown expiresAt={entry.claim_expires_at} />
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 min-w-fit">
                        <Button
                          onClick={() => handleClaimSlot(entry)}
                          disabled={claiming === entry.id}
                          className="h-9 text-xs font-semibold gap-1"
                        >
                          {claiming === entry.id ? (
                            <>Claiming...</>
                          ) : (
                            <>
                              <ArrowRight size={14} />
                              Claim Now
                            </>
                          )}
                        </Button>
                        <button
                          onClick={() => handleReleaseLock(entry.id)}
                          disabled={releasing === entry.id}
                          className="text-xs text-text-muted hover:text-text-faint transition-colors disabled:opacity-50"
                        >
                          {releasing === entry.id
                            ? "Releasing..."
                            : "Release Slot"}
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
            </div>
          </>
        )}

        {activeCount > 0 && (
          <>
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted px-1 mt-6">
              ⏳ Waiting in Queue
            </h3>
            <div className="space-y-3">
              {waitlistEntries
                .filter((entry) => entry.status === "waiting")
                .map((entry) => (
                  <Card
                    key={entry.id}
                    variant="glass"
                    className="p-5 border-l-4 border-l-text-muted/30"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="p-2 rounded-full bg-text-muted/10">
                          <Hourglass size={18} className="text-text-muted" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-foreground">
                            {entry.provider?.name}
                          </h4>
                          {entry.provider && (
                            <>
                              <p className="text-xs text-text-muted mt-0.5">
                                {entry.provider.specialization}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-text-muted mt-1">
                                <MapPin size={12} />
                                {entry.provider.location}
                              </div>
                            </>
                          )}
                          {entry.preferred_date && (
                            <div className="flex items-center gap-2 text-xs text-text-muted mt-2">
                              <Calendar size={12} />
                              Preferred:{" "}
                              {new Date(
                                entry.preferred_date,
                              ).toLocaleDateString()}
                            </div>
                          )}
                          <p className="text-xs text-text-faint mt-2">
                            Joined{" "}
                            {new Date(entry.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleLeaveWaitlist(entry.id)}
                        disabled={removing === entry.id}
                        className="text-xs text-text-muted hover:text-error transition-colors disabled:opacity-50"
                      >
                        {removing === entry.id ? (
                          "Leaving..."
                        ) : (
                          <>
                            <X size={16} />
                          </>
                        )}
                      </button>
                    </div>
                  </Card>
                ))}
            </div>
          </>
        )}
      </div>

      {/* Help Section */}
      <Card variant="glass" className="p-4 bg-accent/5 border-accent/20 mt-6">
        <div className="flex gap-3">
          <AlertCircle size={18} className="text-accent flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-foreground">How Waitlists Work</p>
            <ul className="text-text-muted space-y-1 list-disc list-inside">
              <li>Join a provider's waitlist while browsing their profile</li>
              <li>
                You'll be notified when a slot opens matching your preferred
                date
              </li>
              <li>
                You have 30 minutes to claim the slot before it passes to the
                next person
              </li>
              <li>
                Release your slot early to help other customers in the queue
              </li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
