import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { resetPassword } from "../../store/authSlice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import toast from "react-hot-toast";

export default function ResetPassword() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, otpEmail } = useSelector((s) => s.auth);
  const [form, setForm] = useState({ otp: "", new_password: "", confirm: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.new_password !== form.confirm) { 
      toast.error("Passwords do not match"); 
      return; 
    }
    const res = await dispatch(resetPassword({ email: otpEmail, otp: form.otp, new_password: form.new_password }));
    if (resetPassword.fulfilled.match(res)) {
      toast.success("Password reset successfully!");
      navigate("/login");
    } else {
      toast.error(res.payload?.message || "Reset failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md bg-card border-border shadow-xl animate-slide-up">
        <CardContent className="p-8 flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6 shadow-sm">
            <Lock size={22} className="text-primary" />
          </div>
          
          <h1 className="text-2xl font-extrabold tracking-tight mb-2 text-foreground">Reset Password</h1>
          <p className="text-xs text-muted-foreground max-w-xs leading-relaxed mb-6 text-center">
            Enter the OTP sent to <span className="font-semibold text-primary font-mono">{otpEmail}</span>
          </p>
          
          <form onSubmit={handleSubmit} className="w-full space-y-4">
            {[
              { key: "otp", label: "OTP Code", type: "text", placeholder: "6-digit OTP" },
              { key: "new_password", label: "New Password", type: "password", placeholder: "New password" },
              { key: "confirm", label: "Confirm Password", type: "password", placeholder: "Confirm password" },
            ].map(({ key, label, type, placeholder }) => (
              <div key={key} className="space-y-2">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider ml-0.5">{label}</label>
                <Input 
                  type={type} 
                  className="h-12 bg-background border-border" 
                  placeholder={placeholder} 
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })} 
                  required 
                />
              </div>
            ))}
            
            <Button type="submit" size="lg" className="w-full h-12 font-semibold mt-2" disabled={loading}>
              {loading ? "Resetting..." : "Reset Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
