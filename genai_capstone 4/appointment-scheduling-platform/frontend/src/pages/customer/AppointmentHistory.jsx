import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { Calendar as CalendarIcon, Download, X, Search } from "lucide-react";
import { fetchMyAppointments } from "../../store/appointmentSlice";
import StatusBadge from "../../components/ui/StatusBadge";
import { APPOINTMENT_STATUSES } from "../../utils/constants";
import { downloadCustomerHistory } from "../../services/reportService";
import { useSelector as useAuthSelector } from "react-redux";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Pagination from "../../components/ui/Pagination";
import { getCategoriesAPI } from "../../services/apiService";

const HistorySkeleton = () => (
  <div className="flex flex-col gap-3">
    {[...Array(4)].map((_, idx) => (
      <div key={idx} className="skeleton w-full h-[88px]" />
    ))}
  </div>
);

export default function AppointmentHistory() {
  const dispatch = useDispatch();
  const { list, loading, total, totalPages } = useSelector(
    (s) => s.appointments,
  );
  const { user } = useAuthSelector((s) => s.auth);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [providerSearch, setProviderSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [paymentFilter, setPaymentFilter] = useState(""); // "paid", "unpaid", or ""
  const [providerSearchInput, setProviderSearchInput] = useState("");
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState(""); // category id as string

  useEffect(() => {
    getCategoriesAPI()
      .then((r) => setCategories(r.data?.data?.categories || []))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const params = {
      status: filter || undefined,
      limit: 10,
      page,
    };

    // Add date filters if specified
    if (dateFrom) params.from_date = dateFrom;

    // Add provider search if specified
    if (providerSearch) params.provider_name = providerSearch;

    // Add payment filter if specified
    if (paymentFilter === "paid") params.is_paid = true;
    if (paymentFilter === "unpaid") params.is_paid = false;

    // Add category filter if specified
    if (categoryFilter) params.category_id = Number(categoryFilter);

    dispatch(fetchMyAppointments(params));
  }, [dispatch, filter, page, providerSearch, dateFrom, paymentFilter, categoryFilter]);

  // Debounce provider name input (ref: marketplace search filter)
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setProviderSearch(providerSearchInput.trim());
    }, 350);
    return () => window.clearTimeout(timeoutId);
  }, [providerSearchInput]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [filter, providerSearch, dateFrom, paymentFilter, categoryFilter]);

  const clearAdvancedFilters = () => {
    setProviderSearch("");
    setProviderSearchInput("");
    setDateFrom("");
    setPaymentFilter("");
    setCategoryFilter("");
  };

  const hasAdvancedFilters =
    providerSearch || dateFrom || paymentFilter || categoryFilter;

  const handleExport = async () => {
    try {
      await downloadCustomerHistory(user.id);
      toast.success("History exported!");
    } catch {
      toast.error("Export failed");
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            My Appointments
          </h1>
          <p className="text-sm text-text-muted mt-1">{total} sessions total</p>
        </div>
        <Button
          onClick={handleExport}
          variant="outline"
          size="sm"
          className="gap-2 cursor-pointer"
        >
          <Download size={14} /> Export Excel
        </Button>
      </div>

      {/* Status filter tabs */}
      <Tabs value={filter} onValueChange={setFilter} className="w-full">
        <TabsList>
          <TabsTrigger value="">All</TabsTrigger>
          {APPOINTMENT_STATUSES.map((s) => (
            <TabsTrigger key={s} value={s} className="capitalize">
              {s}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Advanced Filters */}
      <Card variant="glass" className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm text-foreground">
            Advanced Filters
          </h3>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Provider Search */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-muted">
                Provider Name
              </label>
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-2.5 top-2.5 text-text-muted"
                />
                <Input
                  placeholder="Search provider..."
                  value={providerSearchInput}
                  onChange={(e) => setProviderSearchInput(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
            </div>

            {/* Date */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-muted">
                Date
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-muted">
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-9 text-sm px-3 rounded-lg border border-border/40 bg-background text-foreground cursor-pointer"
              >
                <option value="">All</option>
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Filter */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-muted">
                Payment Status
              </label>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="h-9 text-sm px-3 rounded-lg border border-border/40 bg-background text-foreground cursor-pointer"
              >
                <option value="">All</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>
          </div>

          {hasAdvancedFilters && (
            <div className="flex gap-2 justify-end pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={clearAdvancedFilters}
                className="gap-1 cursor-pointer"
              >
                <X size={14} /> Clear Filters
              </Button>
            </div>
          )}
        </div>
      </Card>

      {loading ? (
        <HistorySkeleton />
      ) : (
        <div className="flex flex-col gap-3">
          {[...list]
            .sort((a, b) => {
              const rank = (s) => {
                if (s === "confirmed") return 0;
                if (s === "pending") return 1;
                if (s === "completed") return 2;
                if (s === "cancelled") return 3;
                return 4;
              };

              const ra = rank(a?.status);
              const rb = rank(b?.status);
              if (ra !== rb) return ra - rb;

              const da = new Date(`${a?.appointment_date || ""}T${a?.time_slot || "00:00"}:00`).getTime();
              const db = new Date(`${b?.appointment_date || ""}T${b?.time_slot || "00:00"}:00`).getTime();
              return db - da; // latest first
            })
            .map((appt) => (
            <Link
              key={appt.id}
              to={`/customer/appointments/${appt.id}`}
              className="block group"
            >
              <Card variant="glass-hover">
                <CardContent className="p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-primary/10 border border-primary/20 group-hover:scale-105 transition-transform duration-200">
                      <CalendarIcon size={20} className="text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                          {appt.provider?.user?.full_name || "Provider"}
                        </p>
                        {appt.provider?.specialization && (
                          <span className="text-xs text-primary/70 bg-primary/5 px-2 py-1 rounded shrink-0">
                            {appt.provider.specialization}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-muted font-mono">
                        {appt.appointment_date} at {appt.time_slot}
                      </p>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {appt.is_paid ? (
                          <span className="text-[11px] font-semibold text-green-600 bg-green-50 border border-green-200 px-2 py-1 rounded-full inline-flex items-center gap-1 select-none">
                            ✓ Paid
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full inline-flex items-center gap-1 select-none">
                            ○ Unpaid
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={appt.status} />
                </CardContent>
              </Card>
            </Link>
          ))}

          {list.length === 0 && (
            <div className="text-center py-24 text-text-muted border border-dashed border-border/40 rounded-2xl bg-surface-1/10 backdrop-blur-xs">
              <p>No appointments found.</p>
              <Link
                to="/customer/providers"
                className="inline-block mt-3 text-sm text-primary hover:underline font-semibold"
              >
                Book your first appointment →
              </Link>
            </div>
          )}
          {list.length > 0 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          )}
        </div>
      )}
    </div>
  );
}
