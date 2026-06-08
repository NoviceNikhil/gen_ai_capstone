import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { 
  getProviderOrganizationAPI, 
  requestOrganizationCreationAPI,
  listOrganizationsAPI,
  requestJoinOrganizationAPI,
  getJoinRequestsAPI,
  approveJoinRequestAPI,
  leaveProviderOrganizationAPI,
  getProviderPendingJoinRequestsAPI
} from "../../services/apiService";
import { Building2, Mail, MapPin, Phone, CheckCircle2, AlertCircle, Search, UserPlus, X, Check, LogOut, Clock } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const isSafeLogoUrl = (url) => {
  if (!url) return false;
  try {
    const parsed = new URL(url, window.location.origin);
    return !["localhost", "127.0.0.1"].includes(parsed.hostname);
  } catch {
    return false;
  }
};

function JoinRequestsList({ orgId }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    getJoinRequestsAPI(orgId)
      .then(res => setRequests(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [orgId]);

  const handleApprove = async (reqId, status) => {
    setProcessing(reqId);
    try {
      await approveJoinRequestAPI(reqId, { status, approval_notes: "" });
      toast.success(status === "approved" ? "Provider approved!" : "Request rejected");
      setRequests(requests.filter(r => r.id !== reqId));
    } catch (error) {
      toast.error(error.response?.data?.detail || "Action failed");
    } finally {
      setProcessing(null);
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading requests...</div>;
  if (requests.length === 0) return null;

  return (
    <div className="mt-8 border-t border-border pt-8">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <UserPlus size={18} className="text-primary" /> Pending Join Requests
      </h3>
      <div className="space-y-4">
        {requests.map(req => (
          <div key={req.id} className="flex items-center justify-between p-4 rounded-lg bg-surface-2/50 border border-border/50">
            <div>
              <p className="font-bold text-sm">{req.provider_name}</p>
              <p className="text-xs text-muted-foreground">{req.provider_specialization}</p>
            </div>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                className="h-8 text-destructive border-destructive/20 hover:bg-destructive/10"
                onClick={() => handleApprove(req.id, "rejected")}
                disabled={processing === req.id}
              >
                <X size={14} className="mr-1" /> Reject
              </Button>
              <Button 
                size="sm" 
                className="h-8 bg-emerald-500 hover:bg-emerald-600 text-white"
                onClick={() => handleApprove(req.id, "approved")}
                disabled={processing === req.id}
              >
                <Check size={14} className="mr-1" /> Approve
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProviderPendingJoinRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProviderPendingJoinRequestsAPI()
      .then(res => {
        setRequests(res.data?.data?.requests || []);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-sm text-muted-foreground">Loading pending requests...</div>;
  if (requests.length === 0) return null;

  return (
    <Card className="border-border bg-card mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock size={18} className="text-warning" /> Pending Join Requests
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {requests.map(req => (
            <div key={req.id} className="flex items-center justify-between p-4 rounded-lg bg-surface-2/50 border border-warning/20">
              <div>
                <p className="font-bold text-foreground">{req.organization_name}</p>
                {req.organization_location && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin size={12} /> {req.organization_location}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Requested: {new Date(req.requested_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-warning/10 text-warning">
                  <Clock size={12} className="mr-1" /> Pending
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProviderOrganization() {
  const user = useSelector(state => state.auth.user);
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [isLeavingOrg, setIsLeavingOrg] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const [orgsList, setOrgsList] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [joiningOrgId, setJoiningOrgId] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    location: "",
    logo_url: "",
    contact_email: "",
    contact_phone: "",
    metadata_json: "{}"
  });

  const fetchOrg = () => {
    setLoading(true);
    getProviderOrganizationAPI()
      .then(res => {
        if (res.data?.data?.organization) {
          setOrganization(res.data.data.organization);
        } else {
          // If no org, fetch list for the join tab
          fetchOrgsList();
        }
      })
      .catch(err => console.error("Error fetching org", err))
      .finally(() => setLoading(false));
  };

  const fetchOrgsList = () => {
    listOrganizationsAPI({ limit: 100 })
      .then(res => setOrgsList(res.data.filter(o => o.is_approved)))
      .catch(err => console.error("Error fetching orgs list", err));
  };

  useEffect(() => {
    fetchOrg();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) return toast.error("Organization name is required");
    
    setIsSubmitting(true);
    try {
      await requestOrganizationCreationAPI(formData);
      toast.success("Organization creation requested successfully!");
      setRequestSubmitted(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to submit request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinSubmit = async (orgId) => {
    setJoiningOrgId(orgId);
    try {
      await requestJoinOrganizationAPI(orgId);
      toast.success("Join request submitted successfully!");
      setRequestSubmitted(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to submit request");
    } finally {
      setJoiningOrgId(null);
    }
  };

  const handleLeaveOrganization = async () => {
    setIsLeavingOrg(true);
    try {
      await leaveProviderOrganizationAPI();
      toast.success("You have left the organization successfully!");
      setShowLeaveConfirm(false);
      setOrganization(null);
      fetchOrgsList();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to leave organization");
    } finally {
      setIsLeavingOrg(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-6">
        <div className="skeleton h-10 w-48 mb-6" />
        <div className="skeleton h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  // View 2: Request creation success state
  if (requestSubmitted) {
    return (
      <div className="p-8 max-w-4xl mx-auto animate-fade-in text-center py-20">
        <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-6">
          <AlertCircle size={32} className="text-warning" />
        </div>
        <h2 className="text-2xl font-black mb-2 text-foreground">Request Submitted</h2>
        <p className="text-muted-foreground max-w-md mx-auto mb-8">
          Your request has been successfully submitted for approval.
          You will be notified once it is processed.
        </p>
      </div>
    );
  }

  const filteredOrgs = orgsList.filter(o => 
    o.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (o.location && o.location.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // View 1: Provider is already in an Organization
  if (organization) {
    const isOrgAdmin = user?.id === organization.admin_user_id;

    return (
      <div className="p-8 max-w-4xl mx-auto animate-fade-in">
        <h1 className="text-3xl font-black mb-8 text-foreground">My Organization</h1>
        
        {showLeaveConfirm && (
          <Card className="border-destructive/30 bg-destructive/5 mb-6">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="text-destructive flex-shrink-0 mt-1" size={20} />
                <div className="flex-1">
                  <h3 className="font-bold text-foreground mb-2">Leave Organization?</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Are you sure you want to leave <strong>{organization.name}</strong>? After leaving, you can request to join another organization.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleLeaveOrganization}
                      disabled={isLeavingOrg}
                      className="text-white"
                    >
                      {isLeavingOrg ? "Leaving..." : "Yes, Leave"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowLeaveConfirm(false)}
                      disabled={isLeavingOrg}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-border bg-card overflow-hidden">
          <div className="h-24 bg-primary/10 relative">
            <div className="absolute -bottom-8 left-6 border-4 border-card rounded-lg overflow-hidden bg-card w-16 h-16 flex items-center justify-center">
              {isSafeLogoUrl(organization.logo_url) ? (
                <img src={organization.logo_url} alt={organization.name} className="w-full h-full object-cover" />
              ) : (
                <Building2 size={24} className="text-primary/50" />
              )}
            </div>
          </div>
          <CardContent className="pt-12 pb-6 px-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold mb-1 text-foreground">{organization.name}</h2>
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  {organization.is_approved ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      <CheckCircle2 size={12} /> Approved
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-bold text-warning bg-warning/10 px-2 py-0.5 rounded-full">
                      <AlertCircle size={12} /> Pending Approval
                    </span>
                  )}
                  {organization.location && (
                    <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <MapPin size={12} /> {organization.location}
                    </span>
                  )}
                  {isOrgAdmin && (
                    <span className="flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      Org Admin
                    </span>
                  )}
                </div>
              </div>
              {!isOrgAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive border-destructive/20 hover:bg-destructive/10"
                  onClick={() => setShowLeaveConfirm(true)}
                >
                  <LogOut size={14} className="mr-1" /> Leave Organization
                </Button>
              )}
            </div>
            {organization.description && (
              <p className="text-sm text-foreground/80 mb-6 max-w-2xl">{organization.description}</p>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border pt-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail size={14} className="text-primary" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Contact Email</p>
                  <p className="text-sm font-semibold">{organization.contact_email || "N/A"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Phone size={14} className="text-primary" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Contact Phone</p>
                  <p className="text-sm font-semibold">{organization.contact_phone || "N/A"}</p>
                </div>
              </div>
            </div>

            {isOrgAdmin && organization.is_approved && (
              <JoinRequestsList orgId={organization.id} />
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // View 3: Provider is not in an organization and hasn't submitted yet
  return (
    <div className="p-8 max-w-3xl mx-auto animate-fade-in">
      <h1 className="text-3xl font-black mb-2 text-foreground">Organization Setup</h1>
      <p className="text-muted-foreground mb-8">
        You are currently operating as an independent provider. You can request to join an existing organization or create a new one.
      </p>

      <ProviderPendingJoinRequests />

      <Tabs defaultValue="join" className="w-full mt-8">
       
        
        <TabsContent value="join" className="space-y-4">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle>Join Organization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input 
                  placeholder="Search organizations by name or location..." 
                  className="pl-9 h-11"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {filteredOrgs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">No organizations found.</p>
                ) : (
                  filteredOrgs.map(org => (
                    <div key={org.id} className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-surface-2/30 hover:bg-surface-2/80 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Building2 size={18} className="text-primary" />
                        </div>
                        <div>
                          <p className="font-bold text-foreground text-sm">{org.name}</p>
                          {org.location && <p className="text-xs text-muted-foreground">{org.location}</p>}
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => handleJoinSubmit(org.id)}
                        disabled={joiningOrgId === org.id}
                      >
                        {joiningOrgId === org.id ? "Sending..." : "Request to Join"}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* <TabsContent value="create" className="space-y-4">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle>Request New Organization</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Organization Name *
                  </label>
                  <Input
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g. Manipal Hospitals"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Description
                  </label>
                  <Textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="A brief description of your organization..."
                    className="min-h-[100px]"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Location
                    </label>
                    <Input
                      name="location"
                      value={formData.location}
                      onChange={handleChange}
                      placeholder="e.g. Bengaluru, India"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Logo URL
                    </label>
                    <Input
                      name="logo_url"
                      value={formData.logo_url}
                      onChange={handleChange}
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Contact Email
                    </label>
                    <Input
                      name="contact_email"
                      type="email"
                      value={formData.contact_email}
                      onChange={handleChange}
                      placeholder="admin@hospital.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Contact Phone
                    </label>
                    <Input
                      name="contact_phone"
                      value={formData.contact_phone}
                      onChange={handleChange}
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>

                <Button type="submit" disabled={isSubmitting} className="w-full mt-2">
                  {isSubmitting ? "Submitting Request..." : "Submit Organization Request"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent> */}
      </Tabs>
    </div>
  );
}
