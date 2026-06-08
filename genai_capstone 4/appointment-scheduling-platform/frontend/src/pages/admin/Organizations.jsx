import { useState, useEffect } from "react";
import {
  listOrganizationsAPI,
  deactivateOrganizationAPI,
  getOrganizationProvidersAPI,
} from "../../services/apiService";
import { Search, Building2, MapPin, Users, Eye, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const GridSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {[...Array(6)].map((_, idx) => (
      <div key={idx} className="skeleton w-full h-[250px]" />
    ))}
  </div>
);

export default function AdminOrganizations() {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [approvalFilter, setApprovalFilter] = useState("");
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [orgProviders, setOrgProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(false);

  const loadOrganizations = (s = search, approval = approvalFilter) => {
    setLoading(true);
    listOrganizationsAPI({
      approved_only: false,
      limit: 50,
      search: s || undefined,
    })
      .then((res) => {
        // Handle both array response and nested data structure
        let orgs = Array.isArray(res.data) ? res.data : res.data?.data || [];
        if (approval) {
          orgs = orgs.filter((o) => o.approval_status === approval);
        }
        setOrganizations(orgs);
      })
      .catch((err) => {
        console.error("Failed to load organizations:", err);
        toast.error("Failed to load organizations");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrganizations();
  }, []);

  const handleSearch = (val) => {
    setSearch(val);
    loadOrganizations(val, approvalFilter);
  };

  const handleApprovalFilter = (val) => {
    setApprovalFilter(val);
    loadOrganizations(search, val);
  };

  const handleViewDetails = async (org) => {
    setSelectedOrg(org);
    setLoadingProviders(true);
    try {
      const res = await getOrganizationProvidersAPI(org.id, { limit: 50 });
      setOrgProviders(res.data?.data || []);
    } catch {
      toast.error("Failed to load providers");
    } finally {
      setLoadingProviders(false);
    }
  };

  const handleDeactivate = async (id) => {
    if (
      !window.confirm("Are you sure you want to deactivate this organization?")
    )
      return;
    const promise = deactivateOrganizationAPI(id);
    toast.promise(promise, {
      loading: "Deactivating...",
      success: "Organization deactivated",
      error: "Failed to deactivate",
    });
    await promise;
    loadOrganizations();
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Building2 size={32} className="text-primary" />
            Organizations
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Manage service provider organizations and their memberships.
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 group">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-text-faint group-focus-within:text-primary transition-colors shrink-0 pointer-events-none"
          />
          <Input
            className="pl-11"
            placeholder="Search by name or location..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <div className="w-full md:w-56">
          <Select value={approvalFilter} onValueChange={handleApprovalFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <GridSkeleton />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {organizations.map((org) => (
            <Card key={org.id} variant="glass-hover" className="p-6">
              <CardContent className="p-0">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-lg shrink-0">
                    {org.name?.[0]}
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      org.approval_status === "approved"
                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200"
                        : org.approval_status === "pending"
                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200"
                          : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200"
                    }`}
                  >
                    {org.approval_status}
                  </span>
                </div>

                <h3 className="font-semibold text-foreground mb-2 line-clamp-2">
                  {org.name}
                </h3>

                {org.location && (
                  <div className="flex items-center gap-2 text-sm text-text-muted mb-3">
                    <MapPin size={14} />
                    {org.location}
                  </div>
                )}

                <div className="space-y-2 mb-4 text-sm text-text-muted">
                  {org.contact_email && <p>📧 {org.contact_email}</p>}
                  {org.contact_phone && <p>📞 {org.contact_phone}</p>}
                  {org.description && (
                    <p className="line-clamp-2">{org.description}</p>
                  )}
                </div>

                <div className="flex gap-2 pt-4 border-t border-border/40">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1.5"
                    onClick={() => handleViewDetails(org)}
                  >
                    <Eye size={14} /> Details
                  </Button>
                  {org.is_active && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => handleDeactivate(org.id)}
                    >
                      <Trash2 size={14} /> Deactivate
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Organization Details Modal */}
      {selectedOrg && (
        <Dialog open={!!selectedOrg} onOpenChange={() => setSelectedOrg(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedOrg.name}</DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              <div>
                <h4 className="font-semibold mb-2">Organization Details</h4>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-text-muted">Location:</span>{" "}
                    {selectedOrg.location || "N/A"}
                  </p>
                  <p>
                    <span className="text-text-muted">Email:</span>{" "}
                    {selectedOrg.contact_email || "N/A"}
                  </p>
                  <p>
                    <span className="text-text-muted">Phone:</span>{" "}
                    {selectedOrg.contact_phone || "N/A"}
                  </p>
                  <p>
                    <span className="text-text-muted">Status:</span>{" "}
                    {selectedOrg.is_active ? "Active" : "Inactive"}
                  </p>
                  <p>
                    <span className="text-text-muted">Approval:</span>{" "}
                    {selectedOrg.approval_status}
                  </p>
                  <p>
                    <span className="text-text-muted">Description:</span>{" "}
                    {selectedOrg.description || "N/A"}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Users size={16} />
                  Associated Providers ({orgProviders.length})
                </h4>
                {loadingProviders ? (
                  <p className="text-sm text-text-muted">
                    Loading providers...
                  </p>
                ) : orgProviders.length > 0 ? (
                  <div className="space-y-2">
                    {orgProviders.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 p-3 bg-surface rounded-lg border border-border/40"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {p.user?.full_name?.[0]}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {p.user?.full_name}
                          </p>
                          <p className="text-xs text-text-muted">
                            {p.specialization}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-text-muted">
                    No providers in this organization
                  </p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
