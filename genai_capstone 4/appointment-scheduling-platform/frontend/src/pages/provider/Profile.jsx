import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  getProviderProfileAPI,
  updateProviderProfileAPI,
  getCategoriesAPI,
  getProviderOfferingsAPI,
  saveProviderOfferingAPI,
  getProviderIntakeFormAPI,
  saveProviderIntakeFormAPI,
  getProviderPackagesAPI,
  saveProviderPackageAPI,
  getProviderOnboardingAPI,
  updateProviderOnboardingAPI,
} from "../../services/apiService";
import { fetchProfile } from "../../store/authSlice";
import toast from "react-hot-toast";
import { Save, Plus, Briefcase, FileText, Gift, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ProfileSkeleton = () => (
  <div className="p-6 max-w-5xl mx-auto space-y-6 animate-fade-in">
    <div className="skeleton w-48 h-9" />
    <div className="skeleton w-full h-[52px]" />
    <div className="skeleton w-full h-[400px]" />
  </div>
);

export default function ProviderProfile() {
  const { user } = useSelector((s) => s.auth);
  const [profile, setProfile] = useState(null);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [offerings, setOfferings] = useState([]);
  const [intakeFields, setIntakeFields] = useState([]);
  const [intakeTitle, setIntakeTitle] = useState("Pre-Appointment Form");
  const [packages, setPackages] = useState([]);
  const [newOffering, setNewOffering] = useState({
    title: "",
    description: "",
    duration_minutes: 30,
    price: 0,
  });
  const [newPackage, setNewPackage] = useState({
    title: "",
    session_count: 5,
    discount_percent: 0,
    package_price: 0,
  });
  const [activeTab, setActiveTab] = useState("details");
  const [onboarding, setOnboarding] = useState({
    organization_name: "",
    owner_name: "",
    email: "",
    phone: "",
    address: "",
    identity_proof_url: "",
    tax_number: "",
    bank_details: "",
    profile_photo_url: "",
    certificates_urls: "",
    submitted_for_approval: false,
  });
  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [focused, setFocused] = useState({});

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
    consultation_fee: "Consultation fee in Rupees (non-negative).",
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
    } else if (name === "consultation_fee") {
      if (Number(value) < 0) {
        err = "Consultation fee cannot be negative.";
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
        <span className="text-[11px] text-destructive font-semibold flex items-center gap-1 mt-1 text-red-400">
          ⚠️ {error}
        </span>
      );
    }

    if (isFocused && rule) {
      return (
        <span className="text-[11px] text-primary/80 font-medium flex items-center gap-1 mt-1 text-blue-400">
          ✨ {rule}
        </span>
      );
    }

    return null;
  };

  useEffect(() => {
    Promise.all([
      getProviderProfileAPI(),
      getCategoriesAPI(),
      getProviderOfferingsAPI(),
      getProviderIntakeFormAPI(),
      getProviderPackagesAPI(),
      getProviderOnboardingAPI(),
    ]).then(([pRes, cRes, oRes, iRes, pkgRes, onRes]) => {
      const p = pRes.data?.data?.provider;
      setProfile(p);
      setForm({
        specialization: p?.specialization || "",
        experience_years: p?.experience_years || 0,
        profile_description: p?.profile_description || "",
        location: p?.location || "",
        state: p?.state || "",
        city: p?.city || "",
        pincode: p?.pincode || "",
        consultation_fee: p?.consultation_fee || 0,
        category_id: p?.category_id || "",
        organization_id: p?.organization_id || "",
        is_accepting_appointments: p?.is_accepting_appointments ?? true,
        organization_name: p?.organization_name || "",
        owner_name: p?.owner_name || "",
        address: p?.address || "",
        tax_number: p?.tax_number || "",
        bank_details: p?.bank_details || "",
        identity_proof_url: p?.identity_proof_url || "",
        certificates_urls: p?.certificates_urls || "",
        profile_photo_url: p?.profile_photo_url || "",
      });
      setCategories(cRes.data?.data?.categories || []);
      setOfferings(oRes.data?.data?.offerings || []);
      const intake = iRes.data?.data?.intake_form;
      if (intake) {
        setIntakeTitle(intake.title || "Pre-Appointment Form");
        try {
          setIntakeFields(JSON.parse(intake.fields_json || "[]"));
        } catch {
          setIntakeFields([]);
        }
      }
      setPackages(pkgRes.data?.data?.packages || []);
      const ob = onRes.data?.data?.onboarding || {};
      setOnboarding({
        organization_name: ob.organization_name || "",
        owner_name: ob.owner_name || "",
        email: ob.email || "",
        phone: ob.phone || "",
        address: ob.address || "",
        identity_proof_url: ob.identity_proof_url || "",
        tax_number: ob.tax_number || "",
        bank_details: ob.bank_details || "",
        profile_photo_url: ob.profile_photo_url || "",
        certificates_urls: ob.certificates_urls || "",
        submitted_for_approval: !!ob.submitted_for_approval,
      });
    });
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();

    // Owner Name validation
    if (form.owner_name && (form.owner_name.trim().length < 2 || !/^[A-Za-z\s]+$/.test(form.owner_name))) {
      toast.error("Owner name must be at least 2 characters long and contain only letters and spaces.");
      return;
    }

    // Organization Name validation
    if (form.organization_name && form.organization_name.trim().length < 2) {
      toast.error("Organization name must be at least 2 characters long.");
      return;
    }

    // Address validation
    if (form.address && form.address.trim().length < 10) {
      toast.error("Address must be at least 10 characters long.");
      return;
    }

    // PIN code prefix validation
    if (form.pincode) {
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
      if (form.city && !isValidPin) {
        toast.error(`PIN code must be valid for ${form.city} (starts with ${allowed.join(" or ")}).`);
        return;
      }
    }

    // Tax Number validation
    if (form.tax_number && (form.tax_number.trim().length < 8 || form.tax_number.trim().length > 20 || !/^[A-Za-z0-9]+$/.test(form.tax_number))) {
      toast.error("Tax ID (GST/VAT/PAN) must be between 8 and 20 alphanumeric characters.");
      return;
    }

    // Bank Details validation
    if (form.bank_details && form.bank_details.trim().length < 10) {
      toast.error("Bank details must be at least 10 characters long.");
      return;
    }

    // Specialization validation
    if (form.specialization && form.specialization.trim().length < 3) {
      toast.error("Specialization must be at least 3 characters long.");
      return;
    }

    // Experience Years validation
    if (form.experience_years !== undefined && Number(form.experience_years) < 0) {
      toast.error("Experience years cannot be negative.");
      return;
    }

    // Consultation Fee validation
    if (form.consultation_fee !== undefined && Number(form.consultation_fee) < 0) {
      toast.error("Consultation fee cannot be negative.");
      return;
    }

    // Profile Description validation
    if (form.profile_description && form.profile_description.trim().length < 20) {
      toast.error("Profile description must be at least 20 characters long.");
      return;
    }

    setSaving(true);
    try {
      await updateProviderProfileAPI(form);
      toast.success("Profile updated!");
    } catch {
      toast.error("Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleAddOffering = async () => {
    if (!newOffering.title.trim())
      return toast.error("Offering title is required");
    try {
      await saveProviderOfferingAPI(newOffering);
      const fresh = await getProviderOfferingsAPI();
      setOfferings(fresh.data?.data?.offerings || []);
      setNewOffering({
        title: "",
        description: "",
        duration_minutes: 30,
        price: 0,
      });
      toast.success("Offering saved");
    } catch {
      toast.error("Failed to save offering");
    }
  };

  const handleSaveIntakeForm = async () => {
    try {
      await saveProviderIntakeFormAPI({
        title: intakeTitle,
        fields: intakeFields,
      });
      toast.success("Intake form saved");
    } catch {
      toast.error("Failed to save intake form");
    }
  };

  const handleAddPackage = async () => {
    if (!newPackage.title.trim())
      return toast.error("Package title is required");
    try {
      await saveProviderPackageAPI(newPackage);
      const fresh = await getProviderPackagesAPI();
      setPackages(fresh.data?.data?.packages || []);
      setNewPackage({
        title: "",
        session_count: 5,
        discount_percent: 0,
        package_price: 0,
      });
      toast.success("Package saved");
    } catch {
      toast.error("Failed to save package");
    }
  };

  const handleSaveOnboarding = async () => {
    try {
      await updateProviderOnboardingAPI(onboarding);
      toast.success("Onboarding details saved");
    } catch {
      toast.error("Failed to save onboarding details");
    }
  };

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

  if (!profile) return <ProfileSkeleton />;

  const FIELDS = [
    { key: "specialization", label: "Specialization", type: "text" },
    { key: "experience_years", label: "Years of Experience", type: "number" },
    { key: "consultation_fee", label: "Consultation Fee (₹)", type: "number" },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in space-y-6">
      <div className="border-b border-border/40 pb-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          My Profile
        </h1>
        <p className="text-xs text-text-muted mt-1">
          Configure profile details, offerings, client intake questions, and
          packages.
        </p>
        {!profile?.is_verified && (
          <p className="text-xs mt-2 text-amber-600 font-semibold">
            Account is pending admin approval. You can complete setup now, and go live after approval.
          </p>
        )}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full space-y-6"
      >
        <TabsList className="w-full sm:w-auto flex flex-wrap">
          <TabsTrigger value="details" className="gap-1.5">
            <User size={14} /> Core Profile
          </TabsTrigger>
          <TabsTrigger value="offerings" className="gap-1.5">
            <Briefcase size={14} /> Offerings
          </TabsTrigger>
          <TabsTrigger value="intake" className="gap-1.5">
            <FileText size={14} /> Intake Form
          </TabsTrigger>
          <TabsTrigger value="onboarding" className="gap-1.5">
            <FileText size={14} /> Onboarding
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Core Details */}
        <TabsContent value="details">
          <Card variant="glass" className="p-6">
            <CardContent>
              <form onSubmit={handleSave} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {FIELDS.map(({ key, label, type }) => (
                    <div key={key} className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                        {label}
                      </label>
                      <Input
                        type={type}
                        value={form[key] || ""}
                        onChange={(e) => {
                          setForm({ ...form, [key]: e.target.value });
                          validateField(key, e.target.value);
                        }}
                        onFocus={() => handleInputFocus(key)}
                        onBlur={() => handleInputBlur(key)}
                      />
                      {renderFieldFeedback(key)}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                      State
                    </label>
                    <select
                      className="h-10 w-full rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary px-3 text-foreground"
                      value={form.state || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm({ ...form, state: val, city: "" });
                        validateField("state", val);
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

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                      City
                    </label>
                    <select
                      className="h-10 w-full rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary px-3 text-foreground"
                      value={form.city || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm({ ...form, city: val });
                        validateField("city", val);
                      }}
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

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                      PIN Code
                    </label>
                    <Input
                      type="text"
                      placeholder="6-digit PIN code"
                      maxLength={6}
                      value={form.pincode || ""}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        setForm({ ...form, pincode: val });
                        validateField("pincode", val);
                      }}
                      onFocus={() => handleInputFocus("pincode")}
                      onBlur={() => handleInputBlur("pincode")}
                      required
                    />
                    {renderFieldFeedback("pincode")}
                  </div>
                </div>

                <div className="space-y-1.5 mt-4">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    Office or Practice Address
                  </label>
                  <textarea
                    placeholder="Enter full physical address"
                    className="w-full resize-none rounded-lg border border-border bg-surface-1/60 text-foreground transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none p-3 placeholder:text-text-faint/60 text-sm h-20"
                    value={form.address || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm({ ...form, address: val });
                      validateField("address", val);
                    }}
                    onFocus={() => handleInputFocus("address")}
                    onBlur={() => handleInputBlur("address")}
                    required
                  />
                  {renderFieldFeedback("address")}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                      Category
                    </label>
                    <Select
                      value={form.category_id || ""}
                      onValueChange={(val) => {
                        setForm({ ...form, category_id: val });
                        validateField("category_id", val);
                        setTouched({ ...touched, category_id: true });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {renderFieldFeedback("category_id")}
                  </div>
                  {profile?.organization && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                        Organization
                      </label>
                      <div className="px-3.5 py-2.5 rounded-lg border border-border-light bg-surface-1/60 text-sm font-medium text-foreground">
                        {profile.organization.name}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3 pt-6 pl-1 select-none">
                    <Switch
                      id="accepting"
                      checked={form.is_accepting_appointments}
                      onCheckedChange={(checked) =>
                        setForm({ ...form, is_accepting_appointments: checked })
                      }
                    />
                    <label
                      htmlFor="accepting"
                      className="text-sm font-semibold text-foreground cursor-pointer"
                    >
                      Accepting new appointments
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                      Organization Name (Optional)
                    </label>
                    <Input
                      value={form.organization_name || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm({ ...form, organization_name: val });
                        validateField("organization_name", val);
                      }}
                      onFocus={() => handleInputFocus("organization_name")}
                      onBlur={() => handleInputBlur("organization_name")}
                    />
                    {renderFieldFeedback("organization_name")}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                      Professional Owner Name
                    </label>
                    <Input
                      value={form.owner_name || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm({ ...form, owner_name: val });
                        validateField("owner_name", val);
                      }}
                      onFocus={() => handleInputFocus("owner_name")}
                      onBlur={() => handleInputBlur("owner_name")}
                      required
                    />
                    {renderFieldFeedback("owner_name")}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                      Tax ID Number (GST / VAT / PAN)
                    </label>
                    <Input
                      value={form.tax_number || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm({ ...form, tax_number: val });
                        validateField("tax_number", val);
                      }}
                      onFocus={() => handleInputFocus("tax_number")}
                      onBlur={() => handleInputBlur("tax_number")}
                      required
                    />
                    {renderFieldFeedback("tax_number")}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                      Bank Details for Payouts
                    </label>
                    <Input
                      value={form.bank_details || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm({ ...form, bank_details: val });
                        validateField("bank_details", val);
                      }}
                      onFocus={() => handleInputFocus("bank_details")}
                      onBlur={() => handleInputBlur("bank_details")}
                      required
                    />
                    {renderFieldFeedback("bank_details")}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    About / Profile Description
                  </label>
                  <textarea
                    className="w-full resize-none rounded-lg border border-border-light bg-surface-1/60 text-foreground transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none p-3.5 placeholder:text-text-faint/60 text-sm h-32"
                    value={form.profile_description || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm({ ...form, profile_description: val });
                      validateField("profile_description", val);
                    }}
                    onFocus={() => handleInputFocus("profile_description")}
                    onBlur={() => handleInputBlur("profile_description")}
                    placeholder="Describe your services, experience, and approach..."
                  />
                  {renderFieldFeedback("profile_description")}
                </div>

                <Button
                  type="submit"
                  className="w-full sm:w-auto gap-2 cursor-pointer"
                  disabled={saving}
                >
                  <Save size={16} /> {saving ? "Saving..." : "Save Profile"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Offerings */}
        <TabsContent value="offerings" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card variant="glass" className="p-6">
              <CardContent className="space-y-4">
                <h2 className="font-bold text-lg text-foreground">
                  Service Offerings
                </h2>
                {offerings.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {offerings.map((item) => (
                      <Card
                        key={item.id}
                        className="border border-border/40 bg-surface-1/40 p-3.5 rounded-xl"
                      >
                        <CardContent className="p-0">
                          <p className="font-semibold text-sm text-foreground">
                            {item.title}
                          </p>
                          <p className="text-xs text-text-muted mt-1 font-mono">
                            {item.duration_minutes} min · ₹{item.price}
                          </p>
                          {item.description && (
                            <p className="text-xs text-text-muted/80 mt-1">
                              {item.description}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-muted">
                    No offerings configured yet. Add your first service below.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card variant="glass" className="p-6">
              <CardContent className="space-y-4">
                <h2 className="font-bold text-lg text-foreground">
                  Add New Offering
                </h2>
                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                      Offering Title
                    </label>
                    <Input
                      placeholder="e.g. 1-on-1 Consultation"
                      value={newOffering.title}
                      onChange={(e) =>
                        setNewOffering({
                          ...newOffering,
                          title: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                      Description
                    </label>
                    <Input
                      placeholder="Brief description of the service"
                      value={newOffering.description}
                      onChange={(e) =>
                        setNewOffering({
                          ...newOffering,
                          description: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                        Duration (min)
                      </label>
                      <Input
                        type="number"
                        placeholder="30"
                        value={newOffering.duration_minutes}
                        onChange={(e) =>
                          setNewOffering({
                            ...newOffering,
                            duration_minutes: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                        Price (₹)
                      </label>
                      <Input
                        type="number"
                        placeholder="500"
                        value={newOffering.price}
                        onChange={(e) =>
                          setNewOffering({
                            ...newOffering,
                            price: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-1.5 cursor-pointer mt-2"
                    onClick={handleAddOffering}
                  >
                    <Plus size={14} /> Add Offering
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 3: Intake Form */}
        <TabsContent value="intake" className="space-y-6">
          <Card variant="glass" className="p-6 max-w-2xl">
            <CardContent className="space-y-5">
              <h2 className="font-bold text-lg text-foreground">
                Intake Form Builder
              </h2>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    Form Title
                  </label>
                  <Input
                    value={intakeTitle}
                    onChange={(e) => setIntakeTitle(e.target.value)}
                    placeholder="Form title"
                  />
                </div>

                <div className="space-y-3 pt-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-muted block">
                    Questions / Fields
                  </label>
                  {intakeFields.map((field, index) => (
                    <div
                      key={`${index}-${field.key || "f"}`}
                      className="flex items-center gap-3"
                    >
                      <span className="text-xs font-mono text-text-faint">
                        {index + 1}.
                      </span>
                      <Input
                        value={field.label || ""}
                        placeholder={`Field ${index + 1} Question Label`}
                        onChange={(e) => {
                          const next = [...intakeFields];
                          next[index] = {
                            ...next[index],
                            key: next[index].key || `field_${index + 1}`,
                            label: e.target.value,
                          };
                          setIntakeFields(next);
                        }}
                      />
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 gap-1.5 cursor-pointer"
                    onClick={() =>
                      setIntakeFields((prev) => [
                        ...prev,
                        { key: `field_${prev.length + 1}`, label: "" },
                      ])
                    }
                  >
                    <Plus size={14} /> Add Field
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 gap-1.5 cursor-pointer"
                    onClick={handleSaveIntakeForm}
                  >
                    <Save size={14} /> Save Intake Form
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: Onboarding */}
        <TabsContent value="onboarding">
          <Card variant="glass" className="p-6">
            <CardContent className="space-y-5">
              <h2 className="font-bold text-lg text-foreground">
                Registration & Compliance
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  placeholder="Organization Name (optional)"
                  value={onboarding.organization_name}
                  onChange={(e) =>
                    setOnboarding({ ...onboarding, organization_name: e.target.value })
                  }
                />
                <Input
                  placeholder="Owner Name"
                  value={onboarding.owner_name}
                  onChange={(e) =>
                    setOnboarding({ ...onboarding, owner_name: e.target.value })
                  }
                />
                <Input
                  placeholder="Email"
                  value={onboarding.email}
                  onChange={(e) =>
                    setOnboarding({ ...onboarding, email: e.target.value })
                  }
                />
                <Input
                  placeholder="Phone"
                  value={onboarding.phone}
                  onChange={(e) =>
                    setOnboarding({ ...onboarding, phone: e.target.value })
                  }
                />
                <Input
                  placeholder="Tax Number (GST/VAT)"
                  value={onboarding.tax_number}
                  onChange={(e) =>
                    setOnboarding({ ...onboarding, tax_number: e.target.value })
                  }
                />
                <Input
                  placeholder="Profile Photo URL"
                  value={onboarding.profile_photo_url}
                  onChange={(e) =>
                    setOnboarding({ ...onboarding, profile_photo_url: e.target.value })
                  }
                />
                <Input
                  placeholder="Identity Proof URL"
                  value={onboarding.identity_proof_url}
                  onChange={(e) =>
                    setOnboarding({ ...onboarding, identity_proof_url: e.target.value })
                  }
                />
                <Input
                  placeholder="Certificates URLs (comma-separated)"
                  value={onboarding.certificates_urls}
                  onChange={(e) =>
                    setOnboarding({ ...onboarding, certificates_urls: e.target.value })
                  }
                />
              </div>
              <textarea
                className="w-full resize-none rounded-lg border border-border-light bg-surface-1/60 text-foreground transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none p-3.5 placeholder:text-text-faint/60 text-sm h-24"
                placeholder="Address"
                value={onboarding.address}
                onChange={(e) =>
                  setOnboarding({ ...onboarding, address: e.target.value })
                }
              />
              <textarea
                className="w-full resize-none rounded-lg border border-border-light bg-surface-1/60 text-foreground transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none p-3.5 placeholder:text-text-faint/60 text-sm h-24"
                placeholder="Bank Details"
                value={onboarding.bank_details}
                onChange={(e) =>
                  setOnboarding({ ...onboarding, bank_details: e.target.value })
                }
              />

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="cursor-pointer"
                  onClick={handleSaveOnboarding}
                >
                  Save Onboarding Details
                </Button>
                <Button
                  type="button"
                  className="cursor-pointer"
                  onClick={async () => {
                    await updateProviderOnboardingAPI({
                      ...onboarding,
                      submitted_for_approval: true,
                    });
                    setOnboarding((s) => ({ ...s, submitted_for_approval: true }));
                    toast.success("Submitted to admin for approval");
                  }}
                >
                  Submit For Approval
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
