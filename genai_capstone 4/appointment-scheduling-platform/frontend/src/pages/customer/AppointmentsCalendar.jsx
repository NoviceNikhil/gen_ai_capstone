import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Calendar,
  Clock,
  MapPin,
} from "lucide-react";
import { fetchMyAppointments } from "../../store/appointmentSlice";
import StatusBadge from "../../components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import toast from "react-hot-toast";

export default function AppointmentsCalendar() {
  const dispatch = useDispatch();
  const { list: appointments = [] } = useSelector((s) => s.appointments);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedAppointmentIndex, setSelectedAppointmentIndex] = useState(0);

  useEffect(() => {
    dispatch(fetchMyAppointments({ limit: 1000 }));
  }, [dispatch]);

  // Today's date for reference
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get calendar days for the current month
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const calendarDays = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(new Date(year, month, day));
  }

  // Group appointments by date
  const appointmentsByDate = {};
  // Calendar view: show only confirmed appointments (exclude cancelled/pending/completed)
  appointments
    .filter((appt) => appt?.status === "confirmed")
    .forEach((appt) => {
    if (appt.appointment_date) {
      const dateKey = appt.appointment_date.split("T")[0]; // YYYY-MM-DD format
      if (!appointmentsByDate[dateKey]) {
        appointmentsByDate[dateKey] = [];
      }
      appointmentsByDate[dateKey].push(appt);
    }
  });

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDate(null);
    setSelectedAppointmentIndex(0);
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDate(null);
    setSelectedAppointmentIndex(0);
  };

  const toLocalDateKey = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const getDayAppointments = (date) => {
    if (!date) return [];
    // Use local date key (avoid UTC shifting off-by-one day)
    const dateKey = toLocalDateKey(date);
    return appointmentsByDate[dateKey] || [];
  };

  const handleDayClick = (date) => {
    const dayAppts = getDayAppointments(date);
    if (dayAppts.length > 0) {
      setSelectedDate(date);
      setSelectedAppointmentIndex(0);
    }
  };

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const formatTime = (timeSlot) => {
    if (!timeSlot) return "N/A";
    return timeSlot;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    // Parse as local date to avoid timezone shifting (off-by-one-day in UI)
    const date = new Date(dateString.split("T")[0] + "T00:00:00");
    return date.toLocaleDateString("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in space-y-6">
      <div className="border-b border-border/40 pb-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          My Appointments
        </h1>
        <p className="text-xs text-text-muted mt-1">
          View all your appointments in a calendar format
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Section */}
        <Card variant="glass" className="lg:col-span-2 p-6">
          <CardContent className="p-0 space-y-6">
            {/* Calendar Header */}
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-foreground">
                {monthNames[month]} {year}
              </h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPreviousMonth}
                  className="cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextMonth}
                  className="cursor-pointer"
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-bold uppercase tracking-wide text-text-muted py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((date, idx) => {
                const dayAppts = getDayAppointments(date);
                const isToday = date && date.getTime() === today.getTime();
                const isOtherMonth = !date;

                return (
                  <div
                    key={idx}
                    onClick={() =>
                      date && dayAppts.length > 0 && handleDayClick(date)
                    }
                    className={`
                      aspect-square rounded-lg p-2 transition-all
                      ${
                        isOtherMonth
                          ? "bg-surface-0/30"
                          : dayAppts.length > 0
                            ? "bg-primary/10 border border-primary/30 cursor-pointer hover:bg-primary/15"
                            : isToday
                              ? "bg-surface-1/60 border border-border/40"
                              : "bg-surface-1/40 border border-border/20 hover:border-border/40"
                      }
                    `}
                  >
                    <div className="flex flex-col h-full">
                      <span className="text-xs font-semibold text-foreground">
                        {date ? date.getDate() : ""}
                      </span>
                      {dayAppts.length > 0 && (
                        <div className="mt-auto">
                          <span className="text-[10px] font-bold text-primary">
                            {dayAppts.length}{" "}
                            {dayAppts.length === 1 ? "appt" : "appts"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Details Sidebar */}
        <div className="space-y-4">
          {selectedDate && getDayAppointments(selectedDate).length > 0 ? (
            <>
              {/* Appointment Selector */}
              {getDayAppointments(selectedDate).length > 1 && (
                <Card variant="glass" className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      onClick={() =>
                        setSelectedAppointmentIndex(
                          (prev) =>
                            (prev -
                              1 +
                              getDayAppointments(selectedDate).length) %
                            getDayAppointments(selectedDate).length,
                        )
                      }
                      className="p-2 rounded-lg hover:bg-surface-1/40 transition-colors cursor-pointer"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <div className="text-center">
                      <p className="text-xs font-bold uppercase text-text-muted">
                        Appointment
                      </p>
                      <p className="text-sm font-semibold text-foreground">
                        {selectedAppointmentIndex + 1} of{" "}
                        {getDayAppointments(selectedDate).length}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        setSelectedAppointmentIndex(
                          (prev) =>
                            (prev + 1) %
                            getDayAppointments(selectedDate).length,
                        )
                      }
                      className="p-2 rounded-lg hover:bg-surface-1/40 transition-colors cursor-pointer"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </Card>
              )}

              {/* Details */}
              {getDayAppointments(selectedDate)[selectedAppointmentIndex] && (
                <Card variant="glass" className="p-6 sticky top-6 space-y-6">
                  {(() => {
                    const appt =
                      getDayAppointments(selectedDate)[
                        selectedAppointmentIndex
                      ];
                    return (
                      <>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-lg text-foreground">
                              Appointment Details
                            </h3>
                            <button
                              onClick={() => {
                                setSelectedDate(null);
                                setSelectedAppointmentIndex(0);
                              }}
                              className="text-text-muted hover:text-foreground transition-colors cursor-pointer"
                            >
                              <X size={18} />
                            </button>
                          </div>
                          <p className="text-xs text-text-muted">
                            {formatDate(appt.appointment_date)}
                          </p>
                        </div>

                        <div className="space-y-4 border-t border-border/20 pt-4">
                          {/* Date & Time */}
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                              <Calendar size={16} className="text-primary" />
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-bold uppercase tracking-wide text-text-muted">
                                Date & Time
                              </p>
                              <p className="text-sm font-medium text-foreground mt-1">
                                {formatDate(appt.appointment_date)}
                              </p>
                              <p className="text-sm text-text-muted mt-0.5">
                                {formatTime(appt.time_slot)}
                              </p>
                            </div>
                          </div>

                          {/* Status */}
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                              <Calendar size={16} className="text-primary" />
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-bold uppercase tracking-wide text-text-muted">
                                Status
                              </p>
                              <div className="mt-1">
                                <StatusBadge status={appt.status} />
                              </div>
                            </div>
                          </div>

                          {/* Provider/Service */}
                          {appt.provider?.user?.full_name && (
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <MapPin size={16} className="text-primary" />
                              </div>
                              <div className="flex-1">
                                <p className="text-xs font-bold uppercase tracking-wide text-text-muted">
                                  Service Provider
                                </p>
                                <p className="text-sm font-medium text-foreground mt-1">
                                  {appt.provider.user.full_name}
                                </p>
                                {appt.provider.specialization && (
                                  <p className="text-xs text-text-muted mt-0.5">
                                    {appt.provider.specialization}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Fee */}
                          {appt.consultation_fee_snapshot && (
                            <div className="flex items-start gap-3 border-t border-border/20 pt-4">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <Clock size={16} className="text-primary" />
                              </div>
                              <div className="flex-1">
                                <p className="text-xs font-bold uppercase tracking-wide text-text-muted">
                                  Consultation Fee
                                </p>
                                <p className="text-sm font-mono font-bold text-foreground mt-1">
                                  ₹{appt.consultation_fee_snapshot}
                                </p>
                                {appt.is_paid && (
                                  <p className="text-xs text-green-600 font-semibold mt-1">
                                    ✓ Paid
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Notes */}
                          {appt.notes && !appt.notes.includes("[DEMO:") && (
                            <div className="flex flex-col gap-2 border-t border-border/20 pt-4">
                              <p className="text-xs font-bold uppercase tracking-wide text-text-muted">
                                Notes
                              </p>
                              <p className="text-sm text-foreground bg-surface-0/40 p-3 rounded-lg">
                                {appt.notes}
                              </p>
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </Card>
              )}
            </>
          ) : (
            <Card variant="glass" className="p-6">
              <CardContent className="p-0 text-center space-y-3">
                <Calendar size={24} className="mx-auto text-text-muted/50" />
                <div>
                  <p className="text-sm font-medium text-text-muted">
                    Click on a day with appointments to see details
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Summary */}
      {appointments.filter((a) => a?.status === "confirmed").length === 0 && (
        <Card variant="glass" className="p-6 text-center">
          <CardContent className="p-0 space-y-3">
            <Calendar size={32} className="mx-auto text-text-muted/50" />
            <div>
              <p className="text-base font-medium text-foreground">
                No appointments yet
              </p>
              <p className="text-xs text-text-muted mt-1">
                Book your first appointment to get started
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
