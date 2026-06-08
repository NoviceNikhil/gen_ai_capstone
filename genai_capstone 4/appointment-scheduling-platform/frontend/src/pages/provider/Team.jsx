import { useState } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Users,
  Calendar,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function ProviderTeam() {
  const [staffMembers, setStaffMembers] = useState([
    {
      id: 1,
      name: "Emma Thompson",
      role: "Senior Consultant",
      certification: "Certified",
      utilization: 92,
      status: "active",
      nextShift: "Today 2:00 PM",
    },
    {
      id: 2,
      name: "James Park",
      role: "Consultant",
      certification: "Certified",
      utilization: 78,
      status: "active",
      nextShift: "Tomorrow 10:00 AM",
    },
    {
      id: 3,
      name: "Sarah Johnson",
      role: "Assistant",
      certification: "Training",
      utilization: 45,
      status: "active",
      nextShift: "Today 6:00 PM",
    },
    {
      id: 4,
      name: "Michael Chen",
      role: "Senior Consultant",
      certification: "Certified",
      utilization: 88,
      status: "on-leave",
      nextShift: "Jun 10, 9:00 AM",
    },
  ]);

  const [shifts, setShifts] = useState([
    {
      id: 1,
      date: "Today",
      time: "9:00 AM - 1:00 PM",
      staff: "Emma Thompson",
      available: true,
      bookings: 8,
    },
    {
      id: 2,
      date: "Today",
      time: "2:00 PM - 6:00 PM",
      staff: "James Park",
      available: true,
      bookings: 6,
    },
    {
      id: 3,
      date: "Tomorrow",
      time: "10:00 AM - 2:00 PM",
      staff: "Sarah Johnson",
      available: false,
      bookings: 4,
    },
    {
      id: 4,
      date: "Tomorrow",
      time: "3:00 PM - 7:00 PM",
      staff: "Emma Thompson",
      available: true,
      bookings: 5,
    },
  ]);

  const [performanceData, setPerformanceData] = useState([
    { name: "Emma", completion: 98, punctuality: 96, satisfaction: 9.2 },
    { name: "James", completion: 94, punctuality: 92, satisfaction: 8.8 },
    { name: "Sarah", completion: 85, punctuality: 88, satisfaction: 8.5 },
    { name: "Michael", completion: 96, punctuality: 94, satisfaction: 9.1 },
  ]);

  const [showStaffForm, setShowStaffForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    role: "",
    certification: "",
  });

  const handleAddStaff = () => {
    if (formData.name && formData.role) {
      if (editingStaff) {
        setStaffMembers(
          staffMembers.map((s) =>
            s.id === editingStaff.id ? { ...editingStaff, ...formData } : s,
          ),
        );
        setEditingStaff(null);
      } else {
        setStaffMembers([
          ...staffMembers,
          {
            id: Date.now(),
            ...formData,
            utilization: 0,
            status: "active",
            nextShift: "Not scheduled",
          },
        ]);
      }
      setFormData({ name: "", role: "", certification: "" });
      setShowStaffForm(false);
    }
  };

  const handleEditStaff = (staff) => {
    setEditingStaff(staff);
    setFormData(staff);
    setShowStaffForm(true);
  };

  const handleDeleteStaff = (id) => {
    setStaffMembers(staffMembers.filter((s) => s.id !== id));
  };

  const handleToggleStatus = (id) => {
    setStaffMembers(
      staffMembers.map((s) =>
        s.id === id
          ? { ...s, status: s.status === "active" ? "on-leave" : "active" }
          : s,
      ),
    );
  };

  const activeStaff = staffMembers.filter((s) => s.status === "active").length;
  const avgUtilization = (
    staffMembers.reduce((sum, s) => sum + s.utilization, 0) /
    staffMembers.length
  ).toFixed(1);
  const openShifts = shifts.filter((s) => !s.available).length;
  const totalBookings = shifts.reduce((sum, s) => sum + s.bookings, 0);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">
          Team & Staff Management
        </h1>
        <p className="text-sm md:text-base text-text-muted font-medium">
          Coordinate shifts, assignments, and capacity management
        </p>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="glass-card p-5">
          <p className="text-[11px] uppercase tracking-widest font-black text-text-faint mb-3 flex items-center gap-2">
            <Users size={14} /> Staff Members
          </p>
          <p className="text-2xl font-black">{staffMembers.length}</p>
          <p className="text-xs text-success mt-2">{activeStaff} active</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-[11px] uppercase tracking-widest font-black text-text-faint mb-3 flex items-center gap-2">
            <TrendingUp size={14} /> Avg Utilization
          </p>
          <p className="text-2xl font-black">{avgUtilization}%</p>
          <p className="text-xs text-text-muted mt-2">All staff</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-[11px] uppercase tracking-widest font-black text-text-faint mb-3 flex items-center gap-2">
            <Calendar size={14} /> Shifts
          </p>
          <p className="text-2xl font-black">{shifts.length}</p>
          <p className="text-xs text-warning mt-2">{openShifts} unfilled</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-[11px] uppercase tracking-widest font-black text-text-faint mb-3">
            This Week Bookings
          </p>
          <p className="text-2xl font-black">{totalBookings}</p>
          <p className="text-xs text-text-muted mt-2">scheduled</p>
        </div>
      </div>

      {/* ─── Performance Analytics ─── */}
      <div className="glass-card p-6 mb-8">
        <h3 className="text-xs font-black uppercase tracking-widest text-text-faint mb-4">
          Staff Performance Metrics
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={performanceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="name" stroke="var(--color-text-faint)" />
            <YAxis stroke="var(--color-text-faint)" />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-surface-1)",
                border: "1px solid var(--color-border)",
              }}
              cursor={false}
            />
            <Legend />
            <Bar dataKey="completion" fill="#3D5A47" name="Completion %" />
            <Bar dataKey="punctuality" fill="#C4441A" name="Punctuality %" />
            <Bar
              dataKey="satisfaction"
              fill="#C4941A"
              name="Satisfaction (out of 10)"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ─── Staff Members Section ─── */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-black">Your Team</h2>
          <button
            onClick={() => {
              setEditingStaff(null);
              setFormData({ name: "", role: "", certification: "" });
              setShowStaffForm(!showStaffForm);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white font-bold hover:opacity-90 transition-all"
          >
            <Plus size={16} /> Add Staff Member
          </button>
        </div>

        {/* ─── Staff Form ─── */}
        {showStaffForm && (
          <div className="glass-card p-6 mb-6 border-l-4 border-primary">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <input
                type="text"
                placeholder="Full Name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="input-field"
              />
              <select
                value={formData.role}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value })
                }
                className="input-field"
              >
                <option value="">Select Role</option>
                <option value="Senior Consultant">Senior Consultant</option>
                <option value="Consultant">Consultant</option>
                <option value="Assistant">Assistant</option>
              </select>
              <select
                value={formData.certification}
                onChange={(e) =>
                  setFormData({ ...formData, certification: e.target.value })
                }
                className="input-field"
              >
                <option value="">Certification Status</option>
                <option value="Certified">Certified</option>
                <option value="Training">Training</option>
                <option value="Pending">Pending</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleAddStaff}
                className="px-4 py-2 bg-primary text-white rounded-lg font-bold hover:opacity-90 transition-all"
              >
                {editingStaff ? "Update Member" : "Add Member"}
              </button>
              <button
                onClick={() => setShowStaffForm(false)}
                className="px-4 py-2 border border-border rounded-lg font-bold hover:bg-surface-2 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ─── Staff Grid ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {staffMembers.map((staff) => (
            <div
              key={staff.id}
              className="glass-card p-5 hover:border-primary/50 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold">{staff.name}</h3>
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-bold ${
                        staff.status === "active"
                          ? "bg-success/10 text-success"
                          : "bg-warning/10 text-warning"
                      }`}
                    >
                      {staff.status === "active" ? "Active" : "On Leave"}
                    </span>
                  </div>
                  <p className="text-sm text-text-muted mb-2">{staff.role}</p>
                  <p className="text-xs text-text-faint">
                    📜 {staff.certification}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditStaff(staff)}
                    className="p-2 hover:bg-surface-2 rounded transition-colors"
                  >
                    <Edit2 size={14} className="text-primary" />
                  </button>
                  <button
                    onClick={() => handleDeleteStaff(staff.id)}
                    className="p-2 hover:bg-surface-2 rounded transition-colors"
                  >
                    <Trash2 size={14} className="text-error" />
                  </button>
                </div>
              </div>

              <div className="border-t border-border pt-3 mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Utilization:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-surface-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all"
                        style={{ width: `${staff.utilization}%` }}
                      />
                    </div>
                    <span className="font-bold">{staff.utilization}%</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Next Shift:</span>
                  <span className="font-bold text-xs">{staff.nextShift}</span>
                </div>
              </div>

              <button
                onClick={() => handleToggleStatus(staff.id)}
                className="w-full mt-3 px-3 py-2 border border-border rounded-lg hover:bg-surface-2 transition-all font-bold text-sm"
              >
                {staff.status === "active" ? "Mark Leave" : "Mark Active"}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Shift Schedule ─── */}
      <section className="mb-8">
        <h2 className="text-xl font-black mb-5 flex items-center gap-2">
          <Calendar size={20} /> Shift Schedule
        </h2>
        <div className="space-y-3">
          {shifts.map((shift) => (
            <div
              key={shift.id}
              className="glass-card p-5 flex items-start justify-between hover:border-primary/50 transition-all"
            >
              <div>
                <p className="font-bold">
                  {shift.date} • {shift.time}
                </p>
                <p className="text-sm text-text-muted mt-1">
                  Assigned to: {shift.staff}
                </p>
                <p className="text-xs text-text-faint mt-1">
                  📊 {shift.bookings} appointments
                </p>
              </div>
              <div className="flex items-center gap-3">
                {shift.available ? (
                  <span className="flex items-center gap-1 text-xs font-bold text-success px-2 py-1 rounded bg-success/10">
                    <CheckCircle2 size={14} /> Available
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-bold text-warning px-2 py-1 rounded bg-warning/10">
                    <AlertCircle size={14} /> Filling
                  </span>
                )}
                <button className="px-4 py-2 border border-border rounded-lg font-bold text-sm hover:bg-surface-2 transition-all">
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Info Card ─── */}
      <div className="glass-card p-6 border-l-4 border-accent">
        <div className="flex gap-3">
          <CheckCircle2 className="text-accent flex-shrink-0" size={20} />
          <div>
            <p className="font-bold text-sm mb-1">
              Capacity Planning Recommendations
            </p>
            <p className="text-xs text-text-muted">
              Consider adding more staff or adjusting shift hours if utilization
              exceeds 85%. Monitor performance metrics regularly to identify
              training needs. Rotate roles to prevent burnout.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
