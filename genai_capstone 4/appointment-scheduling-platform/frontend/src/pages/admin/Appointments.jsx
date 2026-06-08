import { useEffect, useMemo, useState } from "react";
import { getAdminAppointmentsAPI } from "../../services/apiService";
import { downloadAdminAppointmentsReport } from "../../services/reportService";
import {
  Download,
  Calendar as CalIcon,
  Clock,
  CreditCard,
  User,
  Briefcase,
} from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import StatusBadge from "../../components/ui/StatusBadge";
import { APPOINTMENT_STATUSES } from "../../utils/constants";
import {
  AdminPieChart,
  AdminLineChart,
  AdminBarChart,
} from "@/components/admin/AdminCharts";

const TableSkeleton = () => (
  <div className="space-y-3 w-full animate-fade-in">
    {[...Array(6)].map((_, idx) => (
      <div key={idx} className="skeleton w-full h-[64px]" />
    ))}
  </div>
);

export default function AdminAppointments() {
  const [data, setData] = useState({ appointments: [], total: 0 });
  const [loading, setLoading] = useState(true);

  // server-side status filter
  const [status, setStatus] = useState("");

  // client-side filters
  const [paymentFilter, setPaymentFilter] = useState(""); // "paid" | "unpaid" | ""
  const [segmentKey, setSegmentKey] = useState(""); // "paid" | "unpaid" | any status

  const load = (s = status) => {
    setLoading(true);
    getAdminAppointmentsAPI({ status: s || undefined, limit: 200 })
      .then((res) => setData(res.data?.data || { appointments: [], total: 0 }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredAppointments = useMemo(() => {
    let arr = Array.isArray(data.appointments) ? data.appointments : [];

    if (paymentFilter) {
      const wantsPaid = paymentFilter === "paid";
      arr = arr.filter((a) => Boolean(a.is_paid) === wantsPaid);
    }

    if (segmentKey === "paid") {
      arr = arr.filter((a) => Boolean(a.is_paid));
    } else if (segmentKey === "unpaid") {
      arr = arr.filter((a) => !Boolean(a.is_paid));
    } else if (APPOINTMENT_STATUSES.map(String).includes(String(segmentKey))) {
      arr = arr.filter((a) => String(a.status) === String(segmentKey));
    }

    return arr;
  }, [data.appointments, paymentFilter, segmentKey]);

  const paymentMix = useMemo(() => {
    const paid = filteredAppointments.filter((a) => Boolean(a.is_paid)).length;
    const unpaid = filteredAppointments.length - paid;
    return [
      { name: "Paid", key: "paid", value: paid, fill: "#10b981" },
      { name: "Unpaid", key: "unpaid", value: unpaid, fill: "#ef4444" },
    ];
  }, [filteredAppointments]);

  const statusMix = useMemo(() => {
    const counts = {};
    for (const a of filteredAppointments) {
      const k = String(a.status || "pending");
      counts[k] = (counts[k] || 0) + 1;
    }
    const palette = ["#f59e0b", "#2563eb", "#10b981", "#ef4444"];
    return APPOINTMENT_STATUSES.map((s, idx) => ({
      name: String(s),
      key: s,
      value: counts[s] || 0,
      fill: palette[idx % palette.length],
    })).filter((d) => d.value > 0 || filteredAppointments.length === 0);
  }, [filteredAppointments]);

  const dailyTrend = useMemo(() => {
    const map = new Map();
    for (const a of filteredAppointments) {
      const day = a.appointment_date ? String(a.appointment_date) : "unknown";
      map.set(day, (map.get(day) || 0) + 1);
    }
    const entries = Array.from(map.entries())
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      .slice(-7);

    return entries.map(([d, count]) => ({
      x: d === "unknown" ? "Unknown" : d.slice(5),
      y: count,
    }));
  }, [filteredAppointments]);

  const topCategories = useMemo(() => {
    const counts = {};
    for (const a of filteredAppointments) {
      const k = a.category?.name || "Uncategorized";
      counts[k] = (counts[k] || 0) + 1;
    }

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
      .map((d) => ({ x: d.name, y: d.value }));
  }, [filteredAppointments]);

  const clearClientFilters = () => {
    setPaymentFilter("");
    setSegmentKey("");
  };

  const handleExport = () => {
    const promise = downloadAdminAppointmentsReport({
      status: status || undefined,
    });

    toast.promise(promise, {
      loading: "Compiling Excel report...",
      success: "Report downloaded successfully",
      error: "Report generation failed",
    });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Global Schedule
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Monitoring and logging all system transactions and appointments
            (analytics enabled).
          </p>
        </div>

        <div className="flex gap-3 items-center flex-wrap">
          <Button
            onClick={handleExport}
            variant="outline"
            size="sm"
            className="gap-1.5 cursor-pointer"
          >
            <Download size={14} /> Full Export
          </Button>

          {(paymentFilter || segmentKey) && (
            <Button
              onClick={clearClientFilters}
              variant="secondary"
              size="sm"
              className="cursor-pointer"
            >
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      <Tabs
        value={status}
        onValueChange={(val) => {
          setStatus(val);
          clearClientFilters();
          load(val);
        }}
        className="w-full"
      >
        <TabsList>
          <TabsTrigger value="">All Records</TabsTrigger>
          {APPOINTMENT_STATUSES.map((s) => (
            <TabsTrigger key={s} value={s} className="capitalize">
              {s}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <AdminPieChart
            title="Payment Status"
            subtitle="Click to filter table"
            data={paymentMix}
            height={250}
            onClickSegment={(payload) => {
              const key = payload?.key || payload?.name;
              if (!key) return;
              setSegmentKey(String(key));
              setPaymentFilter("");
            }}
          />

          <Card variant="glass" className="p-6 mt-6">
            <CardContent className="space-y-4">
              <div className="text-sm font-bold uppercase tracking-wider text-text-faint">
                Quick filters
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  size="sm"
                  variant={paymentFilter === "paid" ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => {
                    setPaymentFilter(paymentFilter === "paid" ? "" : "paid");
                    setSegmentKey("");
                  }}
                >
                  <CreditCard size={14} /> Paid
                </Button>

                <Button
                  size="sm"
                  variant={paymentFilter === "unpaid" ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => {
                    setPaymentFilter(
                      paymentFilter === "unpaid" ? "" : "unpaid",
                    );
                    setSegmentKey("");
                  }}
                >
                  <CreditCard size={14} /> Unpaid
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="cursor-pointer"
                  onClick={clearClientFilters}
                >
                  Reset
                </Button>
              </div>

              <div className="rounded-xl border border-border/40 bg-surface-1/20 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-text-faint">
                  Current view
                </p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {filteredAppointments.length}
                  <span className="text-sm font-semibold text-text-muted ml-2">
                    appointments
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <AdminLineChart
            title="Appointments Over Time"
            subtitle="Last 7 dates in current filter"
            data={dailyTrend}
            xKey="x"
            height={240}
            lines={[
              {
                dataKey: "y",
                name: "Appointments",
                stroke: "#C4441A",
                strokeWidth: 3,
              },
            ]}
          />

          <AdminBarChart
            title="Top Categories"
            subtitle="Most common categories"
            data={topCategories}
            xKey="x"
            height={200}
            bars={[{ dataKey: "y", name: "Appointments", fill: "#3D5A47" }]}
          />

          <AdminPieChart
            title="Status Mix"
            subtitle="Click to filter table by status"
            data={statusMix}
            height={240}
            onClickSegment={(payload) => {
              const key = payload?.key || payload?.name;
              if (!key) return;
              setSegmentKey(String(key));
              setPaymentFilter("");
            }}
          />
        </div>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : (
        <Card
          variant="glass"
          className="overflow-hidden p-0 border border-border/40"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer / Provider</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Metadata</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Payment</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredAppointments.map((a) => (
                <TableRow key={a.id} className="group">
                  <TableCell>
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <User size={12} className="text-primary shrink-0" />
                        <span className="text-sm font-semibold text-foreground truncate">
                          {a.customer?.full_name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Briefcase size={12} className="text-accent shrink-0" />
                        <span className="text-xs text-text-muted truncate">
                          {a.provider?.user?.full_name}
                        </span>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-col gap-1 font-mono text-xs text-text-muted">
                      <div className="flex items-center gap-1.5">
                        <CalIcon
                          size={12}
                          className="text-text-faint/80 shrink-0"
                        />{" "}
                        {a.appointment_date}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock
                          size={12}
                          className="text-text-faint/80 shrink-0"
                        />{" "}
                        {a.time_slot}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-text-faint bg-surface-2 border border-border/40 px-2 py-0.5 rounded">
                      {a.category?.name || "Uncategorized"}
                    </span>
                  </TableCell>

                  <TableCell className="text-center">
                    <StatusBadge status={a.status} />
                  </TableCell>

                  <TableCell className="text-right">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider ${
                        a.is_paid
                          ? "bg-accent/10 text-accent border-accent/20"
                          : "bg-status-pending/10 text-status-pending border-status-pending/20"
                      }`}
                    >
                      <CreditCard size={11} className="shrink-0" />
                      {a.is_paid ? "Settled" : "Unpaid"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredAppointments.length === 0 && (
            <div className="text-center py-24 text-text-muted border-t border-border/40 bg-surface-1/10 backdrop-blur-xs">
              <CalIcon size={40} className="text-text-faint/80 mx-auto mb-3" />
              <p className="font-bold text-sm text-foreground">
                No records found
              </p>
              <p className="text-xs mt-0.5">
                No appointments match the selected filters.
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
