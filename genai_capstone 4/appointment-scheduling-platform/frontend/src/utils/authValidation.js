const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_RE = /^[A-Za-z][A-Za-z .'-]{1,148}[A-Za-z]$/;
const PHONE_RE = /^\+?[0-9 ()-]{7,20}$/;

export const cleanSignupForm = (form) => ({
  full_name: form.full_name.trim().replace(/\s+/g, " "),
  email: form.email.trim().toLowerCase(),
  password: form.password,
  phone: form.phone.trim(),
  role: form.role,
  organization_name: form.organization_name?.trim() || "",
  owner_name: form.owner_name?.trim() || "",
  address: form.address?.trim() || "",
  identity_proof_url: form.identity_proof_url?.trim() || "",
  tax_number: form.tax_number?.trim() || "",
  bank_details: form.bank_details?.trim() || "",
  profile_photo_url: form.profile_photo_url?.trim() || "",
  certificates_urls: form.certificates_urls?.trim() || "",
});

export const cleanLoginForm = (form) => ({
  email: form.email.trim().toLowerCase(),
  password: form.password,
});

export function validatePassword(password) {
  const errors = [];
  if (password.length < 8) errors.push("Use at least 8 characters.");
  if (new TextEncoder().encode(password).length > 72) errors.push("Use 72 bytes or fewer.");
  if (!/[a-z]/.test(password)) errors.push("Add a lowercase letter.");
  if (!/[A-Z]/.test(password)) errors.push("Add an uppercase letter.");
  if (!/\d/.test(password)) errors.push("Add a number.");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("Add a special character.");
  return errors;
}

export function validateSignupForm(form) {
  const data = cleanSignupForm(form);
  const errors = {};
  const phoneDigits = data.phone.replace(/\D/g, "");

  if (!NAME_RE.test(data.full_name)) {
    errors.full_name = "Enter a valid name using letters, spaces, apostrophes, periods, or hyphens.";
  }
  if (!EMAIL_RE.test(data.email)) {
    errors.email = "Enter a valid email address.";
  }
  if (!PHONE_RE.test(data.phone) || phoneDigits.length < 7 || phoneDigits.length > 15) {
    errors.phone = "Enter a valid phone number with 7 to 15 digits.";
  }

  const passwordErrors = validatePassword(data.password);
  if (passwordErrors.length > 0) errors.password = passwordErrors[0];

  if (!["customer", "provider", "organization"].includes(data.role)) {
    errors.role = "Choose a valid account type.";
  }

  return { data, errors };
}

export function validateLoginForm(form) {
  const data = cleanLoginForm(form);
  const errors = {};

  if (!EMAIL_RE.test(data.email)) errors.email = "Enter a valid email address.";
  if (!data.password) errors.password = "Enter your password.";
  if (new TextEncoder().encode(data.password).length > 72) {
    errors.password = "Password is too long.";
  }

  return { data, errors };
}

export function firstError(errors) {
  return Object.values(errors).find(Boolean);
}
