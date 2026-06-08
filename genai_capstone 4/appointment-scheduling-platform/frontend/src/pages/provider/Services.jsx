import { useEffect, useMemo, useState } from "react";
import { Plus, Edit2, Clock, DollarSign, Package } from "lucide-react";
import toast from "react-hot-toast";

import {
  getProviderOfferingsAPI,
  saveProviderOfferingAPI,
} from "../../services/apiService";

export default function ProviderServices() {
  const [offerings, setOfferings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(true);

  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    duration_minutes: 30,
    price: "",
    description: "",
  });

  const refreshOfferings = async () => {
    try {
      const res = await getProviderOfferingsAPI();
      setOfferings(res.data?.data?.offerings || []);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load offerings");
      setOfferings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshOfferings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const active = offerings || [];
    const avgPrice =
      active.length > 0
        ? active.reduce((sum, o) => sum + Number(o.price || 0), 0) / active.length
        : 0;
    const avgDuration =
      active.length > 0
        ? active.reduce((sum, o) => sum + Number(o.duration_minutes || 0), 0) /
          active.length
        : 0;

    return {
      count: active.length,
      avgPrice,
      avgDuration,
    };
  }, [offerings]);

  const handleStartCreate = () => {
    setEditingId(null);
    setFormData({ title: "", duration_minutes: 30, price: "", description: "" });
    setShowForm(true);
  };

  const handleStartEdit = (offering) => {
    setEditingId(offering.id);
    setFormData({
      title: offering.title || "",
      duration_minutes: Number(offering.duration_minutes || 30),
      price: String(offering.price ?? ""),
      description: offering.description || "",
    });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const title = formData.title?.trim();
    const duration_minutes = Number(formData.duration_minutes);
    const price = Number(formData.price);

    if (!title) return toast.error("Service name is required.");
    if (!Number.isFinite(duration_minutes) || duration_minutes <= 0) {
      return toast.error("Duration must be greater than 0.");
    }
    if (!Number.isFinite(price) || price <= 0) {
      return toast.error("Price must be greater than 0.");
    }

    try {
      await saveProviderOfferingAPI({
        id: editingId || undefined,
        title,
        description: formData.description || undefined,
        duration_minutes,
        price,
        is_active: true,
      });

      toast.success(editingId ? "Service updated" : "Service created");
      setShowForm(false);
      setEditingId(null);
      await refreshOfferings();
      setFormData({ title: "", duration_minutes: 30, price: "", description: "" });
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save service");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">
          Services
        </h1>
        <p className="text-sm md:text-base text-text-muted font-medium">
          Create and manage the services customers can book from.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="glass-card p-5">
          <p className="text-[11px] uppercase tracking-widest font-black text-text-faint mb-3 flex items-center gap-2">
            <Package size={14} /> Active Services
          </p>
          <p className="text-2xl font-black">{stats.count}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-[11px] uppercase tracking-widest font-black text-text-faint mb-3 flex items-center gap-2">
            <DollarSign size={14} /> Avg Price
          </p>
          <p className="text-2xl font-black">₹{stats.avgPrice.toFixed(2)}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-[11px] uppercase tracking-widest font-black text-text-faint mb-3 flex items-center gap-2">
            <Clock size={14} /> Avg Duration
          </p>
          <p className="text-2xl font-black">{Math.round(stats.avgDuration)}m</p>
        </div>
      </div>

      {/* Services */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-black">Your Services</h2>
          <button
            onClick={handleStartCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white font-bold hover:opacity-90 transition-all"
          >
            <Plus size={16} /> Add Service
          </button>
        </div>

        {showForm && (
          <div className="glass-card p-6 mb-6 border-l-4 border-primary">
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-muted ml-0.5">
                    Service Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Nutrition Consultation"
                    value={formData.title}
                    onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                    className="input-field"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-muted ml-0.5">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    placeholder="Duration"
                    value={formData.duration_minutes}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        duration_minutes: Number(e.target.value),
                      }))
                    }
                    className="input-field"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-muted ml-0.5">
                    Price (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="Price"
                    value={formData.price}
                    onChange={(e) => setFormData((p) => ({ ...p, price: e.target.value }))}
                    className="input-field"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-muted ml-0.5">
                    Description (optional)
                  </label>
                  <textarea
                    placeholder="Short description customers will see"
                    value={formData.description}
                    onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                    className="input-field min-h-[80px]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-lg font-bold hover:opacity-90 transition-all cursor-pointer"
                >
                  {editingId ? "Update Service" : "Create Service"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    setFormData({ title: "", duration_minutes: 30, price: "", description: "" });
                  }}
                  className="px-4 py-2 border border-border rounded-lg font-bold hover:bg-surface-2 transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="skeleton w-full h-[120px] rounded-xl" />
        ) : offerings.length === 0 ? (
          <div className="text-center py-20 text-text-muted border border-dashed border-border/40 rounded-2xl bg-surface-1/10 backdrop-blur-xs">
            <p>No services configured yet.</p>
            <p className="text-xs text-text-faint mt-1">Add your first service to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {offerings.map((offering) => (
              <div
                key={offering.id}
                className="glass-card p-5 hover:border-primary/50 transition-all"
              >
                <div className="flex items-start justify-between mb-3 gap-3">
                  <div>
                    <h3 className="font-bold text-sm mb-1">{offering.title}</h3>
                    {offering.description ? (
                      <p className="text-xs text-text-muted line-clamp-2">{offering.description}</p>
                    ) : null}
                  </div>
                  <button
                    onClick={() => handleStartEdit(offering)}
                    className="p-2 hover:bg-surface-2 rounded transition-colors"
                    aria-label="Edit service"
                  >
                    <Edit2 size={14} className="text-primary" />
                  </button>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Duration:</span>
                    <span className="font-bold">{offering.duration_minutes}m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Price:</span>
                    <span className="font-bold text-primary">
                      ₹{Number(offering.price || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Status:</span>
                    <span className="text-xs px-2 py-1 rounded bg-surface-2 font-bold">
                      {offering.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
