import { useEffect, useState, useMemo } from "react";
import { Star, Search, X, ChevronDown } from "lucide-react";
import { getCustomerReviewsAPI, submitReviewAPI } from "../../services/apiService";
import toast from "react-hot-toast";
import LoadingSpinner from "../../components/LoadingSpinner";

// ─── Star row (interactive or display) ───────────────────────────────────────
function StarRow({ value, onChange, size = 18 }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange?.(s)}
          onMouseEnter={() => onChange && setHover(s)}
          onMouseLeave={() => onChange && setHover(0)}
          className={onChange ? "cursor-pointer p-0.5" : "cursor-default p-0.5"}
        >
          <Star
            size={size}
            className={
              (hover || value) >= s
                ? "fill-amber-400 text-amber-400"
                : "text-text-faint"
            }
          />
        </button>
      ))}
    </div>
  );
}

// ─── Mini filter chip ─────────────────────────────────────────────────────────
function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
        active
          ? "bg-accent text-white border-accent"
          : "bg-surface-2/60 text-text-muted border-border/40 hover:border-accent/40"
      }`}
    >
      {children}
    </button>
  );
}

export default function CustomerReviews() {
  const [loading, setLoading]     = useState(true);
  const [pending, setPending]     = useState([]);
  const [submitted, setSubmitted] = useState([]);
  const [drafts, setDrafts]       = useState({});

  // ── Submitted filters ─────────────────────────────────────────────────────
  const [search, setSearch]         = useState("");
  const [categoryFilter, setCategory] = useState("all");
  const [minRating, setMinRating]   = useState(0);
  const [maxRating, setMaxRating]   = useState(5);
  const [sortBy, setSortBy]         = useState("date_desc"); // date_desc | date_asc | rating_desc | rating_asc

  const load = async () => {
    try {
      setLoading(true);
      const res = await getCustomerReviewsAPI();
      setPending(res.data?.data?.pending   || []);
      setSubmitted(res.data?.data?.submitted || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (appointmentId) => {
    const draft = drafts[appointmentId] || {};
    if (!draft.rating) { toast.error("Please pick a star rating first"); return; }
    try {
      await submitReviewAPI(appointmentId, { rating: draft.rating, comment: draft.comment || "" });
      toast.success("Review submitted!");
      setDrafts(prev => { const n = { ...prev }; delete n[appointmentId]; return n; });
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Submit failed");
    }
  };

  // ── Derived category list from submitted ─────────────────────────────────
  const categories = useMemo(() => {
    const set = new Set(submitted.map(s => s.category_name).filter(Boolean));
    return ["all", ...Array.from(set).sort()];
  }, [submitted]);

  // ── Filtered + sorted submitted list ─────────────────────────────────────
  const filteredSubmitted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = submitted.filter(item => {
      const rating = Number(item.rating || 0);
      if (rating < minRating || rating > maxRating) return false;
      if (categoryFilter !== "all" && item.category_name !== categoryFilter) return false;
      if (q) {
        const nameMatch    = (item.provider_name    || "").toLowerCase().includes(q);
        const commentMatch = (item.comment          || "").toLowerCase().includes(q);
        const specMatch    = (item.provider_specialization || "").toLowerCase().includes(q);
        if (!nameMatch && !commentMatch && !specMatch) return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === "date_desc")   return new Date(b.appointment_date) - new Date(a.appointment_date);
      if (sortBy === "date_asc")    return new Date(a.appointment_date) - new Date(b.appointment_date);
      if (sortBy === "rating_desc") return Number(b.rating) - Number(a.rating);
      if (sortBy === "rating_asc")  return Number(a.rating) - Number(b.rating);
      return 0;
    });
    return list;
  }, [submitted, search, categoryFilter, minRating, maxRating, sortBy]);

  const filtersActive = search.trim() !== "" || categoryFilter !== "all" || minRating > 0 || maxRating < 5 || sortBy !== "date_desc";

  function clearFilters() {
    setSearch(""); setCategory("all"); setMinRating(0); setMaxRating(5); setSortBy("date_desc");
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in">
      <h1 className="text-3xl font-bold mb-1">Reviews</h1>
      <p className="text-sm text-text-muted mb-6">Rate completed appointments and browse your review history.</p>

      {/* ── Pending ── */}
      <section className="mb-10">
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
          Pending
          {pending.length > 0 && (
            <span className="text-xs font-black bg-accent/15 text-accent px-2 py-0.5 rounded-full border border-accent/25">
              {pending.length}
            </span>
          )}
        </h2>
        <div className="grid gap-3">
          {pending.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/40 bg-surface-1/10 p-6 text-text-muted text-sm">
              No pending reviews — all caught up!
            </div>
          ) : pending.map((item) => (
            <div key={item.appointment_id} className="glass-card rounded-xl p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-foreground">{item.provider_name}</p>
                  {item.provider_specialization && (
                    <p className="text-xs text-text-muted">{item.provider_specialization}</p>
                  )}
                  {item.category_name && (
                    <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-surface-2 border-border/30 text-text-faint">
                      {item.category_name}
                    </span>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-text-muted font-mono">{item.appointment_date}</p>
                  <p className="text-xs text-text-faint font-mono">{item.time_slot}</p>
                </div>
              </div>

              <StarRow
                value={drafts[item.appointment_id]?.rating || 0}
                onChange={(s) => setDrafts(prev => ({ ...prev, [item.appointment_id]: { ...prev[item.appointment_id], rating: s } }))}
                size={20}
              />

              <textarea
                className="w-full rounded-lg border border-border/40 bg-surface-2/50 px-3 py-2 text-sm text-foreground placeholder:text-text-faint focus:outline-none focus:ring-1 focus:ring-accent/50 resize-none"
                rows={2}
                placeholder="Leave a comment (optional)…"
                value={drafts[item.appointment_id]?.comment || ""}
                onChange={(e) => setDrafts(prev => ({ ...prev, [item.appointment_id]: { ...prev[item.appointment_id], comment: e.target.value } }))}
              />

              <button
                type="button"
                className="btn-primary px-5 py-2 text-sm font-bold rounded-lg"
                onClick={() => submit(item.appointment_id)}
              >
                Submit Review
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── Submitted: filter bar ── */}
      <section>
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h2 className="text-lg font-bold">
            Submitted
            <span className="text-sm font-normal text-text-muted ml-2">
              {filtersActive ? `${filteredSubmitted.length} of ${submitted.length}` : submitted.length}
            </span>
          </h2>
          {filtersActive && (
            <button type="button" onClick={clearFilters} className="flex items-center gap-1 text-xs text-text-muted hover:text-foreground">
              <X size={13} /> Clear filters
            </button>
          )}
        </div>

        {submitted.length > 0 && (
          <div className="glass-card p-4 mb-4 space-y-3">
            {/* Row 1: search + sort */}
            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[180px]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
                <input
                  type="text"
                  placeholder="Search provider name or review…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs bg-surface-2/60 border border-border/40 rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/50 placeholder:text-text-faint"
                />
              </div>

              <div className="relative">
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2 text-xs bg-surface-2/60 border border-border/40 rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/50 text-foreground cursor-pointer"
                >
                  <option value="date_desc">Newest first</option>
                  <option value="date_asc">Oldest first</option>
                  <option value="rating_desc">Highest rating</option>
                  <option value="rating_asc">Lowest rating</option>
                </select>
                <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-faint" />
              </div>
            </div>

            {/* Row 2: category chips */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] uppercase tracking-widest font-black text-text-faint">Category</span>
              {categories.map(cat => (
                <Chip key={cat} active={categoryFilter === cat} onClick={() => setCategory(cat)}>
                  {cat === "all" ? "All" : cat}
                </Chip>
              ))}
            </div>

            {/* Row 3: rating range */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[11px] uppercase tracking-widest font-black text-text-faint">Rating</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-text-muted">Min</span>
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(s => (
                    <button key={s} type="button" onClick={() => setMinRating(minRating === s ? 0 : s)} className="p-0.5">
                      <Star size={14} className={minRating >= s ? "fill-amber-400 text-amber-400" : "text-text-faint hover:text-amber-300"} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-text-muted">Max</span>
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(s => (
                    <button key={s} type="button" onClick={() => setMaxRating(s)} className="p-0.5">
                      <Star size={14} className={maxRating >= s ? "fill-amber-400 text-amber-400" : "text-text-faint hover:text-amber-300"} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-3">
          {filteredSubmitted.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/40 bg-surface-1/10 p-6 text-text-muted text-sm">
              {submitted.length === 0 ? "No reviews submitted yet." : "No reviews match your filters."}
              {filtersActive && submitted.length > 0 && (
                <button type="button" onClick={clearFilters} className="ml-2 text-accent hover:underline text-xs">Clear filters</button>
              )}
            </div>
          ) : filteredSubmitted.map((item) => (
            <div key={item.appointment_id} className="glass-card rounded-xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-foreground">{item.provider_name}</p>
                  {item.provider_specialization && (
                    <p className="text-xs text-text-muted">{item.provider_specialization}</p>
                  )}
                  {item.category_name && (
                    <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-surface-2 border-border/30 text-text-faint">
                      {item.category_name}
                    </span>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-text-muted font-mono">{item.appointment_date}</p>
                  <p className="text-xs text-text-faint font-mono">{item.time_slot}</p>
                </div>
              </div>

              <StarRow value={Number(item.rating || 0)} size={15} />

              {item.comment ? (
                <p className="text-sm text-text-muted leading-relaxed">{item.comment}</p>
              ) : (
                <p className="text-xs text-text-faint italic">No comment.</p>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
