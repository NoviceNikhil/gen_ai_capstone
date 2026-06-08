import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Mail } from "lucide-react";
import { forgotPassword } from "../../store/authSlice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import toast from "react-hot-toast";

export default function ForgotPassword() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading } = useSelector((s) => s.auth);
  const [email, setEmail] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await dispatch(forgotPassword({ email }));
    if (forgotPassword.fulfilled.match(res)) {
      toast.success("OTP sent to email");
      navigate("/reset-password");
    } else {
      toast.error(res.payload?.message || "Failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md bg-card border-border shadow-xl animate-slide-up">
        <CardContent className="p-8 flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6 shadow-sm">
            <Mail size={22} className="text-primary" />
          </div>
          
          <h1 className="text-2xl font-extrabold tracking-tight mb-2 text-foreground">Forgot Password</h1>
          <p className="text-xs text-muted-foreground max-w-xs leading-relaxed mb-8 text-center">
            Enter your email and we'll send you an OTP to reset your password.
          </p>
          
          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground uppercase tracking-wider ml-0.5">Email Address</label>
              <div className="relative flex items-center group">
                <Mail size={16} className="absolute left-4 text-muted-foreground pointer-events-none group-focus-within:text-primary transition-colors shrink-0" />
                <Input 
                  type="email" 
                  className="pl-11 h-12 bg-background border-border" 
                  placeholder="you@example.com" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                />
              </div>
            </div>
            
            <Button type="submit" size="lg" className="w-full h-12 font-semibold" disabled={loading}>
              {loading ? "Sending..." : "Send OTP"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
