import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchProviderAppointments, updateAppointmentStatus } from "../../store/providerSlice";
import StatusBadge from "../../components/ui/StatusBadge";
import { Link } from "react-router-dom";
import { APPOINTMENT_STATUSES } from "../../utils/constants";
import toast from "react-hot-toast";
import { Check, Flag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Pagination from "../../components/ui/Pagination";

const AppointmentsSkeleton = () => (
  <div className="flex flex-col gap-3">
    {[...Array(4)].map((_, idx) => (
      <div key={idx} className="skeleton w-full h-[96px]" />
    ))}
  </div>
);

export default function ProviderAppointments() {
  const dispatch = useDispatch();
  const { appointments, loading, apptsTotalPages } = useSelector((s) => s.providers);
  const [filter, setFilter] = useState("confirmed");
  const [page, setPage] = useState(1);

  useEffect(() => {
    dispatch(fetchProviderAppointments({ status: filter || undefined, limit: 10, page }));
  }, [dispatch, filter, page]);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  const handleAction = async (id, action) => {
    const res = await dispatch(updateAppointmentStatus({ id, action }));
    if (updateAppointmentStatus.fulfilled.match(res)) {
      toast.success(`Appointment ${action}ed`);
      dispatch(fetchProviderAppointments({ status: filter || undefined, limit: 10, page }));
    } else {
      toast.error(res.payload?.message || "Action failed");
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in space-y-6">
      <div className="border-b border-border/40 pb-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Appointments Queue</h1>
        <p className="text-xs text-text-muted mt-1">Review confirmed booking requests and manage client schedules.</p>
      </div>

      <Tabs value={filter} onValueChange={setFilter} className="w-full">
        <TabsList>
          <TabsTrigger value="">All</TabsTrigger>
          {APPOINTMENT_STATUSES.filter(s => s !== "pending").map((s) => (
            <TabsTrigger key={s} value={s} className="capitalize">
              {s}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading ? (
        <AppointmentsSkeleton />
      ) : (
        <div className="flex flex-col gap-3">
          {appointments.map((appt) => (
            <Card key={appt.id} variant="glass-hover" className="p-5">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-0">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm truncate">{appt.customer?.full_name}</p>
                  <p className="text-xs text-text-muted mt-1 font-mono">
                    {appt.appointment_date} at {appt.time_slot}
                  </p>
                  {appt.notes && (
                    <p className="text-xs text-text-faint/80 mt-1.5 leading-relaxed italic">
                      "{appt.notes}"
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={appt.status} />
                  {appt.status === "pending" && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleAction(appt.id, "confirm")}
                        size="xs"
                        className="bg-success/15 text-success hover:bg-success/20 border border-success/35 gap-1 cursor-pointer"
                      >
                        <Check size={12} /> Confirm
                      </Button>
                    </div>
                  )}
                  {appt.status === "confirmed" && (
                    <Button
                      onClick={() => handleAction(appt.id, "complete")}
                      size="xs"
                      className="bg-primary/15 text-primary hover:bg-primary/20 border border-primary/35 gap-1 cursor-pointer"
                    >
                      <Flag size={12} /> Complete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {appointments.length === 0 && (
            <div className="text-center py-20 text-text-muted border border-dashed border-border/40 rounded-2xl bg-surface-1/10 backdrop-blur-xs">
              No appointments found in this status.
            </div>
          )}
          {appointments.length > 0 && (
            <Pagination
              page={page}
              totalPages={apptsTotalPages}
              onPageChange={setPage}
            />
          )}
        </div>
      )}
    </div>
  );
}
