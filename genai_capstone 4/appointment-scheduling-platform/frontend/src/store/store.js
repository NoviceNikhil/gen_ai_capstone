import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import appointmentReducer from "./appointmentSlice";
import providerReducer from "./providerSlice";

const store = configureStore({
  reducer: {
    auth: authReducer,
    appointments: appointmentReducer,
    providers: providerReducer,
  },
});

export default store;
