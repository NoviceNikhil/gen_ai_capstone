import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { ArrowRight, CheckCircle2, ShieldAlert, Upload, Sparkles, Building2, User, MapPin, Landmark, Receipt, FileCheck } from "lucide-react";
import axios from "axios";
import { getProviderOnboardingAPI, updateProviderOnboardingAPI, uploadOnboardingFileAPI, getCategoriesAPI } from "../../services/apiService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { FaTwitter, FaGithub, FaLinkedin } from "react-icons/fa";
import toast from "react-hot-toast";

const INDIAN_STATES = [
  "Karnataka",
  "Maharashtra",
  "Tamil Nadu",
  "Telangana",
  "Delhi",
  "Gujarat",
  "Rajasthan",
  "West Bengal",
  "Kerala"
];

const STATE_CITIES = {
  "Karnataka": ["Bengaluru"],
  "Maharashtra": ["Mumbai", "Pune"],
  "Tamil Nadu": ["Chennai"],
  "Telangana": ["Hyderabad"],
  "Delhi": ["Delhi"],
  "Gujarat": ["Ahmedabad", "Surat"],
  "Rajasthan": ["Jaipur"],
  "West Bengal": ["Kolkata"],
  "Kerala": ["Kochi"]
};

export default function ProviderOnboarding() {
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);
  
  const [form, setForm] = useState({
    organization_name: "",
    owner_name: "",
    address: "",
    state: "",
    city: "",
    pincode: "",
    tax_number: "",
    bank_details: "",
    identity_proof_url: "",
    profile_photo_url: "",
    certificates_urls: "",
    specialization: "",
    experience_years: 0,
    profile_description: "",
    category_id: "",
  });
  
  const [categories, setCategories] = useState([]);
  const [onboardingId, setOnboardingId] = useState("");
  const [uploading, setUploading] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [focused, setFocused] = useState({});
  const [uploadErrors, setUploadErrors] = useState({});

  const FIELD_RULES = {
    owner_name: "At least 2 characters. Only letters and spaces allowed.",
    organization_name: "Optional. At least 2 characters if provided.",
    address: "Full practicing address (minimum 10 characters).",
    state: "Select your practicing state.",
    city: "Select your practicing city.",
    pincode: "6-digit PIN code matching your selected city.",
    tax_number: "Alphanumeric Tax ID (GST/VAT/PAN) between 8-20 characters.",
    bank_details: "Bank credentials (Account No, IFSC, Bank Name). Min 10 chars.",
    specialization: "Area of expertise (minimum 3 characters).",
    experience_years: "Years of professional practice (non-negative).",
    profile_description: "Introduce yourself to clients. Minimum 20 characters.",
    category_id: "Select your practicing category.",
  };

  const validateField = (name, value) => {
    let err = "";
    const strVal = String(value || "").trim();

    if (name === "owner_name") {
      if (strVal.length < 2) {
        err = "Owner name must be at least 2 characters long.";
      } else if (!/^[A-Za-z\s]+$/.test(strVal)) {
        err = "Owner name must contain only letters and spaces.";
      }
    } else if (name === "organization_name") {
      if (strVal && strVal.length < 2) {
        err = "Organization name must be at least 2 characters long.";
      }
    } else if (name === "address") {
      if (strVal.length < 10) {
        err = "Address must be at least 10 characters long.";
      }
    } else if (name === "state") {
      if (!strVal) {
        err = "Please select a state.";
      }
    } else if (name === "city") {
      if (!strVal) {
        err = "Please select a city.";
      }
    } else if (name === "pincode") {
      if (!/^\d{6}$/.test(strVal)) {
        err = "PIN code must be exactly 6 digits.";
      } else {
        const pincodePrefixes = {
          "Bengaluru": ["560"],
          "Mumbai": ["400"],
          "Pune": ["411", "412"],
          "Chennai": ["600"],
          "Hyderabad": ["500"],
          "Delhi": ["110"],
          "Ahmedabad": ["380"],
          "Surat": ["395"],
          "Jaipur": ["302"],
          "Kolkata": ["700"],
          "Kochi": ["682"],
        };
        const allowed = pincodePrefixes[form.city] || [];
        const isValidPin = allowed.some(pref => strVal.startsWith(pref));
        if (form.city && !isValidPin) {
          err = `PIN code must be valid for ${form.city} (starts with ${allowed.join(" or ")}).`;
        }
      }
    } else if (name === "tax_number") {
      if (strVal.length < 8 || strVal.length > 20 || !/^[A-Za-z0-9]+$/.test(strVal)) {
        err = "Tax ID (GST/VAT/PAN) must be between 8 and 20 alphanumeric characters.";
      }
    } else if (name === "bank_details") {
      if (strVal.length < 10) {
        err = "Bank details must be at least 10 characters long.";
      }
    } else if (name === "specialization") {
      if (strVal.length < 3) {
        err = "Specialization must be at least 3 characters long.";
      }
    } else if (name === "experience_years") {
      if (Number(value) < 0) {
        err = "Experience years cannot be negative.";
      }
    } else if (name === "profile_description") {
      if (strVal.length < 20) {
        err = "Profile description must be at least 20 characters long.";
      }
    } else if (name === "category_id") {
      if (!strVal) {
        err = "Please select a category.";
      }
    }

    setErrors(prev => ({ ...prev, [name]: err }));
    return err;
  };

  const handleInputFocus = (name) => {
    setFocused(prev => ({ ...prev, [name]: true }));
  };

  const handleInputBlur = (name) => {
    setFocused(prev => ({ ...prev, [name]: false }));
    setTouched(prev => ({ ...prev, [name]: true }));
    validateField(name, form[name]);
  };

  const renderFieldFeedback = (name) => {
    const isFocused = focused[name];
    const isTouched = touched[name];
    const error = errors[name];
    const rule = FIELD_RULES[name];

    if (isTouched && error) {
      return (
        <span className="text-[11px] text-destructive font-semibold flex items-center gap-1 mt-1 animate-fade-in text-red-400">
          <ShieldAlert size={12} className="shrink-0" /> {error}
        </span>
      );
    }

    if (isFocused && rule) {
      return (
        <span className="text-[11px] text-primary/80 font-medium flex items-center gap-1 mt-1 animate-fade-in text-blue-400">
          <Sparkles size={12} className="shrink-0" /> {rule}
        </span>
      );
    }

    return null;
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load categories
        const catRes = await getCategoriesAPI();
        setCategories(catRes.data?.data?.categories || []);
        
        // Load existing onboarding/profile details
        const res = await getProviderOnboardingAPI();
        const onboarding = res.data?.data?.onboarding;
        if (onboarding) {
          setOnboardingId(onboarding.id || "");
          if (onboarding.submitted_for_approval) {
            navigate("/provider/dashboard");
            return;
          }
          
          // Also fetch provider profile details to fill in additional fields
          const profileRes = await import("../../services/apiService").then(m => m.getProviderProfileAPI());
          const p = profileRes.data?.data?.provider || {};
          
          setForm({
            organization_name: onboarding.organization_name || p.organization_name || "",
            owner_name: onboarding.owner_name || p.owner_name || "",
            address: onboarding.address || p.address || "",
            state: onboarding.state || p.state || "",
            city: onboarding.city || p.city || "",
            pincode: onboarding.pincode || p.pincode || "",
            tax_number: onboarding.tax_number || p.tax_number || "",
            bank_details: onboarding.bank_details || p.bank_details || "",
            identity_proof_url: onboarding.identity_proof_url || p.identity_proof_url || "",
            profile_photo_url: onboarding.profile_photo_url || p.profile_photo_url || "",
            certificates_urls: onboarding.certificates_urls || p.certificates_urls || "",
            specialization: p.specialization || "",
            experience_years: p.experience_years || 0,
            profile_description: p.profile_description || "",
            category_id: p.category_id || "",
          });
        }
      } catch (err) {
        console.error("Failed to load onboarding data:", err);
      }
    };
    loadData();
  }, [navigate]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    validateField(field, value);
  };

  const handleDocUpload = async (field, file) => {
    if (!file) return;
    
    // Check file type based on field
    let allowedExtensions;
    let errorMessage;
    
    if (field === "profile_photo_url") {
      // Allow images for profile photo
      allowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".pdf", ".doc", ".docx"];
      errorMessage = "Only image files (JPG, PNG, etc.) or documents (PDF, DOC, DOCX) are allowed.";
    } else {
      // Only documents for other fields
      allowedExtensions = [".pdf", ".doc", ".docx"];
      errorMessage = "Only .pdf, .doc, .docx files are allowed.";
    }
    
    const ext = `.${(file.name.split(".").pop() || "").toLowerCase()}`;
    if (!allowedExtensions.includes(ext)) {
      setUploadErrors((s) => ({ ...s, [field]: errorMessage }));
      toast.error(errorMessage);
      return;
    }
    try {
      setUploading((s) => ({ ...s, [field]: true }));
      setUploadErrors((s) => ({ ...s, [field]: "" }));
      
      const fd = new FormData();
      fd.append("file", file);
      
      const res = await uploadOnboardingFileAPI(fd);
      const path = res.data?.data?.file_path;
      
      if (path) {
        updateField(field, path);
        
        // Call AI verification API to check document content
        try {
          // Determine field type for verification
          let fieldType = "identity_proof_url";
          if (field === "profile_photo_url") {
            fieldType = "profile_photo_url";
          } else if (field === "certificates_urls") {
            fieldType = "certificates_urls";
          }
          
          const verifyRes = await axios.post(
            `${import.meta.env.VITE_API_BASE_URL}/api/provider/verify-document`,
            {
              file_url: path,
              provider_onboarding_id: onboardingId || "temp-" + Date.now(),
              field_type: fieldType,
              category_name: form.category_id ? categories.find(c => String(c.id) === String(form.category_id))?.name : "", // Pass selected category
            },
            { withCredentials: true }
          );
          
          const verifyData = verifyRes.data;
          
          if (verifyData.status === "complete") {
            // Document is valid
            setUploadErrors((s) => ({ ...s, [field]: "" }));
            toast.success(`✅ ${field.replace("_url", "").replace("_", " ")} verified successfully!`);
          } else if (verifyData.status === "incomplete") {
            // Document is missing required content
            const errorMsg = verifyData.message || `Missing: ${verifyData.missing_fields.join(", ")}`;
            setUploadErrors((s) => ({ ...s, [field]: errorMsg }));
            toast.error(errorMsg);
          }
        } catch (verifyError) {
          console.error("Verification error:", verifyError);
          // Still show upload success even if verification fails
          toast.success(`${field.replace("_url", "").replace("_", " ")} uploaded successfully!`);
        }
      } else {
        const msg = "Upload failed: No file path returned from server";
        setUploadErrors((s) => ({ ...s, [field]: msg }));
        toast.error(msg);
        setUploading((s) => ({ ...s, [field]: false }));
      }
    } catch (error) {
      console.error(`Upload error for ${field}:`, error);
      
      let errorMsg = "File upload failed";
      if (error.response?.status === 413) {
        errorMsg = "File too large. Maximum size is 10MB.";
      } else if (error.response?.status === 415) {
        errorMsg = "Invalid file type. Only PDF, DOC, DOCX allowed.";
      } else if (error.response?.data?.detail) {
        errorMsg = `Upload error: ${error.response.data.detail}`;
      } else if (error.message) {
        errorMsg = `Upload error: ${error.message}`;
      }
      
      setUploadErrors((s) => ({ ...s, [field]: errorMsg }));
      toast.error(errorMsg);
      setUploading((s) => ({ ...s, [field]: false }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate onboarding details
    const required = [
      "owner_name", "state", "city", "pincode", 
      "tax_number", "bank_details", "specialization", "profile_description", 
      "category_id", "identity_proof_url", "profile_photo_url", "certificates_urls"
    ];
    const missing = required.find((k) => !String(form[k] || "").trim());
    if (missing) {
      toast.error(`Please complete all details and upload the required ${missing.replace("_url", "").replace("_", " ")}.`);
      return;
    }

    // Owner Name validation
    if (form.owner_name.trim().length < 2 || !/^[A-Za-z\s]+$/.test(form.owner_name)) {
      toast.error("Owner name must be at least 2 characters long and contain only letters and spaces.");
      return;
    }

    // Organization Name validation
    if (form.organization_name && form.organization_name.trim().length < 2) {
      toast.error("Organization name must be at least 2 characters long.");
      return;
    }

    // Pincode validation linked to State/City
    const pincodePrefixes = {
      "Bengaluru": ["560"],
      "Mumbai": ["400"],
      "Pune": ["411", "412"],
      "Chennai": ["600"],
      "Hyderabad": ["500"],
      "Delhi": ["110"],
      "Ahmedabad": ["380"],
      "Surat": ["395"],
      "Jaipur": ["302"],
      "Kolkata": ["700"],
      "Kochi": ["682"],
    };
    const allowed = pincodePrefixes[form.city] || [];
    const isValidPin = allowed.some(pref => form.pincode.startsWith(pref));
    if (!/^\d{6}$/.test(form.pincode)) {
      toast.error("PIN code must be exactly 6 digits.");
      return;
    }
    if (!isValidPin) {
      toast.error(`PIN code must be valid for ${form.city} (starts with ${allowed.join(" or ")}).`);
      return;
    }

    // Tax Number validation
    if (form.tax_number.trim().length < 8 || form.tax_number.trim().length > 20 || !/^[A-Za-z0-9]+$/.test(form.tax_number)) {
      toast.error("Tax ID (GST/VAT/PAN) must be between 8 and 20 alphanumeric characters.");
      return;
    }

    // Bank Details validation
    if (form.bank_details.trim().length < 10) {
      toast.error("Bank details must be at least 10 characters long.");
      return;
    }

    // Specialization validation
    if (form.specialization.trim().length < 3) {
      toast.error("Specialization must be at least 3 characters long.");
      return;
    }

    // Experience Years validation
    if (Number(form.experience_years) < 0) {
      toast.error("Experience years cannot be negative.");
      return;
    }

    // Profile Description validation
    if (form.profile_description.trim().length < 20) {
      toast.error("Profile description must be at least 20 characters long.");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        ...form,
        experience_years: Number(form.experience_years),
        submitted_for_approval: true
      };
      const response = await updateProviderOnboardingAPI(payload);
      
      // After successful submission, trigger document analysis
      if (form.id || response.data?.data?.onboarding?.id) {
        const onboardingId = form.id || response.data.data.onboarding.id;
        try {
          await axios.post(
            `${import.meta.env.VITE_API_BASE_URL}/api/provider/analyze-onboarding-documents`,
            { provider_onboarding_id: onboardingId },
            { withCredentials: true }
          );
          console.log("Documents analyzed successfully");
        } catch (analyzeError) {
          console.error("Document analysis error:", analyzeError);
          // Don't fail the submission if analysis fails
        }
      }
      
      toast.success("Onboarding details submitted! Admin will approve your account shortly.");
      navigate("/provider/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit onboarding details");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between overflow-hidden bg-background">
      
      {/* ── Fixed Premium Video Background ── */}
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

      {/* ── Onboarding Content ── */}
      <div className="flex-1 w-full max-w-4xl mx-auto px-6 py-12 flex items-center justify-center relative z-10 animate-slide-up mt-8">
        <Card className="w-full bg-card/85 backdrop-blur-md border-border shadow-2xl rounded-2xl overflow-hidden">
          <CardContent className="p-8 md:p-10 space-y-8">
            
            {/* Header info */}
            <div className="text-center max-w-xl mx-auto space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-accent animate-pulse" /> Complete Onboarding
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                Professional Provider Setup
              </h1>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Welcome, <span className="font-semibold text-primary">{user?.full_name}</span>. Provide your credentials below. Once submitted, our admins will review your application for verification. You will be shown to customers in our marketplace after verification.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Basic and Professional Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-primary border-b border-border/60 pb-1.5 flex items-center gap-2">
                  <Building2 size={16} /> Business Information
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                  {/* <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider">Organization Name (Optional)</label>
                    <div className="relative flex items-center group">
                      <Building2 size={16} className="absolute left-4 text-muted-foreground pointer-events-none group-focus-within:text-primary transition-colors shrink-0" />
                      <Input
                        type="text"
                        placeholder="E.g. HealthSpace Clinics"
                        className="pl-11 h-12 bg-background/50 border-border"
                        value={form.organization_name}
                        onChange={(e) => updateField("organization_name", e.target.value)}
                        onFocus={() => handleInputFocus("organization_name")}
                        onBlur={() => handleInputBlur("organization_name")}
                      />
                    </div>
                    {renderFieldFeedback("organization_name")}
                  </div> */}

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider">Professional Owner Name</label>
                    <div className="relative flex items-center group">
                      <User size={16} className="absolute left-4 text-muted-foreground pointer-events-none group-focus-within:text-primary transition-colors shrink-0" />
                      <Input
                        type="text"
                        placeholder="Full Legal Name"
                        className="pl-11 h-12 bg-background/50 border-border"
                        value={form.owner_name}
                        onChange={(e) => updateField("owner_name", e.target.value)}
                        onFocus={() => handleInputFocus("owner_name")}
                        onBlur={() => handleInputBlur("owner_name")}
                        required
                      />
                    </div>
                    {renderFieldFeedback("owner_name")}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider">State</label>
                    <select
                      className="h-12 w-full rounded-lg border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary px-3 text-foreground"
                      value={form.state}
                      onChange={(e) => {
                        updateField("state", e.target.value);
                        updateField("city", "");
                      }}
                      onFocus={() => handleInputFocus("state")}
                      onBlur={() => handleInputBlur("state")}
                      required
                    >
                      <option value="">Select Indian State</option>
                      {INDIAN_STATES.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                    {renderFieldFeedback("state")}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider">City</label>
                    <select
                      className="h-12 w-full rounded-lg border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary px-3 text-foreground"
                      value={form.city}
                      onChange={(e) => updateField("city", e.target.value)}
                      onFocus={() => handleInputFocus("city")}
                      onBlur={() => handleInputBlur("city")}
                      disabled={!form.state}
                      required
                    >
                      <option value="">Select City</option>
                      {form.state && STATE_CITIES[form.state]?.map((ct) => (
                        <option key={ct} value={ct}>{ct}</option>
                      ))}
                    </select>
                    {renderFieldFeedback("city")}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider">PIN Code</label>
                    <div className="relative flex items-center group">
                      <MapPin size={16} className="absolute left-4 text-muted-foreground pointer-events-none group-focus-within:text-primary transition-colors shrink-0" />
                      <Input
                        type="text"
                        placeholder="6-digit PIN code"
                        maxLength={6}
                        className="pl-11 h-12 bg-background/50 border-border"
                        value={form.pincode}
                        onChange={(e) => updateField("pincode", e.target.value.replace(/\D/g, ""))}
                        onFocus={() => handleInputFocus("pincode")}
                        onBlur={() => handleInputBlur("pincode")}
                        required
                      />
                    </div>
                    {renderFieldFeedback("pincode")}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider">Tax ID Number (GST / VAT / PAN)</label>
                    <div className="relative flex items-center group">
                      <Receipt size={16} className="absolute left-4 text-muted-foreground pointer-events-none group-focus-within:text-primary transition-colors shrink-0" />
                      <Input
                        type="text"
                        placeholder="GSTIN or regional tax code"
                        className="pl-11 h-12 bg-background/50 border-border"
                        value={form.tax_number}
                        onChange={(e) => updateField("tax_number", e.target.value)}
                        onFocus={() => handleInputFocus("tax_number")}
                        onBlur={() => handleInputBlur("tax_number")}
                        required
                      />
                    </div>
                    {renderFieldFeedback("tax_number")}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider">Bank Details for Payouts</label>
                    <div className="relative flex items-center group">
                      <Landmark size={16} className="absolute left-4 text-muted-foreground pointer-events-none group-focus-within:text-primary transition-colors shrink-0" />
                      <Input
                        type="text"
                        placeholder="Account No, Bank Name, IFSC Code"
                        className="pl-11 h-12 bg-background/50 border-border"
                        value={form.bank_details}
                        onChange={(e) => updateField("bank_details", e.target.value)}
                        onFocus={() => handleInputFocus("bank_details")}
                        onBlur={() => handleInputBlur("bank_details")}
                        required
                      />
                    </div>
                    {renderFieldFeedback("bank_details")}
                  </div>
                </div>
              </div>

              {/* Professional Profile Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-primary border-b border-border/60 pb-1.5 flex items-center gap-2">
                  <User size={16} /> Professional Profile
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider">Service Category</label>
                    <select
                      className="h-12 w-full rounded-lg border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary px-3 text-foreground"
                      value={form.category_id}
                      onChange={(e) => updateField("category_id", e.target.value)}
                      onFocus={() => handleInputFocus("category_id")}
                      onBlur={() => handleInputBlur("category_id")}
                      required
                    >
                      <option value="">Select Category</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                    {renderFieldFeedback("category_id")}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider">Specialization</label>
                    <div className="relative flex items-center group">
                      <Sparkles size={16} className="absolute left-4 text-muted-foreground pointer-events-none group-focus-within:text-primary transition-colors shrink-0" />
                      <Input
                        type="text"
                        placeholder="E.g. General Physician, Makeup Artist"
                        className="pl-11 h-12 bg-background/50 border-border"
                        value={form.specialization}
                        onChange={(e) => updateField("specialization", e.target.value)}
                        onFocus={() => handleInputFocus("specialization")}
                        onBlur={() => handleInputBlur("specialization")}
                        required
                      />
                    </div>
                    {renderFieldFeedback("specialization")}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">Years of Experience</label>
                  <Input
                    type="number"
                    min={0}
                    className="h-12 bg-background/50 border-border"
                    value={form.experience_years}
                    onChange={(e) => updateField("experience_years", e.target.value)}
                    onFocus={() => handleInputFocus("experience_years")}
                    onBlur={() => handleInputBlur("experience_years")}
                    required
                  />
                  {renderFieldFeedback("experience_years")}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">About / Profile Description</label>
                  <textarea
                    placeholder="Describe your services, professional experience, and approach..."
                    className="pl-4 pr-4 py-3 min-h-[100px] w-full rounded-lg border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground"
                    value={form.profile_description}
                    onChange={(e) => updateField("profile_description", e.target.value)}
                    onFocus={() => handleInputFocus("profile_description")}
                    onBlur={() => handleInputBlur("profile_description")}
                    required
                  />
                  {renderFieldFeedback("profile_description")}
                </div>
              </div>

              {/* Upload Verification Documents */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-primary border-b border-border/60 pb-1.5 flex items-center gap-2">
                  <FileCheck size={16} /> Verification Documents
                </h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed -mt-2">
                  Please upload valid PDFs, DOC, or DOCX copies of your files. URL typing is disabled for security.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Identity Proof */}
                  <div className="p-4 rounded-xl border border-border bg-background/40 hover:bg-background/60 transition-all flex flex-col justify-between h-auto">
                    <div>
                      <p className="text-xs font-extrabold text-foreground uppercase tracking-wider mb-1">Identity Proof</p>
                      <p className="text-[10px] text-muted-foreground leading-snug">Passport, Driver License, or National ID card copy.</p>
                    </div>
                    <div className="mt-3 space-y-2">
                      {form.identity_proof_url ? (
                        <div>
                          <label className={`flex items-center justify-center gap-2 h-9 px-3 border border-border border-dashed rounded-lg cursor-pointer text-xs font-semibold transition-all bg-card/60 ${!form.category_id ? "opacity-50 cursor-not-allowed text-muted-foreground" : "text-muted-foreground hover:text-foreground hover:border-primary"}`}>
                            <Upload size={14} /> Re-upload
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx"
                              className="hidden"
                              disabled={!form.category_id}
                              onChange={(e) => handleDocUpload("identity_proof_url", e.target.files?.[0])}
                            />
                          </label>
                          <div className="flex items-center gap-1.5 text-xs text-success font-semibold mt-1">
                            <CheckCircle2 size={16} /> Uploaded
                          </div>
                        </div>
                      ) : uploading.identity_proof_url ? (
                        <span className="text-xs text-muted-foreground animate-pulse">Uploading...</span>
                      ) : (
                        <>
                          <label className={`flex items-center justify-center gap-2 h-9 px-3 border border-border border-dashed rounded-lg cursor-pointer text-xs font-semibold transition-all bg-card/60 ${!form.category_id ? "opacity-50 cursor-not-allowed text-muted-foreground" : "text-muted-foreground hover:text-foreground hover:border-primary"}`}>
                            <Upload size={14} /> Choose File
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx"
                              className="hidden"
                              disabled={!form.category_id}
                              onChange={(e) => handleDocUpload("identity_proof_url", e.target.files?.[0])}
                            />
                          </label>
                          {!form.category_id && (
                            <p className="text-[10px] text-amber-600 font-semibold flex items-center gap-1">
                              ⚠️ Select category first
                            </p>
                          )}
                        </>
                      )}
                      {uploadErrors.identity_proof_url && (
                        <div className="flex items-start gap-1.5 p-2 bg-destructive/10 border border-destructive/30 rounded-md">
                          <ShieldAlert size={14} className="text-destructive mt-0.5 flex-shrink-0" />
                          <p className="text-[10px] text-destructive leading-snug">{uploadErrors.identity_proof_url}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Profile Photo */}
                  <div className="p-4 rounded-xl border border-border bg-background/40 hover:bg-background/60 transition-all flex flex-col justify-between h-auto">
                    <div>
                      <p className="text-xs font-extrabold text-foreground uppercase tracking-wider mb-1">Profile Photo Doc</p>
                      <p className="text-[10px] text-muted-foreground leading-snug">Recent professional headshot or photo file document.</p>
                    </div>
                    <div className="mt-3 space-y-2">
                      {form.profile_photo_url ? (
                        <div>
                          <label className={`flex items-center justify-center gap-2 h-9 px-3 border border-border border-dashed rounded-lg cursor-pointer text-xs font-semibold transition-all bg-card/60 ${!form.category_id ? "opacity-50 cursor-not-allowed text-muted-foreground" : "text-muted-foreground hover:text-foreground hover:border-primary"}`}>
                            <Upload size={14} /> Re-upload
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.bmp"
                              className="hidden"
                              disabled={!form.category_id}
                              onChange={(e) => handleDocUpload("profile_photo_url", e.target.files?.[0])}
                            />
                          </label>
                          <div className="flex items-center gap-1.5 text-xs text-success font-semibold mt-1">
                            <CheckCircle2 size={16} /> Uploaded
                          </div>
                        </div>
                      ) : uploading.profile_photo_url ? (
                        <span className="text-xs text-muted-foreground animate-pulse">Uploading...</span>
                      ) : (
                        <>
                          <label className={`flex items-center justify-center gap-2 h-9 px-3 border border-border border-dashed rounded-lg cursor-pointer text-xs font-semibold transition-all bg-card/60 ${!form.category_id ? "opacity-50 cursor-not-allowed text-muted-foreground" : "text-muted-foreground hover:text-foreground hover:border-primary"}`}>
                            <Upload size={14} /> Choose File
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.bmp"
                              className="hidden"
                              disabled={!form.category_id}
                              onChange={(e) => handleDocUpload("profile_photo_url", e.target.files?.[0])}
                            />
                          </label>
                          {!form.category_id && (
                            <p className="text-[10px] text-amber-600 font-semibold flex items-center gap-1">
                              ⚠️ Select category first
                            </p>
                          )}
                        </>
                      )}
                      {uploadErrors.profile_photo_url && (
                        <div className="flex items-start gap-1.5 p-2 bg-destructive/10 border border-destructive/30 rounded-md">
                          <ShieldAlert size={14} className="text-destructive mt-0.5 flex-shrink-0" />
                          <p className="text-[10px] text-destructive leading-snug">{uploadErrors.profile_photo_url}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Professional Certificates */}
                  <div className="p-4 rounded-xl border border-border bg-background/40 hover:bg-background/60 transition-all flex flex-col justify-between h-auto">
                    <div>
                      <p className="text-xs font-extrabold text-foreground uppercase tracking-wider mb-1">Certificates Docs</p>
                      <p className="text-[10px] text-muted-foreground leading-snug">Board certifications, licenses, or diplomas.</p>
                    </div>
                    <div className="mt-3 space-y-2">
                      {form.certificates_urls ? (
                        <div>
                          <label className={`flex items-center justify-center gap-2 h-9 px-3 border border-border border-dashed rounded-lg cursor-pointer text-xs font-semibold transition-all bg-card/60 ${!form.category_id ? "opacity-50 cursor-not-allowed text-muted-foreground" : "text-muted-foreground hover:text-foreground hover:border-primary"}`}>
                            <Upload size={14} /> Re-upload
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx"
                              className="hidden"
                              disabled={!form.category_id}
                              onChange={(e) => handleDocUpload("certificates_urls", e.target.files?.[0])}
                            />
                          </label>
                          <div className="flex items-center gap-1.5 text-xs text-success font-semibold mt-1">
                            <CheckCircle2 size={16} /> Uploaded
                          </div>
                        </div>
                      ) : uploading.certificates_urls ? (
                        <span className="text-xs text-muted-foreground animate-pulse">Uploading...</span>
                      ) : (
                        <>
                          <label className={`flex items-center justify-center gap-2 h-9 px-3 border border-border border-dashed rounded-lg cursor-pointer text-xs font-semibold transition-all bg-card/60 ${!form.category_id ? "opacity-50 cursor-not-allowed text-muted-foreground" : "text-muted-foreground hover:text-foreground hover:border-primary"}`}>
                            <Upload size={14} /> Choose File
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx"
                              className="hidden"
                              disabled={!form.category_id}
                              onChange={(e) => handleDocUpload("certificates_urls", e.target.files?.[0])}
                            />
                          </label>
                          {!form.category_id && (
                            <p className="text-[10px] text-amber-600 font-semibold flex items-center gap-1">
                              ⚠️ Select category first
                            </p>
                          )}
                        </>
                      )}
                      {uploadErrors.certificates_urls && (
                        <div className="flex items-start gap-1.5 p-2 bg-destructive/10 border border-destructive/30 rounded-md">
                          <ShieldAlert size={14} className="text-destructive mt-0.5 flex-shrink-0" />
                          <p className="text-[10px] text-destructive leading-snug">{uploadErrors.certificates_urls}</p>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-6 border-t border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground leading-snug">
                  <ShieldAlert size={16} className="text-amber-500 shrink-0" />
                  <span>Admin approval is mandatory before publishing onto search results.</span>
                </div>
                
                <Button
                  type="submit"
                  size="lg"
                  className="font-bold h-12 px-8 cursor-pointer group flex items-center justify-center"
                  disabled={submitting}
                >
                  {submitting ? "Submitting Application..." : "Submit for Approval"}
                  <ArrowRight size={16} className="ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>

            </form>

          </CardContent>
        </Card>
      </div>

      {/* ── Footer ── */}
      <footer className="pt-16 pb-8 border-t border-border bg-card relative z-10 mt-auto">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground font-medium">
              <p>© 2026 SIGCAL Platforms Inc. All rights reserved.</p>
              <div className="flex gap-4">
                <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
                <a href="#" className="hover:text-foreground transition-colors">Terms of Service</a>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <a href="#" className="w-8 h-8 rounded-full bg-muted/20 flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all">
                <FaTwitter size={16} />
              </a>
              <a href="#" className="w-8 h-8 rounded-full bg-muted/20 flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all">
                <FaGithub size={16} />
              </a>
              <a href="#" className="w-8 h-8 rounded-full bg-muted/20 flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all">
                <FaLinkedin size={16} />
              </a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
