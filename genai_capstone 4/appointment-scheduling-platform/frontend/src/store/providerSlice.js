import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as api from "../services/apiService";

// ─── Thunks ───────────────────────────────────────────────────────────────────

export const fetchProviders = createAsyncThunk(
  "providers/fetchAll",
  async (params, { rejectWithValue }) => {
    try { return (await api.getProvidersAPI(params)).data; }
    catch (err) { return rejectWithValue(err.response?.data || { message: "Failed to fetch providers" }); }
  }
);

export const fetchProviderById = createAsyncThunk(
  "providers/fetchById",
  async (id, { rejectWithValue }) => {
    try { return (await api.getProviderDetailAPI(id)).data; }
    catch (err) { return rejectWithValue(err.response?.data); }
  }
);

export const fetchProviderDashboard = createAsyncThunk(
  "providers/dashboard",
  async (_, { rejectWithValue }) => {
    try { return (await api.getProviderDashboardAPI()).data; }
    catch (err) { return rejectWithValue(err.response?.data); }
  }
);

export const fetchProviderAppointments = createAsyncThunk(
  "providers/fetchAppointments",
  async (params, { rejectWithValue }) => {
    try { return (await api.getProviderAppointmentsAPI(params)).data; }
    catch (err) { return rejectWithValue(err.response?.data); }
  }
);

export const updateAppointmentStatus = createAsyncThunk(
  "providers/updateApptStatus",
  async ({ id, action, notes }, { rejectWithValue }) => {
    try { return (await api.updateAppointmentStatusAPI(id, { action, notes })).data; }
    catch (err) { return rejectWithValue(err.response?.data || { message: "Update failed" }); }
  }
);

export const rescheduleProviderAppointment = createAsyncThunk(
  "providers/rescheduleAppt",
  async ({ id, appointment_date, time_slot }, { rejectWithValue }) => {
    try { return (await api.rescheduleProviderAppointmentAPI(id, { appointment_date, time_slot })).data; }
    catch (err) { return rejectWithValue(err.response?.data || { message: "Reschedule failed" }); }
  }
);

export const respondProviderReschedule = createAsyncThunk(
  "providers/respondReschedule",
  async ({ requestId, action }, { rejectWithValue }) => {
    try { return (await api.respondProviderRescheduleAPI(requestId, { action })).data; }
    catch (err) { return rejectWithValue(err.response?.data || { message: "Respond failed" }); }
  }
);

export const fetchAvailability = createAsyncThunk(
  "providers/fetchAvailability",
  async (_, { rejectWithValue }) => {
    try { return (await api.getAvailabilityAPI()).data; }
    catch (err) { return rejectWithValue(err.response?.data); }
  }
);

export const addAvailability = createAsyncThunk(
  "providers/addAvailability",
  async (data, { rejectWithValue }) => {
    try { return (await api.addAvailabilityAPI(data)).data; }
    catch (err) { return rejectWithValue(err.response?.data || { message: "Failed to add slot" }); }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────
const providerSlice = createSlice({
  name: "providers",
  initialState: {
    list: [],
    selected: null,
    appointments: [],
    availability: [],
    dashboardStats: null,
    total: 0,
    totalPages: 1,
    apptsTotalPages: 1,
    loading: false,
    error: null,
  },
  reducers: {
    clearError: (s) => { s.error = null; },
    clearSelected: (s) => { s.selected = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProviders.pending, (s) => { s.loading = true; })
      .addCase(fetchProviders.fulfilled, (s, a) => {
        s.loading = false;
        s.error = null;
        s.list = a.payload.data?.providers || [];
        s.total = a.payload.data?.total || 0;
        s.totalPages = a.payload.data?.total_pages || 1;
      })
      .addCase(fetchProviders.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload?.message || "Failed to fetch providers";
        s.list = [];
        s.total = 0;
        s.totalPages = 1;
      })

      .addCase(fetchProviderById.pending, (s) => {
        s.loading = true;
        s.selected = null;
        s.error = null;
      })
      .addCase(fetchProviderById.fulfilled, (s, a) => {
        s.loading = false;
        s.selected = a.payload.data?.provider;
      })
      .addCase(fetchProviderById.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload?.message || "Failed to fetch provider details";
        s.selected = null;
      })

      .addCase(fetchProviderDashboard.pending, (s) => { s.loading = true; })
      .addCase(fetchProviderDashboard.fulfilled, (s, a) => { s.loading = false; s.dashboardStats = a.payload.data; })
      .addCase(fetchProviderDashboard.rejected, (s) => { s.loading = false; })

      .addCase(fetchProviderAppointments.fulfilled, (s, a) => {
        s.appointments = a.payload.data?.appointments || [];
        s.apptsTotalPages = a.payload.data?.total_pages || 1;
      })
      .addCase(updateAppointmentStatus.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(updateAppointmentStatus.fulfilled, (s) => { s.loading = false; })
      .addCase(updateAppointmentStatus.rejected, (s, a) => { s.loading = false; s.error = a.payload?.message; })

      .addCase(fetchAvailability.fulfilled, (s, a) => { s.availability = a.payload.data?.slots || []; })
      .addCase(addAvailability.fulfilled, (s, a) => {
        if (a.payload.data?.slot) s.availability = [...s.availability, a.payload.data.slot];
      });
  },
});

export const { clearError, clearSelected } = providerSlice.actions;
export default providerSlice.reducer;
