/**
 * SchedullyChatWidget.jsx
 * Floating FAB chat widget for Schedully.
 *
 * Roles:
 *   provider / admin  → full access: chat + document upload panel
 *   customer          → KB-only chat + Automate tab, no upload panel
 *   organization / unauthenticated → widget hidden
 *
 * Redux state shape (from authSlice.js):
 *   { isAuthenticated: bool, role: "provider"|"admin"|"customer"|... }
 *
 * API calls go through the existing services/axios.js instance which
 * already attaches Authorization: Bearer <token> from localStorage.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import api from "../../frontend/src/services/axios";

// ── Session ID (stable for the browser tab) ────────────────────────────────────
function getSessionId() {
  const KEY = "schedully_session_id";
  let sid = sessionStorage.getItem(KEY);
  if (!sid) {
    sid = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(KEY, sid);
  }
  return sid;
}

// ── Citation badge ─────────────────────────────────────────────────────────────
function CitationBadge({ source }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <span className="inline-block mx-0.5">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300
                   rounded px-1.5 py-0.5 font-medium hover:bg-blue-200 transition-colors"
        aria-label={`Source: ${source.source}`}
      >
        [{source.index}]
      </button>
      {expanded && (
        <span
          className="block mt-1 p-2 text-xs bg-gray-50 dark:bg-gray-800
                     border border-gray-200 dark:border-gray-700
                     rounded max-w-xs break-words"
        >
          <strong>{source.source}</strong>
          <br />
          {source.snippet?.slice(0, 200)}
          {source.snippet?.length > 200 ? "…" : ""}
        </span>
      )}
    </span>
  );
}

// ── Parse [Source N] markers in answer text ────────────────────────────────────
function renderAnswerWithCitations(text, sources) {
  if (!sources || sources.length === 0) return <span>{text}</span>;
  const parts = text.split(/(\[Source \d+\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^\[Source (\d+)\]$/);
        if (match) {
          const src = sources.find((s) => s.index === parseInt(match[1], 10));
          if (src) return <CitationBadge key={i} source={src} />;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// Helper to get next N days
const getNextNDays = (n) => {
  const dates = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
};

// ── Main widget ────────────────────────────────────────────────────────────────
export default function SchedullyChatWidget() {
  const { isAuthenticated, role } = useSelector((s) => s.auth);
  const navigate = useNavigate();

  // Only render for authenticated provider / admin / customer
  if (!isAuthenticated || !["provider", "admin", "customer"].includes(role)) {
    return null;
  }

  const canUpload = role === "provider" || role === "admin";

  const [open, setOpen]                   = useState(false);
  const [activeTab, setActiveTab]         = useState("chat"); // "chat" | "automate"
  const [messages, setMessages]           = useState([
    {
      id:      "welcome",
      role:    "assistant",
      text:
        role === "customer"
          ? "Hi! I'm Schedully. Ask me anything about using Schedex — booking, cancellations, payments, and more."
          : "Hi! I'm Schedully. Ask me about your appointments, upload an exported report or certificate, or ask how to use the platform.",
      sources: [],
    },
  ]);
  const [input, setInput]                 = useState("");
  const [loading, setLoading]             = useState(false);
  const [uploadStatus, setUploadStatus]   = useState(null);   // null | "uploading" | "success" | "error"
  const [uploadMessage, setUploadMessage] = useState("");
  const [isDragOver, setIsDragOver]       = useState(false);
  const [showUploadPanel, setShowUploadPanel] = useState(false);

  // ── Automate tab states ──────────────────────────────────────────────────────
  const [automateFlow, setAutomateFlow]   = useState(null);   // null | "book" | "cancel" | "review" | "rebook"
  const [automateStep, setAutomateStep]   = useState(1);
  const [autoError, setAutoError]         = useState("");
  const [autoSuccess, setAutoSuccess]     = useState("");
  const [autoLoading, setAutoLoading]     = useState(false);

  // Automate Booking Form
  const [bookCity, setBookCity]                     = useState("Hyderabad");
  const [bookSpecialization, setBookSpecialization] = useState("Dentist");
  const [bookProviderName, setBookProviderName]     = useState("");
  const [bookMinRating, setBookMinRating]           = useState("0");
  const [bookProviders, setBookProviders]           = useState([]);
  const [bookSelectedProvider, setBookSelectedProvider] = useState(null);
  const [bookDates, setBookDates]                   = useState(getNextNDays(5));
  const [bookSelectedDate, setBookSelectedDate]     = useState(bookDates[0]);
  const [bookSlots, setBookSlots]                   = useState([]);
  const [bookSelectedSlot, setBookSelectedSlot]     = useState("");
  const [bookNotes, setBookNotes]                   = useState("");

  // Automate Cancel Form
  const [cancelAppointments, setCancelAppointments] = useState([]);
  const [cancelSelectedAppt, setCancelSelectedAppt] = useState(null);
  const [cancelReason, setCancelReason]             = useState("");

  // Automate Review Form
  const [reviewAppointments, setReviewAppointments] = useState([]);
  const [reviewSelectedAppt, setReviewSelectedAppt] = useState(null);
  const [reviewRating, setReviewRating]             = useState(5);
  const [reviewComment, setReviewComment]           = useState("");

  // Automate Rebook Form
  const [rebookProviders, setRebookProviders]       = useState([]);
  const [rebookSelectedProvider, setRebookSelectedProvider] = useState(null);
  const [rebookSelectedDate, setRebookSelectedDate] = useState(bookDates[0]);
  const [rebookSlots, setRebookSlots]               = useState([]);
  const [rebookSelectedSlot, setRebookSelectedSlot] = useState("");

  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);
  const fileInputRef   = useRef(null);
  const sessionId      = useRef(getSessionId()).current;

  // Auto-scroll to latest message
  useEffect(() => {
    if (activeTab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, activeTab]);

  // Focus input when panel opens
  useEffect(() => {
    if (open && activeTab === "chat") inputRef.current?.focus();
  }, [open, activeTab]);

  // ── Send message ─────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev) => [
      ...prev,
      { id: `u_${Date.now()}`, role: "user", text, sources: [] },
    ]);
    setInput("");
    setLoading(true);

    try {
      const res  = await api.post("/api/schedully/chat", {
        message:    text,
        session_id: sessionId,
      });
      const data = res.data?.data;
      setMessages((prev) => [
        ...prev,
        {
          id:           `a_${Date.now()}`,
          role:         "assistant",
          text:         data?.answer || "No response received.",
          sources:      data?.sources || [],
          intent:       data?.intent,
          verification: data?.verification,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id:      `err_${Date.now()}`,
          role:    "error",
          text:    err.response?.data?.message || "Something went wrong. Please try again.",
          sources: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, sessionId]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── File upload ───────────────────────────────────────────────────────────────
  const handleFileUpload = async (file) => {
    if (!file || !canUpload) return;

    const ext = file.name.split(".").pop().toLowerCase();
    if (!["pdf", "docx", "xlsx"].includes(ext)) {
      setUploadMessage("Only .pdf, .docx, and .xlsx files are allowed.");
      setUploadStatus("error");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setUploadMessage("File too large. Maximum is 20 MB.");
      setUploadStatus("error");
      return;
    }

    setUploadStatus("uploading");
    setUploadMessage(`Uploading ${file.name}…`);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/api/schedully/ingest", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const d = res.data?.data;
      const msg =
        d?.chunks_added > 0
          ? `✓ Ingested ${file.name} (${d.chunks_added} chunks added)`
          : d?.message || `✓ ${file.name} processed`;
      setUploadMessage(msg);
      setUploadStatus("success");
      // Confirm in chat
      setMessages((prev) => [
        ...prev,
        {
          id:      `upload_${Date.now()}`,
          role:    "assistant",
          text:    `I've indexed **${file.name}**. You can now ask me questions about it.`,
          sources: [],
        },
      ]);
    } catch (err) {
      setUploadMessage(err.response?.data?.message || "Upload failed.");
      setUploadStatus("error");
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (canUpload) handleFileUpload(e.dataTransfer.files?.[0]);
  };

  // ── AUTOMATION FLOW LOGIC ───────────────────────────────────────────────────

  // Flow 1: Search Providers for Booking
  const handleSearchProviders = async () => {
    setAutoLoading(true);
    setAutoError("");
    try {
      const res = await api.get("/api/customer/providers", {
        params: {
          search: bookSpecialization || bookProviderName || undefined,
          location: bookCity,
          min_rating: bookMinRating !== "0" ? parseFloat(bookMinRating) : undefined,
        }
      });
      const providers = res.data?.data?.providers || [];
      setBookProviders(providers);
      if (providers.length === 0) {
        setAutoError("No providers matching your filters were found.");
      } else {
        setAutomateStep(2);
      }
    } catch (err) {
      setAutoError("Failed to search providers. Please try again.");
    } finally {
      setAutoLoading(false);
    }
  };

  // Flow 1: Fetch Slots for Selected Provider
  const handleSelectProviderForBooking = async (provider) => {
    setBookSelectedProvider(provider);
    setAutoLoading(true);
    setAutoError("");
    try {
      const res = await api.get(`/api/customer/providers/${provider.id}/slots`, {
        params: { date: bookSelectedDate }
      });
      setBookSlots(res.data?.data?.available_slots || []);
      setAutomateStep(3);
    } catch (err) {
      setAutoError("Failed to fetch slots for this provider.");
    } finally {
      setAutoLoading(false);
    }
  };

  // Flow 1: Change Date during Booking
  const handleBookingDateChange = async (date) => {
    setBookSelectedDate(date);
    setAutoLoading(true);
    setAutoError("");
    try {
      const res = await api.get(`/api/customer/providers/${bookSelectedProvider.id}/slots`, {
        params: { date }
      });
      setBookSlots(res.data?.data?.available_slots || []);
    } catch (err) {
      setAutoError("Failed to fetch slots for this date.");
    } finally {
      setAutoLoading(false);
    }
  };

  // Flow 1: Book Appointment Action
  const handleBookAppointment = async () => {
    if (!bookSelectedSlot) {
      setAutoError("Please select a time slot.");
      return;
    }
    setAutoLoading(true);
    setAutoError("");
    try {
      const res = await api.post("/api/customer/appointments", {
        provider_id: bookSelectedProvider.id,
        appointment_date: bookSelectedDate,
        time_slot: bookSelectedSlot,
        notes: bookNotes || "Automated booking from assistant",
      });
      const appt = res.data?.data?.appointment;
      if (appt) {
        setAutoSuccess("Appointment reserved successfully!");
        setAutomateStep(5); // Success step
        // Redirect the user to checkout/payment page after brief delay
        setTimeout(() => {
          setOpen(false);
          navigate(`/customer/appointments/${appt.id}`);
        }, 1500);
      } else {
        setAutoError("Failed to reserve the appointment slot.");
      }
    } catch (err) {
      setAutoError(err.response?.data?.message || "Booking slot conflict. Try another slot.");
    } finally {
      setAutoLoading(false);
    }
  };

  // Flow 2: Fetch Active Appointments for Cancellation
  const handleFetchActiveAppointments = async () => {
    setAutoLoading(true);
    setAutoError("");
    try {
      const res = await api.get("/api/customer/appointments", {
        params: { limit: 50 }
      });
      const list = res.data?.data?.appointments || [];
      // Filter only confirmed or pending appointments
      const active = list.filter(a => a.status === "confirmed" || a.status === "pending");
      setCancelAppointments(active);
      if (active.length === 0) {
        setAutoError("You have no upcoming active appointments to cancel.");
      } else {
        setAutomateStep(2);
      }
    } catch (err) {
      setAutoError("Failed to retrieve active appointments.");
    } finally {
      setAutoLoading(false);
    }
  };

  // Flow 2: Perform Cancel Appointment
  const handleCancelAppointment = async () => {
    if (!cancelReason.trim()) {
      setAutoError("Please specify a cancellation reason.");
      return;
    }
    setAutoLoading(true);
    setAutoError("");
    try {
      await api.patch(`/api/customer/appointments/${cancelSelectedAppt.id}/cancel`, {
        cancellation_reason: cancelReason
      });
      setAutoSuccess("Appointment cancelled successfully!");
      setAutomateStep(4);
      setTimeout(() => {
        setOpen(false);
        navigate("/customer/appointments");
      }, 1500);
    } catch (err) {
      setAutoError(err.response?.data?.message || "Cancellation failed.");
    } finally {
      setAutoLoading(false);
    }
  };

  // Flow 3: Fetch Completed Appointments for Review
  const handleFetchCompletedAppointments = async () => {
    setAutoLoading(true);
    setAutoError("");
    try {
      const res = await api.get("/api/customer/appointments", {
        params: { status: "completed", limit: 50 }
      });
      const list = res.data?.data?.appointments || [];
      setReviewAppointments(list);
      if (list.length === 0) {
        setAutoError("You have no completed appointments to review.");
      } else {
        setAutomateStep(2);
      }
    } catch (err) {
      setAutoError("Failed to retrieve completed appointments.");
    } finally {
      setAutoLoading(false);
    }
  };

  // Flow 3: Submit Rating/Review
  const handleSubmitReview = async () => {
    if (!reviewComment.trim()) {
      setAutoError("Please write a short review comment.");
      return;
    }
    setAutoLoading(true);
    setAutoError("");
    try {
      await api.post(`/api/customer/appointments/${reviewSelectedAppt.id}/review`, {
        rating: reviewRating,
        comment: reviewComment
      });
      setAutoSuccess("Review submitted successfully!");
      setAutomateStep(4);
    } catch (err) {
      setAutoError(err.response?.data?.message || "Failed to submit review.");
    } finally {
      setAutoLoading(false);
    }
  };

  // Flow 4: Fetch Past Providers for Rebooking
  const handleFetchPastProviders = async () => {
    setAutoLoading(true);
    setAutoError("");
    try {
      const res = await api.get("/api/customer/appointments", {
        params: { limit: 100 }
      });
      const list = res.data?.data?.appointments || [];
      // Extract unique providers
      const uniqueProviders = [];
      const seenIds = new Set();
      for (const app of list) {
        if (app.provider && !seenIds.has(app.provider.id)) {
          seenIds.add(app.provider.id);
          uniqueProviders.push(app.provider);
        }
      }
      setRebookProviders(uniqueProviders);
      if (uniqueProviders.length === 0) {
        setAutoError("No past providers found in your appointment history.");
      } else {
        setAutomateStep(2);
      }
    } catch (err) {
      setAutoError("Failed to retrieve past providers.");
    } finally {
      setAutoLoading(false);
    }
  };

  // Flow 4: Select Provider for Rebooking
  const handleSelectProviderForRebook = async (provider) => {
    setRebookSelectedProvider(provider);
    setAutoLoading(true);
    setAutoError("");
    try {
      const res = await api.get(`/api/customer/providers/${provider.id}/slots`, {
        params: { date: rebookSelectedDate }
      });
      setRebookSlots(res.data?.data?.available_slots || []);
      setAutomateStep(3);
    } catch (err) {
      setAutoError("Failed to fetch slots for this provider.");
    } finally {
      setAutoLoading(false);
    }
  };

  // Flow 4: Rebook Date Change
  const handleRebookDateChange = async (date) => {
    setRebookSelectedDate(date);
    setAutoLoading(true);
    setAutoError("");
    try {
      const res = await api.get(`/api/customer/providers/${rebookSelectedProvider.id}/slots`, {
        params: { date }
      });
      setRebookSlots(res.data?.data?.available_slots || []);
    } catch (err) {
      setAutoError("Failed to fetch slots for this date.");
    } finally {
      setAutoLoading(false);
    }
  };

  // Flow 4: Perform Rebook Booking Action
  const handleRebookAppointment = async () => {
    if (!rebookSelectedSlot) {
      setAutoError("Please select a time slot.");
      return;
    }
    setAutoLoading(true);
    setAutoError("");
    try {
      const res = await api.post("/api/customer/appointments", {
        provider_id: rebookSelectedProvider.id,
        appointment_date: rebookSelectedDate,
        time_slot: rebookSelectedSlot,
        notes: "Rebooking past provider via Schedully",
      });
      const appt = res.data?.data?.appointment;
      if (appt) {
        setAutoSuccess("Rebooked slot reserved successfully!");
        setAutomateStep(5);
        setTimeout(() => {
          setOpen(false);
          navigate(`/customer/appointments/${appt.id}`);
        }, 1500);
      } else {
        setAutoError("Failed to reserve the rebooked slot.");
      }
    } catch (err) {
      setAutoError(err.response?.data?.message || "Slot conflict. Try another time.");
    } finally {
      setAutoLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Floating Action Button ──────────────────────────────────────────── */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close Schedully chat" : "Open Schedully chat"}
        className="fixed bottom-6 right-6 z-[100] w-14 h-14 rounded-full
                   bg-blue-600 hover:bg-blue-700 text-white shadow-lg
                   flex items-center justify-center transition-transform
                   hover:scale-105 focus:outline-none focus:ring-2
                   focus:ring-blue-400 focus:ring-offset-2"
        style={{ boxShadow: "0 4px 24px rgba(37,99,235,0.4)" }}
      >
        {open ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>

      {/* ── Chat Panel ──────────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-[99]
                     w-[calc(100vw-3rem)] max-w-[400px]
                     h-[70vh] max-h-[600px] min-h-[400px]
                     bg-white dark:bg-gray-900
                     border border-gray-200 dark:border-gray-700
                     rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in"
          role="dialog"
          aria-label="Schedully AI assistant"
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            if (canUpload) setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3
                       bg-blue-600 text-white rounded-t-2xl shrink-0"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="font-semibold text-sm">Schedully</span>
              {role === "customer" && (
                <span className="text-xs bg-blue-500 px-1.5 py-0.5 rounded">
                  Help
                </span>
              )}
            </div>
            {/* Upload toggle — provider/admin only */}
            {canUpload && (
              <button
                onClick={() => setShowUploadPanel((v) => !v)}
                aria-label="Toggle upload panel"
                className="p-1 rounded hover:bg-blue-500 transition-colors"
                title="Upload a report or document"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </button>
            )}
          </div>

          {/* Customer Tabs */}
          {role === "customer" && (
            <div className="flex border-b border-gray-200 dark:border-gray-700 shrink-0 bg-gray-50/50 dark:bg-gray-800/40">
              <button
                onClick={() => { setActiveTab("chat"); setAutomateFlow(null); }}
                className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-all ${
                  activeTab === "chat"
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
              >
                Chat Assistant
              </button>
              <button
                onClick={() => { setActiveTab("automate"); setAutomateFlow(null); setAutomateStep(1); setAutoError(""); setAutoSuccess(""); }}
                className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-all ${
                  activeTab === "automate"
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
              >
                Automate
              </button>
            </div>
          )}

          {/* Drag-and-drop overlay */}
          {isDragOver && canUpload && (
            <div
              className="absolute inset-0 z-10 bg-blue-600/20 border-2 border-dashed
                         border-blue-500 rounded-2xl flex items-center justify-center
                         pointer-events-none"
            >
              <p className="text-blue-700 dark:text-blue-300 font-semibold text-sm">
                Drop PDF, DOCX, or XLSX to ingest
              </p>
            </div>
          )}

          {/* Upload panel — provider/admin only */}
          {showUploadPanel && canUpload && (
            <div
              className="px-4 py-3 bg-gray-50 dark:bg-gray-800
                         border-b border-gray-200 dark:border-gray-700 shrink-0"
            >
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Upload an exported report or document
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                Tip: Export your schedule from Insights, or download admin reports first
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.xlsx"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files?.[0])}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadStatus === "uploading"}
                className="w-full py-2 text-xs border-2 border-dashed
                           border-gray-300 dark:border-gray-600 rounded-lg
                           text-gray-500 dark:text-gray-400
                           hover:border-blue-400 hover:text-blue-600
                           transition-colors disabled:opacity-50"
              >
                {uploadStatus === "uploading"
                  ? "Uploading…"
                  : "Click or drag-and-drop (.pdf .docx .xlsx)"}
              </button>
              {uploadMessage && (
                <p
                  className={`mt-1 text-xs ${
                    uploadStatus === "error" ? "text-red-500" : "text-green-600"
                  }`}
                >
                  {uploadMessage}
                </p>
              )}
            </div>
          )}

          {/* CHAT TAB PANEL */}
          {activeTab === "chat" && (
            <>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scroll-smooth">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm
                                  leading-relaxed break-words
                        ${
                          msg.role === "user"
                            ? "bg-blue-600 text-white rounded-br-md"
                            : msg.role === "error"
                            ? "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-bl-md"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md"
                        }`}
                    >
                      {msg.role === "user" ? (
                        <span>{msg.text}</span>
                      ) : (
                        renderAnswerWithCitations(msg.text, msg.sources)
                      )}
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex gap-1 items-center">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce"
                            style={{ animationDelay: `${i * 0.15}s` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              <div
                className="px-3 py-3 border-t border-gray-200 dark:border-gray-700 shrink-0"
              >
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      role === "customer"
                        ? "Ask about booking, cancelling, or using Schedex…"
                        : "Ask about appointments, slots, reports, certificates…"
                    }
                    rows={1}
                    maxLength={2000}
                    disabled={loading}
                    className="flex-1 resize-none rounded-xl border
                               border-gray-300 dark:border-gray-600
                               bg-white dark:bg-gray-800
                               text-gray-900 dark:text-gray-100
                               px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-blue-500
                               disabled:opacity-50 max-h-24 overflow-y-auto"
                    style={{ lineHeight: "1.5" }}
                    aria-label="Chat message"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={loading || !input.trim()}
                    aria-label="Send message"
                    className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-700
                               text-white flex items-center justify-center
                               shrink-0 disabled:opacity-40 transition-colors
                               focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* AUTOMATE TAB PANEL */}
          {activeTab === "automate" && (
            <div className="flex-1 flex flex-col overflow-y-auto p-4 bg-gray-50/30 dark:bg-gray-900/10">
              
              {/* FLOW SELECTION VIEW */}
              {automateFlow === null && (
                <div className="space-y-4 my-auto">
                  <h3 className="text-center font-bold text-gray-800 dark:text-gray-200 text-sm mb-4">
                    Choose a workflow to automate
                  </h3>
                  
                  <button
                    onClick={() => { setAutomateFlow("book"); setAutomateStep(1); }}
                    className="w-full p-4 text-left rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-blue-400 transition-all flex items-center gap-3.5 group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">📅</div>
                    <div>
                      <h4 className="font-semibold text-xs text-gray-800 dark:text-gray-100 group-hover:text-blue-600 transition-colors">Book Appointment</h4>
                      <p className="text-[10px] text-gray-400">Step-by-step search, slot booking, and reservation flow.</p>
                    </div>
                  </button>

                  <button
                    onClick={() => { setAutomateFlow("cancel"); setAutomateStep(1); handleFetchActiveAppointments(); }}
                    className="w-full p-4 text-left rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-red-400 transition-all flex items-center gap-3.5 group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center font-bold text-lg">❌</div>
                    <div>
                      <h4 className="font-semibold text-xs text-gray-800 dark:text-gray-100 group-hover:text-red-600 transition-colors">Cancel Appointment</h4>
                      <p className="text-[10px] text-gray-400">Identify upcoming bookings and cancel with policy summary.</p>
                    </div>
                  </button>

                  <button
                    onClick={() => { setAutomateFlow("review"); setAutomateStep(1); handleFetchCompletedAppointments(); }}
                    className="w-full p-4 text-left rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-yellow-400 transition-all flex items-center gap-3.5 group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-yellow-100 text-yellow-600 flex items-center justify-center font-bold text-lg">⭐</div>
                    <div>
                      <h4 className="font-semibold text-xs text-gray-800 dark:text-gray-100 group-hover:text-yellow-600 transition-colors">Give Review & Rating</h4>
                      <p className="text-[10px] text-gray-400">Rate and write feedback for completed appointments.</p>
                    </div>
                  </button>

                  <button
                    onClick={() => { setAutomateFlow("rebook"); setAutomateStep(1); handleFetchPastProviders(); }}
                    className="w-full p-4 text-left rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-green-400 transition-all flex items-center gap-3.5 group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-green-100 text-green-600 flex items-center justify-center font-bold text-lg">🔄</div>
                    <div>
                      <h4 className="font-semibold text-xs text-gray-800 dark:text-gray-100 group-hover:text-green-600 transition-colors">Rebook Appointment</h4>
                      <p className="text-[10px] text-gray-400">Quickly select a past provider to make a new booking.</p>
                    </div>
                  </button>
                </div>
              )}

              {/* AUTOMATION STEP WORKSPACES */}

              {/* FLOW 1: BOOKING WIZARD */}
              {automateFlow === "book" && (
                <div className="flex-1 flex flex-col space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700 shrink-0">
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">Automate Booking · Step {automateStep}/4</span>
                    <button onClick={() => setAutomateFlow(null)} className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">✕ Close</button>
                  </div>

                  {autoError && <div className="p-2.5 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-semibold">{autoError}</div>}
                  {autoSuccess && <div className="p-2.5 rounded-lg bg-green-50 text-green-700 border border-green-200 text-xs font-semibold">{autoSuccess}</div>}

                  {/* Step 1: Input Criteria */}
                  {automateStep === 1 && (
                    <div className="space-y-3 my-auto">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Select City</label>
                        <select
                          value={bookCity}
                          onChange={(e) => setBookCity(e.target.value)}
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg text-xs"
                        >
                          <option>Hyderabad</option>
                          <option>Mumbai</option>
                          <option>Bengaluru</option>
                          <option>Pune</option>
                          <option>Delhi</option>
                          <option>Ahmedabad</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Specialization / Category</label>
                        <select
                          value={bookSpecialization}
                          onChange={(e) => setBookSpecialization(e.target.value)}
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg text-xs"
                        >
                          <option value="Dentist">Dentist</option>
                          <option value="General Physician">General Physician</option>
                          <option value="Dermatologist">Dermatologist</option>
                          <option value="Business Coach">Business Coach</option>
                          <option value="Makeup Artist">Makeup Artist</option>
                          <option value="Deep Cleaning Supervisor">Cleaning Supervisor</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Provider Name (Optional)</label>
                        <input
                          type="text"
                          value={bookProviderName}
                          onChange={(e) => setBookProviderName(e.target.value)}
                          placeholder="e.g. Dhoni Bose"
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Minimum Rating (Optional)</label>
                        <select
                          value={bookMinRating}
                          onChange={(e) => setBookMinRating(e.target.value)}
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg text-xs"
                        >
                          <option value="0">Any rating</option>
                          <option value="4.0">4.0+ Stars</option>
                          <option value="4.5">4.5+ Stars</option>
                        </select>
                      </div>

                      <button
                        onClick={handleSearchProviders}
                        disabled={autoLoading}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs tracking-wider uppercase transition-colors shrink-0 disabled:opacity-50 mt-4"
                      >
                        {autoLoading ? "Searching..." : "Search Providers"}
                      </button>
                    </div>
                  )}

                  {/* Step 2: Choose Provider */}
                  {automateStep === 2 && (
                    <div className="flex-1 flex flex-col space-y-2 overflow-y-auto">
                      <div className="flex justify-between items-center text-[10px] text-gray-400 pb-1">
                        <span>Matching experts found: {bookProviders.length}</span>
                        <button onClick={() => setAutomateStep(1)} className="text-blue-500 hover:underline">← Back</button>
                      </div>
                      <div className="space-y-2 overflow-y-auto max-h-[380px] pr-1">
                        {bookProviders.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => handleSelectProviderForBooking(p)}
                            className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-400 rounded-xl cursor-pointer shadow-sm hover:shadow transition-all text-xs"
                          >
                            <div className="font-bold text-gray-800 dark:text-gray-100">{p.provider_name || p.user?.full_name}</div>
                            <div className="text-[10px] text-blue-500 font-semibold">{p.specialization}</div>
                            <div className="flex justify-between text-[10px] text-gray-400 mt-1.5">
                              <span>⭐ {parseFloat(p.avg_rating || 5.0).toFixed(1)} ({p.total_reviews || 0} reviews)</span>
                              <span className="font-semibold text-gray-700 dark:text-gray-300">₹{p.consultation_fee}/session</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step 3: Choose Slot */}
                  {automateStep === 3 && (
                    <div className="flex-1 flex flex-col space-y-3">
                      <div className="flex justify-between items-center text-[10px] text-gray-400 pb-1">
                        <span>Expert: <strong>{bookSelectedProvider?.provider_name || bookSelectedProvider?.user?.full_name}</strong></span>
                        <button onClick={() => setAutomateStep(2)} className="text-blue-500 hover:underline">← Back</button>
                      </div>
                      
                      {/* Date list selection */}
                      <div className="space-y-1 shrink-0">
                        <label className="text-[9px] font-bold text-gray-500 uppercase">Select Date</label>
                        <div className="flex gap-1.5 overflow-x-auto pb-1.5">
                          {bookDates.map((d) => (
                            <button
                              key={d}
                              onClick={() => handleBookingDateChange(d)}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all shrink-0 ${
                                bookSelectedDate === d
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : "bg-white dark:bg-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:border-blue-400"
                              }`}
                            >
                              {new Date(d).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Slots list */}
                      <div className="flex-1 flex flex-col space-y-1.5 min-h-[150px] overflow-y-auto">
                        <label className="text-[9px] font-bold text-gray-500 uppercase">Select Available Slot</label>
                        {bookSlots.length === 0 ? (
                          <div className="text-center text-xs text-gray-400 p-8 my-auto">No available slots for this date.</div>
                        ) : (
                          <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-[200px]">
                            {bookSlots.map((s) => (
                              <button
                                key={s}
                                onClick={() => setBookSelectedSlot(s)}
                                className={`p-2 rounded-lg text-[11px] font-semibold text-center border transition-all ${
                                  bookSelectedSlot === s
                                    ? "bg-blue-600 text-white border-blue-600 shadow"
                                    : "bg-white dark:bg-gray-800 dark:text-gray-100 border-gray-200 dark:border-gray-700 hover:border-blue-400"
                                }`}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => setAutomateStep(4)}
                        disabled={!bookSelectedSlot}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs tracking-wider uppercase transition-colors shrink-0 disabled:opacity-50"
                      >
                        Proceed to Booking
                      </button>
                    </div>
                  )}

                  {/* Step 4: Summary & Confirm */}
                  {automateStep === 4 && (
                    <div className="space-y-4 my-auto">
                      <div className="flex justify-between items-center text-[10px] text-gray-400 pb-1">
                        <span>Verify reservation details:</span>
                        <button onClick={() => setAutomateStep(3)} className="text-blue-500 hover:underline">← Back</button>
                      </div>

                      <div className="p-3.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Expert:</span>
                          <span className="font-bold text-gray-800 dark:text-gray-100">{bookSelectedProvider?.provider_name || bookSelectedProvider?.user?.full_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Specialization:</span>
                          <span className="font-semibold text-gray-700 dark:text-gray-300">{bookSelectedProvider?.specialization}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Date:</span>
                          <span className="font-semibold text-gray-700 dark:text-gray-300">{bookSelectedDate}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Time Slot:</span>
                          <span className="font-bold text-blue-600">{bookSelectedSlot}</span>
                        </div>
                        <div className="flex justify-between border-t border-gray-100 dark:border-gray-700 pt-2 font-bold text-sm">
                          <span>Price Amount:</span>
                          <span className="text-accent">₹{bookSelectedProvider?.consultation_fee}</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Consultation Notes (Optional)</label>
                        <textarea
                          value={bookNotes}
                          onChange={(e) => setBookNotes(e.target.value)}
                          placeholder="e.g. Hello Dr, need checkup."
                          rows={2}
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg text-xs resize-none"
                        />
                      </div>

                      <button
                        onClick={handleBookAppointment}
                        disabled={autoLoading}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs tracking-wider uppercase transition-colors shrink-0 disabled:opacity-50 mt-2"
                      >
                        {autoLoading ? "Automating Booking..." : "Confirm & Automate Book"}
                      </button>
                    </div>
                  )}

                  {/* Step 5: Success Loading Screen */}
                  {automateStep === 5 && (
                    <div className="my-auto text-center py-6 space-y-3">
                      <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-bold text-xl mx-auto animate-bounce">✓</div>
                      <h4 className="font-bold text-gray-800 dark:text-gray-100 text-sm">Booking Success!</h4>
                      <p className="text-[11px] text-gray-400 leading-relaxed max-w-xs mx-auto">
                        Your slot has been reserved. Taking you to the payment screen to finalize transaction...
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* FLOW 2: CANCELLING WIZARD */}
              {automateFlow === "cancel" && (
                <div className="flex-1 flex flex-col space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700 shrink-0">
                    <span className="text-[10px] font-bold text-red-600 uppercase tracking-wide">Automate Cancellation · Step {automateStep}/3</span>
                    <button onClick={() => setAutomateFlow(null)} className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">✕ Close</button>
                  </div>

                  {autoError && <div className="p-2.5 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-semibold">{autoError}</div>}
                  {autoSuccess && <div className="p-2.5 rounded-lg bg-green-50 text-green-700 border border-green-200 text-xs font-semibold">{autoSuccess}</div>}

                  {/* Step 1 & 2: List & Select */}
                  {automateStep === 2 && (
                    <div className="flex-1 flex flex-col space-y-2 overflow-y-auto">
                      <div className="text-[10px] text-gray-400 pb-1">Select an active appointment to cancel:</div>
                      <div className="space-y-2 overflow-y-auto max-h-[380px] pr-1">
                        {cancelAppointments.map((a) => (
                          <div
                            key={a.id}
                            onClick={() => { setCancelSelectedAppt(a); setAutomateStep(3); }}
                            className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-red-400 rounded-xl cursor-pointer shadow-sm hover:shadow transition-all text-xs"
                          >
                            <div className="font-bold text-gray-800 dark:text-gray-100">
                              {a.provider?.owner_name || a.provider?.user?.full_name || "Expert"}
                            </div>
                            <div className="text-[10px] text-gray-400 mt-1">
                              📅 {a.appointment_date} | ⏰ {a.time_slot}
                            </div>
                            <div className="flex justify-between items-center text-[9px] mt-2">
                              <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold uppercase">{a.status}</span>
                              <span className="text-gray-500 font-semibold">₹{a.consultation_fee_snapshot}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step 3: Input Reason & Submit */}
                  {automateStep === 3 && (
                    <div className="space-y-4 my-auto">
                      <div className="flex justify-between items-center text-[10px] text-gray-400 pb-1">
                        <span>Cancel Appt with: <strong>{cancelSelectedAppt?.provider?.owner_name || cancelSelectedAppt?.provider?.user?.full_name}</strong></span>
                        <button onClick={() => setAutomateStep(2)} className="text-blue-500 hover:underline">← Back</button>
                      </div>

                      <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-lg text-[10px] leading-relaxed">
                        ⚠️ <strong>Important cancellation policy:</strong> Cancellations made inside 24 hours of slot time incur a 20% penalty deduction. Inside 2 hours are non-refundable.
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Reason for Cancellation</label>
                        <textarea
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          placeholder="e.g. Conflict in schedule"
                          rows={3}
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg text-xs resize-none"
                        />
                      </div>

                      <button
                        onClick={handleCancelAppointment}
                        disabled={autoLoading}
                        className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs tracking-wider uppercase transition-colors shrink-0 disabled:opacity-50"
                      >
                        {autoLoading ? "Automating Cancellation..." : "Confirm & Cancel"}
                      </button>
                    </div>
                  )}

                  {/* Step 4: Success loading screen */}
                  {automateStep === 4 && (
                    <div className="my-auto text-center py-6 space-y-3 animate-fade-in">
                      <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-bold text-xl mx-auto">✓</div>
                      <h4 className="font-bold text-gray-800 dark:text-gray-100 text-sm">Cancellation Done!</h4>
                      <p className="text-[11px] text-gray-400 leading-relaxed max-w-xs mx-auto">
                        The appointment has been successfully cancelled. Redirecting you to your schedule...
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* FLOW 3: REVIEWS WIZARD */}
              {automateFlow === "review" && (
                <div className="flex-1 flex flex-col space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700 shrink-0">
                    <span className="text-[10px] font-bold text-yellow-600 uppercase tracking-wide">Automate Review · Step {automateStep}/3</span>
                    <button onClick={() => setAutomateFlow(null)} className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">✕ Close</button>
                  </div>

                  {autoError && <div className="p-2.5 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-semibold">{autoError}</div>}
                  {autoSuccess && <div className="p-2.5 rounded-lg bg-green-50 text-green-700 border border-green-200 text-xs font-semibold">{autoSuccess}</div>}

                  {/* Step 1 & 2: List completed */}
                  {automateStep === 2 && (
                    <div className="flex-1 flex flex-col space-y-2 overflow-y-auto">
                      <div className="text-[10px] text-gray-400 pb-1">Select completed appointment to review:</div>
                      <div className="space-y-2 overflow-y-auto max-h-[380px] pr-1">
                        {reviewAppointments.map((a) => (
                          <div
                            key={a.id}
                            onClick={() => { setReviewSelectedAppt(a); setAutomateStep(3); }}
                            className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-yellow-400 rounded-xl cursor-pointer shadow-sm hover:shadow transition-all text-xs"
                          >
                            <div className="font-bold text-gray-800 dark:text-gray-100">
                              {a.provider?.owner_name || a.provider?.user?.full_name || "Expert"}
                            </div>
                            <div className="text-[10px] text-gray-400 mt-1">
                              📅 {a.appointment_date} | ⏰ {a.time_slot}
                            </div>
                            <div className="text-[9px] text-gray-500 mt-2 italic font-medium">
                              Notes: {a.notes || "No notes"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step 3: Write Review & Star input */}
                  {automateStep === 3 && (
                    <div className="space-y-4 my-auto">
                      <div className="flex justify-between items-center text-[10px] text-gray-400 pb-1">
                        <span>Review for: <strong>{reviewSelectedAppt?.provider?.owner_name || reviewSelectedAppt?.provider?.user?.full_name}</strong></span>
                        <button onClick={() => setAutomateStep(2)} className="text-blue-500 hover:underline">← Back</button>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Select Rating (1 to 5 Stars)</label>
                        <div className="flex justify-center gap-2 py-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setReviewRating(star)}
                              className="text-2xl hover:scale-110 transition-transform"
                            >
                              {star <= reviewRating ? "★" : "☆"}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Write Review Comment</label>
                        <textarea
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          placeholder="Write your experience with this expert..."
                          rows={3}
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg text-xs resize-none"
                        />
                      </div>

                      <button
                        onClick={handleSubmitReview}
                        disabled={autoLoading}
                        className="w-full py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-bold text-xs tracking-wider uppercase transition-colors shrink-0 disabled:opacity-50"
                      >
                        {autoLoading ? "Submitting Review..." : "Submit Review"}
                      </button>
                    </div>
                  )}

                  {/* Step 4: Success loading screen */}
                  {automateStep === 4 && (
                    <div className="my-auto text-center py-6 space-y-3">
                      <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-bold text-xl mx-auto">✓</div>
                      <h4 className="font-bold text-gray-800 dark:text-gray-100 text-sm">Review Submitted!</h4>
                      <p className="text-[11px] text-gray-400 leading-relaxed max-w-xs mx-auto">
                        Thank you for sharing your feedback with the Schedully expert!
                      </p>
                      <button
                        onClick={() => setAutomateFlow(null)}
                        className="mt-3 px-4 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white text-xs font-semibold rounded-lg transition-colors"
                      >
                        Back to Automation Menu
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* FLOW 4: REBOOKING WIZARD */}
              {automateFlow === "rebook" && (
                <div className="flex-1 flex flex-col space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700 shrink-0">
                    <span className="text-[10px] font-bold text-green-600 uppercase tracking-wide">Automate Rebooking · Step {automateStep}/4</span>
                    <button onClick={() => setAutomateFlow(null)} className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">✕ Close</button>
                  </div>

                  {autoError && <div className="p-2.5 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-semibold">{autoError}</div>}
                  {autoSuccess && <div className="p-2.5 rounded-lg bg-green-50 text-green-700 border border-green-200 text-xs font-semibold">{autoSuccess}</div>}

                  {/* Step 1 & 2: List providers */}
                  {automateStep === 2 && (
                    <div className="flex-1 flex flex-col space-y-2 overflow-y-auto">
                      <div className="text-[10px] text-gray-400 pb-1">Choose a past provider to rebook with:</div>
                      <div className="space-y-2 overflow-y-auto max-h-[380px] pr-1">
                        {rebookProviders.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => handleSelectProviderForRebook(p)}
                            className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-green-400 rounded-xl cursor-pointer shadow-sm hover:shadow transition-all text-xs"
                          >
                            <div className="font-bold text-gray-800 dark:text-gray-100">{p.owner_name || p.user?.full_name || "Expert"}</div>
                            <div className="text-[10px] text-blue-500 font-semibold">{p.specialization}</div>
                            <div className="flex justify-between text-[10px] text-gray-400 mt-1.5">
                              <span>⭐ {parseFloat(p.avg_rating || 5.0).toFixed(1)}</span>
                              <span>₹{p.consultation_fee}/session</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step 3: Choose date & slot */}
                  {automateStep === 3 && (
                    <div className="flex-1 flex flex-col space-y-3">
                      <div className="flex justify-between items-center text-[10px] text-gray-400 pb-1">
                        <span>Provider: <strong>{rebookSelectedProvider?.owner_name || rebookSelectedProvider?.user?.full_name}</strong></span>
                        <button onClick={() => setAutomateStep(2)} className="text-blue-500 hover:underline">← Back</button>
                      </div>

                      {/* Date selections */}
                      <div className="space-y-1 shrink-0">
                        <label className="text-[9px] font-bold text-gray-500 uppercase">Select Date</label>
                        <div className="flex gap-1.5 overflow-x-auto pb-1.5">
                          {bookDates.map((d) => (
                            <button
                              key={d}
                              onClick={() => handleRebookDateChange(d)}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all shrink-0 ${
                                rebookSelectedDate === d
                                  ? "bg-green-600 text-white border-green-600"
                                  : "bg-white dark:bg-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:border-green-400"
                              }`}
                            >
                              {new Date(d).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Slots list */}
                      <div className="flex-1 flex flex-col space-y-1.5 min-h-[150px] overflow-y-auto">
                        <label className="text-[9px] font-bold text-gray-500 uppercase">Select Time Slot</label>
                        {rebookSlots.length === 0 ? (
                          <div className="text-center text-xs text-gray-400 p-8 my-auto">No available slots for this date.</div>
                        ) : (
                          <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-[200px]">
                            {rebookSlots.map((s) => (
                              <button
                                key={s}
                                onClick={() => setRebookSelectedSlot(s)}
                                className={`p-2 rounded-lg text-[11px] font-semibold text-center border transition-all ${
                                  rebookSelectedSlot === s
                                    ? "bg-green-600 text-white border-green-600 shadow"
                                    : "bg-white dark:bg-gray-800 dark:text-gray-100 border-gray-200 dark:border-gray-700 hover:border-green-400"
                                }`}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => setAutomateStep(4)}
                        disabled={!rebookSelectedSlot}
                        className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-xs tracking-wider uppercase transition-colors shrink-0 disabled:opacity-50"
                      >
                        Review Booking
                      </button>
                    </div>
                  )}

                  {/* Step 4: Summary & Confirm */}
                  {automateStep === 4 && (
                    <div className="space-y-4 my-auto">
                      <div className="flex justify-between items-center text-[10px] text-gray-400 pb-1">
                        <span>Confirm your rebooking details:</span>
                        <button onClick={() => setAutomateStep(3)} className="text-blue-500 hover:underline">← Back</button>
                      </div>

                      <div className="p-3.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Expert:</span>
                          <span className="font-bold text-gray-800 dark:text-gray-100">{rebookSelectedProvider?.owner_name || rebookSelectedProvider?.user?.full_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Date:</span>
                          <span className="font-semibold text-gray-700 dark:text-gray-300">{rebookSelectedDate}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Time Slot:</span>
                          <span className="font-bold text-green-600">{rebookSelectedSlot}</span>
                        </div>
                        <div className="flex justify-between border-t border-gray-100 dark:border-gray-700 pt-2 font-bold text-sm">
                          <span>Price Amount:</span>
                          <span className="text-accent">₹{rebookSelectedProvider?.consultation_fee}</span>
                        </div>
                      </div>

                      <button
                        onClick={handleRebookAppointment}
                        disabled={autoLoading}
                        className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-xs tracking-wider uppercase transition-colors shrink-0 disabled:opacity-50"
                      >
                        {autoLoading ? "Rebooking Slot..." : "Automate Rebook Booking"}
                      </button>
                    </div>
                  )}

                  {/* Step 5: Success Loading Screen */}
                  {automateStep === 5 && (
                    <div className="my-auto text-center py-6 space-y-3">
                      <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-bold text-xl mx-auto">✓</div>
                      <h4 className="font-bold text-gray-800 dark:text-gray-100 text-sm">Rebook Success!</h4>
                      <p className="text-[11px] text-gray-400 leading-relaxed max-w-xs mx-auto">
                        Your slot has been reserved. Redirecting to payment screen to finalize...
                      </p>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

        </div>
      )}
    </>
  );
}
