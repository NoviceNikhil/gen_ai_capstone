import { useEffect, useMemo, useState } from "react";
import { Star, Search, X, ChevronDown } from "lucide-react";
import toast from "react-hot-toast";

import { getProviderReviewsAPI } from "../../services/apiService";
import { Card, CardContent } from "@/components/ui/card";

function Stars({ rating }) {
  const r = Number(rating || 0);
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} size={14} className={i < r ? "text-accent fill-accent" : "text-text-muted"} />
      ))}
    </div>
  );
}

function FilterStar({ filled, onClick }) {
  return (
    <button type="button" onClick={onClick} className="p-0.5 focus:outline-none">
      <Star size={16} className={filled ? "text-accent fill-accent" : "text-text-muted hover:text-accent/60"} />
    </button>
  );
}

export default function ProviderReviewsRatings() {
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [minRating, setMinRating]     = useState(0);
  const [maxRating, setMaxRating]     = useState(5);
  const [sortBy, setSortBy]           = useState("date_desc");

  useEffect(() => {
    let mounted = true;
    const fetchReviews = async () => {
      setLoading(true);
      try {
        const res = await getProviderReviewsAPI();
        const list = res?.data?.data?.reviews || [];
        if (mounted) setReviews(list);
      } catch (err) {
        if (mounted) toast.error(err?.response?.data?.message || "Failed to load reviews");
        if (mounted) setReviews([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchReviews();
    return () => { mounted = false; };
  }, []);

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    return reviews.reduce((acc, r) => acc + Number(r.rating || 0), 0) / reviews.length;
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = reviews.filter(r => {
      const rating = Number(r.rating || 0);
      if (rating < minRating || rating > maxRating) return false;
      if (q) {
        const nameMatch    = (r.customer?.full_name || "").toLowerCase().includes(q);
        const commentMatch = (r.comment || "").toLowerCase().includes(q);
        if (!nameMatch && !commentMatch) return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === "date_desc")   return new Date(b.created_at) - new Date(a.created_at);
      if (sortBy === "date_asc")    return new Date(a.created_at) - new Date(b.created_at);
      if (sortBy === "rating_desc") return Number(b.rating) - Number(a.rating);
      if (sortBy === "rating_asc")  return Number(a.rating) - Number(b.rating);
      return 0;
    });
    return list;
  }, [reviews, searchQuery, minRating, maxRating, sortBy]);

  const filtersActive = searchQuery.trim() !== "" || minRating > 0 || maxRating < 5 || sortBy !== "date_desc";

  function clearFilters() {
    setSearchQuery(""); setMinRating(0); setMaxRating(5); setSortBy("date_desc");
  }

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-8 border-b border-border/40 pb-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Reviews and Ratings</h1>
        <p className="text-xs text-text-muted mt-1">All customer reviews for your services.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <div className="glass-card p-5">
          <p className="text-[11px] uppercase tracking-widest font-black text-text-faint mb-3">Average Rating</p>
          <div className="flex items-center gap-3">
            <p className="text-2xl font-black">{averageRating.toFixed(1)}</p>
            <Stars rating={averageRating} />
          </div>
        </div>
        <div className="glass-card p-5">
          <p className="text-[11px] uppercase tracking-widest font-black text-text-faint mb-3">Total Reviews</p>
          <p className="text-2xl font-black">{reviews.length}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-[11px] uppercase tracking-widest font-black text-text-faint mb-3">Highest Rating</p>
          <p className="text-2xl font-black">{reviews.length === 0 ? "N/A" : Math.max(...reviews.map(r => Number(r.rating || 0)))}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-[11px] uppercase tracking-widest font-black text-text-faint mb-3">Lowest Rating</p>
          <p className="text-2xl font-black">{reviews.length === 0 ? "N/A" : Math.min(...reviews.map(r => Number(r.rating || 0)))}</p>
        </div>
      </div>

      {/* Filter Bar */}
      {reviews.length > 0 && (
        <div className="glass-card p-4 mb-5 space-y-3">
          {/* Row 1: search + sort */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
              <input
                type="text"
                placeholder="Search by customer name or review keyword…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
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
            {filtersActive && (
              <button type="button" onClick={clearFilters} className="flex items-center gap-1 text-xs text-text-muted hover:text-foreground">
                <X size={13} /> Clear
              </button>
            )}
          </div>

          {/* Row 2: rating range */}
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-[11px] uppercase tracking-widest font-black text-text-faint">Rating</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-text-muted">Min</span>
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(s => (
                  <FilterStar key={s} filled={minRating >= s} onClick={() => setMinRating(minRating === s ? 0 : s)} />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-text-muted">Max</span>
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(s => (
                  <FilterStar key={s} filled={maxRating >= s} onClick={() => setMaxRating(s)} />
                ))}
              </div>
            </div>
          </div>

          {filtersActive && (
            <p className="text-xs text-text-muted">
              Showing <span className="font-bold text-foreground">{filteredReviews.length}</span> of {reviews.length} reviews
              {minRating > 0 || maxRating < 5 ? ` · Rating ${minRating || 1}–${maxRating}★` : ""}
              {searchQuery.trim() ? ` · "${searchQuery.trim()}"` : ""}
            </p>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, idx) => <div key={idx} className="skeleton glass-card p-6 h-[140px]" />)}
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-20 text-text-muted border border-dashed border-border/40 rounded-2xl bg-surface-1/10 backdrop-blur-xs">
          <p>No reviews yet.</p>
          <p className="text-xs text-text-faint mt-1">When customers complete appointments, reviews will appear here.</p>
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="text-center py-16 text-text-muted border border-dashed border-border/40 rounded-2xl bg-surface-1/10">
          <p className="font-medium">No reviews match your filters.</p>
          <button type="button" onClick={clearFilters} className="mt-3 text-xs text-accent hover:underline">Clear filters</button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReviews.map(r => (
            <Card key={r.id} variant="glass-hover" className="p-4">
              <CardContent className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Stars rating={r.rating} />
                      <span className="text-xs font-bold text-text-muted">{Number(r.rating || 0)}/5</span>
                    </div>
                    <p className="text-sm font-bold mt-2">{r.customer?.full_name || "Customer"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-text-muted">{r.appointment?.appointment_date ? `On ${r.appointment.appointment_date}` : "Appointment date: N/A"}</p>
                    {r.appointment?.time_slot && <p className="text-xs text-text-muted font-mono mt-1">{r.appointment.time_slot}</p>}
                  </div>
                </div>
                {r.comment
                  ? <p className="text-sm text-text-muted leading-relaxed">{r.comment}</p>
                  : <p className="text-sm text-text-muted italic">No comment provided.</p>
                }
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
