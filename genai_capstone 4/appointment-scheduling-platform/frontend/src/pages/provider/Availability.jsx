import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchAvailability, addAvailability } from "../../store/providerSlice";
import { deleteAvailabilityAPI, getProviderSlotsAPI } from "../../services/apiService";
import { DAY_NAMES } from "../../utils/constants";
import { Plus, Trash2, ChevronLeft, ChevronRight, Clock, Calendar as CalendarIcon, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { DualRangeSlider } from "../../components/ui/DualRangeSlider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const AvailabilitySkeleton = () => (
  <div className="flex flex-col gap-3">
    {[...Array(3)].map((_, idx) => <div key={idx} className="skeleton w-full h-[72px]" />)}
  </div>
);

const MIN_STEP = 1;   // allow 1-minute precision for odd times like 9:07–9:29
const MAX_MINUTES = 24 * 60 - MIN_STEP;
const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => {
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${ampm}`;
});

function toMinutes(hhmm) {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function toTime(minutes) {
  const m = Math.max(0, minutes);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
function formatTimeValue(t) {
  if (!t) return "";
  return typeof t === "string" ? t.slice(0, 5) : String(t);
}
function formatDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Check if [newStart, newEnd) overlaps with any existing slot in slotList
function detectOverlap(newStartMin, newEndMin, slotList) {
  return slotList.filter((s) => {
    const sStart = toMinutes(formatTimeValue(s.start_time));
    const sEnd   = toMinutes(formatTimeValue(s.end_time));
    return newStartMin < sEnd && newEndMin > sStart;
  });
}

// ─── Weekday Heatmap ──────────────────────────────────────────────────────────
function WeekdayHeatmap({ availabilityByDay, activeDay, onDayClick }) {
  const COLS = 24; // one cell per hour
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] uppercase tracking-widest font-black text-text-faint mb-2">
        Weekly Availability Overview
      </p>
      <div className="flex gap-1 mb-1">
        <div className="w-8 flex-shrink-0" />
        {HOUR_LABELS.filter((_, i) => i % 3 === 0).map((l) => (
          <div key={l} className="flex-1 text-[9px] text-text-faint text-center">{l}</div>
        ))}
      </div>
      {DAY_NAMES.map((name, dayIdx) => {
        const slots = availabilityByDay[dayIdx] || [];
        const isActive = activeDay === dayIdx;
        return (
          <div
            key={dayIdx}
            className={`flex items-center gap-1 cursor-pointer rounded-md px-1 py-0.5 transition-all ${isActive ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-surface-1/20"}`}
            onClick={() => onDayClick(dayIdx)}
          >
            <div className="w-8 text-[10px] font-bold text-text-muted flex-shrink-0">{name.slice(0, 3)}</div>
            <div className="flex-1 flex gap-px h-5">
              {Array.from({ length: COLS }, (_, hour) => {
                const hourStart = hour * 60;
                const hourEnd   = hourStart + 60;
                const covered = slots.some(s => {
                  const sS = toMinutes(formatTimeValue(s.start_time));
                  const sE = toMinutes(formatTimeValue(s.end_time));
                  return sS < hourEnd && sE > hourStart;
                });
                return (
                  <div
                    key={hour}
                    className={`flex-1 rounded-sm ${covered ? "bg-primary/70" : "bg-border/15"}`}
                    title={covered ? `${HOUR_LABELS[hour]}: has slot` : ""}
                  />
                );
              })}
            </div>
            <div className="w-10 text-right text-[10px] text-text-faint flex-shrink-0">
              {slots.length > 0 ? `${slots.length}r` : "—"}
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-2 mt-1 text-[10px] text-text-faint">
        <span className="inline-block w-3 h-3 rounded-sm bg-primary/70" /> Has availability
        <span className="inline-block w-3 h-3 rounded-sm bg-border/15 ml-2" /> No slots
      </div>
    </div>
  );
}

export default function ProviderAvailability() {
  const dispatch = useDispatch();
  const { availability, loading } = useSelector((s) => s.providers);
  const [showForm, setShowForm] = useState(false); // collapsed by default — no crash on toggle

  const [slotMode, setSlotMode]           = useState("recurring");
  const [builderDay, setBuilderDay]       = useState(1);
  const [selectedDates, setSelectedDates] = useState([]);
  const [currentPickerMonth, setCurrentPickerMonth] = useState(new Date());
  const [startMinutes, setStartMinutes]   = useState(toMinutes("09:00"));
  const [endMinutes, setEndMinutes]       = useState(toMinutes("17:00"));

  // Slot duration is auto-derived from the time range — no manual entry needed
  const slotDurationMinutes = Math.max(1, endMinutes - startMinutes);

  // Calendar view
  const [currentDate, setCurrentDate]     = useState(new Date());
  const [selectedDate, setSelectedDate]   = useState(null);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [slotsLoading, setSlotsLoading]   = useState(false);

  useEffect(() => { dispatch(fetchAvailability()); }, [dispatch]);

  const availabilityByDay = useMemo(() => {
    const map = {};
    for (const slot of availability || []) {
      if (slot.day_of_week !== null && slot.day_of_week !== undefined) {
        if (!map[slot.day_of_week]) map[slot.day_of_week] = [];
        map[slot.day_of_week].push(slot);
      }
    }
    for (const key of Object.keys(map)) {
      map[key] = map[key].slice().sort((a, b) =>
        formatTimeValue(a.start_time).localeCompare(formatTimeValue(b.start_time))
      );
    }
    return map;
  }, [availability]);

  // Build a map of specific-date slots for overlap checking
  const availabilityByDate = useMemo(() => {
    const map = {};
    for (const slot of availability || []) {
      if (slot.specific_date) {
        if (!map[slot.specific_date]) map[slot.specific_date] = [];
        map[slot.specific_date].push(slot);
      }
    }
    return map;
  }, [availability]);

  // Live overlap detection for the current form state
  const overlapWarning = useMemo(() => {
    if (!showForm) return null;
    if (slotMode === "recurring") {
      const existing = availabilityByDay[builderDay] || [];
      const conflicts = detectOverlap(startMinutes, endMinutes, existing);
      if (conflicts.length > 0) {
        return `Overlaps with ${conflicts.map(s => `${formatTimeValue(s.start_time)}–${formatTimeValue(s.end_time)}`).join(", ")} on ${DAY_NAMES[builderDay]}`;
      }
    }
    if (slotMode === "specific" && selectedDates.length > 0) {
      const conflicts = [];
      for (const dateObj of selectedDates) {
        const key = formatDateKey(dateObj);
        // Check against existing specific-date slots for that date
        const specificExisting = availabilityByDate[key] || [];
        // ALSO check against recurring slots for the weekday of that date
        // (dateObj.getDay(): Sun=0, but DAY_NAMES/backend: Mon=0)
        const pythonDay = (dateObj.getDay() + 6) % 7;
        const recurringExisting = availabilityByDay[pythonDay] || [];
        const allExisting = [...specificExisting, ...recurringExisting];
        const found = detectOverlap(startMinutes, endMinutes, allExisting);
        if (found.length > 0) {
          conflicts.push(`${key}: ${found.map(s => `${formatTimeValue(s.start_time)}–${formatTimeValue(s.end_time)}`).join(", ")}`);
        }
      }
      if (conflicts.length > 0) {
        return `Overlaps existing slots on: ${conflicts.join(" | ")}`;
      }
    }
    return null;
  }, [showForm, slotMode, builderDay, startMinutes, endMinutes, availabilityByDay, availabilityByDate, selectedDates]);

  const handleAdd = async (e) => {
    e.preventDefault();
    const start_time = toTime(startMinutes);
    const end_time   = toTime(endMinutes);

    if (startMinutes >= endMinutes) { toast.error("End time must be after start time."); return; }
    if (overlapWarning) { toast.error("This range overlaps an existing slot. Adjust times first."); return; }

    if (slotMode === "recurring") {
      const payload = {
        day_of_week: Number(builderDay),   // ensure int, not string
        start_time,
        end_time,
        slot_duration_minutes: Number(slotDurationMinutes),
      };
      const res = await dispatch(addAvailability(payload));
      if (addAvailability.fulfilled.match(res)) {
        toast.success(`Recurring slot saved for ${DAY_NAMES[builderDay]}!`);
        dispatch(fetchAvailability());
      } else {
        const msg = res.payload?.message || res.payload?.detail?.[0]?.msg || "Failed to add slot";
        toast.error(msg);
      }
    } else {
      if (selectedDates.length === 0) { toast.error("Select at least one date."); return; }
      let ok = 0, fail = 0, lastErr = "";
      for (const dateObj of selectedDates) {
        const payload = {
          specific_date: formatDateKey(dateObj),  // "YYYY-MM-DD" string — backend accepts it
          start_time,
          end_time,
          slot_duration_minutes: Number(slotDurationMinutes),
        };
        const res = await dispatch(addAvailability(payload));
        if (addAvailability.fulfilled.match(res)) {
          ok++;
        } else {
          fail++;
          lastErr = res.payload?.message || res.payload?.detail?.[0]?.msg || "Failed";
        }
      }
      if (ok > 0) { toast.success(`Created ${ok} slot(s)`); setSelectedDates([]); dispatch(fetchAvailability()); }
      if (fail > 0) toast.error(`${fail} slot(s) failed: ${lastErr}`);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteAvailabilityAPI(id);
      toast.success("Slot removed");
      dispatch(fetchAvailability());
    } catch { toast.error("Delete failed"); }
  };

  const toggleDateSelection = (dateObj) => {
    const key = formatDateKey(dateObj);
    setSelectedDates(prev =>
      prev.some(d => formatDateKey(d) === key) ? prev.filter(d => formatDateKey(d) !== key) : [...prev, dateObj]
    );
  };

  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear(), month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const calendarDays = [];
    for (let i = 0; i < firstDay.getDay(); i++) calendarDays.push(null);
    for (let d = 1; d <= daysInMonth; d++) calendarDays.push(new Date(year, month, d));
    return { calendarDays, year, month };
  }, [currentDate]);

  const pickerMonthDays = useMemo(() => {
    const year = currentPickerMonth.getFullYear(), month = currentPickerMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));
    return days;
  }, [currentPickerMonth]);

  const today = useMemo(() => { const t = new Date(); t.setHours(0,0,0,0); return t; }, []);

  const fetchSelectedDateSlots = async (dateObj) => {
    setSelectedDate(dateObj); setSlotsLoading(true);
    try {
      const res = await getProviderSlotsAPI(formatDateKey(dateObj));
      setSelectedSlots(res?.data?.data?.slots || []);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load slots");
      setSelectedSlots([]);
    } finally { setSlotsLoading(false); }
  };

  const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const selectedDateKey = selectedDate ? formatDateKey(selectedDate) : null;

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Schedule</h1>
          <p className="text-xs text-text-muted mt-1">Manage recurring and one-off availability slots.</p>
        </div>
        <Button onClick={() => setShowForm(v => !v)} size="sm" className="gap-1.5 cursor-pointer">
          <Plus size={14} /> {showForm ? "Hide Form" : "Add Range"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* ── Left column: form + slot list ── */}
        <div className="space-y-6">

          {/* Add form */}
          {showForm && (
            <Card variant="glass" className="p-5">
              <form onSubmit={handleAdd} className="space-y-5">
                <Tabs value={slotMode} onValueChange={setSlotMode} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="recurring">Recurring</TabsTrigger>
                    <TabsTrigger value="specific">Specific Dates</TabsTrigger>
                  </TabsList>

                  {/* Recurring */}
                  <TabsContent value="recurring" className="space-y-4 mt-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-text-muted">Day of Week</label>
                      <select
                        value={builderDay}
                        onChange={e => setBuilderDay(parseInt(e.target.value, 10))}
                        className="w-full rounded-lg border border-border/40 bg-surface-2/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent/50 cursor-pointer"
                      >
                        {DAY_NAMES.map((d, i) => (
                          <option key={i} value={i}>{d}</option>
                        ))}
                      </select>
                    </div>

                    {/* Existing slots for selected day */}
                    {(availabilityByDay[builderDay] || []).length > 0 && (
                      <div className="rounded-lg bg-surface-1/20 border border-border/30 p-3 space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-text-faint mb-1">
                          Existing on {DAY_NAMES[builderDay]}
                        </p>
                        {(availabilityByDay[builderDay] || []).map(s => (
                          <div key={s.id} className="flex items-center justify-between text-xs">
                            <span className="font-mono text-text-muted">{formatTimeValue(s.start_time)} – {formatTimeValue(s.end_time)}</span>
                            <span className="text-text-faint">{s.slot_duration_minutes}m</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Specific dates */}
                  <TabsContent value="specific" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-text-muted">Select Dates</label>
                      <p className="text-xs text-text-muted">Selected: {selectedDates.length} date(s)</p>
                      <div className="border border-border/20 rounded-lg p-3 bg-surface-0/30 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-semibold">{MONTH_NAMES[currentPickerMonth.getMonth()]} {currentPickerMonth.getFullYear()}</h3>
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" onClick={e => { e.preventDefault(); setCurrentPickerMonth(new Date(currentPickerMonth.getFullYear(), currentPickerMonth.getMonth()-1, 1)); }} className="cursor-pointer"><ChevronLeft size={14} /></Button>
                            <Button variant="outline" size="sm" onClick={e => { e.preventDefault(); setCurrentPickerMonth(new Date(currentPickerMonth.getFullYear(), currentPickerMonth.getMonth()+1, 1)); }} className="cursor-pointer"><ChevronRight size={14} /></Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => <div key={d} className="text-[10px] font-semibold text-text-muted text-center py-1">{d}</div>)}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {pickerMonthDays.map((dateObj, idx) => {
                            const isSelected = dateObj && selectedDates.some(d => formatDateKey(d) === formatDateKey(dateObj));
                            const isToday = dateObj && dateObj.toDateString() === new Date().toDateString();
                            return (
                              <button key={idx} type="button"
                                onClick={() => dateObj && toggleDateSelection(dateObj)}
                                disabled={!dateObj}
                                className={`text-[11px] font-semibold py-2 rounded transition-colors ${!dateObj ? "bg-transparent cursor-default" : isSelected ? "bg-primary text-white" : isToday ? "bg-primary/20 text-primary border border-primary/30" : "bg-surface-1/20 hover:bg-surface-1/40 text-foreground"}`}
                              >
                                {dateObj ? dateObj.getDate() : ""}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Time range slider */}
                <DualRangeSlider
                  min={0} max={MAX_MINUTES} step={MIN_STEP}
                  startValue={startMinutes} endValue={endMinutes}
                  onStartChange={setStartMinutes} onEndChange={setEndMinutes}
                  formatLabel={toTime} className="mt-4"
                />

                {/* Derived duration display */}
                <div className="flex items-center justify-between text-xs text-text-muted px-1">
                  <span className="font-black uppercase tracking-wider text-text-faint">Session duration</span>
                  <span className="font-mono font-bold text-foreground">
                    {slotDurationMinutes >= 60
                      ? `${Math.floor(slotDurationMinutes / 60)}h ${slotDurationMinutes % 60 > 0 ? `${slotDurationMinutes % 60}m` : ""}`.trim()
                      : `${slotDurationMinutes}m`}
                  </span>
                </div>

                {/* Overlap warning */}
                {overlapWarning && (
                  <div className="flex items-start gap-2 text-xs text-warning bg-warning/10 border border-warning/20 rounded-lg p-3">
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>{overlapWarning}</span>
                  </div>
                )}

                <Button type="submit" disabled={!!overlapWarning} className="w-full h-10 mt-2 cursor-pointer">
                  {slotMode === "recurring"
                    ? `Save ${DAY_NAMES[builderDay]} · ${toTime(startMinutes)}–${toTime(endMinutes)} (${slotDurationMinutes}m)`
                    : `Save ${selectedDates.length} Date(s) · ${toTime(startMinutes)}–${toTime(endMinutes)}`}
                </Button>
              </form>
            </Card>
          )}

          {/* Heatmap always visible */}
          <Card variant="glass" className="p-4">
            <WeekdayHeatmap
              availabilityByDay={availabilityByDay}
              activeDay={slotMode === "recurring" ? builderDay : null}
              onDayClick={(day) => { setBuilderDay(day); setSlotMode("recurring"); setShowForm(true); }}
            />
          </Card>

          {/* Slot list */}
          {loading ? <AvailabilitySkeleton /> : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-foreground">Your slots</p>
                <p className="text-xs text-text-muted">{availability?.length || 0} saved</p>
              </div>

              {(availability || []).length === 0 ? (
                <div className="text-center py-12 text-text-muted border border-dashed border-border/40 rounded-2xl bg-surface-1/10">
                  <p>No availability configured yet.</p>
                  <button type="button" onClick={() => setShowForm(true)} className="text-xs text-accent mt-2 hover:underline">Add your first slot</button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Recurring */}
                  {Object.keys(availabilityByDay).length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">Recurring Slots</p>
                      <div className="space-y-3">
                        {Object.keys(availabilityByDay).map(Number).sort((a,b) => a-b).map(day => (
                          <div key={day} className="space-y-2">
                            <p className="text-xs font-bold uppercase tracking-wider text-text-muted">{DAY_NAMES[day]}</p>
                            {(availabilityByDay[day] || []).map(slot => (
                              <Card key={slot.id} variant="glass-hover" className="p-4">
                                <CardContent className="flex items-center justify-between p-0">
                                  <div>
                                    <p className="text-sm font-semibold">{formatTimeValue(slot.start_time)} — {formatTimeValue(slot.end_time)}</p>
                                    <p className="text-xs text-text-muted mt-1 font-mono">{slot.slot_duration_minutes} min slots</p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${slot.is_active ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}`}>
                                      {slot.is_active ? "Active" : "Inactive"}
                                    </span>
                                    <Button onClick={() => handleDelete(slot.id)} variant="ghost" size="icon-sm" className="text-destructive hover:bg-destructive/10 cursor-pointer"><Trash2 size={16} /></Button>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Specific */}
                  {(availability || []).filter(s => s.specific_date).length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">Specific Date Slots</p>
                      <div className="space-y-3">
                        {(availability || []).filter(s => s.specific_date).sort((a,b) => new Date(a.specific_date) - new Date(b.specific_date)).map(slot => (
                          <Card key={slot.id} variant="glass-hover" className="p-4">
                            <CardContent className="flex items-center justify-between p-0">
                              <div>
                                <p className="text-sm font-semibold">{new Date(slot.specific_date).toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" })}</p>
                                <p className="text-xs text-text-muted mt-1">{formatTimeValue(slot.start_time)} — {formatTimeValue(slot.end_time)} ({slot.slot_duration_minutes} min)</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${slot.is_active ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}`}>
                                  {slot.is_active ? "Active" : "Inactive"}
                                </span>
                                <Button onClick={() => handleDelete(slot.id)} variant="ghost" size="icon-sm" className="text-destructive hover:bg-destructive/10 cursor-pointer"><Trash2 size={16} /></Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right: calendar ── */}
        <Card variant="glass" className="lg:col-span-2 p-6">
          <CardContent className="p-0 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">{MONTH_NAMES[monthDays.month]} {monthDays.year}</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setCurrentDate(new Date(monthDays.year, monthDays.month-1, 1)); setSelectedDate(null); setSelectedSlots([]); }} className="cursor-pointer"><ChevronLeft size={16} /></Button>
                <Button variant="outline" size="sm" onClick={() => { setCurrentDate(new Date(monthDays.year, monthDays.month+1, 1)); setSelectedDate(null); setSelectedSlots([]); }} className="cursor-pointer"><ChevronRight size={16} /></Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
                <div key={d} className="text-center text-xs font-bold uppercase tracking-wide text-text-muted py-2">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {monthDays.calendarDays.map((date, idx) => {
                const isToday    = date && date.getTime() === today.getTime();
                const isSelected = date && selectedDateKey === formatDateKey(date);
                const pythonDay  = date ? (date.getDay() + 6) % 7 : null;
                const hasAvailability = pythonDay !== null && (availabilityByDay?.[pythonDay] || []).length > 0;
                return (
                  <div key={idx} onClick={() => date && fetchSelectedDateSlots(date)}
                    className={`aspect-square rounded-lg p-2 transition-all ${!date ? "bg-transparent cursor-default" : isSelected ? "bg-primary/15 border border-primary/40 cursor-pointer" : hasAvailability ? "bg-surface-1/30 border border-border/20 hover:border-border/40 cursor-pointer" : "bg-surface-0/30 border border-border/10 hover:border-border/30 cursor-pointer"}`}
                    aria-disabled={!date}
                  >
                    <div className="flex flex-col h-full">
                      <span className={`text-xs font-semibold ${isToday ? "text-primary" : "text-foreground"}`}>{date ? date.getDate() : ""}</span>
                      {date && hasAvailability && <div className="mt-auto"><span className="text-[10px] font-bold text-primary">Slots</span></div>}
                      {date && isToday && !hasAvailability && <div className="mt-auto"><span className="text-[10px] font-bold text-text-muted">Today</span></div>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="space-y-3">
                <p className="text-sm font-bold text-foreground flex items-center gap-2"><CalendarIcon size={16} /> Day details</p>
                {!selectedDate ? (
                  <div className="text-sm text-text-muted border border-border/40 rounded-xl bg-surface-1/10 p-4">Select a date to see all slots.</div>
                ) : slotsLoading ? (
                  <div className="space-y-3">{[...Array(3)].map((_,i) => <div key={i} className="skeleton w-full h-[40px]" />)}</div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-text-muted uppercase tracking-wider font-bold">{selectedDate.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-info/10 text-info border-info/20">Occupied: {selectedSlots.filter(s => s.is_booked).length}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-success/10 text-success border-success/20">Empty: {selectedSlots.filter(s => !s.is_booked).length}</span>
                    </div>
                    {selectedSlots.length === 0 ? (
                      <div className="text-sm text-text-muted border border-dashed border-border/40 rounded-xl p-4">No slots found for this date.</div>
                    ) : (
                      <div className="space-y-2 max-h-[320px] overflow-auto pr-1">
                        {selectedSlots.map(s => (
                          <div key={s.time_slot} className="flex items-start justify-between gap-3 border border-border/20 rounded-lg p-3 bg-surface-1/20">
                            <div className="flex items-start gap-2">
                              <Clock size={14} className={s.is_booked ? "text-info" : "text-primary"} />
                              <div>
                                <p className="text-sm font-mono font-semibold">{s.time_slot}</p>
                                {s.is_booked && s.appointment ? (
                                  <div className="text-xs text-text-muted mt-1 space-y-0.5">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-foreground">{s.appointment.customer?.full_name || "Customer"}</span>
                                      <span className="font-mono">({s.appointment.status})</span>
                                    </div>
                                    {s.appointment.notes && <div className="text-[11px] line-clamp-2">{s.appointment.notes}</div>}
                                  </div>
                                ) : <div className="text-xs text-text-muted mt-1">Available</div>}
                              </div>
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${s.is_booked ? "bg-info/10 text-info border-info/20" : "bg-success/10 text-success border-success/20"}`}>
                              {s.is_booked ? "Occupied" : "Empty"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <p className="text-sm font-bold text-foreground">Tips</p>
                <div className="text-xs text-text-muted border border-border/40 rounded-xl bg-surface-1/10 p-4 space-y-2">
                  <p>Add multiple non-overlapping time ranges per weekday. The heatmap shows your coverage at a glance.</p>
                  <p>Click any day in the heatmap to quickly configure that weekday's slots.</p>
                  <p>Specific date slots override recurring ones for that date.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
