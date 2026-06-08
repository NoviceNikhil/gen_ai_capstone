import { useRef, useEffect, useState, useCallback } from "react";

/**
 * Dual-endpoint time range slider component
 * Displays a single slider track with two draggable thumbs for start and end time.
 * Uses refs for event-handler values to avoid stale-closure crashes.
 */
export function DualRangeSlider({
  min = 0,
  max = 1440,
  step = 5,
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  formatLabel = (val) => val,
  className = "",
}) {
  const containerRef  = useRef(null);
  const draggingRef   = useRef(null);   // "start" | "end" | null  — avoids stale closure
  const startRef      = useRef(startValue);
  const endRef        = useRef(endValue);
  const [isDragging, setIsDragging] = useState(null);

  // Keep refs in sync with props
  useEffect(() => { startRef.current = startValue; }, [startValue]);
  useEffect(() => { endRef.current   = endValue;   }, [endValue]);

  const getPercent = (value) => ((value - min) / (max - min)) * 100;

  const computeValue = useCallback((clientX) => {
    if (!containerRef.current) return null;
    const rect    = containerRef.current.getBoundingClientRect();
    const x       = clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const raw     = Math.round((percent / 100) * (max - min) + min);
    // snap to step — when step=1 this is a no-op
    return step <= 1 ? Math.max(min, Math.min(max, raw)) : Math.round(raw / step) * step;
  }, [min, max, step]);

  // Attach global move/up listeners only while dragging
  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e) => {
      const clientX = e.touches?.[0]?.clientX ?? e.clientX;
      const snapped = computeValue(clientX);
      if (snapped === null) return;

      if (draggingRef.current === "start") {
        onStartChange(Math.min(snapped, endRef.current - step));
      } else if (draggingRef.current === "end") {
        onEndChange(Math.max(snapped, startRef.current + step));
      }
    };

    const onUp = () => {
      draggingRef.current = null;
      setIsDragging(null);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("touchmove",  onMove,  { passive: true });
    document.addEventListener("mouseup",   onUp);
    document.addEventListener("touchend",  onUp);

    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("touchmove",  onMove);
      document.removeEventListener("mouseup",   onUp);
      document.removeEventListener("touchend",  onUp);
    };
  }, [isDragging, computeValue, onStartChange, onEndChange, step]);

  const startDrag = (thumb) => (e) => {
    e.preventDefault();
    draggingRef.current = thumb;
    setIsDragging(thumb);
  };

  const startPercent = getPercent(startValue);
  const endPercent   = getPercent(endValue);

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
          Time Range
        </label>
        <span className="text-xs font-mono text-text-muted">
          {formatLabel(startValue)} — {formatLabel(endValue)}
        </span>
      </div>

      <div
        ref={containerRef}
        className="relative h-10 flex items-center cursor-pointer select-none"
      >
        {/* Track background */}
        <div className="absolute left-0 right-0 h-2 bg-border/20 rounded-full" />

        {/* Active range highlight */}
        <div
          className="absolute h-2 bg-primary rounded-full pointer-events-none"
          style={{ left: `${startPercent}%`, right: `${100 - endPercent}%` }}
        />

        {/* Start thumb */}
        <div
          onMouseDown={startDrag("start")}
          onTouchStart={startDrag("start")}
          className={`absolute w-5 h-5 bg-primary rounded-full border-2 border-white shadow-md z-40 cursor-grab active:cursor-grabbing ${
            isDragging === "start" ? "shadow-lg ring-2 ring-primary/30" : ""
          }`}
          style={{ left: `calc(${startPercent}% - 10px)`, top: "50%", transform: "translateY(-50%)" }}
          role="slider"
          aria-label="Start time"
          aria-valuenow={startValue}
          tabIndex={0}
        />

        {/* End thumb */}
        <div
          onMouseDown={startDrag("end")}
          onTouchStart={startDrag("end")}
          className={`absolute w-5 h-5 bg-primary rounded-full border-2 border-white shadow-md z-40 cursor-grab active:cursor-grabbing ${
            isDragging === "end" ? "shadow-lg ring-2 ring-primary/30" : ""
          }`}
          style={{ left: `calc(${endPercent}% - 10px)`, top: "50%", transform: "translateY(-50%)" }}
          role="slider"
          aria-label="End time"
          aria-valuenow={endValue}
          tabIndex={0}
        />
      </div>
    </div>
  );
}
