import { useEffect, useState } from "react";
import { getAdminUsersAPI, updateUserStatusAPI } from "../../services/apiService";
import { downloadAdminUsersReport } from "../../services/reportService";
import { Search, Download, UserCircle, Mail, Phone, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminPieChart } from "@/components/admin/AdminCharts";
import { useMemo } from "react";

const TableSkeleton = () => (
  <div className="space-y-3 w-full animate-fade-in">
    {[...Array(6)].map((_, idx) => (
      <div key={idx} className="skeleton w-full h-[64px]" />
    ))}
  </div>
);

export default function AdminUsers() {
  const [data, setData] = useState({ users: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");

  const load = (s = search, r = role) => {
    setLoading(true);
    getAdminUsersAPI({ search: s || undefined, role: r || undefined, limit: 40 })
      .then((res) => setData(res.data?.data || { users: [], total: 0 }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const roleMix = useMemo(() => {
    const counts = {};
    for (const u of data.users) {
      const r = u.role || "unknown";
      counts[r] = (counts[r] || 0) + 1;
    }
    const palette = ["#2563eb", "#10b981", "#ef4444", "#f59e0b"];
    return Object.entries(counts).map(([name, count], idx) => ({
      name,
      key: name,
      value: count,
      fill: palette[idx % palette.length],
    })).filter(d => d.value > 0);
  }, [data.users]);

  const statusMix = useMemo(() => {
    const active = data.users.filter(u => u.is_active).length;
    const inactive = data.users.length - active;
    return [
      { name: "Active", key: "active", value: active, fill: "#10b981" },
      { name: "Disabled", key: "disabled", value: inactive, fill: "#ef4444" }
    ].filter(d => d.value > 0);
  }, [data.users]);

  const toggleStatus = async (id, currentStatus) => {
    // Optimistic UI update
    setData(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === id ? { ...u, is_active: !currentStatus } : u)
    }));

    const promise = updateUserStatusAPI(id, { is_active: !currentStatus });
    toast.promise(promise, {
      loading: "Updating status...",
      success: "User profile updated",
      error: "Modification failed",
    });
    
    try {
      await promise;
    } catch (e) {
      // Revert on failure
      setData(prev => ({
        ...prev,
        users: prev.users.map(u => u.id === id ? { ...u, is_active: currentStatus } : u)
      }));
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">User Directory</h1>
          <p className="text-sm text-text-muted mt-1">Manage platform access and permissions for {data.total} registered users.</p>
        </div>
        <Button 
          onClick={() => downloadAdminUsersReport().catch(() => toast.error("Export failed"))} 
          variant="outline"
          size="sm"
          className="gap-1.5 cursor-pointer"
        >
          <Download size={14} /> Global Export
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AdminPieChart
          title="Role Distribution"
          subtitle="Click to filter by role"
          data={roleMix}
          height={220}
          onClickSegment={(payload) => {
            const key = payload?.key;
            if (key) {
              setRole(key);
              load(search, key);
            }
          }}
        />
        <AdminPieChart
          title="Account Status"
          subtitle="Active vs Disabled users"
          data={statusMix}
          height={220}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 group">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-faint group-focus-within:text-primary transition-colors shrink-0 pointer-events-none" />
          <Input 
            className="pl-11" 
            placeholder="Filter by name, email, or phone..." 
            value={search}
            onChange={(e) => { setSearch(e.target.value); load(e.target.value, role); }} 
          />
        </div>
        <div className="w-full md:w-56">
          <Select value={role || "all"} onValueChange={(val) => { const r = val === "all" ? "" : val; setRole(r); load(search, r); }}>
            <SelectTrigger>
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="customer">Customers</SelectItem>
              <SelectItem value="provider">Providers</SelectItem>
              <SelectItem value="organization">Organizations</SelectItem>
              <SelectItem value="admin">Administrators</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : (
        <Card variant="glass" className="overflow-hidden p-0 border border-border/40">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Identity</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-center">Role</TableHead>
                <TableHead className="text-center">Security</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.users.map((u) => (
                <TableRow key={u.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                       <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-xs group-hover:scale-105 transition-transform duration-200">
                          {u.full_name?.[0]}
                       </div>
                       <p className="font-semibold text-foreground text-sm">{u.full_name}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 font-mono text-xs">
                      <div className="flex items-center gap-2 text-text-muted">
                         <Mail size={11} className="text-text-faint/80 shrink-0" /> {u.email}
                      </div>
                      <div className="flex items-center gap-2 text-text-muted">
                         <Phone size={11} className="text-text-faint/80 shrink-0" /> {u.phone}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                      u.role === 'admin' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                      u.role === 'organization' ? 'bg-teal-500/10 text-teal-500 border-teal-500/20' :
                      u.role === 'provider' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                      'bg-primary/10 text-primary border-primary/20'
                    }`}>
                      {u.role}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                     <div className="flex justify-center items-center gap-1.5">
                        {u.is_verified ? (
                          <div className="flex items-center gap-1 text-accent text-[10px] font-bold uppercase tracking-wider">
                             <ShieldCheck size={12} /> Verified
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-text-faint uppercase tracking-wider">Unverified</span>
                        )}
                     </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-3 select-none">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${u.is_active ? "text-success" : "text-destructive"}`}>
                        Account Status: {u.is_active ? "Enabled" : "Disabled"}
                      </span>
                      <Switch
                        checked={u.is_active}
                        onCheckedChange={() => {
                          const action = u.is_active ? "disable" : "enable";
                          if (window.confirm(`Are you sure you want to ${action} this user's account?`)) {
                            toggleStatus(u.id, u.is_active);
                          }
                        }}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {data.users.length === 0 && (
            <div className="text-center py-24 text-text-muted border-t border-border/40 bg-surface-1/10 backdrop-blur-xs">
               <UserCircle size={40} className="text-text-faint/80 mx-auto mb-3" />
               <p className="font-bold text-sm text-foreground">No records found</p>
               <p className="text-xs mt-0.5">Adjust your filters or search terms.</p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
