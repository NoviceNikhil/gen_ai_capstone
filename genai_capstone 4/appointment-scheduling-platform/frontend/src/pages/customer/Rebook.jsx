import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMyAppointmentsAPI } from "../../services/apiService";
import LoadingSpinner from "../../components/LoadingSpinner";
import toast from "react-hot-toast";

export default function RebookPage() {
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setLoadError(false);
        const res = await getMyAppointmentsAPI({ limit: 50 });
        setAppointments(res.data?.data?.appointments || []);
      } catch (e) {
        setLoadError(true);
        toast.error(e?.response?.data?.message || "Failed to load rebook data");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const list = useMemo(() => {
    const base = appointments.filter((a) => ["completed", "cancelled"].includes(a.status));
    if (!search.trim()) return base;
    return base.filter((a) =>
      (a.provider?.user?.full_name || "").toLowerCase().includes(search.toLowerCase())
    );
  }, [appointments, search]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 max-w-6xl animate-fade-in">
      <h1 className="text-3xl font-bold mb-1">Rebook</h1>
      <p className="text-sm text-text-muted mb-4">Quickly book again with same provider</p>

      <input
        className="input-field mb-5"
        placeholder="Search provider"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="grid gap-3">
        {list.map((item) => (
          <div key={item.id} className="rounded-xl border border-border bg-surface-1 p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold">{item.provider?.user?.full_name || "Provider"}</p>
              <p className="text-xs text-text-faint">{item.appointment_date} · {item.time_slot} · {item.status}</p>
            </div>
            <button
              className="btn-primary px-4 py-2 text-sm"
              onClick={() => navigate(`/customer/providers/${item.provider_id}`)}
            >
              Rebook
            </button>
          </div>
        ))}
        {loadError && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-600 font-semibold">Failed to load your appointment history. Try again later.</div>}
        {!loadError && list.length === 0 && <div className="rounded-xl border border-border bg-surface-1 p-6 text-text-muted">No rebook history</div>}
      </div>
    </div>
  );
}
