import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Mail, Lock, Eye, EyeOff, LogIn, ArrowRight, ShieldCheck } from "lucide-react";
import { completeGoogleSignup, loginUser, googleLogin } from "../../store/authSlice";
import { firstError, validateLoginForm } from "../../utils/authValidation";
import { GoogleLogin } from "@react-oauth/google";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TypewriterText from "@/components/ui/TypewriterText";
import toast from "react-hot-toast";

const GOOGLE_ROLES = [
  { id: "customer", label: "Customer", desc: "Book services" },
  { id: "provider", label: "Provider", desc: "Complete onboarding" },
  { id: "organization", label: "Organisation", desc: "Set up org profile" },
];

const redirectToDashboard = (navigate, role, user) => {
  if (role === "admin") navigate("/admin/dashboard");
  else if (role === "provider") navigate("/provider/dashboard");
  else if (role === "organization") {
    if (user?.onboarding_completed === false) navigate("/onboarding/organisation");
    else navigate("/organization/dashboard");
  }
  else navigate("/customer/dashboard");
};

const redirectAfterNewGoogleUser = (navigate, role) => {
  if (role === "provider") navigate("/provider/onboarding");
  else if (role === "organization") navigate("/onboarding/organisation");
  else navigate("/customer/dashboard");
};

export default function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading } = useSelector((s) => s.auth);

  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [focusedField, setFocusedField] = useState(null);
  const [showPass, setShowPass] = useState(false);
  const [pendingGoogleCredential, setPendingGoogleCredential] = useState(null);
  const [newGoogleRole, setNewGoogleRole] = useState("customer");

  const updateField = (field, value) => {
    setForm((c) => ({ ...c, [field]: value }));
    setErrors((c) => ({ ...c, [field]: null }));
    setTouched((c) => ({ ...c, [field]: false }));
  };

  const validateField = (field) => {
    const { errors: ve } = validateLoginForm(form);
    setTouched((c) => ({ ...c, [field]: true }));
    setErrors((c) => ({ ...c, [field]: ve[field] || null }));
  };

  const handleFieldKeyDown = (field) => (e) => {
    if (e.key === "Tab" || e.key === "Enter") validateField(field);
  };

  const showRule  = (field) => focusedField === field && !touched[field];
  const showError = (field) => touched[field] && errors[field];

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { data, errors: ve } = validateLoginForm(form);
    if (Object.keys(ve).length > 0) {
      setErrors(ve);
      toast.error(firstError(ve));
      return;
    }
    const res = await dispatch(loginUser(data));
    if (loginUser.fulfilled.match(res)) {
      const d = res.payload?.data;
      if (d?.isAdmin) {
        toast.success("OTP sent to admin email");
        navigate("/verify-otp");
      } else {
        const role = d?.role || d?.user?.role;
        toast.success("Welcome back!");
        redirectToDashboard(navigate, role, d?.user);
      }
    } else {
      toast.error(res.payload?.message || "Login failed");
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    // No role needed — backend resolves from existing account
    const res = await dispatch(googleLogin({
      credential: credentialResponse.credential,
      intent: "login",
    }));
    if (googleLogin.fulfilled.match(res)) {
      const data = res.payload.data;
      if (data?.is_new_user || data?.isNewUser) {
        setPendingGoogleCredential(credentialResponse.credential);
        toast.success("Choose an account type to finish signup.");
        return;
      }

      toast.success("Google Login successful!");
      const role = data?.role || data?.user?.role;
      redirectToDashboard(navigate, role, data?.user);
    } else {
      toast.error(res.payload?.message || "Google Login failed");
    }
  };

  const handleCompleteGoogleSignup = async () => {
    if (!pendingGoogleCredential) return;

    const res = await dispatch(completeGoogleSignup({
      credential: pendingGoogleCredential,
      role: newGoogleRole,
    }));

    if (completeGoogleSignup.fulfilled.match(res)) {
      const role = res.payload.data?.role || res.payload.data?.user?.role;
      toast.success("Google signup complete!");
      setPendingGoogleCredential(null);
      redirectAfterNewGoogleUser(navigate, role);
    } else {
      toast.error(res.payload?.message || "Google signup failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-3 md:p-4">
      {/* wider container — 2:3 left/right split */}
      <div className="w-full max-w-7xl grid lg:grid-cols-[2fr_3fr] rounded-2xl overflow-hidden border border-border bg-card text-card-foreground shadow-2xl animate-slide-up my-4">

        {/* Left Branding Panel */}
        <section className="hidden lg:flex relative p-7 lg:p-8 flex-col justify-between bg-gradient-to-br from-primary via-emerald-700 to-green-950 text-white overflow-hidden">
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full bg-black/20 blur-2xl" />
          {/* Reduced opacity + mix-blend-normal so video colours show through naturally */}
          <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover object-center mix-blend-normal opacity-20 z-0 pointer-events-none">
            <source src="/login.mp4" type="video/mp4" />
          </video>
          <div className="relative z-10">
            <TypewriterText as="p" text="Schedex Access" className="text-[10px] uppercase tracking-[0.2em] font-extrabold text-white/80 mb-3 block animate-heartbeatText" delay={100} speed={40} />
            <TypewriterText as="h2" text="Manage bookings, payments, and schedules in one secure cockpit." className="text-3xl font-extrabold leading-tight mb-3 tracking-tight animate-stagger-2 block" delay={800} speed={25} />
            <TypewriterText as="p" text="Sign in to continue operations, track appointment status, and handle customer workflows without context switching." className="text-white/85 text-xs leading-relaxed max-w-md animate-stagger-3 block" delay={2500} speed={15} />
          </div>
          <div className="relative z-10 grid grid-cols-2 gap-3 animate-stagger-4 mt-6">
            <div className="rounded-xl bg-white/10 border border-white/10 backdrop-blur p-3">
              <p className="text-[10px] uppercase tracking-wider text-white/70 font-semibold mb-1">Active Providers</p>
              <p className="text-xl font-extrabold">10</p>
            </div>
            <div className="rounded-xl bg-white/10 border border-white/10 backdrop-blur p-3">
              <p className="text-[10px] uppercase tracking-wider text-white/70 font-semibold mb-1">Live Bookings</p>
              <p className="text-xl font-extrabold">18</p>
            </div>
          </div>
        </section>

        {/* Right Form — wider with generous padding */}
        <section className="p-6 md:p-10 flex items-center justify-center bg-card overflow-y-auto max-h-screen">
          <div className="w-full max-w-md py-2">
            <div className="mb-5">
              <Link to="/" className="inline-flex items-center gap-2 mb-3 group">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary shadow-lg">
                  <LogIn size={16} className="text-primary-foreground" />
                </div>
              </Link>
              <h1 className="text-2xl font-extrabold tracking-tight mb-1 text-foreground">Welcome Back</h1>
              <p className="text-muted-foreground text-xs">Enter your credentials to manage your platform.</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider ml-0.5">Email Address</label>
                <div className="relative flex items-center group">
                  <Mail size={16} className="absolute left-4 text-muted-foreground pointer-events-none group-focus-within:text-primary transition-colors shrink-0" />
                  <Input
                    type="email"
                    className="pl-11 h-12 bg-background border-border"
                    placeholder="name@company.com"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => validateField("email")}
                    onKeyDown={handleFieldKeyDown("email")}
                    autoComplete="email"
                    maxLength={255}
                    aria-invalid={Boolean(errors.email)}
                    required
                  />
                </div>
                {showRule("email") && <p className="text-[11px] text-muted-foreground">Use the email address linked to your account.</p>}
                {showError("email") && <p className="text-[11px] font-semibold text-destructive">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-end ml-0.5">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">Password</label>
                  <Link to="/forgot-password" className="text-xs font-bold text-primary hover:underline transition-colors">
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative flex items-center group">
                  <Lock size={16} className="absolute left-4 text-muted-foreground pointer-events-none group-focus-within:text-primary transition-colors shrink-0" />
                  <Input
                    type={showPass ? "text" : "password"}
                    className="pl-11 pr-12 h-12 bg-background border-border"
                    placeholder="••••••••••••"
                    value={form.password}
                    onChange={(e) => updateField("password", e.target.value)}
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => validateField("password")}
                    onKeyDown={handleFieldKeyDown("password")}
                    autoComplete="current-password"
                    maxLength={72}
                    aria-invalid={Boolean(errors.password)}
                    required
                  />
                  <Button
                    type="button" variant="ghost" size="icon"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground h-8 w-8 hover:bg-muted/50"
                    aria-label={showPass ? "Hide password" : "Show password"}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                </div>
                {showRule("password") && <p className="text-[11px] text-muted-foreground">Passwords are case-sensitive.</p>}
                {showError("password") && <p className="text-[11px] font-semibold text-destructive">{errors.password}</p>}
              </div>

              <Button type="submit" size="lg" className="w-full h-12 group font-semibold mt-2" disabled={loading}>
                {loading ? "Authenticating..." : "Sign In"}
                <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </form>

            <div className="flex justify-center mt-4 mb-2">
              <Link to="/restore-account" className="text-xs font-semibold text-primary hover:underline transition-colors">
                Recover a deleted account?
              </Link>
            </div>

            <div className="relative mt-6 mb-6">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground font-semibold">Or continue with</span>
              </div>
            </div>

            <div className="flex justify-center w-full">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => toast.error("Google Sign-In failed or was cancelled.")}
                shape="pill" theme="outline" text="continue_with" size="large"
              />
            </div>

            {pendingGoogleCredential && (
              <div className="mt-5 rounded-lg border border-border bg-background p-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Choose account type
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {GOOGLE_ROLES.map((role) => (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => setNewGoogleRole(role.id)}
                      className={`flex min-h-[76px] flex-col items-start justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                        newGoogleRole === role.id
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border bg-card text-foreground hover:border-primary/50"
                      }`}
                    >
                      <span className="text-xs font-bold uppercase">{role.label}</span>
                      <span className="text-[11px] text-muted-foreground">{role.desc}</span>
                    </button>
                  ))}
                </div>
                <Button
                  type="button"
                  className="w-full h-11 font-semibold"
                  disabled={loading}
                  onClick={handleCompleteGoogleSignup}
                >
                  {loading ? "Creating Account..." : "Create Google Account"}
                </Button>
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-border text-center">
              <p className="text-muted-foreground text-sm">
                Don't have an account?{" "}
                <Link to="/signup" className="text-primary font-bold hover:underline transition-colors">Create an account</Link>
              </p>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2 text-muted-foreground/60 text-xs">
              <ShieldCheck size={14} className="shrink-0" />
              <span>Secure, encrypted authentication</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
