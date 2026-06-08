import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  ArrowRight, CheckCircle2, ShieldAlert, Upload, Sparkles,
  Building2, MapPin, Landmark, Receipt, Users, FileCheck,
} from "lucide-react";
import {
  getOrgOnboardingAPI,
  updateOrgOnboardingAPI,
  uploadOnboardingFileAPI,
} from "../../services/apiService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { FaTwitter, FaGithub, FaLinkedin } from "react-icons/fa";
import toast from "react-hot-toast";

const INDIAN_STATES = [
  "Karnataka", "Maharashtra", "Tamil Nadu", "Telangana", "Delhi",
  "Gujarat", "Rajasthan", "West Bengal", "Kerala",
];

const STATE_CITIES = {
  Karnataka: ["Bengaluru"],
  Maharashtra: ["Mumbai", "Pune"],
  "Tamil Nadu": ["Chennai"],
  Telangana: ["Hyderabad"],
  Delhi: ["Delhi"],
  Gujarat: ["Ahmedabad", "Surat"],
  Rajasthan: ["Jaipur"],
  "West Bengal": ["Kolkata"],
  Kerala: ["Kochi"],
};

const PINCODE_PREFIXES = {
  Bengaluru: ["560"],
  Mumbai: ["400"],
  Pune: ["411", "412"],
  Chennai: ["600"],
  Hyderabad: ["500"],
  Delhi: ["110"],
  Ahmedabad: ["380"],
  Surat: ["395"],
  Jaipur: ["302"],
  Kolkata: ["700"],
  Kochi: ["682"],
};

const ORG_TYPES = [
  "Hospital / Clinic", "Salon / Spa", "Fitness / Wellness Centre",
  "Educational Institution", "Business Consulting", "Home Services",
  "Legal / Financial Services", "Technology Company", "Other",
];

const FIELD_RULES = {
  org_type: "Select the type that best describes your organisation.",
  address: "Full registered address (minimum 10 characters).",
  state: "Select your registered state.",
  city: "Select your registered city.",
  pincode: "6-digit PIN code matching your selected city.",
  num_employees: "Total number of employees / staff (must be ≥ 1).",
  tax_number: "Alphanumeric Tax ID (GST/VAT/PAN) between 8-20 characters.",
  bank_details: "Bank account details for payouts (min 10 characters).",
};

export default function OrganisationOnboarding() {
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);

  const [form, setForm] = useState({
    org_type: "",
    address: "",
    state: "",
    city: "",
    pincode: "",
    num_employees: "",
    tax_number: "",
    bank_details: "",
    identity_doc_url: "",
    description: "",
    contact_phone: "",
    contact_email: "",
    location: "",
  });

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [focused, setFocused] = useState({});

  // ── Load existing data & guard if already onboarded ──────────────────────
  useEffect(() => {
    getOrgOnboardingAPI()
      .then((res) => {
        const data = res.data?.data;
        if (data?.onboarding_completed) {
          navigate("/organization/dashboard");
          return;
        }
        const org = data?.org || {};
        setForm((f) => ({
          ...f,
          org_type: org.org_type || "",
          address: org.address || "",
          state: org.state || "",
          city: org.city || "",
          pincode: org.pincode || "",
          num_employees: org.num_employees != null ? String(org.num_employees) : "",
          tax_number: org.tax_number || "",
          bank_details: org.bank_details || "",
          identity_doc_url: org.identity_doc_url || "",
          description: org.description || "",
          contact_phone: org.contact_phone || "",
          contact_email: org.contact_email || "",
          location: org.location || "",
        }));
      })
      .catch((err) => console.error("Failed to load onboarding:", err));
  }, [navigate]);

  // ── Validation ────────────────────────────────────────────────────────────
  const validateField = (name, value) => {
    let err = "";
    const strVal = String(value || "").trim();

    switch (name) {
      case "org_type":
        if (!strVal) err = "Please select an organisation type.";
        break;
      case "address":
        if (strVal.length < 10) err = "Address must be at least 10 characters.";
        break;
      case "state":
        if (!strVal) err = "Please select a state.";
        break;
      case "city":
        if (!strVal) err = "Please select a city.";
        break;
      case "pincode":
        if (!/^\d{6}$/.test(strVal)) {
          err = "PIN code must be exactly 6 digits.";
        } else {
          const allowed = PINCODE_PREFIXES[form.city] || [];
          if (form.city && !allowed.some((p) => strVal.startsWith(p))) {
            err = `PIN code must start with ${allowed.join(" or ")} for ${form.city}.`;
          }
        }
        break;
      case "num_employees":
        if (!strVal || Number(strVal) < 1) err = "Must have at least 1 employee.";
        break;
      case "tax_number":
        if (
          strVal.length < 8 ||
          strVal.length > 20 ||
          !/^[A-Za-z0-9]+$/.test(strVal)
        )
          err = "Tax ID must be 8-20 alphanumeric characters.";
        break;
      case "bank_details":
        if (strVal.length < 10) err = "Bank details must be at least 10 characters.";
        break;
      default:
        break;
    }

    setErrors((prev) => ({ ...prev, [name]: err }));
    return err;
  };

  const handleFocus = (name) => setFocused((f) => ({ ...f, [name]: true }));
  const handleBlur = (name) => {
    setFocused((f) => ({ ...f, [name]: false }));
    setTouched((t) => ({ ...t, [name]: true }));
    validateField(name, form[name]);
  };

  const renderFeedback = (name) => {
    const isFocused = focused[name];
    const isTouched = touched[name];
    const error = errors[name];
    const rule = FIELD_RULES[name];

    if (isTouched && error) {
      return (
        <span className="text-[11px] text-red-400 font-semibold flex items-center gap-1 mt-1">
          <ShieldAlert size={12} className="shrink-0" /> {error}
        </span>
      );
    }
    if (isFocused && rule) {
      return (
        <span className="text-[11px] text-blue-400 font-medium flex items-center gap-1 mt-1">
          <Sparkles size={12} className="shrink-0" /> {rule}
        </span>
      );
    }
    return null;
  };

  const updateField = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    validateField(field, value);
  };

  // ── File upload ───────────────────────────────────────────────────────────
  const handleDocUpload = async (file) => {
    if (!file) return;
    const ext = `.${(file.name.split(".").pop() || "").toLowerCase()}`;
    if (![".pdf", ".doc", ".docx"].includes(ext)) {
      toast.error("Only .pdf, .doc, .docx files are allowed.");
      return;
    }
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadOnboardingFileAPI(fd);
      const path = res.data?.data?.file_path;
      if (path) {
        updateField("identity_doc_url", path);
        toast.success("Document uploaded successfully!");
      }
    } catch {
      toast.error("File upload failed");
    } finally {
      setUploading(false);
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    const requiredFields = [
      "org_type", "address", "state", "city", "pincode",
      "num_employees", "tax_number", "bank_details", "identity_doc_url",
    ];

    // Validate all required fields
    let hasError = false;
    requiredFields.forEach((f) => {
      const err = validateField(f, form[f]);
      if (err) hasError = true;
      setTouched((t) => ({ ...t, [f]: true }));
    });

    if (hasError) {
      toast.error("Please fix the errors above before submitting.");
      return;
    }

    const missing = requiredFields.find((f) => !String(form[f] || "").trim());
    if (missing) {
      toast.error(
        `Please complete all required fields. Missing: ${missing.replace(/_/g, " ")}.`
      );
      return;
    }

    try {
      setSubmitting(true);
      await updateOrgOnboardingAPI({
        ...form,
        num_employees: form.num_employees ? Number(form.num_employees) : null,
      });
      toast.success("Onboarding complete! Redirecting to dashboard…");
      navigate("/organization/dashboard");
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to submit onboarding details"
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen flex flex-col justify-between overflow-hidden bg-background">
      {/* Background video */}
      <div className="fixed inset-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-20"
        >
          <source src="/mushroom.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/60 to-background backdrop-blur-[4px]" />
      </div>

      {/* Main content */}
      <div className="flex-1 w-full max-w-4xl mx-auto px-6 py-12 flex items-center justify-center relative z-10 animate-slide-up mt-8">
        <Card className="w-full bg-card/85 backdrop-blur-md border-border shadow-2xl rounded-2xl overflow-hidden">
          <CardContent className="p-8 md:p-10 space-y-8">

            {/* Header */}
            <div className="text-center max-w-xl mx-auto space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-accent animate-pulse" /> Complete Organisation Setup
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                Organisation Onboarding
              </h1>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Welcome, <span className="font-semibold text-primary">{user?.full_name}</span>.
                Complete your organisation profile to unlock the full dashboard and start managing providers.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

              {/* ── Organisation Details ─────────────────────────────────── */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-primary border-b border-border/60 pb-1.5 flex items-center gap-2">
                  <Building2 size={16} /> Organisation Information
                </h3>

                {/* Type + Description */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Organisation Type <span className="text-destructive">*</span>
                    </label>
                    <select
                      className="h-12 w-full rounded-lg border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary px-3 text-foreground"
                      value={form.org_type}
                      onChange={(e) => updateField("org_type", e.target.value)}
                      onFocus={() => handleFocus("org_type")}
                      onBlur={() => handleBlur("org_type")}
                      required
                    >
                      <option value="">Select Type</option>
                      {ORG_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    {renderFeedback("org_type")}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Number of Employees <span className="text-destructive">*</span>
                    </label>
                    <div className="relative flex items-center group">
                      <Users size={16} className="absolute left-4 text-muted-foreground pointer-events-none group-focus-within:text-primary shrink-0" />
                      <Input
                        type="number"
                        min={1}
                        placeholder="e.g. 50"
                        className="pl-11 h-12 bg-background/50 border-border"
                        value={form.num_employees}
                        onChange={(e) => updateField("num_employees", e.target.value)}
                        onFocus={() => handleFocus("num_employees")}
                        onBlur={() => handleBlur("num_employees")}
                        required
                      />
                    </div>
                    {renderFeedback("num_employees")}
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                    About Your Organisation
                  </label>
                  <textarea
                    placeholder="Describe your organisation, its services and mission…"
                    className="pl-4 pr-4 py-3 min-h-[80px] w-full rounded-lg border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground"
                    value={form.description}
                    onChange={(e) => updateField("description", e.target.value)}
                  />
                </div>
              </div>

              {/* ── Address ──────────────────────────────────────────────── */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-primary border-b border-border/60 pb-1.5 flex items-center gap-2">
                  <MapPin size={16} /> Address & Location
                </h3>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Registered Address <span className="text-destructive">*</span>
                  </label>
                  <textarea
                    placeholder="Full registered office address…"
                    className="pl-4 pr-4 py-3 min-h-[70px] w-full rounded-lg border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground"
                    value={form.address}
                    onChange={(e) => updateField("address", e.target.value)}
                    onFocus={() => handleFocus("address")}
                    onBlur={() => handleBlur("address")}
                    required
                  />
                  {renderFeedback("address")}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                      State <span className="text-destructive">*</span>
                    </label>
                    <select
                      className="h-12 w-full rounded-lg border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary px-3 text-foreground"
                      value={form.state}
                      onChange={(e) => {
                        updateField("state", e.target.value);
                        updateField("city", "");
                      }}
                      onFocus={() => handleFocus("state")}
                      onBlur={() => handleBlur("state")}
                      required
                    >
                      <option value="">Select State</option>
                      {INDIAN_STATES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    {renderFeedback("state")}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                      City <span className="text-destructive">*</span>
                    </label>
                    <select
                      className="h-12 w-full rounded-lg border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary px-3 text-foreground"
                      value={form.city}
                      onChange={(e) => updateField("city", e.target.value)}
                      onFocus={() => handleFocus("city")}
                      onBlur={() => handleBlur("city")}
                      disabled={!form.state}
                      required
                    >
                      <option value="">Select City</option>
                      {(STATE_CITIES[form.state] || []).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    {renderFeedback("city")}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                      PIN Code <span className="text-destructive">*</span>
                    </label>
                    <div className="relative flex items-center group">
                      <MapPin size={16} className="absolute left-4 text-muted-foreground pointer-events-none group-focus-within:text-primary shrink-0" />
                      <Input
                        type="text"
                        placeholder="6-digit PIN"
                        maxLength={6}
                        className="pl-11 h-12 bg-background/50 border-border"
                        value={form.pincode}
                        onChange={(e) =>
                          updateField("pincode", e.target.value.replace(/\D/g, ""))
                        }
                        onFocus={() => handleFocus("pincode")}
                        onBlur={() => handleBlur("pincode")}
                        required
                      />
                    </div>
                    {renderFeedback("pincode")}
                  </div>
                </div>

                {/* Location display name */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Display Location (optional)
                  </label>
                  <Input
                    placeholder="e.g. Bengaluru, Karnataka"
                    className="h-12 bg-background/50 border-border"
                    value={form.location}
                    onChange={(e) => updateField("location", e.target.value)}
                  />
                </div>
              </div>

              {/* ── Contact ───────────────────────────────────────────────── */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-primary border-b border-border/60 pb-1.5 flex items-center gap-2">
                  <Building2 size={16} /> Contact Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Contact Email
                    </label>
                    <Input
                      type="email"
                      placeholder="admin@organisation.com"
                      className="h-12 bg-background/50 border-border"
                      value={form.contact_email}
                      onChange={(e) => updateField("contact_email", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Contact Phone
                    </label>
                    <Input
                      type="tel"
                      placeholder="+91 98765 43210"
                      className="h-12 bg-background/50 border-border"
                      value={form.contact_phone}
                      onChange={(e) => updateField("contact_phone", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* ── Financial ─────────────────────────────────────────────── */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-primary border-b border-border/60 pb-1.5 flex items-center gap-2">
                  <Landmark size={16} /> Financial Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Tax ID / GST Number <span className="text-destructive">*</span>
                    </label>
                    <div className="relative flex items-center group">
                      <Receipt size={16} className="absolute left-4 text-muted-foreground pointer-events-none group-focus-within:text-primary shrink-0" />
                      <Input
                        type="text"
                        placeholder="GSTIN or regional tax code"
                        className="pl-11 h-12 bg-background/50 border-border"
                        value={form.tax_number}
                        onChange={(e) => updateField("tax_number", e.target.value)}
                        onFocus={() => handleFocus("tax_number")}
                        onBlur={() => handleBlur("tax_number")}
                        required
                      />
                    </div>
                    {renderFeedback("tax_number")}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Bank Details for Payouts <span className="text-destructive">*</span>
                    </label>
                    <div className="relative flex items-center group">
                      <Landmark size={16} className="absolute left-4 text-muted-foreground pointer-events-none group-focus-within:text-primary shrink-0" />
                      <Input
                        type="text"
                        placeholder="Account No, Bank Name, IFSC"
                        className="pl-11 h-12 bg-background/50 border-border"
                        value={form.bank_details}
                        onChange={(e) => updateField("bank_details", e.target.value)}
                        onFocus={() => handleFocus("bank_details")}
                        onBlur={() => handleBlur("bank_details")}
                        required
                      />
                    </div>
                    {renderFeedback("bank_details")}
                  </div>
                </div>
              </div>

              {/* ── Verification Document ──────────────────────────────────── */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-primary border-b border-border/60 pb-1.5 flex items-center gap-2">
                  <FileCheck size={16} /> Verification Document
                </h3>
                <p className="text-[11px] text-muted-foreground -mt-2">
                  Upload a Certificate of Incorporation, Business License, or similar identity document (PDF/DOC/DOCX).
                </p>

                <div className="p-4 rounded-xl border border-border bg-background/40 hover:bg-background/60 transition-all flex flex-col justify-between h-36 max-w-sm">
                  <div>
                    <p className="text-xs font-extrabold text-foreground uppercase tracking-wider mb-1">
                      Organisation Identity Document <span className="text-destructive">*</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-snug">
                      Certificate of Incorporation, Registration, or Business License copy.
                    </p>
                  </div>
                  <div>
                    {form.identity_doc_url ? (
                      <div className="flex items-center gap-1.5 text-xs text-success font-semibold">
                        <CheckCircle2 size={16} /> Uploaded
                      </div>
                    ) : uploading ? (
                      <span className="text-xs text-muted-foreground animate-pulse">Uploading…</span>
                    ) : (
                      <label className="flex items-center justify-center gap-2 h-9 px-3 border border-dashed border-border rounded-lg cursor-pointer text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-primary transition-all bg-card/60">
                        <Upload size={14} /> Choose File
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          className="hidden"
                          onChange={(e) => handleDocUpload(e.target.files?.[0])}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Submit ────────────────────────────────────────────────── */}
              <div className="pt-6 border-t border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground leading-snug">
                  <ShieldAlert size={16} className="text-amber-500 shrink-0" />
                  <span>All information will be reviewed before dashboard features are unlocked.</span>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="font-bold h-12 px-8 cursor-pointer group flex items-center justify-center"
                  disabled={submitting}
                >
                  {submitting ? "Saving…" : "Complete Onboarding"}
                  <ArrowRight size={16} className="ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>

            </form>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="pt-16 pb-8 border-t border-border bg-card relative z-10 mt-auto">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground font-medium">
              <p>© 2026 Schedex Platforms Inc. All rights reserved.</p>
              <div className="flex gap-4">
                <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
                <a href="#" className="hover:text-foreground transition-colors">Terms of Service</a>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {[FaTwitter, FaGithub, FaLinkedin].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-8 h-8 rounded-full bg-muted/20 flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
