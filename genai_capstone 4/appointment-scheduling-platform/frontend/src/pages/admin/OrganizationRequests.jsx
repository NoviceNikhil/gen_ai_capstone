import { useState, useEffect } from "react";
import {
  getAllApprovalRequestsAPI,
  decideApprovalRequestAPI,
} from "../../services/apiService";
import { CheckCircle, XCircle, Building2, Clock, Users } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SkeletonCard = () => <div className="skeleton w-full h-[180px]" />;

export default function AdminOrganizationRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState(""); // all, organization, provider
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  const loadRequests = () => {
    setLoading(true);
    getAllApprovalRequestsAPI({ 
      request_type: filterType || undefined,
      limit: 50 
    })
      .then((res) => {
        let reqs = res.data?.data?.requests || [];
        setRequests(reqs);
      })
      .catch((err) => {
        console.error("Failed to load requests:", err);
        toast.error("Failed to load requests");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRequests();
  }, [filterType]);

  const handleApproval = async (approved) => {
    if (!selectedRequest) return;

    setProcessing(true);
    try {
      await decideApprovalRequestAPI(
        selectedRequest.id,
        selectedRequest.type,
        {
          status: approved ? "approved" : "rejected",
          notes: approvalNotes,
        }
      );
      toast.success(`Request ${approved ? "approved" : "rejected"}`);
      setSelectedRequest(null);
      setApprovalNotes("");
      loadRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to process request");
    } finally {
      setProcessing(false);
    }
  };

  const requestDetails = selectedRequest?.request_details || {};

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fade-in space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Clock size={32} className="text-primary" />
            Approval Requests
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Review and approve pending organization and provider requests.
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-foreground">
            {requests.length}
          </p>
          <p className="text-xs text-text-muted">Pending Requests</p>
        </div>
      </div>

      <div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Requests</SelectItem>
            <SelectItem value="organization">Organizations</SelectItem>
            <SelectItem value="provider">Providers</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <Card className="p-8 text-center">
          <Clock
            size={48}
            className="mx-auto text-text-faint mb-4 opacity-50"
          />
          <p className="text-text-muted">No pending requests at this time.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <Card key={req.id} variant="glass-hover" className="p-6">
              <CardContent className="p-0">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        req.type === "provider"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                          : "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200"
                      }`}>
                        {req.type === "provider" ? (
                          <span className="flex items-center gap-1">
                            <Users size={12} /> Provider
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Building2 size={12} /> Organization
                          </span>
                        )}
                      </span>
                      <p className="text-xs text-text-muted">
                        Requested{" "}
                        {new Date(req.requested_at).toLocaleDateString()}
                      </p>
                    </div>

                    <h3 className="font-semibold text-foreground mb-2 line-clamp-1">
                      {req.name || "Unnamed"}
                    </h3>

                    <div className="space-y-1 text-sm text-text-muted mb-4">
                      <p>📧 {req.email}</p>
                      {req.description && (
                        <p className="line-clamp-2">{req.description}</p>
                      )}
                    </div>
                  </div>

                  <Button
                    onClick={() => {
                      setSelectedRequest(req);
                      setApprovalNotes("");
                    }}
                    className="gap-1.5 whitespace-nowrap"
                  >
                    Review
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {selectedRequest && (
        <Dialog
          open={!!selectedRequest}
          onOpenChange={() => setSelectedRequest(null)}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                Review {selectedRequest.type === "provider" ? "Provider" : "Organization"} Request
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              <div>
                <h4 className="font-semibold mb-3">Request Details</h4>
                <div className="space-y-2 text-sm p-4 bg-surface rounded-lg border border-border/40">
                  <p>
                    <span className="text-text-muted">Type:</span>
                    <span className="font-medium ml-2 capitalize">
                      {selectedRequest.type}
                    </span>
                  </p>
                  <p>
                    <span className="text-text-muted">Name:</span>
                    <span className="font-medium ml-2">
                      {selectedRequest.name || "N/A"}
                    </span>
                  </p>
                  <p>
                    <span className="text-text-muted">Email:</span>
                    <span className="font-medium ml-2">
                      {selectedRequest.email || "N/A"}
                    </span>
                  </p>
                  {requestDetails.specialization && (
                    <p>
                      <span className="text-text-muted">Specialization:</span>
                      <span className="font-medium ml-2">
                        {requestDetails.specialization}
                      </span>
                    </p>
                  )}
                  {requestDetails.location && (
                    <p>
                      <span className="text-text-muted">Location:</span>
                      <span className="font-medium ml-2">
                        {requestDetails.location}
                      </span>
                    </p>
                  )}
                  {requestDetails.organization && (
                    <p>
                      <span className="text-text-muted">Organization:</span>
                      <span className="font-medium ml-2">
                        {requestDetails.organization}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Approval Notes
                </label>
                <Textarea
                  placeholder="Add notes for approval or rejection reason..."
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-border/40">
                <Button
                  variant="outline"
                  onClick={() => setSelectedRequest(null)}
                  disabled={processing}
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive gap-1.5"
                  onClick={() => handleApproval(false)}
                  disabled={processing}
                >
                  <XCircle size={16} /> Reject
                </Button>
                <Button
                  className="gap-1.5"
                  onClick={() => handleApproval(true)}
                  disabled={processing}
                >
                  <CheckCircle size={16} /> Approve
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
