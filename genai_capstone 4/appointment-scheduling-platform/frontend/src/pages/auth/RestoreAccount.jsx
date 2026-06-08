import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, CheckCircle2, ArrowRight, Lock } from "lucide-react";
import { useDispatch } from "react-redux";
import { restoreAccount } from "../../store/authSlice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import toast from "react-hot-toast";

export default function RestoreAccount() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter both email and password");
      return;
    }

    setLoading(true);
    try {
      const res = await dispatch(restoreAccount({ email, password })).unwrap();
      if (res?.token) {
        toast.success("Account restored successfully! Welcome back.");
        // Redirect based on role returned in response
        if (res.role === "admin") navigate("/admin/dashboard");
        else if (res.role === "provider") navigate("/provider/dashboard");
        else if (res.role === "organization") navigate("/organization/dashboard");
        else navigate("/customer/dashboard");
      } else {
        toast.success("Account restored successfully! You can now log in.");
        navigate("/login");
      }
    } catch (err) {
      toast.error(err.message || "Failed to restore account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-8 flex items-center justify-center bg-background">
      <div className="w-full max-w-md bg-card border border-border p-8 rounded-3xl shadow-xl animate-fade-in">
        <div className="mb-8 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={24} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Restore Account</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Enter your credentials to recover a deleted account securely.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground uppercase tracking-wider ml-0.5">Email Address</label>
            <div className="relative flex items-center group">
              <Mail size={16} className="absolute left-4 text-muted-foreground pointer-events-none group-focus-within:text-primary transition-colors shrink-0" />
              <Input
                type="email"
                className="pl-11 h-12 bg-background border-border"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground uppercase tracking-wider ml-0.5">Password</label>
            <div className="relative flex items-center group">
              <Lock size={16} className="absolute left-4 text-muted-foreground pointer-events-none group-focus-within:text-primary transition-colors shrink-0" />
              <Input
                type="password"
                className="pl-11 h-12 bg-background border-border"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full h-12 group font-semibold" disabled={loading}>
            {loading ? "Restoring..." : "Restore Account"}
            <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </form>

        <div className="mt-8 text-center">
          <Link to="/login" className="text-sm font-semibold text-primary hover:underline">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
