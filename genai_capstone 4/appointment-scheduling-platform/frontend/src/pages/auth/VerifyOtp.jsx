import { useState, useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Shield } from "lucide-react";
import { verifyOtp, verifyAdminOtp, resendOtp } from "../../store/authSlice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import toast from "react-hot-toast";

const maskEmail = (email) => {
  if (!email) return "";
  const parts = email.split("@");
  if (parts.length !== 2) return email;
  const [name, domain] = parts;
  const maskedName = name.length > 2 
    ? name[0] + "*".repeat(name.length - 2) + name[name.length - 1] 
    : name[0] + "*".repeat(name.length - 1);
    
  const domainParts = domain.split(".");
  if (domainParts.length < 2) return `${maskedName}@${domain}`;
  
  const domainName = domainParts[0];
  const tld = domainParts.slice(1).join(".");
  const maskedDomain = domainName.length > 2
    ? domainName[0] + "*".repeat(domainName.length - 2) + domainName[domainName.length - 1]
    : domainName[0] + "*".repeat(domainName.length - 1);
    
  return `${maskedName}@${maskedDomain}.${tld}`;
};

export default function VerifyOtp() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, otpEmail, otpType } = useSelector((s) => s.auth);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [cooldown, setCooldown] = useState(60);
  const [hasError, setHasError] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    // Autofocus first input on mount
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (cooldown === 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => c - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleChange = (idx, val) => {
    if (!/^\d?$/.test(val)) return;
    const newOtp = [...otp];
    newOtp[idx] = val;
    setOtp(newOtp);
    if (val && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    if (!/^\d{6}$/.test(pastedData)) {
      toast.error("Please paste a 6-digit numeric OTP");
      return;
    }
    const newOtp = pastedData.split("");
    setOtp(newOtp);
    inputRefs.current[5]?.focus();
    setHasError(false);
  };

  const handleFocus = () => {
    setHasError(false);
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    const otpStr = otp.join("");
    if (otpStr.length < 6) { 
      toast.error("Enter all 6 digits"); 
      return; 
    }

    const thunk = otpType === "admin" ? verifyAdminOtp : verifyOtp;
    const res = await dispatch(thunk({ email: otpEmail, otp: otpStr }));

    if (thunk.fulfilled.match(res)) {
      toast.success("Verified successfully!");
      const userRole = res.payload?.data?.role || res.payload?.data?.user?.role;
      const map = {
        customer: "/customer/dashboard",
        provider: "/provider/onboarding",
        organization: "/onboarding/organisation",
        admin: "/admin/dashboard",
      };
      navigate(map[userRole] || "/");
    } else {
      setHasError(true);
      toast.error(res.payload?.message || "Invalid OTP");
    }
  };

  const handleResend = async () => {
    const res = await dispatch(resendOtp({ email: otpEmail }));
    if (resendOtp.fulfilled.match(res)) {
      toast.success("OTP resent!");
      setCooldown(60);
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
      setHasError(false);
    } else {
      toast.error("Failed to resend");
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const isReady = otp.join("").length === 6;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md bg-card border-border shadow-xl animate-slide-up">
        <CardContent className="p-8 text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center mb-6 shadow-sm">
            <Shield size={22} className="text-success" />
          </div>
          
          <h1 className="text-2xl font-extrabold tracking-tight mb-2 text-foreground">Verify Security Code</h1>
          <p className="text-xs text-muted-foreground max-w-xs leading-relaxed mb-1">
            We sent a 6-digit confirmation code to
          </p>
          <p className="text-xs font-semibold text-primary mb-8 font-mono">{maskEmail(otpEmail)}</p>

          <form onSubmit={handleVerify} className="w-full">
            <div className="flex gap-2 justify-center mb-8">
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (inputRefs.current[idx] = el)}
                  type="text"
                  maxLength={1}
                  inputMode="numeric"
                  value={digit}
                  onChange={(e) => handleChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  onPaste={handlePaste}
                  onFocus={handleFocus}
                  className={`w-11 h-14 text-center text-xl font-bold rounded-lg border bg-background text-foreground transition-all outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ${
                    hasError 
                      ? "border-destructive focus:border-destructive focus:ring-destructive/20 text-destructive" 
                      : isReady 
                      ? "border-primary/60 ring-1 ring-primary/40"
                      : "border-border"
                  }`}
                />
              ))}
            </div>

            <Button type="submit" size="lg" className="w-full h-12 font-semibold" disabled={loading || !isReady}>
              {loading ? "Verifying..." : "Verify Code"}
            </Button>
          </form>

          {cooldown > 0 ? (
            <p className="mt-5 text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
              Resend in <span className="font-mono">{formatTime(cooldown)}</span>
            </p>
          ) : (
            <Button
              variant="link"
              onClick={handleResend}
              className="mt-3 text-primary font-bold hover:underline h-auto p-0"
            >
              Resend OTP
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
