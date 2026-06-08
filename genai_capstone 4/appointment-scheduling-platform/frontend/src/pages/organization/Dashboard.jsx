import { useState, useEffect, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate, useLocation } from "react-router-dom";
import { fetchProfile } from "../../store/authSlice";
import {
  LayoutDashboard, Users, UserPlus, Calendar, DollarSign,
  AlertCircle, Search, Check, X, TrendingUp, Building2,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  getOrgEmployeesAPI,
  getOrgJoinRequestsAPI,
  respondOrgJoinRequestAPI,
  getOrgAppointmentsAPI,
  getOrgRevenueAPI,
} from "../../services/apiService";

const palette = ["#C4441A", "#3D5A47", "#C4941A", "#4F46E5", "#0EA5E9", "#F97316"];

function StatusBadge({ status }) {
  const map = {
    pending:   "bg-amber-500/10 text-amber-500 border-amber-500/20",
    confirmed: "bg-primary/10 text-primary border-primary/20",
    completed: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${map[status] || "bg-muted text-muted-foreground border-border"}`}>
      {status}
    </span>
  );
}

// ── Employees Tab ─────────────────────────────────────────────────────────────
function EmployeesTab() {
  const [employees, setEmployees] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    (s = search, p = page) => {
      setLoading(true);
      getOrgEmployeesAPI({ search: s || undefined, page: p, limit: 20 })
        .then((res) => {
          const d = res.data?.data || {};
          setEmployees(d.employees || []);
          setTotal(d.total || 0);
        })
        .catch(() => toast.error("Failed to load employees"))
        .finally(() => setLoading(false));
    },
    [search, page]
  );

  useEffect(() => { load(); }, [load]);

  const handleSearch = (v) => {
    setSearch(v);
    setPage(1);
    load(v, 1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
            className="pl-9 h-10"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <span className="text-xs text-muted-foreground">{total} total</span>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="skeleton h-12 w-full rounded-lg" />)}</div>
      ) : employees.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No employees found{search ? ` for "${search}"` : ""}.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Role / Designation</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Date Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-semibold text-foreground">{emp.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{emp.role}</td>
                  <td className="px-4 py-3 text-muted-foreground">{emp.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{emp.date_joined || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Join Requests Tab ─────────────────────────────────────────────────────────
function JoinRequestsTab() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    getOrgJoinRequestsAPI()
      .then((res) => setRequests((res.data?.data?.requests) || []))
      .catch(() => toast.error("Failed to load join requests"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRespond = async (id, status) => {
    setProcessing(id);
    try {
      await respondOrgJoinRequestAPI(id, { status, approval_notes: "" });
      toast.success(status === "approved" ? "Request approved!" : "Request rejected");
      setRequests((r) => r.filter((x) => x.id !== id));
    } catch {
      toast.error("Failed to process request");
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-16 w-full rounded-lg" />)}</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <UserPlus size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No pending join requests.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-card/80 transition-colors">
              <div>
                <p className="font-bold text-foreground text-sm">{req.requester_name}</p>
                <p className="text-xs text-muted-foreground">{req.email}</p>
                <p className="text-xs text-primary mt-1">{req.requested_role}</p>
                <p className="text-[10px] text-muted-foreground">Requested: {req.date_requested}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-destructive border-destructive/20 hover:bg-destructive/10"
                  onClick={() => handleRespond(req.id, "rejected")}
                  disabled={processing === req.id}
                >
                  <X size={14} className="mr-1" /> Reject
                </Button>
                <Button
                  size="sm"
                  className="h-8 bg-emerald-500 hover:bg-emerald-600 text-white"
                  onClick={() => handleRespond(req.id, "approved")}
                  disabled={processing === req.id}
                >
                  <Check size={14} className="mr-1" /> Approve
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Appointments Tab ──────────────────────────────────────────────────────────
function AppointmentsTab() {
  const [appointments, setAppointments] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    (p = page, sf = statusFilter, fd = fromDate, td = toDate) => {
      setLoading(true);
      getOrgAppointmentsAPI({ page: p, limit: 20, status: sf || undefined, from_date: fd || undefined, to_date: td || undefined })
        .then((res) => {
          const d = res.data?.data || {};
          setAppointments(d.appointments || []);
          setTotal(d.total || 0);
          setTotalPages(d.total_pages || 1);
        })
        .catch(() => toast.error("Failed to load appointments"))
        .finally(() => setLoading(false));
    },
    [page, statusFilter, fromDate, toDate]
  );

  useEffect(() => {
    load(page, statusFilter, fromDate, toDate);
  }, [page, statusFilter, fromDate, toDate, load]);

  const handleFilter = () => setPage(1);

  const STATUS_OPTIONS = ["", "pending", "confirmed", "completed", "cancelled"];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Status</label>
          <select
            className="h-9 rounded-lg border border-border bg-background text-sm px-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s || "All Statuses"}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">From</label>
          <Input type="date" className="h-9 w-36 bg-background border-border" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">To</label>
          <Input type="date" className="h-9 w-36 bg-background border-border" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <Button size="sm" variant="outline" onClick={handleFilter} className="h-9">Apply Filters</Button>
        <span className="text-xs text-muted-foreground self-end pb-1">{total} total</span>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="skeleton h-12 w-full rounded-lg" />)}</div>
      ) : appointments.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Calendar size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No appointments found for the selected filters.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">ID</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Provider</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {appointments.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground font-mono text-[10px]">{a.id.slice(0, 8)}…</td>
                    <td className="px-4 py-3 font-medium text-foreground">{a.customer_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.provider_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.date} {a.time_slot}</td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-3 text-right font-bold text-foreground">₹{a.amount.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <span className="text-xs self-center text-muted-foreground">Page {page} / {totalPages}</span>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Revenue Tab ───────────────────────────────────────────────────────────────
function RevenueTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOrgRevenueAPI()
      .then((res) => setData(res.data?.data || null))
      .catch(() => toast.error("Failed to load revenue data"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  if (!data) return <p className="text-sm text-muted-foreground">No revenue data available.</p>;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
            <DollarSign size={12} /> Total Revenue
          </p>
          <p className="text-2xl font-black text-foreground">₹{Number(data.total_revenue).toLocaleString("en-IN")}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
            <TrendingUp size={12} /> This Month
          </p>
          <p className="text-2xl font-black text-foreground">₹{Number(data.this_month_revenue).toLocaleString("en-IN")}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
            <Calendar size={12} /> Total Appointments
          </p>
          <p className="text-2xl font-black text-foreground">{data.total_appointments}</p>
        </div>
      </div>

      {/* Monthly trend chart */}
      {data.monthly_breakdown?.length > 0 && (
        <div className="glass-card p-5">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Monthly Revenue Trend</p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.monthly_breakdown} margin={{ left: 8, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="var(--color-text-faint)" />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--color-text-faint)" />
              <Tooltip
                contentStyle={{ backgroundColor: "var(--color-surface-1)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 11 }}
                formatter={(v) => [`₹${Number(v).toLocaleString("en-IN")}`, "Revenue"]}
              />
              <Line type="monotone" dataKey="revenue" stroke="#166534" strokeWidth={2.5} dot name="Revenue (₹)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Per Provider */}
        {data.per_provider?.length > 0 && (
          <div className="glass-card p-5">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Revenue by Provider</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.per_provider} layout="vertical" margin={{ left: 0, right: 16 }}>
                <XAxis type="number" tick={{ fontSize: 10 }} stroke="var(--color-text-faint)" />
                <YAxis type="category" dataKey="provider" tick={{ fontSize: 10 }} width={100} stroke="var(--color-text-faint)" />
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString("en-IN")}`, "Revenue"]}
                  contentStyle={{ backgroundColor: "var(--color-surface-1)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                  {data.per_provider.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Per Service Type */}
        {data.per_service_type?.length > 0 && (
          <div className="glass-card p-5">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Revenue by Service Type</p>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={data.per_service_type} dataKey="revenue" nameKey="service_type"
                  cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3}>
                  {data.per_service_type.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString("en-IN")}`, "Revenue"]}
                  contentStyle={{ backgroundColor: "var(--color-surface-1)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab({ isPending, onNavigateTab }) {
  const [stats, setStats] = useState({ employees: 0, joinRequests: 0, appointments: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isPending) {
      setLoading(false);
      return;
    }
    Promise.all([
      getOrgEmployeesAPI({ page: 1, limit: 1 }),
      getOrgJoinRequestsAPI(),
      getOrgRevenueAPI(),
    ])
      .then(([empRes, joinRes, revRes]) => {
        setStats({
          employees: empRes.data?.data?.total ?? 0,
          joinRequests: joinRes.data?.data?.total ?? (joinRes.data?.data?.requests?.length ?? 0),
          appointments: revRes.data?.data?.total_appointments ?? 0,
          revenue: revRes.data?.data?.total_revenue ?? 0,
        });
      })
      .catch(() => toast.error("Failed to load overview stats"))
      .finally(() => setLoading(false));
  }, [isPending]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-28 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card
          className={`bg-card border-border cursor-pointer hover:border-primary/40 transition-colors ${isPending ? "opacity-50 pointer-events-none" : ""}`}
          onClick={() => !isPending && onNavigateTab("employees")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.employees}</div>
            <p className="text-xs text-muted-foreground mt-1">Active providers in your org</p>
          </CardContent>
        </Card>
        <Card
          className={`bg-card border-border cursor-pointer hover:border-primary/40 transition-colors ${isPending ? "opacity-50 pointer-events-none" : ""}`}
          onClick={() => !isPending && onNavigateTab("join-requests")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Join Requests</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.joinRequests}</div>
            <p className="text-xs text-muted-foreground mt-1">Pending provider applications</p>
          </CardContent>
        </Card>
        <Card
          className={`bg-card border-border cursor-pointer hover:border-primary/40 transition-colors ${isPending ? "opacity-50 pointer-events-none" : ""}`}
          onClick={() => !isPending && onNavigateTab("appointments")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Appointments</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.appointments}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all providers</p>
          </CardContent>
        </Card>
        <Card
          className={`bg-card border-border cursor-pointer hover:border-primary/40 transition-colors ${isPending ? "opacity-50 pointer-events-none" : ""}`}
          onClick={() => !isPending && onNavigateTab("revenue")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{Number(stats.revenue).toLocaleString("en-IN")}</div>
            <p className="text-xs text-muted-foreground mt-1">From paid appointments</p>
          </CardContent>
        </Card>
      </div>
      {!isPending && (
        <p className="text-xs text-muted-foreground text-center">
          Use the tabs above to manage your team, review join requests, track appointments, and view revenue analytics.
        </p>
      )}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function OrganizationDashboard() {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const navigate = useNavigate();
  const location = useLocation();
  const isPending = user?.org_status === "pending";

  // Read tab from query string
  const queryParams = new URLSearchParams(location.search);
  const activeTab = queryParams.get("tab") || "overview";

  useEffect(() => {
    dispatch(fetchProfile());
  }, [dispatch]);

  // Redirect to onboarding if not yet completed
  useEffect(() => {
    if (user && user.onboarding_completed === false) {
      navigate("/onboarding/organisation");
    }
  }, [user, navigate]);

  // Handler to change tab and update URL
  const handleTabChange = useCallback((newTab) => {
    if (newTab === "overview") {
      navigate("/organization/dashboard");
    } else {
      navigate(`/organization/dashboard?tab=${newTab}`);
    }
  }, [navigate]);

  return (
    <div className="p-8 space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <Building2 size={28} className="text-primary" />
            {user?.org_name || "Organisation Dashboard"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your team, requests, appointments, and revenue in one place.
          </p>
        </div>
      </div>

      {/* Pending approval banner */}
      {isPending && (
        <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={18} />
          <div>
            <h3 className="text-amber-500 font-bold text-sm">Approval Pending</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Your organisation is awaiting admin approval. Some features may be limited until approved.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="w-full grid grid-cols-5 mb-4">
          <TabsTrigger value="overview" className="flex items-center gap-1.5 text-xs">
            <LayoutDashboard size={13} /> Overview
          </TabsTrigger>
          <TabsTrigger value="employees" className="flex items-center gap-1.5 text-xs" disabled={isPending}>
            <Users size={13} /> Employees
          </TabsTrigger>
          <TabsTrigger value="join-requests" className="flex items-center gap-1.5 text-xs" disabled={isPending}>
            <UserPlus size={13} /> Join Requests
          </TabsTrigger>
          <TabsTrigger value="appointments" className="flex items-center gap-1.5 text-xs" disabled={isPending}>
            <Calendar size={13} /> Appointments
          </TabsTrigger>
          <TabsTrigger value="revenue" className="flex items-center gap-1.5 text-xs" disabled={isPending}>
            <DollarSign size={13} /> Revenue
          </TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview">
          <OverviewTab isPending={isPending} onNavigateTab={handleTabChange} />
        </TabsContent>

        <TabsContent value="employees">
          <EmployeesTab />
        </TabsContent>

        <TabsContent value="join-requests">
          <JoinRequestsTab />
        </TabsContent>

        <TabsContent value="appointments">
          <AppointmentsTab />
        </TabsContent>

        <TabsContent value="revenue">
          <RevenueTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
