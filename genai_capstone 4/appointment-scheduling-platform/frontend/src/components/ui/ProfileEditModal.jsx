import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateProfile, deleteAccount } from "@/store/authSlice";
import toast from "react-hot-toast";

export default function ProfileEditModal({ isOpen, onClose }) {
  const { user, role, loading } = useSelector((s) => s.auth);
  const dispatch = useDispatch();

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    org_name: "",
    org_description: "",
    org_location: "",
  });

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name || "",
        phone: user.phone || "",
        org_name: user.org_name || "",
        org_description: user.org_description || "",
        org_location: user.org_location || "",
      });
    }
  }, [user, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const resultAction = await dispatch(updateProfile(form));
      if (updateProfile.fulfilled.match(resultAction)) {
        toast.success("Profile updated successfully");
        onClose();
      } else {
        toast.error(resultAction.payload?.message || "Update failed");
      }
    } catch (err) {
      toast.error("An error occurred");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Update your personal {role === "organization" && "and organizational"} details here.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground">Full Name</label>
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="Your Name"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground">Phone Number</label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Phone"
            />
          </div>

          {role === "organization" && (
            <>
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground">Organization Name</label>
                <Input
                  value={form.org_name}
                  onChange={(e) => setForm({ ...form, org_name: e.target.value })}
                  placeholder="Org Name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground">Organization Description</label>
                <Input
                  value={form.org_description}
                  onChange={(e) => setForm({ ...form, org_description: e.target.value })}
                  placeholder="Description"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground">Location</label>
                <Input
                  value={form.org_location}
                  onChange={(e) => setForm({ ...form, org_location: e.target.value })}
                  placeholder="Location"
                />
              </div>
            </>
          )}

          <div className="pt-4 flex justify-between items-center border-t border-border/40 mt-4">
            <Button
              type="button"
              variant="destructive"
              className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white"
              onClick={async () => {
                if (window.confirm("Are you sure you want to delete your account? This action cannot be undone immediately, though you may contact support to restore it.")) {
                  try {
                    // Requires deleteAccount thunk imported from authSlice
                    const res = await dispatch(deleteAccount());
                    if (deleteAccount.fulfilled.match(res)) {
                      toast.success("Account deleted successfully.");
                      onClose();
                    } else {
                      toast.error(res.payload?.message || "Failed to delete account");
                    }
                  } catch (e) {
                    toast.error("Error deleting account.");
                  }
                }
              }}
            >
              Delete Account
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
