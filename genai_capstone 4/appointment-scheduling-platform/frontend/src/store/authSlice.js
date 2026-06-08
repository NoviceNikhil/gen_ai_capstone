import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as api from "../services/apiService";

// ─── Async Thunks ──────────────────────────────────────────────────────────────

const getApiMessage = (err, fallback) => {
  const data = err.response?.data;
  if (data?.message) return data.message;
  const firstDetail = Array.isArray(data?.detail) ? data.detail[0] : null;
  if (firstDetail?.msg) return firstDetail.msg.replace(/^Value error,\s*/i, "");
  return fallback;
};

export const signupUser = createAsyncThunk("auth/signup", async (data, { rejectWithValue }) => {
  try {
    const res = await api.signupAPI(data);
    return res.data;
  } catch (err) {
    return rejectWithValue({
      ...(err.response?.data || {}),
      message: getApiMessage(err, "Signup failed"),
    });
  }
});

export const loginUser = createAsyncThunk("auth/login", async (data, { rejectWithValue }) => {
  try {
    const res = await api.loginAPI(data);
    return res.data;
  } catch (err) {
    return rejectWithValue({
      ...(err.response?.data || { message: "Login failed" }),
      message: getApiMessage(err, "Login failed"),
      status: err.response?.status,
    });
  }
});

export const googleLogin = createAsyncThunk("auth/googleLogin", async (data, { rejectWithValue }) => {
  try {
    const res = await api.googleAuthAPI(data);
    return res.data;
  } catch (err) {
    return rejectWithValue({
      ...(err.response?.data || { message: "Google authentication failed" }),
      message: getApiMessage(err, "Google authentication failed"),
    });
  }
});

export const completeGoogleSignup = createAsyncThunk("auth/completeGoogleSignup", async (data, { rejectWithValue }) => {
  try {
    const res = await api.completeGoogleSignupAPI(data);
    return res.data;
  } catch (err) {
    return rejectWithValue({
      ...(err.response?.data || { message: "Google signup failed" }),
      message: getApiMessage(err, "Google signup failed"),
    });
  }
});

export const verifyOtp = createAsyncThunk("auth/verifyOtp", async (data, { rejectWithValue }) => {
  try {
    const res = await api.verifyOtpAPI(data);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: "OTP verification failed" });
  }
});

export const verifyAdminOtp = createAsyncThunk("auth/verifyAdminOtp", async (data, { rejectWithValue }) => {
  try {
    const res = await api.verifyAdminOtpAPI(data);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: "Admin OTP failed" });
  }
});

export const resendOtp = createAsyncThunk("auth/resendOtp", async (data, { rejectWithValue }) => {
  try {
    const res = await api.resendOtpAPI(data);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: "Failed to resend OTP" });
  }
});

export const forgotPassword = createAsyncThunk("auth/forgotPassword", async (data, { rejectWithValue }) => {
  try {
    const res = await api.forgotPasswordAPI(data);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: "Failed" });
  }
});

export const resetPassword = createAsyncThunk("auth/resetPassword", async (data, { rejectWithValue }) => {
  try {
    const res = await api.resetPasswordAPI(data);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: "Reset failed" });
  }
});

export const fetchProfile = createAsyncThunk("auth/fetchProfile", async (_, { rejectWithValue }) => {
  try {
    const res = await api.fetchProfileAPI();
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: "Failed to fetch profile" });
  }
});

export const updateProfile = createAsyncThunk("auth/updateProfile", async (data, { rejectWithValue }) => {
  try {
    const res = await api.updateProfileAPI(data);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: "Failed to update profile" });
  }
});

export const logoutUser = createAsyncThunk("auth/logout", async (_, { rejectWithValue }) => {
  try {
    await api.logoutAPI();
    return {};
  } catch (err) {
    return rejectWithValue(err.response?.data || {});
  }
});

export const deleteAccount = createAsyncThunk("auth/deleteAccount", async (_, { rejectWithValue, dispatch }) => {
  try {
    const res = await api.deleteAccountAPI();
    dispatch(logoutUser());
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data || { message: "Failed to delete account" });
  }
});

export const restoreAccount = createAsyncThunk("auth/restoreAccount", async (data, { rejectWithValue }) => {
  try {
    const res = await api.restoreAccountAPI(data);
    return res.data;
  } catch (err) {
    return rejectWithValue({
      ...(err.response?.data || { message: "Failed to restore account" }),
      message: getApiMessage(err, "Failed to restore account"),
    });
  }
});

// ─── Initial State ────────────────────────────────────────────────────────────
const storedUser = localStorage.getItem("user");
const storedToken = localStorage.getItem("token");
const storedRole = localStorage.getItem("role");

const initialState = {
  user: storedUser ? JSON.parse(storedUser) : null,
  token: storedToken || null,
  role: storedRole || null,
  isAuthenticated: !!storedToken || !!storedUser,
  loading: false,
  profileLoading: false,
  error: null,
  // OTP flow
  otpEmail: null,
  otpType: null,   // "signup" | "forgot" | "admin"
};

// ─── Slice ────────────────────────────────────────────────────────────────────
const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearError: (state) => { state.error = null; },
    clearOtpState: (state) => {
      state.otpEmail = null;
      state.otpType = null;
    },
    setOtpFlow: (state, action) => {
      state.otpEmail = action.payload.email;
      state.otpType = action.payload.type;
    },
    fullLogout: (state) => {
      state.user = null;
      state.token = null;
      state.role = null;
      state.isAuthenticated = false;
      state.otpEmail = null;
      state.otpType = null;
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("role");
    },
  },
  extraReducers: (builder) => {
    // Signup
    builder
      .addCase(signupUser.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(signupUser.fulfilled, (s, action) => {
        s.loading = false;
        s.otpEmail = action.payload.data?.email;
        s.otpType = "signup";
      })
      .addCase(signupUser.rejected, (s, action) => { s.loading = false; s.error = action.payload?.message; })

    // Login
      .addCase(loginUser.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(loginUser.fulfilled, (s, action) => {
        s.loading = false;
        const data = action.payload.data;
        if (data?.isAdmin) {
          s.otpEmail = data.email;
          s.otpType = "admin";
        } else if (data?.token) {
          s.token = data.token;
          s.user = data.user;
          s.role = data.role || data.user?.role;
          s.isAuthenticated = true;
          localStorage.setItem("token", data.token);
          localStorage.setItem("user", JSON.stringify(data.user));
          localStorage.setItem("role", data.role || data.user?.role);
        }
      })
      .addCase(loginUser.rejected, (s, action) => { s.loading = false; s.error = action.payload?.message; })

    // Google Login
      .addCase(googleLogin.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(googleLogin.fulfilled, (s, action) => {
        s.loading = false;
        const data = action.payload.data;
        if (data?.token) {
          s.token = data.token;
          s.user = data.user;
          s.role = data.role || data.user?.role;
          s.isAuthenticated = true;
          localStorage.setItem("token", data.token);
          localStorage.setItem("user", JSON.stringify(data.user));
          localStorage.setItem("role", data.role || data.user?.role);
        }
      })
      .addCase(googleLogin.rejected, (s, action) => { s.loading = false; s.error = action.payload?.message; })

    // Complete Google Signup
      .addCase(completeGoogleSignup.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(completeGoogleSignup.fulfilled, (s, action) => {
        s.loading = false;
        const data = action.payload.data;
        if (data?.token) {
          s.token = data.token;
          s.user = data.user;
          s.role = data.role || data.user?.role;
          s.isAuthenticated = true;
          localStorage.setItem("token", data.token);
          localStorage.setItem("user", JSON.stringify(data.user));
          localStorage.setItem("role", data.role || data.user?.role);
        }
      })
      .addCase(completeGoogleSignup.rejected, (s, action) => { s.loading = false; s.error = action.payload?.message; })

    // Verify OTP
      .addCase(verifyOtp.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(verifyOtp.fulfilled, (s, action) => {
        s.loading = false;
        const data = action.payload.data;
        if (data?.token) {
          s.token = data.token;
          s.user = data.user;
          s.role = data.role || data.user?.role;
          s.isAuthenticated = true;
          localStorage.setItem("token", data.token);
          localStorage.setItem("user", JSON.stringify(data.user));
          localStorage.setItem("role", data.role || data.user?.role);
        }
        s.otpEmail = null;
        s.otpType = null;
      })
      .addCase(verifyOtp.rejected, (s, action) => { s.loading = false; s.error = action.payload?.message; })

    // Restore Account
      .addCase(restoreAccount.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(restoreAccount.fulfilled, (s, action) => {
        s.loading = false;
        const data = action.payload.data;
        if (data?.token) {
          s.token = data.token;
          s.user = data.user;
          s.role = data.role || data.user?.role;
          s.isAuthenticated = true;
          localStorage.setItem("token", data.token);
          localStorage.setItem("user", JSON.stringify(data.user));
          localStorage.setItem("role", data.role || data.user?.role);
        }
      })
      .addCase(restoreAccount.rejected, (s, action) => { s.loading = false; s.error = action.payload?.message; })

    // Admin OTP
      .addCase(verifyAdminOtp.fulfilled, (s, action) => {
        const data = action.payload.data;
        if (data?.token) {
          s.token = data.token;
          s.user = data.user;
          s.role = "admin";
          s.isAuthenticated = true;
          localStorage.setItem("token", data.token);
          localStorage.setItem("user", JSON.stringify(data.user));
          localStorage.setItem("role", "admin");
        }
        s.otpEmail = null;
        s.otpType = null;
      })

    // Forgot Password
      .addCase(forgotPassword.fulfilled, (s, action) => {
        s.otpEmail = action.payload.data?.email;
        s.otpType = "forgot";
      })

    // Reset Password
      .addCase(resetPassword.fulfilled, (s) => {
        s.otpEmail = null;
        s.otpType = null;
      })

    // Fetch Profile
      .addCase(fetchProfile.pending, (s) => { s.profileLoading = true; })
      .addCase(fetchProfile.fulfilled, (s, action) => {
        s.profileLoading = false;
        if (action.payload.data) {
          s.user = action.payload.data;
          localStorage.setItem("user", JSON.stringify(action.payload.data));
        }
      })
      .addCase(fetchProfile.rejected, (s) => { s.profileLoading = false; })
      
    // Update Profile
      .addCase(updateProfile.pending, (s) => { s.loading = true; })
      .addCase(updateProfile.fulfilled, (s, action) => {
        s.loading = false;
        if (action.payload.data) {
          s.user = action.payload.data;
          localStorage.setItem("user", JSON.stringify(action.payload.data));
        }
      })
      .addCase(updateProfile.rejected, (s, action) => { 
        s.loading = false; 
        s.error = action.payload?.message;
      })

    // Logout
      .addCase(logoutUser.fulfilled, (s) => {
        s.user = null; s.token = null; s.role = null; s.isAuthenticated = false;
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("role");
      });
  },
});

export const { clearError, clearOtpState, setOtpFlow, fullLogout } = authSlice.actions;
export default authSlice.reducer;
