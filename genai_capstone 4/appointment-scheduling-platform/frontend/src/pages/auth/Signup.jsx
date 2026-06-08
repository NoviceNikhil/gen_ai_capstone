import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { User, Mail, Lock, Phone, ArrowRight, CheckCircle2, Eye, EyeOff, LogIn } from "lucide-react";
import { signupUser, googleLogin } from "../../store/authSlice";
import { firstError, validateSignupForm } from "../../utils/authValidation";
import { GoogleLogin } from "@react-oauth/google";
import { uploadOnboardingFileAPI } from "../../services/apiService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import TypewriterText from "@/components/ui/TypewriterText";
import toast from "react-hot-toast";

const GOOGLE_ROLES = [
  { id: "customer", label: "Customer", desc: "Book services" },
  { id: "provider", label: "Provider", desc: "Complete onboarding" },
  { id: "organization", label: "Organisation", desc: "Set up org profile" },
];

const redirectAfterNewSignup = (navigate, role) => {
  if (role === "provider") navigate("/provider/onboarding");
  else if (role === "organization") navigate("/onboarding/organisation");
  else navigate("/customer/dashboard");
};

export default function Signup() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading } = useSelector((s) => s.auth);

  const [form, setForm] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get("role");
    const initialRole = (roleParam === "provider" || roleParam === "customer" || roleParam === "organization") ? roleParam : "customer";
    return {
      full_name: "", email: "", password: "", phone: "", role: initialRole,
      organization_name: "",
      owner_name: "",
      address: "",
      identity_proof_url: "",
      tax_number: "",
      bank_details: "",
      profile_photo_url: "",
      certificates_urls: "",
    };
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [focusedField, setFocusedField] = useState(null);
  const [showPass, setShowPass] = useState(false);
  const [oauthRole, setOauthRole] = useState("customer");

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: null }));
    setTouched((current) => ({ ...current, [field]: false }));
  };

  const validateField = (field) => {
    const { errors: validationErrors } = validateSignupForm(form);
    setTouched((current) => ({ ...current, [field]: true }));
    setErrors((current) => ({ ...current, [field]: validationErrors[field] || null }));
  };

  const handleFieldKeyDown = (field) => (e) => {
    if (e.key === "Tab" || e.key === "Enter") validateField(field);
  };

  const showRule = (field) => focusedField === field && !touched[field];
  const showError = (field) => touched[field] && errors[field];

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { data, errors: validationErrors } = validateSignupForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error(firstError(validationErrors));
      return;
    }

    const res = await dispatch(signupUser(data));
    if (signupUser.fulfilled.match(res)) {
      toast.success("OTP sent! Please verify your email.");
      navigate("/verify-otp");
    } else {
      toast.error(res.payload?.message || "Signup failed");
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    const res = await dispatch(googleLogin({
      credential: credentialResponse.credential,
      role: oauthRole,
      intent: "signup"
    }));
    
    if (googleLogin.fulfilled.match(res)) {
      toast.success("Google Authentication successful!");
      const role = res.payload.data?.role || res.payload.data?.user?.role;
      const isNewUser = res.payload.data?.is_new_user || res.payload.data?.isNewUser;
      if (isNewUser) redirectAfterNewSignup(navigate, role);
      else if (role === "admin") navigate("/admin/dashboard");
      else if (role === "provider") navigate("/provider/dashboard");
      else if (role === "organization") navigate("/organization/dashboard");
      else navigate("/customer/dashboard");
    } else {
      toast.error(res.payload?.message || "Google Authentication failed");
    }
  };

  const handleGoogleError = () => {
    toast.error("Google Sign-In failed or was cancelled.");
  };



  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-3 md:p-4 pt-12">
      <div className="w-full max-w-7xl grid lg:grid-cols-[2fr_3fr] rounded-2xl overflow-hidden border border-border bg-card text-card-foreground shadow-2xl animate-slide-up my-4">
        {/* Left Branding Panel */}
        <section className="hidden lg:flex relative p-7 lg:p-8 flex-col justify-between bg-gradient-to-br from-primary via-emerald-700 to-green-950 text-white overflow-hidden">
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full bg-black/20 blur-2xl" />
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover object-center mix-blend-normal opacity-20 z-0 pointer-events-none"
          >
            <source src="/signup.mp4" type="video/mp4" />
          </video>
          <div className="relative z-10">
            <TypewriterText as="p" text="New Account" className="text-[10px] uppercase tracking-[0.2em] font-extrabold text-white/80 mb-3 block animate-heartbeatText" delay={100} speed={40} />
            <TypewriterText as="h2" text="Start booking or offering services with a workflow-ready profile." className="text-3xl font-extrabold leading-tight mb-3 tracking-tight animate-stagger-2 block" delay={800} speed={25} />
            <TypewriterText as="p" text="Create your account and verify email OTP. Customer and provider onboarding is separated to keep access clean." className="text-white/85 text-xs leading-relaxed max-w-md animate-stagger-3 block" delay={2500} speed={15} />
          </div>
          <div className="relative z-10 space-y-4 animate-stagger-4 mt-8">
            <div className="rounded-xl bg-white/10 border border-white/10 backdrop-blur p-4">
              <p className="text-[10px] uppercase tracking-wider text-white/70 font-semibold mb-1">Account Verification</p>
              <p className="text-2xl font-extrabold">OTP + JWT</p>
            </div>
            <div className="rounded-xl bg-white/10 border border-white/10 backdrop-blur p-4">
              <p className="text-[10px] uppercase tracking-wider text-white/70 font-semibold mb-1">Profile Setup</p>
              <p className="text-2xl font-extrabold">Role Based</p>
            </div>
          </div>
        </section>

        {/* Right Form Section */}
        <section className="p-6 md:p-8 bg-card flex flex-col justify-center overflow-y-auto">
          <div className="w-full max-w-xl mx-auto">
            <div className="mb-6">
              <Link to="/login" className="inline-flex items-center gap-2 mb-4 group">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary shadow-lg">
                  <LogIn size={16} className="text-primary-foreground" />
                </div>
              </Link>
              <h1 className="text-2xl font-extrabold tracking-tight mb-1 text-foreground">Create Your Account</h1>
              <p className="text-muted-foreground text-xs">Join the next generation of appointment scheduling.</p>
            </div>

            <Card className="bg-card border-border">
              <CardContent className="p-4 md:p-5 space-y-4">
                <form onSubmit={handleSubmit} className="space-y-3" noValidate>
                  {/* Role Toggle */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider ml-0.5">I want to...</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        { id: "customer", label: "Book Services", desc: "Individual users" },
                        { id: "provider", label: "Offer Services", desc: "Professionals" },
                        { id: "organization", label: "Manage Org", desc: "Company account" }
                      ].map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => updateField("role", r.id)}
                          className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left cursor-pointer ${
                            form.role === r.id 
                              ? "bg-primary/5 border-primary shadow-[0_0_15px_rgba(99,102,241,0.05)]" 
                              : "bg-background border-border hover:border-border-light"
                          }`}
                        >
                          <div className="flex items-center justify-between w-full mb-1">
                            <span className={`text-xs font-bold uppercase tracking-wider ${form.role === r.id ? "text-primary" : "text-foreground"}`}>{r.label}</span>
                            {form.role === r.id && <CheckCircle2 size={14} className="text-primary" />}
                          </div>
                          <span className="text-[11px] text-muted-foreground">{r.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-foreground uppercase tracking-wider ml-0.5">Full Name</label>
                      <div className="relative flex items-center group">
                        <User size={16} className="absolute left-4 text-muted-foreground pointer-events-none group-focus-within:text-primary transition-colors shrink-0" />
                        <Input
                          type="text"
                          className="pl-11 h-12 bg-background border-border"
                          placeholder="John Doe"
                          value={form.full_name}
                          onChange={(e) => updateField("full_name", e.target.value)}
                          onFocus={() => setFocusedField("full_name")}
                          onBlur={() => validateField("full_name")}
                          onKeyDown={handleFieldKeyDown("full_name")}
                          autoComplete="name"
                          maxLength={150}
                          aria-invalid={Boolean(errors.full_name)}
                          required
                        />
                      </div>
                      {showRule("full_name") && <p className="text-[11px] text-muted-foreground">Use 2-150 characters. Letters and spaces are allowed.</p>}
                      {showError("full_name") && <p className="text-[11px] font-semibold text-destructive">{errors.full_name}</p>}
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-foreground uppercase tracking-wider ml-0.5">Phone Number</label>
                      <div className="relative flex items-center group">
                        <Phone size={16} className="absolute left-4 text-muted-foreground pointer-events-none group-focus-within:text-primary transition-colors shrink-0" />
                        <Input
                          type="tel"
                          className="pl-11 h-12 bg-background border-border"
                          placeholder="+91 98765 43210"
                          value={form.phone}
                          onChange={(e) => updateField("phone", e.target.value)}
                          onFocus={() => setFocusedField("phone")}
                          onBlur={() => validateField("phone")}
                          onKeyDown={handleFieldKeyDown("phone")}
                          autoComplete="tel"
                          maxLength={20}
                          aria-invalid={Boolean(errors.phone)}
                          required
                        />
                      </div>
                      {showRule("phone") && <p className="text-[11px] text-muted-foreground">Use a reachable phone number with 7 to 15 digits.</p>}
                      {showError("phone") && <p className="text-[11px] font-semibold text-destructive">{errors.phone}</p>}
                    </div>
                  </div>



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
                    {showRule("email") && <p className="text-[11px] text-muted-foreground">Use a valid email address where you can receive the OTP.</p>}
                    {showError("email") && <p className="text-[11px] font-semibold text-destructive">{errors.email}</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider ml-0.5">Secure Password</label>
                    <div className="relative flex items-center group">
                      <Lock size={16} className="absolute left-4 text-muted-foreground pointer-events-none group-focus-within:text-primary transition-colors shrink-0" />
                      <Input
                        type={showPass ? "text" : "password"}
                        className="pl-11 pr-12 h-12 bg-background border-border"
                        placeholder="Min 8 chars, mixed case, number, symbol"
                        value={form.password}
                        onChange={(e) => updateField("password", e.target.value)}
                        onFocus={() => setFocusedField("password")}
                        onBlur={() => validateField("password")}
                        onKeyDown={handleFieldKeyDown("password")}
                        autoComplete="new-password"
                        maxLength={72}
                        aria-invalid={Boolean(errors.password)}
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowPass((current) => !current)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground h-8 w-8 hover:bg-muted/50"
                        aria-label={showPass ? "Hide password" : "Show password"}
                      >
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </Button>
                    </div>
                    {focusedField === "password" && (
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] font-semibold text-muted-foreground mt-2 border border-border p-3 rounded-lg bg-background">
                        {[
                          ["At least 8 characters", form.password.length >= 8],
                          ["Uppercase & lowercase", /[A-Z]/.test(form.password) && /[a-z]/.test(form.password)],
                          ["At least one number", /\d/.test(form.password)],
                          ["At least one special character", /[^A-Za-z0-9]/.test(form.password)],
                        ].map(([label, passed]) => (
                          <li key={label} className={passed ? "text-success" : "text-muted-foreground"}>
                            {passed ? "✓" : "•"} {label}
                          </li>
                        ))}
                      </ul>
                    )}
                    {showError("password") && <p className="text-[11px] font-semibold text-destructive">{errors.password}</p>}
                  </div>

                  <Button type="submit" size="lg" className="w-full h-12 group font-semibold mt-4" disabled={loading}>
                    {loading ? "Creating Account..." : "Create Account"}
                    <ArrowRight size={16} className="ml-2 animate-slide-left-arrow group-hover:translate-x-1 transition-transform" />
                  </Button>
                </form>

                <div className="relative mt-6 mb-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground font-semibold">Or continue with</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {GOOGLE_ROLES.map((role) => (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => setOauthRole(role.id)}
                        className={`flex min-h-[76px] flex-col items-start justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                          oauthRole === role.id
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border bg-background text-foreground hover:border-primary/50"
                        }`}
                      >
                        <span className="text-xs font-bold uppercase">{role.label}</span>
                        <span className="text-[11px] text-muted-foreground">{role.desc}</span>
                      </button>
                    ))}
                  </div>

                  <div className="flex justify-center w-full">
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={handleGoogleError}
                      shape="pill"
                      theme="outline"
                      text="continue_with"
                      size="large"
                    />
                  </div>
                </div>

                <div className="pt-6 border-t border-border text-center mt-6">
                  <p className="text-muted-foreground text-sm">
                    Already have an account?{" "}
                    <Link to="/login" className="text-primary font-bold hover:underline transition-colors">
                      Sign In instead
                    </Link>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
