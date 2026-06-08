import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import store from "./store/store";
import App from "./App.jsx";
import "./index.css";
import { GoogleOAuthProvider } from "@react-oauth/google";

// Ideally from import.meta.env.VITE_GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <Provider store={store}>
        <BrowserRouter>
          <App />
          <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "hsl(222, 35%, 14%)",
              color: "hsl(220, 30%, 95%)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "0.75rem",
              fontFamily: "Inter, sans-serif",
            },
            success: { iconTheme: { primary: "hsl(161, 80%, 45%)", secondary: "#fff" } },
            error: { iconTheme: { primary: "hsl(0, 78%, 60%)", secondary: "#fff" } },
          }}
        />
        </BrowserRouter>
      </Provider>
    </GoogleOAuthProvider>
  </StrictMode>
);
