import { useState } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Clock,
  DollarSign,
  FileText,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

export default function ProviderPolicies() {
  const [policies, setPolicies] = useState([
    {
      id: 1,
      name: "Standard Cancellation",
      serviceName: "All Services",
      cancellationWindow: 24,
      feePercent: 50,
      graceExceptions: 5,
      status: "active",
    },
    {
      id: 2,
      name: "Premium Package",
      serviceName: "Premium Assessment",
      cancellationWindow: 48,
      feePercent: 75,
      graceExceptions: 2,
      status: "active",
    },
    {
      id: 3,
      name: "Consultation Only",
      serviceName: "Initial Consultation",
      cancellationWindow: 12,
      feePercent: 25,
      graceExceptions: 8,
      status: "active",
    },
  ]);

  const [reschedulePolicies, setReschedulePolicies] = useState([
    { id: 1, name: "Same Service Rebook", days: 14, fee: 0, conversions: 87 },
    { id: 2, name: "Different Service", days: 7, fee: 15, conversions: 62 },
  ]);

  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    serviceName: "",
    cancellationWindow: "",
    feePercent: "",
    graceExceptions: "",
  });

  const handleAddPolicy = () => {
    if (
      formData.name &&
      formData.serviceName &&
      formData.cancellationWindow &&
      formData.feePercent !== ""
    ) {
      if (editingPolicy) {
        setPolicies(
          policies.map((p) =>
            p.id === editingPolicy.id
              ? {
                  ...editingPolicy,
                  ...formData,
                  cancellationWindow: parseInt(formData.cancellationWindow),
                  feePercent: parseInt(formData.feePercent),
                  graceExceptions: parseInt(formData.graceExceptions),
                }
              : p,
          ),
        );
        setEditingPolicy(null);
      } else {
        setPolicies([
          ...policies,
          {
            id: Date.now(),
            ...formData,
            cancellationWindow: parseInt(formData.cancellationWindow),
            feePercent: parseInt(formData.feePercent),
            graceExceptions: parseInt(formData.graceExceptions),
            status: "active",
          },
        ]);
      }
      setFormData({
        name: "",
        serviceName: "",
        cancellationWindow: "",
        feePercent: "",
        graceExceptions: "",
      });
      setShowPolicyForm(false);
    }
  };

  const handleEditPolicy = (policy) => {
    setEditingPolicy(policy);
    setFormData(policy);
    setShowPolicyForm(true);
  };

  const handleDeletePolicy = (id) => {
    setPolicies(policies.filter((p) => p.id !== id));
  };

  const handleTogglePolicy = (id) => {
    setPolicies(
      policies.map((p) =>
        p.id === id
          ? { ...p, status: p.status === "active" ? "inactive" : "active" }
          : p,
      ),
    );
  };

  const totalFeeRevenue = policies.reduce(
    (sum, p) => sum + p.feePercent * 3,
    0,
  ); // Assuming 3 cancellations per policy
  const activePolicies = policies.filter((p) => p.status === "active").length;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">
          Cancellation & Rescheduling Policies
        </h1>
        <p className="text-sm md:text-base text-text-muted font-medium">
          Manage cutoff windows, fees, and exception handling
        </p>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="glass-card p-5">
          <p className="text-[11px] uppercase tracking-widest font-black text-text-faint mb-3 flex items-center gap-2">
            <FileText size={14} /> Active Policies
          </p>
          <p className="text-2xl font-black">{activePolicies}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-[11px] uppercase tracking-widest font-black text-text-faint mb-3 flex items-center gap-2">
            <DollarSign size={14} /> Fee Recovery
          </p>
          <p className="text-2xl font-black">${totalFeeRevenue.toFixed(0)}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-[11px] uppercase tracking-widest font-black text-text-faint mb-3 flex items-center gap-2">
            <Clock size={14} /> Avg Cutoff
          </p>
          <p className="text-2xl font-black">
            {Math.round(
              policies.reduce((sum, p) => sum + p.cancellationWindow, 0) /
                policies.length,
            )}
            h
          </p>
        </div>
        <div className="glass-card p-5">
          <p className="text-[11px] uppercase tracking-widest font-black text-text-faint mb-3">
            Grace Requests
          </p>
          <p className="text-2xl font-black">
            {policies.reduce((sum, p) => sum + p.graceExceptions, 0)}
          </p>
        </div>
      </div>

      {/* ─── Cancellation Policies ─── */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-black">
            Cancellation & No-Show Policies
          </h2>
          <button
            onClick={() => {
              setEditingPolicy(null);
              setFormData({
                name: "",
                serviceName: "",
                cancellationWindow: "",
                feePercent: "",
                graceExceptions: "",
              });
              setShowPolicyForm(!showPolicyForm);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white font-bold hover:opacity-90 transition-all"
          >
            <Plus size={16} /> Add Policy
          </button>
        </div>

        {/* ─── Policy Form ─── */}
        {showPolicyForm && (
          <div className="glass-card p-6 mb-6 border-l-4 border-primary">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <input
                type="text"
                placeholder="Policy Name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="input-field"
              />
              <select
                value={formData.serviceName}
                onChange={(e) =>
                  setFormData({ ...formData, serviceName: e.target.value })
                }
                className="input-field"
              >
                <option value="">Select Service</option>
                <option value="All Services">All Services</option>
                <option value="Initial Consultation">
                  Initial Consultation
                </option>
                <option value="Premium Assessment">Premium Assessment</option>
              </select>
              <input
                type="number"
                placeholder="Cancellation Window (hours)"
                value={formData.cancellationWindow}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    cancellationWindow: e.target.value,
                  })
                }
                className="input-field"
              />
              <input
                type="number"
                placeholder="No-Show Fee (%)"
                value={formData.feePercent}
                onChange={(e) =>
                  setFormData({ ...formData, feePercent: e.target.value })
                }
                className="input-field"
                min="0"
                max="100"
              />
              <input
                type="number"
                placeholder="Grace Exceptions per Month"
                value={formData.graceExceptions}
                onChange={(e) =>
                  setFormData({ ...formData, graceExceptions: e.target.value })
                }
                className="input-field"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleAddPolicy}
                className="px-4 py-2 bg-primary text-white rounded-lg font-bold hover:opacity-90 transition-all"
              >
                {editingPolicy ? "Update Policy" : "Create Policy"}
              </button>
              <button
                onClick={() => setShowPolicyForm(false)}
                className="px-4 py-2 border border-border rounded-lg font-bold hover:bg-surface-2 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ─── Policies List ─── */}
        <div className="space-y-3">
          {policies.map((policy) => (
            <div
              key={policy.id}
              className="glass-card p-6 hover:border-primary/50 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-lg">{policy.name}</h3>
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-bold ${
                        policy.status === "active"
                          ? "bg-success/10 text-success"
                          : "bg-text-faint/10 text-text-faint"
                      }`}
                    >
                      {policy.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-text-muted">
                    Applies to: {policy.serviceName}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditPolicy(policy)}
                    className="p-2 hover:bg-surface-2 rounded transition-colors"
                  >
                    <Edit2 size={16} className="text-primary" />
                  </button>
                  <button
                    onClick={() => handleDeletePolicy(policy.id)}
                    className="p-2 hover:bg-surface-2 rounded transition-colors"
                  >
                    <Trash2 size={16} className="text-error" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-border">
                <div>
                  <p className="text-xs text-text-faint uppercase font-bold mb-1">
                    Cancellation Cutoff
                  </p>
                  <p className="text-lg font-black">
                    {policy.cancellationWindow}h
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-faint uppercase font-bold mb-1">
                    No-Show Fee
                  </p>
                  <p className="text-lg font-black">{policy.feePercent}%</p>
                </div>
                <div>
                  <p className="text-xs text-text-faint uppercase font-bold mb-1">
                    Grace Exceptions
                  </p>
                  <p className="text-lg font-black">
                    {policy.graceExceptions}/mo
                  </p>
                </div>
                <button
                  onClick={() => handleTogglePolicy(policy.id)}
                  className="col-span-1 px-3 py-2 border border-border rounded-lg hover:bg-surface-2 transition-all font-bold text-sm"
                >
                  {policy.status === "active" ? "Disable" : "Enable"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Rescheduling Incentives ─── */}
      <section className="mb-8">
        <h2 className="text-xl font-black mb-5">Rescheduling Incentives</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reschedulePolicies.map((policy) => (
            <div key={policy.id} className="glass-card p-5">
              <h3 className="font-bold mb-4">{policy.name}</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-text-muted">Rebook within:</span>
                  <span className="font-bold">{policy.days} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Rescheduling fee:</span>
                  <span className="font-bold">${policy.fee.toFixed(0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Conversion rate:</span>
                  <span className="font-bold text-accent">
                    {policy.conversions}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Info Card ─── */}
      <div className="glass-card p-6 border-l-4 border-accent">
        <div className="flex gap-3">
          <AlertCircle className="text-accent flex-shrink-0" size={20} />
          <div>
            <p className="font-bold text-sm mb-1">
              Policy Acceptance & Compliance
            </p>
            <p className="text-xs text-text-muted">
              Policies are accepted by customers during booking. Clear
              cancellation terms reduce disputes and improve customer
              satisfaction. Monitor no-shows and adjust grace periods based on
              customer feedback.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
