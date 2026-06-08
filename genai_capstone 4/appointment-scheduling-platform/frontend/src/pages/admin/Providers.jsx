import { useEffect, useState } from "react";
import { getAdminProvidersAPI, verifyProviderAPI, listOrganizationsAPI, assignProviderToOrgAPI, removeProviderFromOrgAPI } from "../../services/apiService";
import { downloadAdminProvidersReport } from "../../services/reportService";
import { Search, Download, ShieldCheck, ShieldOff, Star, MapPin, Briefcase, Building2, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";
import AdminAIInsightPanel from "../../components/AdminAIInsightPanel";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const GridSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    {[...Array(4)].map((_, idx) => (
      <div key={idx} className="skeleton w-full h-[230px]" />
    ))}
  </div>
);

export default function AdminProviders() {
  const [data, setData] = useState({ providers: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isVerified, setIsVerified] = useState("");
  const [organizations, setOrganizations] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [expandedProviderId, setExpandedProviderId] = useState(null);

  const load = (s = search, v = isVerified) => {
    setLoading(true);
    getAdminProvidersAPI({ search: s || undefined, is_verified: v === "" ? undefined : v === "true", limit: 40 })
      .then((res) => setData(res.data?.data || { providers: [], total: 0 }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    loadOrganizations();
  }, []);

  const loadOrganizations = () => {
    listOrganizationsAPI({ approved_only: true, limit: 100 })
      .then((res) => setOrganizations(res.data?.data || []))
      .catch(() => toast.error("Failed to load organizations"));
  };

  const handleVerify = async (id, current) => {
    const promise = verifyProviderAPI(id, { is_verified: !current });
    toast.promise(promise, {
      loading: "Processing verification...",
      success: `Expert ${!current ? "verified" : "status reset"}`,
      error: "Verification update failed",
    });
    await promise;
    load();
  };

  const handleOpenOrgDialog = (provider) => {
    setSelectedProvider(provider);
    setSelectedOrgId(provider.organization_id || "");
  };

  const handleAssignOrganization = async () => {
    if (!selectedProvider || !selectedOrgId) return toast.error("Please select an organization");
    
    setAssigning(true);
    try {
      await assignProviderToOrgAPI(selectedOrgId, selectedProvider.id);
      toast.success("Provider assigned to organization");
      setSelectedProvider(null);
      load();
    } catch {
      toast.error("Failed to assign provider");
    } finally {
      setAssigning(false);
    }
  };

  const handleRemoveFromOrganization = async (provider) => {
    if (!provider.organization_id) return;
    
    if (!window.confirm("Remove provider from organization?")) return;
    
    try {
      await removeProviderFromOrgAPI(provider.organization_id, provider.id);
      toast.success("Provider removed from organization");
      load();
    } catch {
      toast.error("Failed to remove provider");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Expert Roster</h1>
          <p className="text-sm text-text-muted mt-1">Vet and manage professional service providers on the platform.</p>
        </div>
        <Button 
          onClick={() => downloadAdminProvidersReport().catch(() => toast.error("Export failed"))} 
          variant="outline"
          size="sm"
          className="gap-1.5 cursor-pointer"
        >
          <Download size={14} /> Provider Data
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 group">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-faint group-focus-within:text-primary transition-colors shrink-0 pointer-events-none" />
          <Input 
            className="pl-11" 
            placeholder="Search by name, expertise, or email..." 
            value={search}
            onChange={(e) => { setSearch(e.target.value); load(e.target.value, isVerified); }} 
          />
        </div>
        <div className="w-full md:w-56">
          <Select value={isVerified} onValueChange={(val) => { setIsVerified(val); load(search, val); }}>
            <SelectTrigger>
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Statuses</SelectItem>
              <SelectItem value="true">Verified Experts</SelectItem>
              <SelectItem value="false">Pending Approval</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <GridSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {data.providers.map((p) => (
            <div key={p.id}>
              <Card variant="glass-hover" className="p-6">
                <CardContent className="p-0 flex flex-col justify-between h-full">
                  <div className="flex items-start justify-between mb-5 gap-4">
                     <div className="flex items-center gap-4 min-w-0">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold text-white text-xl shadow-md group-hover:scale-105 transition-transform duration-200 shrink-0">
                           {p.user?.full_name?.[0]}
                        </div>
                        <div className="min-w-0">
                           <h3 className="text-base font-bold text-foreground truncate">{p.user?.full_name}</h3>
                           <p className="text-[10px] font-bold text-primary uppercase tracking-wider">{p.specialization}</p>
                           <p className="text-[11px] text-text-muted mt-1 font-mono truncate">{p.user?.email}</p>
                        </div>
                     </div>
                     <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${
                        p.is_verified
                          ? "bg-accent/10 text-accent border-accent/20"
                          : "bg-status-pending/10 text-status-pending border-status-pending/20"
                     }`}>
                        {p.is_verified ? "Verified" : "Pending"}
                     </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-6">
                     <div className="flex items-center gap-2 text-xs text-text-muted">
                        <Briefcase size={13} className="text-text-faint/80 shrink-0" />
                        <span className="truncate">{p.category?.name || "No Category"}</span>
                     </div>
                     <div className="flex items-center gap-2 text-xs text-text-muted">
                        <Star size={13} className="text-status-pending shrink-0 fill-status-pending" />
                        <span>{parseFloat(p.avg_rating).toFixed(1)} Rating</span>
                     </div>
                     <div className="flex items-center gap-2 text-xs text-text-muted col-span-2">
                        <MapPin size={13} className="text-text-faint/80 shrink-0" />
                        <span className="truncate">{p.location || "Remote"}</span>
                     </div>
                     {p.organization && (
                       <div className="flex items-center gap-2 text-xs text-primary col-span-2">
                          <Building2 size={13} className="shrink-0" />
                          <span className="truncate font-medium">{p.organization.name}</span>
                       </div>
                     )}
                    {p.onboarding?.owner_name && (
                      <div className="col-span-2 text-xs text-text-muted">
                        <span className="font-semibold text-foreground">Owner:</span>{" "}
                        {p.onboarding.owner_name}
                      </div>
                    )}
                    {p.onboarding?.tax_number && (
                      <div className="col-span-2 text-xs text-text-muted">
                        <span className="font-semibold text-foreground">Tax:</span>{" "}
                        {p.onboarding.tax_number}
                      </div>
                    )}
                    {p.onboarding?.submitted_for_approval && (
                      <div className="col-span-2 text-[10px] font-bold uppercase tracking-wider text-status-pending">
                        Submitted for admin approval
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-border/40 gap-2">
                     <div className="flex flex-col">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-text-faint">Consultation Fee</span>
                        <span className="text-base font-bold text-foreground">₹{p.consultation_fee}</span>
                     </div>
                     <div className="flex gap-1.5 ml-auto">
                       <Button
                          onClick={() => setExpandedProviderId(expandedProviderId === p.id ? null : p.id)}
                          size="xs"
                          variant="outline"
                          className="gap-1.5 cursor-pointer"
                        >
                          {expandedProviderId === p.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </Button>
                       <Button
                          onClick={() => handleOpenOrgDialog(p)}
                          size="xs"
                          variant="outline"
                          className="gap-1.5 cursor-pointer"
                        >
                          <Building2 size={12} />
                        </Button>
                       <Button
  onClick={() => handleVerify(p.id, p.is_verified)}
  size="xs"
  className={`gap-1.5 cursor-pointer border ${
    p.is_verified
      ? "bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/15"
      : "bg-green-100 text-black border-green-200 hover:bg-green-200"
  }`}
>
  {p.is_verified ? (
    <>
      <ShieldOff size={12} /> Revoke
    </>
  ) : (
    <>
      <ShieldCheck size={12} /> Approve
    </>
  )}
</Button>
                     </div>
                  </div>
                </CardContent>
              </Card>

              {/* AI Insights Section - Expandable */}
              {expandedProviderId === p.id && (
                <Card className="mt-2 p-4 bg-blue-50/30 border-blue-200/50">
                  <CardContent className="p-0">
                    <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                      <span>🤖 AI Document Verification</span>
                    </h4>
                    <AdminAIInsightPanel providerOnboardingId={p.onboarding?.id || p.id} />
                  </CardContent>
                </Card>
              )}
            </div>
          ))}
          {data.providers.length === 0 && (
             <div className="col-span-full py-24 text-center border border-dashed border-border/40 rounded-2xl bg-surface-1/10 backdrop-blur-xs">
                <ShieldCheck size={40} className="text-text-faint/80 mx-auto mb-3" />
                <p className="font-bold text-sm text-foreground">No providers match filters</p>
                <p className="text-xs mt-0.5 text-text-muted">Try clearing your search or status filters.</p>
             </div>
          )}
        </div>
      )}

      {/* Organization Assignment Dialog */}
      {selectedProvider && (
        <Dialog open={!!selectedProvider} onOpenChange={() => setSelectedProvider(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Assign Organization</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Provider: {selectedProvider.user?.full_name}</p>
                <p className="text-xs text-text-muted">{selectedProvider.specialization}</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-text-muted">Organization</label>
                <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No Organization</SelectItem>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-border/40">
                <Button
                  variant="outline"
                  onClick={() => setSelectedProvider(null)}
                  disabled={assigning}
                >
                  Cancel
                </Button>
                {selectedProvider.organization_id && (
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive gap-1.5"
                    onClick={() => handleRemoveFromOrganization(selectedProvider)}
                    disabled={assigning}
                  >
                    <Trash2 size={14} /> Remove
                  </Button>
                )}
                <Button
                  onClick={handleAssignOrganization}
                  disabled={assigning || !selectedOrgId}
                >
                  {assigning ? "Assigning..." : "Assign"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
