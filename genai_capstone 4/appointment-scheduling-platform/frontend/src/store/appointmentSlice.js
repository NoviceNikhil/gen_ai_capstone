import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as api from "../services/apiService";

// ─── Thunks ───────────────────────────────────────────────────────────────────

export const fetchCustomerDashboard = createAsyncThunk(
  "appointments/dashboard",
  async (_, { rejectWithValue }) => {
    try {
      return (await api.getCustomerDashboardAPI()).data;
    } catch (err) {
      return rejectWithValue(err.response?.data);
    }
  },
);

export const fetchMyAppointments = createAsyncThunk(
  "appointments/fetchMine",
  async (params, { rejectWithValue }) => {
    try {
      return (await api.getMyAppointmentsAPI(params)).data;
    } catch (err) {
      return rejectWithValue(err.response?.data);
    }
  },
);

export const fetchAppointmentById = createAsyncThunk(
  "appointments/fetchById",
  async (id, { rejectWithValue }) => {
    try {
      return (await api.getMyAppointmentByIdAPI(id)).data;
    } catch (err) {
      return rejectWithValue(err.response?.data);
    }
  },
);

export const bookAppointment = createAsyncThunk(
  "appointments/book",
  async (data, { rejectWithValue }) => {
    try {
      return (await api.bookAppointmentAPI(data)).data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data || { message: "Booking failed" },
      );
    }
  },
);

export const bookOrJoinWaitlist = createAsyncThunk(
  "appointments/bookOrJoinWaitlist",
  async (data, { rejectWithValue }) => {
    try {
      return (await api.bookOrJoinWaitlistAPI(data)).data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data || { message: "Booking failed" },
      );
    }
  },
);

export const cancelAppointment = createAsyncThunk(
  "appointments/cancel",
  async ({ id, reason }, { rejectWithValue }) => {
    try {
      return (
        await api.cancelAppointmentAPI(id, { cancellation_reason: reason })
      ).data;
    } catch (err) {
      return rejectWithValue(err.response?.data);
    }
  },
);

export const fetchCancelPreview = createAsyncThunk(
  "appointments/cancelPreview",
  async (id, { rejectWithValue }) => {
    try {
      return (await api.getCancelPreviewAPI(id)).data;
    } catch (err) {
      return rejectWithValue(err.response?.data);
    }
  },
);

export const rescheduleAppointment = createAsyncThunk(
  "appointments/reschedule",
  async ({ id, appointment_date, time_slot }, { rejectWithValue }) => {
    try {
      return (
        await api.rescheduleAppointmentAPI(id, { appointment_date, time_slot })
      ).data;
    } catch (err) {
      return rejectWithValue(err.response?.data);
    }
  },
);

export const respondRescheduleAppointment = createAsyncThunk(
  "appointments/respondReschedule",
  async ({ requestId, action }, { rejectWithValue }) => {
    try {
      return (await api.respondRescheduleAppointmentAPI(requestId, { action }))
        .data;
    } catch (err) {
      return rejectWithValue(err.response?.data);
    }
  },
);

export const createPaymentOrder = createAsyncThunk(
  "appointments/createOrder",
  async (appointmentId, { rejectWithValue }) => {
    try {
      return (
        await api.createPaymentOrderAPI({ appointment_id: appointmentId })
      ).data;
    } catch (err) {
      return rejectWithValue(err.response?.data);
    }
  },
);

export const verifyPayment = createAsyncThunk(
  "appointments/verifyPayment",
  async (data, { rejectWithValue }) => {
    try {
      return (await api.verifyPaymentAPI(data)).data;
    } catch (err) {
      return rejectWithValue(err.response?.data);
    }
  },
);

// ─── Slice ────────────────────────────────────────────────────────────────────
const appointmentSlice = createSlice({
  name: "appointments",
  initialState: {
    list: [],
    selected: null,
    dashboardStats: null,
    total: 0,
    totalPages: 1,
    page: 1,
    loading: false,
    bookingLoading: false,
    paymentLoading: false,
    error: null,
    paymentOrder: null,
  },
  reducers: {
    clearError: (s) => {
      s.error = null;
    },
    clearSelected: (s) => {
      s.selected = null;
    },
    clearPaymentOrder: (s) => {
      s.paymentOrder = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCustomerDashboard.pending, (s) => {
        s.loading = true;
      })
      .addCase(fetchCustomerDashboard.fulfilled, (s, a) => {
        s.loading = false;
        s.dashboardStats = a.payload.data;
      })
      .addCase(fetchCustomerDashboard.rejected, (s) => {
        s.loading = false;
      })

      .addCase(fetchMyAppointments.pending, (s) => {
        s.loading = true;
      })
      .addCase(fetchMyAppointments.fulfilled, (s, a) => {
        s.loading = false;
        s.list = a.payload.data?.appointments || [];
        s.total = a.payload.data?.total || 0;
        s.totalPages = a.payload.data?.total_pages || 1;
      })
      .addCase(fetchMyAppointments.rejected, (s) => {
        s.loading = false;
        s.totalPages = 1;
      })

      .addCase(fetchAppointmentById.fulfilled, (s, a) => {
        s.selected = a.payload.data?.appointment;
      })

      .addCase(bookAppointment.pending, (s) => {
        s.bookingLoading = true;
        s.error = null;
      })
      .addCase(bookAppointment.fulfilled, (s) => {
        s.bookingLoading = false;
      })
      .addCase(bookAppointment.rejected, (s, a) => {
        s.bookingLoading = false;
        s.error = a.payload?.message;
      })

      .addCase(bookOrJoinWaitlist.pending, (s) => {
        s.bookingLoading = true;
        s.error = null;
      })
      .addCase(bookOrJoinWaitlist.fulfilled, (s) => {
        s.bookingLoading = false;
      })
      .addCase(bookOrJoinWaitlist.rejected, (s, a) => {
        s.bookingLoading = false;
        s.error = a.payload?.message;
      })

      .addCase(createPaymentOrder.pending, (s) => {
        s.paymentLoading = true;
      })
      .addCase(createPaymentOrder.fulfilled, (s, a) => {
        s.paymentLoading = false;
        s.paymentOrder = a.payload.data;
      })
      .addCase(createPaymentOrder.rejected, (s, a) => {
        s.paymentLoading = false;
        s.error = a.payload?.message;
      })

      .addCase(verifyPayment.fulfilled, (s) => {
        s.paymentOrder = null;
      });
  },
});

export const { clearError, clearSelected, clearPaymentOrder } =
  appointmentSlice.actions;
export default appointmentSlice.reducer;
