import api from "./axios";

const cleanParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== "" && value !== null && value !== undefined,
    ),
  );

// ─── AUTH ─────────────────────────────────────────────────────────────────────
export const signupAPI = (data) => api.post("/auth/signup", data);
export const uploadOnboardingFileAPI = (formData) =>
  api.post("/auth/upload-onboarding-file", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
export const loginAPI = (data) => api.post("/auth/login", data);
export const googleAuthAPI = (data) => api.post("/auth/google", data);
export const completeGoogleSignupAPI = (data) =>
  api.post("/auth/google/complete-signup", data);
export const verifyOtpAPI = (data) => api.post("/auth/verify-otp", data);
export const verifyAdminOtpAPI = (data) =>
  api.post("/auth/verify-otp/admin", data);
export const resendOtpAPI = (data) => api.post("/auth/resend-otp", data);
export const forgotPasswordAPI = (data) =>
  api.post("/auth/forgot-password", data);
export const resetPasswordAPI = (data) =>
  api.post("/auth/reset-password", data);
export const fetchProfileAPI = () => api.get("/auth/profile");
export const updateProfileAPI = (data) => api.put("/auth/profile", data);
export const logoutAPI = () => api.post("/auth/logout");

// ─── CUSTOMER ─────────────────────────────────────────────────────────────────
export const getProvidersAPI = (params) =>
  api.get("/api/customer/providers", { params: cleanParams(params) });
export const getProviderDetailAPI = (id) =>
  api.get(`/api/customer/providers/${id}`);
export const getAvailableSlotsAPI = (providerId, date) =>
  api.get(`/api/customer/providers/${providerId}/slots`, { params: { date } });
export const getProviderBookingConfigAPI = (providerId) =>
  api.get(`/api/customer/providers/${providerId}/booking-config`);
export const getProviderWaitlistStatsAPI = (providerId) =>
  api.get(`/api/customer/providers/${providerId}/waitlist-stats`);
export const joinProviderWaitlistAPI = (providerId, data) =>
  api.post(`/api/customer/providers/${providerId}/waitlist`, data);
export const getMyWaitlistAPI = () => api.get("/api/customer/waitlist");
export const leaveWaitlistAPI = (entryId) =>
  api.delete(`/api/customer/waitlist/${entryId}`);
export const releaseWaitlistLockAPI = (entryId) =>
  api.post(`/api/customer/waitlist/${entryId}/release-lock`);
export const claimWaitlistSlotAPI = (entryId, data) =>
  api.post(`/api/customer/waitlist/${entryId}/claim`, data);
export const purchasePackageAPI = (packageId) =>
  api.post(`/api/customer/packages/${packageId}/purchase`);
export const bookAppointmentAPI = (data) =>
  api.post("/api/customer/appointments", data);
export const bookOrJoinWaitlistAPI = (data) =>
  api.post("/api/customer/book-or-join-waitlist", data);
export const getMyAppointmentsAPI = (params) =>
  api.get("/api/customer/appointments", { params });
export const getMyAppointmentByIdAPI = (id) =>
  api.get(`/api/customer/appointments/${id}`);
export const cancelAppointmentAPI = (id, data) =>
  api.patch(`/api/customer/appointments/${id}/cancel`, data);
export const getCancelPreviewAPI = (id) =>
  api.get(`/api/customer/appointments/${id}/cancel-preview`);
export const rescheduleAppointmentAPI = (id, data) =>
  api.patch(`/api/customer/appointments/${id}/reschedule`, data);
export const respondRescheduleAppointmentAPI = (id, data) =>
  api.patch(`/api/customer/reschedule-requests/${id}/respond`, data);
export const getCustomerDashboardAPI = () => api.get("/api/customer/dashboard");
export const getCustomerReviewsAPI = () => api.get("/api/customer/reviews");
export const submitReviewAPI = (appointmentId, data) =>
  api.post(`/api/customer/appointments/${appointmentId}/review`, data);
export const getMyPaymentRecordsAPI = () =>
  api.get("/api/customer/payment-records");
export const getMyRefundRecordsAPI = () =>
  api.get("/api/customer/refund-records");

// ─── PROVIDER ────────────────────────────────────────────────────────────────
export const getProviderProfileAPI = () => api.get("/api/provider/profile");
export const updateProviderProfileAPI = (data) =>
  api.patch("/api/provider/profile", data);
export const getProviderOnboardingAPI = () => api.get("/api/provider/onboarding");
export const updateProviderOnboardingAPI = (data) =>
  api.patch("/api/provider/onboarding", data);
export const uploadProviderPhotoAPI = (formData) =>
  api.post("/api/provider/profile/photo", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
export const getProviderAppointmentsAPI = (params) =>
  api.get("/api/provider/appointments", { params });
export const getProviderAppointmentByIdAPI = (id) =>
  api.get(`/api/provider/appointments/${id}`);
export const getProviderSlotsAPI = (date) =>
  api.get("/api/provider/slots", { params: { date } });
export const getProviderReviewsAPI = () =>
  api.get("/api/provider/reviews");
export const getGoogleCalendarConnectUrlAPI = () =>
  api.get("/api/provider/calendar/google/connect");
export const getGoogleCalendarStatusAPI = () =>
  api.get("/api/provider/calendar/google/status");
export const syncGoogleCalendarAPI = () =>
  api.post("/api/provider/calendar/google/sync");
export const disconnectGoogleCalendarAPI = () =>
  api.delete("/api/provider/calendar/google/disconnect");
export const updateAppointmentStatusAPI = (id, data) =>
  api.patch(`/api/provider/appointments/${id}/status`, data);
export const rescheduleProviderAppointmentAPI = (id, data) =>
  api.patch(`/api/provider/appointments/${id}/reschedule`, data);
export const respondProviderRescheduleAPI = (id, data) =>
  api.patch(`/api/provider/reschedule-requests/${id}/respond`, data);
export const getProviderDashboardAPI = () => api.get("/api/provider/dashboard");
export const getProviderOfferingsAPI = () => api.get("/api/provider/offerings");
export const saveProviderOfferingAPI = (data) =>
  api.post("/api/provider/offerings", data);
export const getProviderIntakeFormAPI = () =>
  api.get("/api/provider/intake-form");
export const saveProviderIntakeFormAPI = (data) =>
  api.post("/api/provider/intake-form", data);
export const getProviderPackagesAPI = () => api.get("/api/provider/packages");
export const saveProviderPackageAPI = (data) =>
  api.post("/api/provider/packages", data);

// ─── AVAILABILITY ─────────────────────────────────────────────────────────────
export const getAvailabilityAPI = () => api.get("/api/availability");
export const addAvailabilityAPI = (data) => api.post("/api/availability", data);
export const updateAvailabilityAPI = (id, data) =>
  api.patch(`/api/availability/${id}`, data);
export const deleteAvailabilityAPI = (id) =>
  api.delete(`/api/availability/${id}`);

// ─── ADMIN ───────────────────────────────────────────────────────────────────
export const getAdminDashboardAPI = () => api.get("/api/admin/dashboard");
export const getAdminUsersAPI = (params) =>
  api.get("/api/admin/users", { params });
export const updateUserStatusAPI = (id, data) =>
  api.patch(`/api/admin/users/${id}/status`, data);
export const getAdminProvidersAPI = (params) =>
  api.get("/api/admin/providers", { params });
export const getIndependentApprovedProvidersAPI = (params) =>
  api.get("/api/admin/providers/independent/approved", { params });
export const debugProviderVisibilityAPI = (providerId) =>
  api.get(`/api/admin/providers/debug/${providerId}`);
export const verifyProviderAPI = (id, data) =>
  api.patch(`/api/admin/providers/${id}/verify`, data);
export const getAdminAppointmentsAPI = (params) =>
  api.get("/api/admin/appointments", { params });

// ─── CATEGORIES ───────────────────────────────────────────────────────────────
export const getCategoriesAPI = () => api.get("/api/categories");
export const createCategoryAPI = (data) => api.post("/api/categories", data);
export const updateCategoryAPI = (id, data) =>
  api.patch(`/api/categories/${id}`, data);
export const deleteCategoryAPI = (id) => api.delete(`/api/categories/${id}`);

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────
export const createPaymentOrderAPI = (data) =>
  api.post("/api/payments/create-order", data);
export const verifyPaymentAPI = (data) =>
  api.post("/api/payments/verify", data);
export const getNotificationsAPI = (params) =>
  api.get("/api/notifications", { params });
export const markNotificationReadAPI = (appointmentId) =>
  api.patch(`/api/notifications/${appointmentId}/read`);
export const getNotificationsNewAPI = (params) =>
  api.get("/api/notifications/new", { params });
export const markNotificationReadNewAPI = (notificationId) =>
  api.patch(`/api/notifications/${notificationId}/read-new`);
export const markAllNotificationsReadNewAPI = () =>
  api.patch("/api/notifications/read-all-new");
export const deleteNotificationAPI = (notificationId) =>
  api.delete(`/api/notifications/${notificationId}`);

// ─── ORGANIZATIONS ────────────────────────────────────────────────────────────
export const listOrganizationsAPI = (params) =>
  api.get("/api/organizations", { params: cleanParams(params) });
export const getOrganizationAPI = (id) => api.get(`/api/organizations/${id}`);
export const requestOrganizationCreationAPI = (data) =>
  api.post("/api/organizations/request-creation", data);
export const requestOrganizationUpdateAPI = (id, data) =>
  api.post(`/api/organizations/${id}/request-update`, data);
export const applyOrganizationUpdateAPI = (id, params) =>
  api.post(
    `/api/organizations/${id}/apply-update`,
    {},
    { params: cleanParams(params) },
  );

// ─── ACCOUNT MANAGEMENT ───────────────────────────────────────────────────────
export const deleteAccountAPI = () => api.delete("/auth/me");
export const restoreAccountAPI = (data) => api.post("/auth/restore", data);

export const deactivateOrganizationAPI = (id) =>
  api.delete(`/api/organizations/${id}`);
export const getPendingOrganizationRequestsAPI = (params) =>
  api.get("/api/admin/org-requests", {
    params: cleanParams(params),
  });
export const approveOrganizationRequestAPI = (requestId, data) =>
  api.post(`/api/admin/org-requests/${requestId}/approve`, data);
export const getAllApprovalRequestsAPI = (params) =>
  api.get(`/api/organizations/approval-requests/all`, { params: cleanParams(params) });
export const decideApprovalRequestAPI = (requestId, requestType, data) =>
  api.post(`/api/organizations/approval-requests/${requestId}/${requestType}/decide`, data);
export const requestJoinOrganizationAPI = (orgId) =>
  api.post(`/api/organizations/${orgId}/request-join`);
export const getJoinRequestsAPI = (orgId) =>
  api.get(`/api/organizations/${orgId}/join-requests`);
export const approveJoinRequestAPI = (requestId, data) =>
  api.post(`/api/organizations/join-requests/${requestId}/approve`, data);
export const assignProviderToOrgAPI = (orgId, providerId) =>
  api.post(`/api/organizations/${orgId}/assign-provider/${providerId}`);
export const removeProviderFromOrgAPI = (orgId, providerId) =>
  api.delete(`/api/organizations/${orgId}/remove-provider/${providerId}`);
export const getOrganizationProvidersAPI = (orgId, params) =>
  api.get(`/api/organizations/${orgId}/providers`, {
    params: cleanParams(params),
  });
export const getProviderOrganizationAPI = () =>
  api.get("/api/provider/organization");
export const leaveProviderOrganizationAPI = () =>
  api.post("/api/provider/organization/leave");
export const getProviderPendingJoinRequestsAPI = () =>
  api.get("/api/provider/organization/pending-requests");

// ─── DISPUTES ─────────────────────────────────────────────────────────────────
export const getDisputesAPI = (params) => api.get("/api/disputes", { params });
export const raiseDisputeAPI = (data) => api.post("/api/disputes", data);
export const resolveDisputeAPI = (id, data) =>
  api.post(`/api/disputes/${id}/resolve`, data);

// ─── ORGANISATION DASHBOARD ───────────────────────────────────────────────────
export const getOrgOnboardingAPI = () =>
  api.get("/api/organizations/org-dashboard/onboarding");
export const updateOrgOnboardingAPI = (data) =>
  api.patch("/api/organizations/org-dashboard/onboarding", data);
export const getOrgEmployeesAPI = (params) =>
  api.get("/api/organizations/org-dashboard/employees", { params: cleanParams(params) });
export const getOrgJoinRequestsAPI = () =>
  api.get("/api/organizations/org-dashboard/join-requests");
export const respondOrgJoinRequestAPI = (requestId, data) =>
  api.post(`/api/organizations/org-dashboard/join-requests/${requestId}/respond`, data);
export const getOrgAppointmentsAPI = (params) =>
  api.get("/api/organizations/org-dashboard/appointments", { params: cleanParams(params) });
export const getOrgRevenueAPI = () =>
  api.get("/api/organizations/org-dashboard/revenue");

// ─── AI DOCUMENT VERIFICATION ────────────────────────────────────────────────
export const analyzeOnboardingDocumentsAPI = (providerOnboardingId) =>
  api.post("/api/provider/analyze-onboarding-documents", {
    provider_onboarding_id: providerOnboardingId,
  });
export const getAIInsightAPI = (providerOnboardingId) =>
  api.get(`/api/admin/ai-insights/${providerOnboardingId}`);

