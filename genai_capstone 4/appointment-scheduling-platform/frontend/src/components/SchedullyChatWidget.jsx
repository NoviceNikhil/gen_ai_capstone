/**
 * SchedullyChatWidget.jsx
 * Floating FAB chat widget for Schedully with automated wizard flows.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import api from "../services/axios";

// ── Stable session ID scoped to this user ─────────────────────────────────────
function getSessionId() {
  const KEY = "schedully_session_id";
  let sid = sessionStorage.getItem(KEY);
  if (!sid) {
    sid = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(KEY, sid);
  }
  return sid;
}

// ── Citation badge ────────────────────────────────────────────────────────────
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
        <span className="block mt-1 p-2 text-xs bg-gray-50 dark:bg-gray-800
                         border border-gray-200 dark:border-gray-700 rounded max-w-xs break-words">
          <strong>{source.source}</strong>
          <br />
          {source.snippet?.slice(0, 200)}{source.snippet?.length > 200 ? "…" : ""}
        </span>
      )}
    </span>
  );
}

function parseMarkdownAndCitations(text, sources) {
  if (!text) return null;
  const lines = text.split("\n");

  return lines.map((line, lineIdx) => {
    const boldParts = line.split(/(\*\*[^*]+\*\*)/g);
    const processedLine = boldParts.flatMap((part, partIdx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        const rawText = part.slice(2, -2);
        return <strong key={`b_${partIdx}`}>{rawText}</strong>;
      }
      
      const codeParts = part.split(/(\`[^`]+\`)/g);
      return codeParts.flatMap((subPart, subIdx) => {
        if (subPart.startsWith("`") && subPart.endsWith("`")) {
          const rawCode = subPart.slice(1, -1);
          return (
            <code key={`c_${subIdx}`} className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-xs font-mono font-bold">
              {rawCode}
            </code>
          );
        }

        if (sources && sources.length > 0) {
          const citeParts = subPart.split(/(\[Source \d+\])/g);
          return citeParts.map((citePart, citeIdx) => {
            const match = citePart.match(/^\[Source (\d+)\]$/);
            if (match) {
              const srcIdx = parseInt(match[1], 10);
              const src = sources.find((s) => s.index === srcIdx);
              if (src) return <CitationBadge key={`cite_${citeIdx}`} source={src} />;
            }
            return citePart;
          });
        }

        return subPart;
      });
    });

    const isBullet = line.trim().startsWith("* ") || line.trim().startsWith("- ");
    if (isBullet) {
      const cleanLine = line.replace(/^\s*[*+-]\s+/, "");
      const cleanBoldParts = cleanLine.split(/(\*\*[^*]+\*\*)/g);
      const processedCleanLine = cleanBoldParts.flatMap((part, partIdx) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={`b_${partIdx}`}>{part.slice(2, -2)}</strong>;
        }
        const codeParts = part.split(/(\`[^`]+\`)/g);
        return codeParts.flatMap((subPart, subIdx) => {
          if (subPart.startsWith("`") && subPart.endsWith("`")) {
            return <code key={`c_${subIdx}`} className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-xs font-mono font-bold">{subPart.slice(1, -1)}</code>;
          }
          if (sources && sources.length > 0) {
            const citeParts = subPart.split(/(\[Source \d+\])/g);
            return citeParts.map((citePart, citeIdx) => {
              const match = citePart.match(/^\[Source (\d+)\]$/);
              if (match) {
                const src = sources.find((s) => s.index === parseInt(match[1], 10));
                if (src) return <CitationBadge key={`cite_${citeIdx}`} source={src} />;
              }
              return citePart;
            });
          }
          return subPart;
        });
      });

      return (
        <li key={lineIdx} className="list-disc ml-5 mb-1 text-sm text-gray-800 dark:text-gray-200">
          {processedCleanLine}
        </li>
      );
    }

    return (
      <div key={lineIdx} className={line.trim() === "" ? "h-2" : "mb-1 text-sm text-gray-800 dark:text-gray-200"}>
        {processedLine}
      </div>
    );
  });
}

function getWelcomeMessage(role, tab) {
  if (tab === "rag") {
    return {
      id:      "welcome_rag",
      role:    "assistant",
      text:    "Hi! I'm Schedully Document QA. Upload your schedule reports, certificates, or documents (.pdf, .docx, .xlsx) and ask questions about them.",
      sources: [],
    };
  }
  return {
    id:      "welcome_normal",
    role:    "assistant",
    text:    role === "customer"
               ? "Hi! I'm Schedully. Ask me anything about using Schedex — booking, cancellations, payments, and more."
               : "Hi! I'm Schedully. Ask me about your appointments, slots, average ratings, or how to use the platform. Note: Use the RAG Document QA tab to ask about uploaded files.",
    sources: [],
  };
}

// ── NLP Prompt Parser ────────────────────────────────────────────────────────
function parseBookingPrompt(message, categories) {
  const msg = message.toLowerCase();
  let providerName = "";
  let location = "";
  let categoryId = "";
  let rating = 0;
  let orgName = "";
  let dateVal = "";
  let serviceType = "";

  // 1. Detect Category/Specialization
  let specialization = "";
  if (categories && categories.length > 0) {
    const specMap = {
      "general physician": { catName: "Healthcare", name: "General Physician" },
      "dermatologist": { catName: "Healthcare", name: "Dermatologist" },
      "pediatrician": { catName: "Healthcare", name: "Pediatrician" },
      "dentist": { catName: "Healthcare", name: "Dentist" },
      "dental": { catName: "Healthcare", name: "Dentist" },
      "physiotherapist": { catName: "Healthcare", name: "Physiotherapist" },
      "cardiologist": { catName: "Healthcare", name: "Cardiologist" },
      "cardio": { catName: "Healthcare", name: "Cardiologist" },
      "orthopedic": { catName: "Healthcare", name: "Orthopedic" },
      "psychiatrist": { catName: "Healthcare", name: "Psychiatrist" },
      "makeup artist": { catName: "Beauty & Wellness", name: "Makeup Artist" },
      "makeup": { catName: "Beauty & Wellness", name: "Makeup Artist" },
      "hair stylist": { catName: "Beauty & Wellness", name: "Hair Stylist" },
      "hair": { catName: "Beauty & Wellness", name: "Hair Stylist" },
      "yoga coach": { catName: "Beauty & Wellness", name: "Yoga Coach" },
      "yoga": { catName: "Beauty & Wellness", name: "Yoga Coach" },
      "massage therapist": { catName: "Beauty & Wellness", name: "Massage Therapist" },
      "massage": { catName: "Beauty & Wellness", name: "Massage Therapist" },
      "nail artist": { catName: "Beauty & Wellness", name: "Nail Artist" },
      "nail": { catName: "Beauty & Wellness", name: "Nail Artist" },
      "dietitian": { catName: "Beauty & Wellness", name: "Dietitian" },
      "diet": { catName: "Beauty & Wellness", name: "Dietitian" },
      "fitness trainer": { catName: "Beauty & Wellness", name: "Fitness Trainer" },
      "fitness": { catName: "Beauty & Wellness", name: "Fitness Trainer" },
      "electrician": { catName: "Home Services", name: "Electrician" },
      "plumber": { catName: "Home Services", name: "Plumber" },
      "appliance repair": { catName: "Home Services", name: "Appliance Repair" },
      "appliance": { catName: "Home Services", name: "Appliance Repair" },
      "deep cleaning": { catName: "Home Services", name: "Deep Cleaning Supervisor" },
      "cleaning": { catName: "Home Services", name: "Deep Cleaning Supervisor" },
      "pest control": { catName: "Home Services", name: "Pest Control" },
      "pest": { catName: "Home Services", name: "Pest Control" },
      "carpenter": { catName: "Home Services", name: "Carpenter" },
      "startup finance": { catName: "Business Consulting", name: "Startup Finance Advisor" },
      "finance": { catName: "Business Consulting", name: "Startup Finance Advisor" },
      "legal consultant": { catName: "Business Consulting", name: "Legal Consultant" },
      "legal": { catName: "Business Consulting", name: "Legal Consultant" },
      "marketing expert": { catName: "Business Consulting", name: "Marketing Expert" },
      "marketing": { catName: "Business Consulting", name: "Marketing Expert" },
      "tax advisor": { catName: "Business Consulting", name: "Tax Advisor" },
      "tax": { catName: "Business Consulting", name: "Tax Advisor" },
      "hr consultant": { catName: "Business Consulting", name: "HR Consultant" },
      "hr": { catName: "Business Consulting", name: "HR Consultant" },
      "business coach": { catName: "Business Consulting", name: "Business Coach" },
      "mathematics tutor": { catName: "Education", name: "Mathematics Tutor" },
      "math": { catName: "Education", name: "Mathematics Tutor" },
      "english coach": { catName: "Education", name: "English Communication Coach" },
      "english": { catName: "Education", name: "English Communication Coach" },
      "science tutor": { catName: "Education", name: "Science Tutor" },
      "science": { catName: "Education", name: "Science Tutor" },
      "music teacher": { catName: "Education", name: "Music Teacher" },
      "music": { catName: "Education", name: "Music Teacher" },
      "art instructor": { catName: "Education", name: "Art Instructor" },
      "art": { catName: "Education", name: "Art Instructor" },
      "coding instructor": { catName: "Education", name: "Coding Instructor" },
      "coding": { catName: "Education", name: "Coding Instructor" }
    };

    const specKeysSorted = Object.keys(specMap).sort((a, b) => b.length - a.length);
    let matchedSpec = null;
    for (const key of specKeysSorted) {
      if (msg.includes(key)) {
        matchedSpec = specMap[key];
        break;
      }
    }

    if (matchedSpec) {
      specialization = matchedSpec.name;
      const foundCat = categories.find(c => c.name.toLowerCase() === matchedSpec.catName.toLowerCase());
      if (foundCat) {
        categoryId = foundCat.id;
      }
    } else {
      const categoryKeywords = {
        "Healthcare": ["healthcare", "doctor", "physician", "clinic", "hospital"],
        "Beauty & Wellness": ["beauty", "wellness", "salon", "spa", "grooming", "trainer"],
        "Home Services": ["home service", "repairs", "maintenance"],
        "Business Consulting": ["business", "consulting", "career", "coach"],
        "Education": ["education", "tutor", "teacher", "instructor"]
      };
      
      let matchedCatName = "";
      for (const [catName, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(kw => msg.includes(kw))) {
          matchedCatName = catName;
          break;
        }
      }
      
      if (matchedCatName) {
        const foundCat = categories.find(c => c.name.toLowerCase() === matchedCatName.toLowerCase());
        if (foundCat) {
          categoryId = foundCat.id;
        }
      }
      
      if (!categoryId) {
        for (const cat of categories) {
          if (msg.includes(cat.name.toLowerCase())) {
            categoryId = cat.id;
            break;
          }
        }
      }
    }
  }

  // 2. Detect City/Location
  const commonCities = ["hyderabad", "mumbai", "bangalore", "bengaluru", "delhi", "pune", "chennai", "kolkata", "ahmedabad", "jaipur", "surat", "tamil nadu", "tamil", "telangana", "maharashtra", "karnataka", "gujarat", "west bengal", "rajasthan"];
  for (const city of commonCities) {
    if (msg.includes(city)) {
      if (city === "bangalore") {
        location = "Bengaluru";
      } else if (city === "tamil nadu" || city === "tamil") {
        location = "Chennai";
      } else if (city === "telangana") {
        location = "Hyderabad";
      } else if (city === "maharashtra") {
        location = "Mumbai";
      } else if (city === "karnataka") {
        location = "Bengaluru";
      } else if (city === "gujarat") {
        location = "Ahmedabad";
      } else if (city === "west bengal") {
        location = "Kolkata";
      } else if (city === "rajasthan") {
        location = "Jaipur";
      } else {
        location = city.charAt(0).toUpperCase() + city.slice(1);
      }
      break;
    }
  }

  // Fallback to regex if no common city found
  if (!location) {
    const locationMatch = message.match(/(?:from|in|at|located\s+in|location:?)\s+([a-zA-Z]+)/i);
    if (locationMatch) {
      const loc = locationMatch[1].trim();
      const skipCities = ["doctor", "provider", "dentist", "cardiologist", "today", "tomorrow", "tommorow", "a", "an", "the", "some", "someone", "day", "days", "hospital", "hospitals", "clinic", "clinics"];
      if (!skipCities.includes(loc.toLowerCase())) {
        location = loc.charAt(0).toUpperCase() + loc.slice(1).toLowerCase();
      }
    }
  }

  // 3. Detect Organization
  const orgs = ["apollo", "manipal", "fortis", "max", "care", "elite", "lakme", "lakmé", "learning", "naturals", "techrepair", "tech", "urban"];
  for (const org of orgs) {
    if (msg.includes(org)) {
      orgName = org.charAt(0).toUpperCase() + org.slice(1);
      break;
    }
  }

  // 4. Detect Provider Name
  // Match provider name specified via with/book/for/to phrase
  const namePatterns = [
    /with\s+(?:dr\.)?\s*([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i,
    /book\s+(?:an?\s+appointment\s+with\s+)?(?:dr\.)?\s*([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i,
    /(?:appointment\s+for|appointment\s+with)\s+(?:dr\.)?\s*([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i,
  ];

  for (const pat of namePatterns) {
    const match = message.match(pat);
    if (match) {
      const name = match[1].trim();
      const skipWords = ["appointment", "doctor", "provider", "physician", "dentist", "cardiologist", "today", "tomorrow", "tommorow", "tomorow", "tommorrow", "a", "an", "the", "some", "someone", "from", "on", "in", "at", "for", "june", "july", "august", "september", "rating", "ratings", "star", "stars", "specialist", "specialization", "counselor", "therapist", "psychologist", "dermatologist", "pediatrician", "orthopedist", "clinic", "hospital", "apollo", "manipal", "fortis", "max", "care", "session", "call", "meeting", "consultation", "booking", "schedule"];
      const parts = name.split(/\s+/);
      const cleanParts = [];
      for (const part of parts) {
        if (skipWords.includes(part.toLowerCase())) {
          break;
        }
        cleanParts.push(part);
      }
      const cleanedName = cleanParts.join(" ").trim();
      if (cleanedName.length > 2) {
        providerName = cleanedName;
        break;
      }
    }
  }

  // 5. Detect Rating
  if (msg.includes("4 star") || msg.includes("four star") || msg.includes("4+")) {
    rating = 4;
  } else if (msg.includes("3 star") || msg.includes("three star") || msg.includes("3+")) {
    rating = 3;
  } else if (msg.includes("5 star") || msg.includes("five star") || msg.includes("5+")) {
    rating = 5;
  }

  // 6. Detect Date
  if (msg.includes("today")) {
    dateVal = new Date().toISOString().split("T")[0];
  } else if (msg.includes("tomorrow") || msg.includes("tommorow") || msg.includes("tomorow") || msg.includes("tommorrow")) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateVal = tomorrow.toISOString().split("T")[0];
  } else {
    const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
    const shortMonths = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    for (let mIdx = 0; mIdx < 12; mIdx++) {
      const mName = months[mIdx];
      const mShort = shortMonths[mIdx];
      const pattern1 = new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${mName}|${mShort})`, "i");
      const pattern2 = new RegExp(`(${mName}|${mShort})\\s+(\\d{1,2})(?:st|nd|rd|th)?`, "i");
      const match1 = msg.match(pattern1);
      const match2 = msg.match(pattern2);
      let dayNum = 0;
      if (match1) {
        dayNum = parseInt(match1[1], 10);
      } else if (match2) {
        dayNum = parseInt(match2[2], 10);
      }
      if (dayNum > 0 && dayNum <= 31) {
        const dObj = new Date(2026, mIdx, dayNum);
        const yyyy = dObj.getFullYear();
        const mm = String(dObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dObj.getDate()).padStart(2, '0');
        dateVal = `${yyyy}-${mm}-${dd}`;
        break;
      }
    }
  }

  // 7. Detect Service Type / Offering
  if (msg.includes("extended session") || msg.includes("extended")) {
    serviceType = "Extended Session";
  } else if (msg.includes("intro call") || msg.includes("intro")) {
    serviceType = "Intro Call";
  } else if (msg.includes("standard session") || msg.includes("standard")) {
    serviceType = "Standard Session";
  }

  // 8. Detect Preferred Time Slot
  let preferredSlot = "";
  const timeMatch = msg.match(/\b(\d{1,2}):(\d{2})\b/);
  if (timeMatch) {
    const hh = String(parseInt(timeMatch[1], 10)).padStart(2, '0');
    const mm = timeMatch[2];
    preferredSlot = `${hh}:${mm}`;
  } else {
    const ampmMatch = msg.match(/\b(\d{1,2})\s*(am|pm)\b/i);
    if (ampmMatch) {
      let hhVal = parseInt(ampmMatch[1], 10);
      const isPm = ampmMatch[2].toLowerCase() === "pm";
      if (isPm && hhVal < 12) hhVal += 12;
      if (!isPm && hhVal === 12) hhVal = 0;
      const hh = String(hhVal).padStart(2, '0');
      preferredSlot = `${hh}:00`;
    }
  }

  return { providerName, location, categoryId, rating, orgName, dateVal, serviceType, preferredSlot, specialization };
}

// ── Get Next 7 Days Helper ────────────────────────────────────────────────────
function getNext7Days() {
  const days = [];
  const options = { weekday: "short", month: "short", day: "numeric" };
  for (let i = 1; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push({
      formatted: d.toISOString().split("T")[0],
      display: d.toLocaleDateString("en-US", options),
    });
  }
  return days;
}

export default function SchedullyChatWidget() {
  const { isAuthenticated, role, user } = useSelector((s) => s.auth);
  const canUpload = role === "provider" || role === "admin";
  const lastUserRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("normal"); // "normal" | "rag" | "automate"
  const [normalSessionId, setNormalSessionId] = useState(() => {
    let nId = sessionStorage.getItem("schedully_session_id_normal");
    if (!nId) {
      nId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      sessionStorage.setItem("schedully_session_id_normal", nId);
    }
    return nId;
  });
  const [ragSessionId, setRagSessionId] = useState(() => {
    let rId = sessionStorage.getItem("schedully_session_id_rag");
    if (!rId) {
      rId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      sessionStorage.setItem("schedully_session_id_rag", rId);
    }
    return rId;
  });
  
  const [historyLoadedNormal, setHistoryLoadedNormal] = useState(false);
  const [historyLoadedRag, setHistoryLoadedRag] = useState(false);
  const [normalMessages, setNormalMessages] = useState([]);
  const [ragMessages, setRagMessages] = useState([]);
  
  const [showHistoryList, setShowHistoryList] = useState(false);
  const [sessionList, setSessionList] = useState([]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState([]);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const sessionId = activeTab === "normal" ? normalSessionId : ragSessionId;
  const setSessionId = activeTab === "normal" ? setNormalSessionId : setRagSessionId;

  // ── Automated Flow States ──────────────────────────────────────────────────
  const [currentFlow, setCurrentFlow] = useState(null); // null | 'book' | 'cancel' | 'review' | 'rebook'

  // Booking Flow States
  const [bookStep, setBookStep] = useState(1);
  const [bookProviderName, setBookProviderName] = useState("");
  const [bookLocation, setBookLocation] = useState("");
  const [bookCategoryId, setBookCategoryId] = useState("");
  const [bookRating, setBookRating] = useState(0);
  const [bookOrgName, setBookOrgName] = useState("");

  // Target provider chosen
  const [bookProvider, setBookProvider] = useState(null);
  const [bookDate, setBookDate] = useState("");
  const [bookSlot, setBookSlot] = useState("");
  const [bookNotes, setBookNotes] = useState("");
  const [bookLoading, setBookLoading] = useState(false);
  const [bookError, setBookError] = useState("");
  const [bookSuccessData, setBookSuccessData] = useState(null);
  const [bookOfferings, setBookOfferings] = useState([]);
  const [bookOfferingId, setBookOfferingId] = useState("");
  const [bookOfferingPrice, setBookOfferingPrice] = useState(0);
  const [bookOfferingNamePrompt, setBookOfferingNamePrompt] = useState("");
  const [bookPreferredSlotPrompt, setBookPreferredSlotPrompt] = useState("");
  const [bookSpecializationPrompt, setBookSpecializationPrompt] = useState("");
  const [inlineBookPromptText, setInlineBookPromptText] = useState("");
  const [inlineCancelPromptText, setInlineCancelPromptText] = useState("");
  const [inlineDeactivatePromptText, setInlineDeactivatePromptText] = useState("");
  const [inlineRulePromptText, setInlineRulePromptText] = useState("");

  // Lists loaded for step choices
  const [categoriesList, setCategoriesList] = useState([]);
  const [slotsList, setSlotsList] = useState([]);
  const [nextSlotsList, setNextSlotsList] = useState([]);

  // Cancellation Flow States
  const [cancelStep, setCancelStep] = useState(1);
  const [cancelAppts, setCancelAppts] = useState([]);
  const [selectedCancelAppt, setSelectedCancelAppt] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState("");

  // Review Flow States
  const [reviewStep, setReviewStep] = useState(1);
  const [reviewAppts, setReviewAppts] = useState([]);
  const [selectedReviewAppt, setSelectedReviewAppt] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState("");

  // Rebook Flow States
  const [rebookStep, setRebookStep] = useState(1);
  const [rebookProviders, setRebookProviders] = useState([]);
  const [selectedRebookProviderId, setSelectedRebookProviderId] = useState("");
  const [rebookDate, setRebookDate] = useState("");
  const [rebookSlot, setRebookSlot] = useState("");
  const [rebookNotes, setRebookNotes] = useState("");
  const [rebookSlotsList, setRebookSlotsList] = useState([]);
  const [rebookLoading, setRebookLoading] = useState(false);
  const [rebookError, setRebookError] = useState("");
  const [rebookSuccessData, setRebookSuccessData] = useState(null);

  // Admin Flow States
  const [deactivateStep, setDeactivateStep] = useState(1);
  const [deactivateSearchName, setDeactivateSearchName] = useState("");
  const [deactivateUsers, setDeactivateUsers] = useState([]);
  const [deactivateSelectedUser, setDeactivateSelectedUser] = useState(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [deactivateError, setDeactivateError] = useState("");

  const [ruleStep, setRuleStep] = useState(1);
  const [ruleName, setRuleName] = useState("");
  const [ruleDescription, setRuleDescription] = useState("");
  const [ruleTrigger, setRuleTrigger] = useState("appointment_scheduled");
  const [ruleLoading, setRuleLoading] = useState(false);
  const [ruleError, setRuleError] = useState("");

  // Universal Navigation & Exclusion States
  const [stepHistory, setStepHistory] = useState([]);
  const [locallyCancelledApptIds, setLocallyCancelledApptIds] = useState([]);

  // Reset session on login changes
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      if (lastUserRef.current !== user.id) {
        sessionStorage.removeItem("schedully_session_id_normal");
        sessionStorage.removeItem("schedully_session_id_rag");

        const initialNormal = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const initialRag = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

        sessionStorage.setItem("schedully_session_id_normal", initialNormal);
        sessionStorage.setItem("schedully_session_id_rag", initialRag);

        setNormalSessionId(initialNormal);
        setRagSessionId(initialRag);

        setNormalMessages([getWelcomeMessage(role, "normal")]);
        setRagMessages([getWelcomeMessage(role, "rag")]);
        
        setHistoryLoadedNormal(false);
        setHistoryLoadedRag(false);

        lastUserRef.current = user.id;
      }
    } else if (!isAuthenticated) {
      lastUserRef.current = null;
    }
  }, [isAuthenticated, user, role]);

  useEffect(() => {
    if (isAuthenticated && ["provider", "admin", "customer"].includes(role)) {
      setNormalMessages([getWelcomeMessage(role, "normal")]);
      setRagMessages([getWelcomeMessage(role, "rag")]);
      setHistoryLoadedNormal(false);
      setHistoryLoadedRag(false);
    }
  }, [role, isAuthenticated]);

  const fetchSessionList = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await api.get("/api/schedully/sessions", { params: { mode: activeTab } });
      setSessionList(res.data?.data?.sessions || []);
    } catch (err) {
      console.error("Failed to load session list", err);
    }
  }, [activeTab, isAuthenticated]);

  useEffect(() => {
    if (showHistoryList && open) {
      fetchSessionList();
    }
  }, [showHistoryList, activeTab, open, fetchSessionList]);

  const fetchUploadedDocs = useCallback(async () => {
    if (!isAuthenticated || !canUpload) return;
    try {
      const res = await api.get("/api/schedully/kb/list");
      setUploadedDocs(res.data?.data?.documents || []);
    } catch (err) {
      console.error("Failed to load uploaded documents", err);
    }
  }, [isAuthenticated, canUpload]);

  useEffect(() => {
    if ((showUploadPanel || activeTab === "rag") && open) {
      fetchUploadedDocs();
    }
  }, [showUploadPanel, activeTab, open, fetchUploadedDocs]);

  const startNewChat = () => {
    const newSid = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const KEY = `schedully_session_id_${activeTab}`;
    sessionStorage.setItem(KEY, newSid);
    setSessionId(newSid);

    const welcome = getWelcomeMessage(role, activeTab);
    if (activeTab === "normal") {
      setNormalMessages([welcome]);
      setHistoryLoadedNormal(true);
    } else {
      setRagMessages([welcome]);
      setHistoryLoadedRag(true);
    }
    setShowHistoryList(false);
  };

  const loadPreviousSession = (selectedSid) => {
    const KEY = `schedully_session_id_${activeTab}`;
    sessionStorage.setItem(KEY, selectedSid);
    setSessionId(selectedSid);

    api.get("/api/schedully/history", { params: { session_id: selectedSid, mode: activeTab } })
      .then((res) => {
        const turns = res.data?.data?.turns || [];
        const restored = turns.map((t, i) => ({
          id:      `history_${activeTab}_${i}`,
          role:    t.role,
          text:    t.content,
          sources: [],
        }));
        const welcome = getWelcomeMessage(role, activeTab);
        if (activeTab === "normal") {
          setNormalMessages([welcome, ...restored]);
          setHistoryLoadedNormal(true);
        } else {
          setRagMessages([welcome, ...restored]);
          setHistoryLoadedRag(true);
        }
      })
      .catch(() => {});

    setShowHistoryList(false);
  };

  useEffect(() => {
    if (!open || !sessionId || !isAuthenticated) return;

    if (activeTab === "normal" && !historyLoadedNormal) {
      setHistoryLoadedNormal(true);
      api.get("/api/schedully/history", { params: { session_id: sessionId, mode: "normal" } })
        .then((res) => {
          const turns = res.data?.data?.turns || [];
          if (turns.length === 0) return;
          const restored = turns.map((t, i) => ({
            id:      `history_normal_${i}`,
            role:    t.role,
            text:    t.content,
            sources: [],
          }));
          setNormalMessages([getWelcomeMessage(role, "normal"), ...restored]);
        })
        .catch(() => {});
    } else if (activeTab === "rag" && !historyLoadedRag && canUpload) {
      setHistoryLoadedRag(true);
      api.get("/api/schedully/history", { params: { session_id: sessionId, mode: "rag" } })
        .then((res) => {
          const turns = res.data?.data?.turns || [];
          if (turns.length === 0) return;
          const restored = turns.map((t, i) => ({
            id:      `history_rag_${i}`,
            role:    t.role,
            text:    t.content,
            sources: [],
          }));
          setRagMessages([getWelcomeMessage(role, "rag"), ...restored]);
        })
        .catch(() => {});
    }
  }, [open, activeTab, historyLoadedNormal, historyLoadedRag, sessionId, role, isAuthenticated, canUpload]);

  const messages = activeTab === "normal" ? normalMessages : ragMessages;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, currentFlow, bookStep, cancelStep, reviewStep, rebookStep]);

  // ── Flow Actions & Inits ────────────────────────────────────────────────────
  const startBookingFlow = async () => {
    setCurrentFlow("book");
    setBookStep(1);
    setStepHistory([]);
    setBookError("");
    setBookProviderName("");
    setBookLocation("");
    setBookCategoryId("");
    setBookRating(0);
    setBookOrgName("");
    setBookProvider(null);
    setBookDate("");
    setBookSlot("");
    setBookNotes("");
    setBookSuccessData(null);
    setBookOfferings([]);
    setBookOfferingId("");
    setBookOfferingPrice(0);
    setBookOfferingNamePrompt("");
    setBookPreferredSlotPrompt("");
    setBookSpecializationPrompt("");
    setBookLoading(true);

    try {
      const catRes = await api.get("/api/categories");
      setCategoriesList(catRes.data?.data?.categories || []);
    } catch (err) {
      setBookError("Failed to initialize booking metadata. Please try again.");
    } finally {
      setBookLoading(false);
    }
  };

  const resolveSelectedProvider = async (chosenDate, overrides = {}) => {
    setBookLoading(true);
    setBookError("");
    setBookDate(chosenDate);

    const providerNameVal = overrides.providerName !== undefined ? overrides.providerName : bookProviderName;
    const orgNameVal = overrides.orgName !== undefined ? overrides.orgName : bookOrgName;
    const locationVal = overrides.location !== undefined ? overrides.location : bookLocation;
    const categoryIdVal = overrides.categoryId !== undefined ? overrides.categoryId : bookCategoryId;
    const ratingVal = overrides.rating !== undefined ? overrides.rating : bookRating;
    const offeringNamePromptVal = overrides.serviceType !== undefined ? overrides.serviceType : bookOfferingNamePrompt;
    const preferredSlotPromptVal = overrides.preferredSlot !== undefined ? overrides.preferredSlot : bookPreferredSlotPrompt;
    const specializationVal = overrides.specialization !== undefined ? overrides.specialization : bookSpecializationPrompt;

    let searchTokens = [];
    if (providerNameVal.trim()) searchTokens.push(providerNameVal.trim());
    if (orgNameVal.trim()) searchTokens.push(orgNameVal.trim());
    if (specializationVal.trim()) searchTokens.push(specializationVal.trim());
    const searchString = searchTokens.join(" ");

    const queryParams = {
      limit: 50,
      page: 1
    };
    if (searchString) queryParams.search = searchString;
    if (locationVal.trim()) queryParams.location = locationVal.trim();
    if (categoryIdVal) queryParams.category_id = parseInt(categoryIdVal, 10);
    if (ratingVal) queryParams.min_rating = parseFloat(ratingVal);

    try {
      const res = await api.get("/api/customer/providers", { params: queryParams });
      const provs = res.data?.data?.providers || [];
      if (provs.length === 0) {
        setBookError("No providers found matching your filter criteria. Please try again with wider options.");
        setBookStep(1);
        return;
      }

      const selectedProv = provs[0];
      setBookProvider(selectedProv);

      // Fetch provider offerings config
      let offerings = [];
      try {
        const configRes = await api.get(`/api/customer/providers/${selectedProv.id}/booking-config`);
        offerings = configRes.data?.data?.offerings || [];
        setBookOfferings(offerings);
      } catch (errConfig) {
        console.error("Failed to load booking config", errConfig);
      }

      // Auto-select offering based on parsed serviceType prompt
      if (offerings.length > 0) {
        let matched = null;
        if (offeringNamePromptVal) {
          matched = offerings.find(o => o.title.toLowerCase().includes(offeringNamePromptVal.toLowerCase()));
        }
        if (matched) {
          setBookOfferingId(matched.id);
          setBookOfferingPrice(matched.price);
        } else {
          // Default to Standard Session or first active offering
          const standard = offerings.find(o => o.title.toLowerCase().includes("standard"));
          if (standard) {
            setBookOfferingId(standard.id);
            setBookOfferingPrice(standard.price);
          } else {
            setBookOfferingId(offerings[0].id);
            setBookOfferingPrice(offerings[0].price);
          }
        }
      }

      const slotsRes = await api.get(`/api/customer/providers/${selectedProv.id}/slots`, {
        params: { date: chosenDate }
      });
      const slots = slotsRes.data?.data?.available_slots || [];
      setSlotsList(slots);

      let slotMatched = false;
      if (preferredSlotPromptVal && slots.length > 0) {
        const matchedSlot = slots.find(s => s.time_slot.includes(preferredSlotPromptVal) || preferredSlotPromptVal.includes(s.time_slot));
        if (matchedSlot) {
          setBookSlot(matchedSlot.time_slot);
          slotMatched = true;
        }
      }

      if (slotMatched) {
        setStepHistory((prev) => {
          if (bookStep !== 9 && prev[prev.length - 1] !== bookStep) {
            return [...prev, bookStep];
          }
          return prev;
        });
        setBookStep(9);
      } else {
        if (bookPreferredSlotPrompt && slots.length > 0) {
          setBookError(`The slot "${bookPreferredSlotPrompt}" is not available on ${chosenDate}. Please choose another slot.`);
        }
        setStepHistory((prev) => {
          if (bookStep !== 7 && prev[prev.length - 1] !== bookStep) {
            return [...prev, bookStep];
          }
          return prev;
        });
        setBookStep(7);
      }
    } catch (err) {
      setBookError("Failed to query slot configuration for this provider.");
    } finally {
      setBookLoading(false);
    }
  };

  const handleFindNextAvailableSlots = async () => {
    if (!bookProvider || !bookDate) return;
    setBookLoading(true);
    setBookError("");
    const nextSlots = [];
    let currentDate = new Date(bookDate);

    try {
      for (let i = 1; i <= 10; i++) {
        currentDate.setDate(currentDate.getDate() + 1);
        const dateStr = currentDate.toISOString().split("T")[0];
        const res = await api.get(`/api/customer/providers/${bookProvider.id}/slots`, {
          params: { date: dateStr }
        });
        const slots = res.data?.data?.available_slots || [];
        for (const slot of slots) {
          nextSlots.push({ date: dateStr, time: slot.time_slot });
          if (nextSlots.length >= 3) break;
        }
        if (nextSlots.length >= 3) break;
      }
      setNextSlotsList(nextSlots);
      setStepHistory((prev) => [...prev, bookStep]);
      setBookStep(8);
    } catch (err) {
      setBookError("Failed to look up next available free slots.");
    } finally {
      setBookLoading(false);
    }
  };

  const handleJoinWaitlist = async () => {
    if (!bookProvider || !bookDate) return;
    setBookLoading(true);
    setBookError("");
    try {
      const res = await api.post(`/api/customer/providers/${bookProvider.id}/waitlist`, {
        preferred_date: bookDate
      });
      setBookSuccessData({
        type: "waitlist",
        waitlist_entry: res.data?.data
      });
      setStepHistory((prev) => [...prev, bookStep]);
      setBookStep(10);
    } catch (err) {
      setBookError(err.response?.data?.message || "Failed to join waitlist.");
    } finally {
      setBookLoading(false);
    }
  };

  const submitBooking = async (isRebook = false) => {
    const loadingSetter = isRebook ? setRebookLoading : setBookLoading;
    const errorSetter = isRebook ? setRebookError : setBookError;
    const provId = isRebook ? selectedRebookProviderId : bookProvider?.id;
    const dateVal = isRebook ? rebookDate : bookDate;
    const slotVal = isRebook ? rebookSlot : bookSlot;
    const notesVal = isRebook ? rebookNotes : bookNotes;
    const catId = isRebook ? null : bookCategoryId;

    loadingSetter(true);
    errorSetter("");

    try {
      const res = await api.post("/api/customer/book-or-join-waitlist", {
        provider_id: provId,
        appointment_date: dateVal,
        time_slot: slotVal,
        category_id: catId ? parseInt(catId, 10) : null,
        notes: notesVal,
        offering_id: isRebook ? null : (bookOfferingId || null)
      });

      if (isRebook) {
        setRebookSuccessData(res.data?.data);
        setStepHistory((prev) => [...prev, rebookStep]);
        setRebookStep(5);
      } else {
        setBookSuccessData(res.data?.data);
        setStepHistory((prev) => [...prev, bookStep]);
        setBookStep(10);
      }
    } catch (err) {
      errorSetter(err.response?.data?.message || "Booking failed. Slot may have been taken.");
    } finally {
      loadingSetter(false);
    }
  };

  const startCancellationFlow = async () => {
    setCurrentFlow("cancel");
    setCancelStep(1);
    setStepHistory([]);
    setCancelError("");
    setCancelReason("");
    setSelectedCancelAppt(null);
    setCancelLoading(true);

    try {
      const res = await api.get("/api/customer/appointments", { params: { limit: 100 } });
      const active = (res.data?.data?.appointments || []).filter(
        a => (a.status === "pending" || a.status === "confirmed") && !locallyCancelledApptIds.includes(a.id)
      );
      setCancelAppts(active);
    } catch (err) {
      setCancelError("Failed to fetch your upcoming appointments.");
    } finally {
      setCancelLoading(false);
    }
  };

  const submitCancellation = async () => {
    if (!selectedCancelAppt) return;
    setCancelLoading(true);
    setCancelError("");
    try {
      await api.patch(`/api/customer/appointments/${selectedCancelAppt.id}/cancel`, {
        cancellation_reason: cancelReason || "Cancelled via chat automation assistant"
      });
      setLocallyCancelledApptIds((prev) => [...prev, selectedCancelAppt.id]);
      setCancelAppts((prev) => prev.filter((a) => a.id !== selectedCancelAppt.id));
      setStepHistory((prev) => [...prev, cancelStep]);
      setCancelStep(3);
    } catch (err) {
      setCancelError(err.response?.data?.message || "Failed to cancel appointment.");
    } finally {
      setCancelLoading(false);
    }
  };

  const startReviewFlow = async () => {
    setCurrentFlow("review");
    setReviewStep(1);
    setStepHistory([]);
    setReviewError("");
    setReviewComment("");
    setReviewRating(5);
    setSelectedReviewAppt(null);
    setReviewLoading(true);

    try {
      const res = await api.get("/api/customer/reviews");
      setReviewAppts(res.data?.data?.pending || []);
    } catch (err) {
      setReviewError("Failed to load appointments pending reviews.");
    } finally {
      setReviewLoading(false);
    }
  };

  const submitReview = async () => {
    if (!selectedReviewAppt) return;
    setReviewLoading(true);
    setReviewError("");
    try {
      await api.post(`/api/customer/appointments/${selectedReviewAppt.appointment_id}/review`, {
        rating: reviewRating,
        comment: reviewComment
      });
      setReviewAppts((prev) => prev.filter((a) => a.appointment_id !== selectedReviewAppt.appointment_id));
      setStepHistory((prev) => [...prev, reviewStep]);
      setReviewStep(3);
    } catch (err) {
      setReviewError(err.response?.data?.message || "Failed to submit review.");
    } finally {
      setReviewLoading(false);
    }
  };

  const startRebookingFlow = async () => {
    setCurrentFlow("rebook");
    setRebookStep(1);
    setStepHistory([]);
    setRebookError("");
    setRebookDate("");
    setRebookSlot("");
    setRebookNotes("");
    setSelectedRebookProviderId("");
    setRebookSuccessData(null);
    setRebookLoading(true);

    try {
      const res = await api.get("/api/customer/appointments", { params: { limit: 100 } });
      const list = res.data?.data?.appointments || [];
      const provsMap = {};
      list.forEach(a => {
        if (a.provider) {
          provsMap[a.provider.id] = {
            id: a.provider.id,
            name: a.provider.user?.full_name || "Provider",
            specialization: a.provider.specialization || "Expert"
          };
        }
      });
      setRebookProviders(Object.values(provsMap));
    } catch (err) {
      setRebookError("Failed to fetch past providers.");
    } finally {
      setRebookLoading(false);
    }
  };

  const handleRebookProviderSelect = (pId) => {
    setStepHistory((prev) => [...prev, rebookStep]);
    setSelectedRebookProviderId(pId);
    setRebookStep(2);
  };

  const handleDateSelect = async (chosenDate, isRebook = true) => {
    if (isRebook) {
      setRebookLoading(true);
      setRebookError("");
      setRebookDate(chosenDate);
      try {
        const slotsRes = await api.get(`/api/customer/providers/${selectedRebookProviderId}/slots`, {
          params: { date: chosenDate }
        });
        const slots = slotsRes.data?.data?.available_slots || [];
        setRebookSlotsList(slots);
        setStepHistory((prev) => [...prev, rebookStep]);
        setRebookStep(3);
      } catch (err) {
        setRebookError("Failed to query slot configuration for this provider.");
      } finally {
        setRebookLoading(false);
      }
    }
  };

  const navigateToNextBookStep = (current) => {
    let next = current + 1;
    if (bookProviderName.trim()) {
      if (next < 6) next = 6;
    } else {
      if (next === 2 && bookLocation.trim()) {
        next = 3;
      }
      if (next === 3 && bookCategoryId) {
        next = 4;
      }
      if (next === 4 && bookRating) {
        next = 5;
      }
      if (next === 5 && bookOrgName.trim()) {
        next = 6;
      }
    }
    
    setStepHistory((prev) => [...prev, current]);
    if (next === 6 && bookDate) {
      resolveSelectedProvider(bookDate);
    } else {
      setBookStep(next);
    }
  };

  const handleInlineBookPrompt = async (text) => {
    let cats = categoriesList;
    if (cats.length === 0) {
      try {
        const catRes = await api.get("/api/categories");
        cats = catRes.data?.data?.categories || [];
        setCategoriesList(cats);
      } catch (e) {}
    }
    const parsed = parseBookingPrompt(text, cats);
    setBookProviderName(parsed.providerName);
    setBookLocation(parsed.location);
    setBookCategoryId(parsed.categoryId);
    setBookRating(parsed.rating);
    setBookOrgName(parsed.orgName);
    setBookDate(parsed.dateVal);
    setBookOfferingNamePrompt(parsed.serviceType || "");
    setBookPreferredSlotPrompt(parsed.preferredSlot || "");
    setBookSpecializationPrompt(parsed.specialization || "");
    setBookNotes("");
    setBookError("");
    setBookSuccessData(null);

    let targetStep = 1;
    let historyArray = [];
    if (parsed.providerName) {
      targetStep = 6;
      historyArray = [1];
    } else {
      if (!parsed.location) {
        targetStep = 2;
        historyArray = [1];
      } else if (!parsed.categoryId) {
        targetStep = 3;
        historyArray = [1, 2];
      } else if (!parsed.rating) {
        targetStep = 4;
        historyArray = [1, 2, 3];
      } else if (!parsed.orgName) {
        targetStep = 5;
        historyArray = [1, 2, 3, 4];
      } else {
        targetStep = 6;
        historyArray = [1, 2, 3, 4, 5];
      }
    }

    const allFiltersProvided = parsed.providerName || (parsed.location && parsed.categoryId && parsed.rating && parsed.orgName);

    if (parsed.dateVal && allFiltersProvided) {
      setStepHistory(historyArray);
      setBookStep(7);
      resolveSelectedProvider(parsed.dateVal, parsed);
    } else {
      setStepHistory(historyArray);
      setBookStep(targetStep);
    }
  };

  const handleInlineCancelPrompt = (text) => {
    const lowerText = text.toLowerCase();
    let matchedAppt = null;
    for (const appt of cancelAppts) {
      const provName = appt.provider?.user?.full_name?.toLowerCase() || "";
      if (provName && lowerText.includes(provName)) {
        matchedAppt = appt;
        break;
      }
    }
    if (matchedAppt) {
      setSelectedCancelAppt(matchedAppt);
      setStepHistory([1]);
      setCancelStep(2);
    } else {
      setCancelError("No matching upcoming appointment found for this provider name.");
    }
  };

  const startDeactivateFlow = () => {
    setCurrentFlow("deactivate");
    setDeactivateStep(1);
    setStepHistory([]);
    setDeactivateSearchName("");
    setDeactivateUsers([]);
    setDeactivateSelectedUser(null);
    setDeactivateLoading(false);
    setDeactivateError("");
    setInlineDeactivatePromptText("");
  };

  const handleDeactivateSearch = async (name) => {
    if (!name || !name.trim()) return;
    setDeactivateLoading(true);
    setDeactivateError("");
    setDeactivateSearchName(name);
    try {
      const res = await api.get("/api/admin/users", { params: { search: name.trim(), limit: 50 } });
      const users = (res.data?.data?.users || []).filter(
        u => (u.role === "customer" || u.role === "provider")
      );
      setDeactivateUsers(users);
      if (users.length === 0) {
        setDeactivateError(`No customer or provider account found with name "${name}".`);
      } else if (users.length === 1) {
        setDeactivateSelectedUser(users[0]);
        setStepHistory((prev) => [...prev, deactivateStep]);
        setDeactivateStep(3);
      } else {
        setStepHistory((prev) => [...prev, deactivateStep]);
        setDeactivateStep(2);
      }
    } catch (err) {
      setDeactivateError("Failed to fetch user accounts.");
    } finally {
      setDeactivateLoading(false);
    }
  };

  const submitDeactivation = async () => {
    if (!deactivateSelectedUser) return;
    setDeactivateLoading(true);
    setDeactivateError("");
    try {
      await api.patch(`/api/admin/users/${deactivateSelectedUser.id}/status`, {
        is_active: false
      });
      setStepHistory((prev) => [...prev, deactivateStep]);
      setDeactivateStep(4);
    } catch (err) {
      setDeactivateError(err.response?.data?.message || "Failed to deactivate account.");
    } finally {
      setDeactivateLoading(false);
    }
  };

  const startRuleFlow = () => {
    setCurrentFlow("create_rule");
    setRuleStep(1);
    setStepHistory([]);
    setRuleName("");
    setRuleDescription("");
    setRuleTrigger("appointment_scheduled");
    setRuleLoading(false);
    setRuleError("");
    setInlineRulePromptText("");
  };

  const handleInlineDeactivatePrompt = (promptVal) => {
    if (!promptVal || !promptVal.trim()) return;
    const match = promptVal.match(/deactivate\s+(?:the\s+account\s+of\s+|account\s+of\s+)?([a-zA-Z\s0-9_.-]+)/i);
    if (match) {
      handleDeactivateSearch(match[1].trim());
    } else {
      handleDeactivateSearch(promptVal);
    }
  };

  const handleInlineRulePrompt = (promptVal) => {
    if (!promptVal || !promptVal.trim()) return;
    
    const mapTriggerToEvent = (tTxt) => {
      if (!tTxt) return null;
      const clean = tTxt.toLowerCase().trim();
      if (clean.includes("appointment") && (clean.includes("schedul") || clean.includes("booking"))) {
        return "appointment_scheduled";
      }
      if (clean.includes("appointment") && (clean.includes("cancel") || clean.includes("delet"))) {
        return "appointment_cancelled";
      }
      if (clean.includes("provider") && (clean.includes("regist") || clean.includes("signup"))) {
        return "provider_registered";
      }
      if (clean.includes("slot") && (clean.includes("releas") || clean.includes("free"))) {
        return "slot_released";
      }
      if (clean.includes("payment") && (clean.includes("fail") || clean.includes("declin"))) {
        return "payment_failed";
      }
      if (clean.includes("schedul") || clean.includes("booking")) return "appointment_scheduled";
      if (clean.includes("cancel") || clean.includes("delet")) return "appointment_cancelled";
      if (clean.includes("regist") || clean.includes("signup")) return "provider_registered";
      if (clean.includes("releas") || clean.includes("free")) return "slot_released";
      if (clean.includes("fail") || clean.includes("declin")) return "payment_failed";
      return null;
    };

    const ruleMatch = promptVal.match(/(?:create\s+a\s+rule\s+called|create\s+rule\s+called|create\s+rule|create\s+a\s+rule|new\s+rule)\s+([a-zA-Z\s0-9_.-]+?)(?:\s+(?:triggered\s+on|triggered\s+by|triggers?\s+on|triggering\s+on|trigger\s+on|on))\s+([a-zA-Z\s0-9_.-]+)?$/i)
                      || promptVal.match(/(?:create\s+rule|create\s+a\s+rule|new\s+rule)\s*(.*)/i);
    
    if (ruleMatch) {
      let rName = "";
      let triggerText = "";
      if (ruleMatch[2]) {
        rName = ruleMatch[1].trim();
        triggerText = ruleMatch[2].trim();
      } else {
        rName = ruleMatch[1].trim();
      }

      if (rName) {
        setRuleName(rName);
        setStepHistory((prev) => [...prev, ruleStep]);
        setRuleStep(2);
      }
      if (triggerText) {
        const mapped = mapTriggerToEvent(triggerText);
        if (mapped) {
          setRuleTrigger(mapped);
        } else {
          setRuleError(`Invalid trigger event: "${triggerText}". Allowed trigger events are: Appointment Scheduled, Appointment Cancelled, Provider Registered, Slot Released, Payment Failed.`);
        }
      }
    } else {
      setRuleName(promptVal);
      setStepHistory((prev) => [...prev, ruleStep]);
      setRuleStep(2);
    }
  };

  const submitRule = () => {
    if (!ruleName.trim()) {
      setRuleError("Rule name is required.");
      return;
    }
    setRuleLoading(true);
    setTimeout(() => {
      import("react-hot-toast").then((m) => {
        m.default.success("Rule created");
      }).catch(() => {});
      setRuleLoading(false);
      setStepHistory((prev) => [...prev, ruleStep]);
      setRuleStep(4);
    }, 1000);
  };

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    const lowerText = text.toLowerCase();

    // Admin Intent: Deactivate
    if (role === "admin" && activeTab === "normal") {
      const deactivateMatch = text.match(/deactivate\s+(?:the\s+account\s+of\s+|account\s+of\s+)?([a-zA-Z\s0-9_.-]+)/i);
      if (deactivateMatch) {
        const nameToDeactivate = deactivateMatch[1].trim();
        setActiveTab("automate");
        startDeactivateFlow();
        handleDeactivateSearch(nameToDeactivate);
        setInput("");
        return;
      }
    }

    // Admin Intent: Create Rule
    if (role === "admin" && activeTab === "normal") {
      const mapTriggerToEvent = (tTxt) => {
        if (!tTxt) return null;
        const clean = tTxt.toLowerCase().trim();
        if (clean.includes("appointment") && (clean.includes("schedul") || clean.includes("booking"))) {
          return "appointment_scheduled";
        }
        if (clean.includes("appointment") && (clean.includes("cancel") || clean.includes("delet"))) {
          return "appointment_cancelled";
        }
        if (clean.includes("provider") && (clean.includes("regist") || clean.includes("signup"))) {
          return "provider_registered";
        }
        if (clean.includes("slot") && (clean.includes("releas") || clean.includes("free"))) {
          return "slot_released";
        }
        if (clean.includes("payment") && (clean.includes("fail") || clean.includes("declin"))) {
          return "payment_failed";
        }
        if (clean.includes("schedul") || clean.includes("booking")) return "appointment_scheduled";
        if (clean.includes("cancel") || clean.includes("delet")) return "appointment_cancelled";
        if (clean.includes("regist") || clean.includes("signup")) return "provider_registered";
        if (clean.includes("releas") || clean.includes("free")) return "slot_released";
        if (clean.includes("fail") || clean.includes("declin")) return "payment_failed";
        return null;
      };

      const ruleMatch = text.match(/(?:create\s+a\s+rule\s+called|create\s+rule\s+called|create\s+rule|create\s+a\s+rule|new\s+rule)\s+([a-zA-Z\s0-9_.-]+?)(?:\s+(?:triggered\s+on|triggered\s+by|triggers?\s+on|triggering\s+on|trigger\s+on|on))\s+([a-zA-Z\s0-9_.-]+)?$/i)
                        || text.match(/(?:create\s+rule|create\s+a\s+rule|new\s+rule)\s*(.*)/i);
      
      if (ruleMatch) {
        let rName = "";
        let triggerText = "";
        if (ruleMatch[2]) {
          rName = ruleMatch[1].trim();
          triggerText = ruleMatch[2].trim();
        } else {
          rName = ruleMatch[1].trim();
        }

        setActiveTab("automate");
        startRuleFlow();
        if (rName) {
          setRuleName(rName);
          setRuleStep(2); // Ask for description
        }
        if (triggerText) {
          const mapped = mapTriggerToEvent(triggerText);
          if (mapped) {
            setRuleTrigger(mapped);
          } else {
            setRuleError(`Invalid trigger event: "${triggerText}". Allowed trigger events are: Appointment Scheduled, Appointment Cancelled, Provider Registered, Slot Released, Payment Failed.`);
          }
        }
        setInput("");
        return;
      }
    }

    // 1. Rebook Intent
    const isRebookIntent = activeTab === "normal" && /\b(rebook|re-book|book again|schedule again)\b/i.test(text);
    if (isRebookIntent) {
      setActiveTab("automate");
      startRebookingFlow();
      setInput("");
      return;
    }

    // 2. Review Intent
    const isReviewIntent = activeTab === "normal" && /\b(review|rate|feedback|give star|stars)\b/i.test(text);
    if (isReviewIntent) {
      setActiveTab("automate");
      startReviewFlow();
      setInput("");
      return;
    }

    // 3. Cancel Intent
    const isCancelIntent = activeTab === "normal" && /\b(cancel|cancellation|delete booking|remove booking)\b/i.test(text);
    if (isCancelIntent) {
      setActiveTab("automate");
      setCurrentFlow("cancel");
      setCancelStep(1);
      setStepHistory([]);
      setCancelError("");
      setCancelReason("");
      setSelectedCancelAppt(null);
      setCancelLoading(true);

      try {
        const res = await api.get("/api/customer/appointments", { params: { limit: 100 } });
        const active = (res.data?.data?.appointments || []).filter(
          a => (a.status === "pending" || a.status === "confirmed") && !locallyCancelledApptIds.includes(a.id)
        );
        setCancelAppts(active);

        let matchedAppt = null;
        for (const appt of active) {
          const provName = appt.provider?.user?.full_name?.toLowerCase() || "";
          if (provName && lowerText.includes(provName)) {
            matchedAppt = appt;
            break;
          }
        }
        if (matchedAppt) {
          setSelectedCancelAppt(matchedAppt);
          setStepHistory([1]);
          setCancelStep(2);
        }
      } catch (err) {
        setCancelError("Failed to fetch your upcoming appointments.");
      } finally {
        setCancelLoading(false);
      }
      
      setInput("");
      return;
    }

    // 4. Natural Language NLP Parsing for booking intent
    const isBookingIntent = activeTab === "normal" && /\b(book|appointment|reserve|slot|schedule)\b/i.test(text);


    const userMsg = { id: `u_${Date.now()}`, role: "user", text, sources: [] };
    if (activeTab === "normal") {
      setNormalMessages((prev) => [...prev, userMsg]);
    } else {
      setRagMessages((prev) => [...prev, userMsg]);
    }

    setInput("");
    setLoading(true);
    try {
      const res = await api.post("/api/schedully/chat", {
        message:    text,
        session_id: sessionId,
        mode:       activeTab,
      });
      const data = res.data?.data;
      const assistantMsg = {
        id:           `a_${Date.now()}`,
        role:         "assistant",
        text:         data?.answer || "No response received.",
        sources:      data?.sources || [],
        intent:       data?.intent,
        verification: data?.verification,
        bookingPromptText: isBookingIntent ? text : null,
      };
      if (activeTab === "normal") {
        setNormalMessages((prev) => [...prev, assistantMsg]);
      } else {
        setRagMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (err) {
      const errMsg = {
        id:      `err_${Date.now()}`,
        role:    "error",
        text:    err.response?.data?.message || "Something went wrong. Please try again.",
        sources: [],
      };
      if (activeTab === "normal") {
        setNormalMessages((prev) => [...prev, errMsg]);
      } else {
        setRagMessages((prev) => [...prev, errMsg]);
      }
    } finally {
      setLoading(false);
    }
  }, [input, loading, sessionId, activeTab, categoriesList]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // ── Universal Step Back Handler ───────────────────────────────────────────
  const handleFlowBack = () => {
    if (stepHistory.length > 0) {
      const prevStep = stepHistory[stepHistory.length - 1];
      setStepHistory((prev) => prev.slice(0, -1));
      if (currentFlow === "book") setBookStep(prevStep);
      else if (currentFlow === "cancel") setCancelStep(prevStep);
      else if (currentFlow === "review") setReviewStep(prevStep);
      else if (currentFlow === "rebook") setRebookStep(prevStep);
      else if (currentFlow === "deactivate") setDeactivateStep(prevStep);
      else if (currentFlow === "create_rule") setRuleStep(prevStep);
    } else {
      setCurrentFlow(null);
    }
  };

  const handleFileUpload = async (file) => {
    if (!file || !canUpload) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["pdf", "docx", "xlsx", "md", "txt"].includes(ext)) {
      setUploadMessage("Only .pdf, .docx, .xlsx, .md, and .txt files are allowed.");
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
      setUploadMessage(
        d?.chunks_added > 0
          ? `✓ Ingested ${file.name} (${d.chunks_added} chunks added)`
          : d?.message || `✓ ${file.name} processed`
      );
      setUploadStatus("success");
      fetchUploadedDocs();
      setRagMessages((prev) => [...prev, {
        id:      `upload_${Date.now()}`,
        role:    "assistant",
        text:    `I've indexed **${file.name}**. You can now ask me questions about it on this RAG Document QA tab.`,
        sources: [],
      }]);
    } catch (err) {
      setUploadMessage(err.response?.data?.message || "Upload failed.");
      setUploadStatus("error");
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (canUpload && activeTab === "rag") handleFileUpload(e.dataTransfer.files?.[0]);
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Collapse Schedully assistant" : "Expand Schedully assistant"}
        className={`fixed top-1/2 transform -translate-y-1/2 z-50 w-8 h-20 rounded-l-xl
                   bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition-all duration-300
                   flex items-center justify-center focus:outline-none focus:ring-2
                   focus:ring-blue-400 focus:ring-offset-2 ${
                     open ? "right-[480px]" : "right-0"
                   }`}
        style={{ boxShadow: "-4px 0 16px rgba(0,0,0,0.1)" }}
      >
        {open ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>

      <div
        className={`relative border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 transition-all duration-300 flex flex-col overflow-hidden shrink-0 sticky top-16 ${
          open ? "w-[480px]" : "w-0 border-l-0"
        }`}
        style={{ height: "calc(100vh - 4rem)" }}
        role="dialog"
        aria-label="Schedully AI assistant"
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); if (canUpload && activeTab === "rag") setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
      >
          {/* Drag-and-drop overlay */}
          {isDragOver && canUpload && (
            <div
              className="absolute inset-0 z-10 bg-blue-600/20 border-2 border-dashed
                         border-blue-500 rounded-none flex items-center justify-center
                         pointer-events-none"
            >
              <p className="text-blue-700 dark:text-blue-300 font-semibold text-sm">
                Drop PDF, DOCX, XLSX, MD, or TXT to ingest
              </p>
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white rounded-none shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="font-semibold text-sm">Schedully Helper</span>
            </div>
            
            <div className="flex items-center gap-2">
              {activeTab !== "automate" && (
                <button
                  onClick={() => setShowHistoryList((v) => !v)}
                  aria-label="Toggle chat history"
                  className={`p-1.5 rounded hover:bg-blue-500 transition-colors ${showHistoryList ? "bg-blue-500" : ""}`}
                  title="View previous chats"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              )}

              {activeTab !== "automate" && (
                <button
                  onClick={startNewChat}
                  aria-label="Start new chat"
                  className="p-1.5 rounded hover:bg-blue-500 transition-colors"
                  title="Start a new chat session"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              )}

              {canUpload && activeTab === "rag" && (
                <button
                  onClick={() => setShowUploadPanel((v) => !v)}
                  aria-label="Toggle upload panel"
                  className="p-1.5 rounded hover:bg-blue-500 transition-colors"
                  title="Upload a report or document"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          {(canUpload || role === "customer") && (
            <div className="flex border-b border-gray-200 dark:border-gray-700 shrink-0 bg-gray-50 dark:bg-gray-800">
              <button
                onClick={() => { setActiveTab("normal"); setShowUploadPanel(false); setCurrentFlow(null); }}
                className={`flex-1 py-2 text-xs font-semibold border-b-2 transition-all ${
                  activeTab === "normal"
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
              >
                Chat Assistant
              </button>

              {(role === "customer" || role === "admin") && (
                <button
                  onClick={() => { setActiveTab("automate"); setShowUploadPanel(false); setCurrentFlow(null); }}
                  className={`flex-1 py-2 text-xs font-semibold border-b-2 transition-all ${
                    activeTab === "automate"
                      ? "border-blue-600 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  }`}
                >
                  Automate
                </button>
              )}

              {canUpload && (
                <button
                  onClick={() => { setActiveTab("rag"); setCurrentFlow(null); }}
                  className={`flex-1 py-2 text-xs font-semibold border-b-2 transition-all ${
                    activeTab === "rag"
                      ? "border-blue-600 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  }`}
                >
                  RAG Document QA
                </button>
              )}
            </div>
          )}

          {/* Upload panel — provider/admin only */}
          {(showUploadPanel || activeTab === "rag") && canUpload && (
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
                accept=".pdf,.docx,.xlsx,.md,.txt"
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
                  : "Click or drag-and-drop (.pdf .docx .xlsx .md .txt)"}
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

              {/* Document list */}
              {uploadedDocs.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                    Indexed Documents ({uploadedDocs.length})
                  </p>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {uploadedDocs.map((doc) => (
                      <div
                        key={doc.doc_id}
                        className="flex items-center justify-between p-1.5 rounded bg-white dark:bg-gray-905 border border-gray-100 dark:border-gray-800 text-xs"
                      >
                        <span className="text-gray-700 dark:text-gray-300 truncate font-medium max-w-[200px]" title={doc.filename}>
                          {doc.filename}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            ({doc.chunk_count} ch)
                          </span>
                          <button
                            onClick={async () => {
                              if (window.confirm(`Delete "${doc.filename}" from index?`)) {
                                try {
                                  await api.delete(`/api/schedully/kb/doc/${doc.doc_id}`);
                                  fetchUploadedDocs();
                                } catch (err) {
                                  console.error("Failed to delete doc", err);
                                }
                              }
                            }}
                            className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"
                            title="Delete document"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Dialog Body */}
          <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
            {activeTab === "automate" ? (
              <div className="p-4 h-full flex flex-col">
                {currentFlow === null ? (
                  role === "admin" ? (
                    <div className="space-y-3 flex-1">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide text-xs">
                        Select a Flow to Automate
                      </h3>
                      
                      <button
                        onClick={startDeactivateFlow}
                        className="w-full text-left p-3.5 rounded-xl border border-gray-200 dark:border-gray-800
                                   bg-white dark:bg-gray-800 hover:border-red-500 hover:shadow-md
                                   transition-all duration-200 group flex items-start gap-3"
                      >
                        <span className="p-2 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 group-hover:bg-red-600 group-hover:text-white transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        </span>
                        <div>
                          <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-200">Deactivate Account</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Deactivate a customer or provider account instantly.</p>
                        </div>
                      </button>

                      <button
                        onClick={startRuleFlow}
                        className="w-full text-left p-3.5 rounded-xl border border-gray-200 dark:border-gray-800
                                   bg-white dark:bg-gray-800 hover:border-green-500 hover:shadow-md
                                   transition-all duration-200 group flex items-start gap-3"
                      >
                        <span className="p-2 rounded-lg bg-green-50 dark:bg-green-950 text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </span>
                        <div>
                          <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-200">Create New Rule</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Configure automation trigger and actions.</p>
                        </div>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 flex-1">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide text-xs">
                        Select a Flow to Automate
                      </h3>
                      
                      <button
                        onClick={startBookingFlow}
                        className="w-full text-left p-3.5 rounded-xl border border-gray-200 dark:border-gray-800
                                   bg-white dark:bg-gray-800 hover:border-blue-500 hover:shadow-md
                                   transition-all duration-200 group flex items-start gap-3"
                      >
                        <span className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </span>
                        <div>
                          <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-200">Book Appointment</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Find slots, pick providers, and book in 1 click.</p>
                        </div>
                      </button>

                      <button
                        onClick={startCancellationFlow}
                        className="w-full text-left p-3.5 rounded-xl border border-gray-200 dark:border-gray-800
                                   bg-white dark:bg-gray-800 hover:border-red-500 hover:shadow-md
                                   transition-all duration-200 group flex items-start gap-3"
                      >
                        <span className="p-2 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 group-hover:bg-red-600 group-hover:text-white transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </span>
                        <div>
                          <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-200">Cancel Appointment</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Cancel any booked or upcoming schedule.</p>
                        </div>
                      </button>

                      <button
                        onClick={startReviewFlow}
                        className="w-full text-left p-3.5 rounded-xl border border-gray-200 dark:border-gray-800
                                   bg-white dark:bg-gray-800 hover:border-yellow-500 hover:shadow-md
                                   transition-all duration-200 group flex items-start gap-3"
                      >
                        <span className="p-2 rounded-lg bg-yellow-50 dark:bg-yellow-950 text-yellow-600 group-hover:bg-yellow-600 group-hover:text-white transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.907c.961 0 1.36 1.243.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.772-.567-.372-1.81.588-1.81h4.906a1 1 0 00.95-.69l1.519-4.674z" />
                          </svg>
                        </span>
                        <div>
                          <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-200">Submit Review</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Rate completed sessions and share feedback.</p>
                        </div>
                      </button>

                      <button
                        onClick={startRebookingFlow}
                        className="w-full text-left p-3.5 rounded-xl border border-gray-200 dark:border-gray-800
                                   bg-white dark:bg-gray-800 hover:border-purple-500 hover:shadow-md
                                   transition-all duration-200 group flex items-start gap-3"
                      >
                        <span className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89H18v3z" />
                          </svg>
                        </span>
                        <div>
                          <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-200">Rebook Provider</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Quickly book a new session with previous experts.</p>
                        </div>
                      </button>
                    </div>
                  )
                ) : (
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      {/* Flow Header with dynamic Step Back button */}
                      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100 dark:border-gray-800">
                        <button
                          onClick={handleFlowBack}
                          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                          </svg>
                        </button>
                        <span className="font-bold text-sm text-gray-800 dark:text-gray-100 capitalize">
                          {currentFlow === "book" && `Book Wizard (Step ${bookStep})`}
                          {currentFlow === "cancel" && `Cancellation Wizard (Step ${cancelStep})`}
                          {currentFlow === "review" && `Review Wizard (Step ${reviewStep})`}
                          {currentFlow === "rebook" && `Rebook Wizard (Step ${rebookStep})`}
                          {currentFlow === "deactivate" && `Deactivate Account (Step ${deactivateStep})`}
                          {currentFlow === "create_rule" && `Create Rule Wizard (Step ${ruleStep})`}
                        </span>
                      </div>

                      {/* --- BOOKING FLOW --- */}
                      {currentFlow === "book" && (
                        <div className="space-y-4">
                          {bookLoading && <div className="text-center py-6 text-sm text-gray-500">Loading details...</div>}
                          
                          {bookError && (
                            <div className="p-3 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-lg text-xs font-semibold">
                              {bookError}
                            </div>
                          )}

                          {/* Step 1: Provider Name (Optional) */}
                          {bookStep === 1 && !bookLoading && (
                            <div className="space-y-3">
                              {/* Inline NLP Box */}
                              <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-xl space-y-2">
                                <label className="text-[11px] font-bold text-blue-700 dark:text-blue-400 block">✨ Quick Autofill with Prompt</label>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={inlineBookPromptText}
                                    onChange={(e) => setInlineBookPromptText(e.target.value)}
                                    placeholder="e.g., book with a dentist from Apollo tomorrow..."
                                    className="flex-1 text-xs p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleInlineBookPrompt(inlineBookPromptText);
                                        setInlineBookPromptText("");
                                      }
                                    }}
                                  />
                                  <button
                                    onClick={() => {
                                      handleInlineBookPrompt(inlineBookPromptText);
                                      setInlineBookPromptText("");
                                    }}
                                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
                                  >
                                    Apply
                                  </button>
                                </div>
                              </div>

                              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Step 1: Provider Name (Optional)</label>
                              <input
                                type="text"
                                value={bookProviderName}
                                onChange={(e) => setBookProviderName(e.target.value)}
                                placeholder="Enter provider name (e.g. Dhoni Bose)..."
                                className="w-full text-xs p-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => navigateToNextBookStep(1)}
                                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
                                >
                                  Next Step
                                </button>
                                <button
                                  onClick={() => { setBookProviderName(""); navigateToNextBookStep(1); }}
                                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-bold"
                                >
                                  Skip
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Step 2: Location (Optional) */}
                          {bookStep === 2 && !bookLoading && (
                            <div className="space-y-3">
                              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Step 2: Location / City (Optional)</label>
                              <input
                                type="text"
                                value={bookLocation}
                                onChange={(e) => setBookLocation(e.target.value)}
                                placeholder="Enter city (e.g. Hyderabad)..."
                                className="w-full text-xs p-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => navigateToNextBookStep(2)}
                                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
                                >
                                  Next Step
                                </button>
                                <button
                                  onClick={() => { setBookLocation(""); navigateToNextBookStep(2); }}
                                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-bold"
                                >
                                  Skip
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Step 3: Category (Optional) */}
                          {bookStep === 3 && !bookLoading && (
                            <div className="space-y-3">
                              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block">Step 3: Select Specialization (Optional)</label>
                              <div className="max-h-[180px] overflow-y-auto space-y-1 pr-1 border border-gray-200 dark:border-gray-700 rounded-lg p-1.5 bg-white dark:bg-gray-800">
                                {categoriesList.map(cat => (
                                  <button
                                    key={cat.id}
                                    onClick={() => { setBookCategoryId(cat.id); navigateToNextBookStep(3); }}
                                    className={`w-full text-left p-2 rounded text-xs transition-colors ${
                                      bookCategoryId === cat.id ? "bg-blue-50 dark:bg-blue-900/40 text-blue-600 font-bold" : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                                    }`}
                                  >
                                    {cat.name}
                                  </button>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => navigateToNextBookStep(3)}
                                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
                                >
                                  Next Step
                                </button>
                                <button
                                  onClick={() => { setBookCategoryId(""); navigateToNextBookStep(3); }}
                                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-bold"
                                >
                                  Skip
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Step 4: Rating Preference (Optional) */}
                          {bookStep === 4 && !bookLoading && (
                            <div className="space-y-3">
                              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Step 4: Minimum Rating Preference (Optional)</label>
                              <div className="flex justify-center gap-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                                {[0, 3, 4, 5].map(stars => (
                                  <button
                                    key={stars}
                                    onClick={() => setBookRating(stars)}
                                    className={`py-1.5 px-3 rounded text-xs border font-medium transition-colors ${
                                      bookRating === stars 
                                        ? "bg-blue-600 border-blue-600 text-white font-bold" 
                                        : "bg-gray-100 dark:bg-gray-700 border-transparent text-gray-700 dark:text-gray-300"
                                    }`}
                                  >
                                    {stars === 0 ? "Any Rating" : `⭐ ${stars}+`}
                                  </button>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => navigateToNextBookStep(4)}
                                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                                >
                                  Next Step
                                </button>
                                <button
                                  onClick={() => { setBookRating(0); navigateToNextBookStep(4); }}
                                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-bold"
                                >
                                  Skip
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Step 5: Organization (Optional) */}
                          {bookStep === 5 && !bookLoading && (
                            <div className="space-y-3">
                              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Step 5: Organization Name (Optional)</label>
                              <input
                                type="text"
                                value={bookOrgName}
                                onChange={(e) => setBookOrgName(e.target.value)}
                                placeholder="Apollo, Manipal, etc..."
                                className="w-full text-xs p-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => navigateToNextBookStep(5)}
                                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
                                >
                                  Select Booking Date
                                </button>
                                <button
                                  onClick={() => { setBookOrgName(""); navigateToNextBookStep(5); }}
                                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-bold"
                                >
                                  Skip
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Step 6: Select Date */}
                          {bookStep === 6 && !bookLoading && (
                            <div className="space-y-3">
                              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Step 6: Select Date</label>
                              <p className="text-[11px] text-gray-400">We will find the first matching provider based on your search filters.</p>
                              <div className="grid grid-cols-2 gap-2">
                                {getNext7Days().map(day => (
                                  <button
                                    key={day.formatted}
                                    onClick={() => resolveSelectedProvider(day.formatted)}
                                    className="p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                                               rounded-lg text-xs text-gray-800 dark:text-gray-200 hover:border-blue-500 text-center font-medium"
                                  >
                                    {day.display}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Step 7: Slot list or Waitlist check */}
                          {bookStep === 7 && !bookLoading && bookProvider && (
                            <div className="space-y-4">
                              <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-xl">
                                <span className="text-xs font-bold text-blue-700 dark:text-blue-400 block">Matched Provider</span>
                                <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 block">{bookProvider.user?.full_name}</span>
                                <span className="text-[11px] text-gray-500 block">{bookProvider.specialization} | Rating: ⭐{bookProvider.avg_rating || "N/A"}</span>
                              </div>

                              {slotsList.length === 0 ? (
                                <div className="space-y-3 text-center py-4 bg-yellow-50/30 dark:bg-yellow-950/10 border border-dashed border-yellow-300 dark:border-yellow-950 rounded-xl p-3">
                                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                    No slots available on **{bookDate}** with this provider.
                                  </p>
                                  <div className="flex flex-col gap-2 pt-2">
                                    <button
                                      onClick={handleJoinWaitlist}
                                      className="py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
                                    >
                                      Join Waitlist
                                    </button>
                                    <button
                                      onClick={handleFindNextAvailableSlots}
                                      className="py-2 px-3 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold"
                                    >
                                      Check Next Available Free Slots
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Available Time Slots</label>
                                  <div className="grid grid-cols-3 gap-2 max-h-[160px] overflow-y-auto pr-1">
                                    {slotsList.map(s => (
                                      <button
                                        key={s.time_slot}
                                        onClick={() => { setStepHistory((prev) => [...prev, bookStep]); setBookSlot(s.time_slot); setBookStep(9); }}
                                        className="py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                                                   rounded-lg text-xs text-gray-800 dark:text-gray-200 hover:border-blue-500 text-center font-medium"
                                      >
                                        {s.time_slot}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Step 8: Next 3 Available Slots */}
                          {bookStep === 8 && !bookLoading && (
                            <div className="space-y-3">
                              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block">Next 3 Available Slots</label>
                              {nextSlotsList.length === 0 ? (
                                <p className="text-xs text-gray-500 text-center py-6">No slots found in the upcoming days.</p>
                              ) : (
                                <div className="space-y-2">
                                  {nextSlotsList.map((s, idx) => (
                                    <button
                                      key={idx}
                                      onClick={() => { setStepHistory((prev) => [...prev, bookStep]); setBookDate(s.date); setBookSlot(s.time); setBookStep(9); }}
                                      className="w-full text-left p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                                                 rounded-lg text-xs text-gray-800 dark:text-gray-200 hover:border-blue-500 flex justify-between font-medium"
                                    >
                                      <span>{s.date}</span>
                                      <span className="text-blue-600 dark:text-blue-400 font-bold">{s.time}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Step 9: Notes & Confirmation */}
                          {bookStep === 9 && !bookLoading && bookProvider && (
                            <div className="space-y-4">
                              <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-xl space-y-1 text-xs">
                                <h5 className="font-bold text-blue-700 dark:text-blue-400">Appointment Summary</h5>
                                <p className="text-gray-700 dark:text-gray-300"><strong>Provider</strong>: {bookProvider.user?.full_name}</p>
                                <p className="text-gray-700 dark:text-gray-300"><strong>Location</strong>: {bookProvider.location || "N/A"}</p>
                                <p className="text-gray-700 dark:text-gray-300"><strong>Date / Time</strong>: {bookDate} @ {bookSlot}</p>
                                {bookOfferingId && bookOfferings.find(o => o.id === bookOfferingId) && (
                                  <p className="text-gray-700 dark:text-gray-300"><strong>Service</strong>: {bookOfferings.find(o => o.id === bookOfferingId).title}</p>
                                )}
                                <p className="text-gray-700 dark:text-gray-300"><strong>Fee</strong>: ₹{bookOfferingPrice ? bookOfferingPrice : bookProvider.consultation_fee}</p>
                              </div>

                              {bookOfferings && bookOfferings.length > 0 && (
                                <div className="space-y-1.5">
                                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Service Type</label>
                                  <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                                    {bookOfferings.map(offering => (
                                      <button
                                        key={offering.id}
                                        onClick={() => {
                                          setBookOfferingId(offering.id);
                                          setBookOfferingPrice(offering.price);
                                        }}
                                        className={`p-2.5 rounded-lg border text-xs text-left flex justify-between items-center transition-all ${
                                          bookOfferingId === offering.id
                                            ? "border-blue-600 bg-blue-50/40 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 font-semibold"
                                            : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                                        }`}
                                      >
                                        <div>
                                          <div className="font-bold">{offering.title}</div>
                                          <div className="text-[10px] text-gray-400 font-normal">{offering.duration_minutes} mins</div>
                                        </div>
                                        <div className="text-blue-600 dark:text-blue-400 font-bold">₹{offering.price}</div>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Consultation Notes (Optional)</label>
                                <textarea
                                  value={bookNotes}
                                  onChange={(e) => setBookNotes(e.target.value)}
                                  placeholder="Describe reason for this session..."
                                  rows={2}
                                  className="w-full text-xs p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                />
                              </div>

                              <button
                                onClick={() => submitBooking(false)}
                                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
                              >
                                Book Slot & Proceed
                              </button>
                            </div>
                          )}

                          {/* Step 10: Success Screen */}
                          {bookStep === 10 && bookSuccessData && (
                            <div className="text-center py-4 space-y-3">
                              <span className="inline-flex p-3 rounded-full bg-green-100 text-green-600">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </span>
                              
                              <h4 className="font-bold text-sm text-gray-800 dark:text-gray-100">
                                {bookSuccessData.type === "waitlist" ? "Joined Waitlist!" : "Slot Reserved!"}
                              </h4>
                              
                              <p className="text-xs text-gray-600 dark:text-gray-400 px-4">
                                {bookSuccessData.type === "waitlist" 
                                  ? "You have successfully joined the waitlist for this date. We'll notify you if a slot opens."
                                  : "Your appointment slot has been reserved. Please complete payment to confirm your booking."}
                              </p>

                              {bookSuccessData.type === "appointment" && (
                                <button
                                  onClick={() => {
                                    window.location.href = `/customer/appointments/${bookSuccessData.appointment?.id}`;
                                  }}
                                  className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-colors"
                                >
                                  Complete Payment Now
                                </button>
                              )}

                              <button
                                onClick={() => setCurrentFlow(null)}
                                className="text-xs text-blue-600 hover:underline block w-full mt-2"
                              >
                                Done
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* --- CANCELLATION FLOW --- */}
                      {currentFlow === "cancel" && (
                        <div className="space-y-4">
                          {cancelLoading && <div className="text-center py-6 text-sm text-gray-500">Processing...</div>}
                          
                          {cancelError && (
                            <div className="p-3 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-lg text-xs font-semibold">
                              {cancelError}
                            </div>
                          )}

                          {cancelStep === 1 && !cancelLoading && (
                            <div className="space-y-2">
                              {/* Inline NLP Box */}
                              <div className="p-3 bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 rounded-xl space-y-2">
                                <label className="text-[11px] font-bold text-red-700 dark:text-red-400 block">✨ Quick Select with Prompt</label>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={inlineCancelPromptText}
                                    onChange={(e) => setInlineCancelPromptText(e.target.value)}
                                    placeholder="e.g., cancel Kabir Singh..."
                                    className="flex-1 text-xs p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleInlineCancelPrompt(inlineCancelPromptText);
                                        setInlineCancelPromptText("");
                                      }
                                    }}
                                  />
                                  <button
                                    onClick={() => {
                                      handleInlineCancelPrompt(inlineCancelPromptText);
                                      setInlineCancelPromptText("");
                                    }}
                                    className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors"
                                  >
                                    Apply
                                  </button>
                                </div>
                              </div>

                              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Select Booking to Cancel</label>
                              {cancelAppts.length === 0 ? (
                                <p className="text-xs text-gray-400 text-center py-6">No upcoming appointments found.</p>
                              ) : (
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                  {cancelAppts.map(appt => (
                                    <button
                                      key={appt.id}
                                      onClick={() => { setStepHistory((prev) => [...prev, cancelStep]); setSelectedCancelAppt(appt); setCancelStep(2); }}
                                      className="w-full text-left p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                                                 rounded-lg text-xs text-gray-800 dark:text-gray-200 hover:border-red-500 flex justify-between items-center"
                                    >
                                      <div>
                                        <span className="font-semibold block">{appt.provider?.user?.full_name}</span>
                                        <span className="text-xs text-gray-500 block">{appt.appointment_date} @ {appt.time_slot}</span>
                                      </div>
                                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                                        appt.status === "confirmed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                                      }`}>
                                        {appt.status}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {cancelStep === 2 && !cancelLoading && selectedCancelAppt && (
                            <div className="space-y-4">
                              <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg text-xs text-yellow-800 dark:text-yellow-400">
                                <strong>Warning</strong>: Cancelling this appointment with {selectedCancelAppt.provider?.user?.full_name} scheduled on {selectedCancelAppt.appointment_date} may incur standard platform rules.
                              </div>

                              <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Reason for Cancellation</label>
                                <textarea
                                  value={cancelReason}
                                  onChange={(e) => setCancelReason(e.target.value)}
                                  placeholder="Provide cancellation details..."
                                  rows={2}
                                  className="w-full text-xs p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                />
                              </div>

                              <button
                                onClick={submitCancellation}
                                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors"
                              >
                                Cancel Appointment
                              </button>
                            </div>
                          )}

                          {cancelStep === 3 && (
                            <div className="text-center py-4 space-y-3">
                              <span className="inline-flex p-3 rounded-full bg-red-100 text-red-600">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </span>
                              <h4 className="font-bold text-sm text-gray-800 dark:text-gray-100">Cancellation Successful</h4>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                The appointment has been successfully cancelled and the slot released.
                              </p>
                              <div className="flex flex-col gap-2">
                                <button
                                  onClick={() => startCancellationFlow()}
                                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors animate-pulse"
                                >
                                  Cancel Another Appointment
                                </button>
                                <button
                                  onClick={() => setCurrentFlow(null)}
                                  className="w-full py-2 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg text-xs font-semibold"
                                >
                                  Done
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* --- REVIEW FLOW --- */}
                      {currentFlow === "review" && (
                        <div className="space-y-4">
                          {reviewLoading && <div className="text-center py-6 text-sm text-gray-500">Processing...</div>}
                          
                          {reviewError && (
                            <div className="p-3 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-lg text-xs font-semibold">
                              {reviewError}
                            </div>
                          )}

                          {reviewStep === 1 && !reviewLoading && (
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Select Appointment to Rate</label>
                              {reviewAppts.length === 0 ? (
                                <p className="text-xs text-gray-400 text-center py-6">No pending completed appointments found.</p>
                              ) : (
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                  {reviewAppts.map(appt => (
                                    <button
                                      key={appt.appointment_id}
                                      onClick={() => { setStepHistory((prev) => [...prev, reviewStep]); setSelectedReviewAppt(appt); setReviewStep(2); }}
                                      className="w-full text-left p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                                                 rounded-lg text-xs text-gray-800 dark:text-gray-200 hover:border-yellow-500"
                                    >
                                      <span className="font-semibold block">{appt.provider_name}</span>
                                      <span className="text-[10px] text-gray-500 block">{appt.category_name} ({appt.provider_specialization})</span>
                                      <span className="text-xs text-gray-400 block mt-1">{appt.appointment_date} @ {appt.time_slot}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {reviewStep === 2 && !reviewLoading && selectedReviewAppt && (
                            <div className="space-y-4">
                              <div className="space-y-1.5 text-center">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block">Star Rating</label>
                                <div className="flex justify-center gap-1.5">
                                  {[1, 2, 3, 4, 5].map(val => (
                                    <button
                                      key={val}
                                      onClick={() => setReviewRating(val)}
                                      className="text-2xl transition-transform hover:scale-110"
                                    >
                                      {val <= reviewRating ? "⭐" : "☆"}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Review Feedback</label>
                                <textarea
                                  value={reviewComment}
                                  onChange={(e) => setReviewComment(e.target.value)}
                                  placeholder="Write a comment about your experience..."
                                  rows={3}
                                  className="w-full text-xs p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                />
                              </div>

                              <button
                                onClick={submitReview}
                                className="w-full py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-xs font-bold transition-colors"
                              >
                                Submit Review
                              </button>
                            </div>
                          )}

                          {reviewStep === 3 && (
                            <div className="text-center py-4 space-y-3">
                              <span className="inline-flex p-3 rounded-full bg-yellow-100 text-yellow-600">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </span>
                              <h4 className="font-bold text-sm text-gray-800 dark:text-gray-100">Review Submitted</h4>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                Thank you for your feedback! It helps improve the platform services.
                              </p>
                              <button
                                onClick={() => setCurrentFlow(null)}
                                className="w-full py-2 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg text-xs font-semibold"
                              >
                                Done
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* --- REBOOK FLOW --- */}
                      {currentFlow === "rebook" && (
                        <div className="space-y-4">
                          {rebookLoading && <div className="text-center py-6 text-sm text-gray-500">Processing...</div>}
                          
                          {rebookError && (
                            <div className="p-3 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-lg text-xs font-semibold">
                              {rebookError}
                            </div>
                          )}

                          {rebookStep === 1 && !rebookLoading && (
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Select Past Provider</label>
                              {rebookProviders.length === 0 ? (
                                <p className="text-xs text-gray-400 text-center py-6">No past providers found in your history.</p>
                              ) : (
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                  {rebookProviders.map(p => (
                                    <button
                                      key={p.id}
                                      onClick={() => handleRebookProviderSelect(p.id)}
                                      className="w-full text-left p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                                                 rounded-lg text-xs text-gray-800 dark:text-gray-200 hover:border-blue-500"
                                    >
                                      <span className="font-semibold block">{p.name}</span>
                                      <span className="text-[10px] text-gray-500 block">{p.specialization}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {rebookStep === 2 && !rebookLoading && (
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Select Date</label>
                              <div className="grid grid-cols-2 gap-2">
                                {getNext7Days().map(day => (
                                  <button
                                    key={day.formatted}
                                    onClick={() => handleDateSelect(day.formatted, true)}
                                    className="p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                                               rounded-lg text-xs text-gray-800 dark:text-gray-200 hover:border-blue-500 text-center font-medium"
                                  >
                                    {day.display}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {rebookStep === 3 && !rebookLoading && (
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Available Time Slots</label>
                              {rebookSlotsList.length === 0 ? (
                                <div className="text-center py-6">
                                  <p className="text-xs text-gray-500">No open slots on this date.</p>
                                  <button
                                    onClick={() => setRebookStep(2)}
                                    className="text-xs text-blue-600 hover:underline mt-2 block w-full"
                                  >
                                    Try another date
                                  </button>
                                </div>
                              ) : (
                                <div className="grid grid-cols-3 gap-2 max-h-[220px] overflow-y-auto pr-1">
                                  {rebookSlotsList.map(s => (
                                    <button
                                      key={s.time_slot}
                                      onClick={() => { setRebookSlot(s.time_slot); setRebookStep(4); }}
                                      className="py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                                                 rounded-lg text-xs text-gray-800 dark:text-gray-200 hover:border-blue-500 text-center font-medium"
                                    >
                                      {s.time_slot}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {rebookStep === 4 && !rebookLoading && (
                            <div className="space-y-4">
                              <div className="p-3.5 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900 rounded-xl space-y-1 text-xs">
                                <h5 className="font-bold text-purple-700 dark:text-purple-400">Rebooking Summary</h5>
                                <p className="text-gray-700 dark:text-gray-300">
                                  <strong>Provider</strong>: {rebookProviders.find(p => p.id === selectedRebookProviderId)?.name}
                                </p>
                                <p className="text-gray-700 dark:text-gray-300">
                                  <strong>Date / Time</strong>: {rebookDate} @ {rebookSlot}
                                </p>
                              </div>

                              <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Consultation Notes (Optional)</label>
                                <textarea
                                  value={rebookNotes}
                                  onChange={(e) => setRebookNotes(e.target.value)}
                                  placeholder="Describe any updates since your last visit..."
                                  rows={2}
                                  className="w-full text-xs p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                />
                              </div>

                              <button
                                onClick={() => submitBooking(true)}
                                className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-colors"
                              >
                                Confirm Rebooking
                              </button>
                            </div>
                          )}

                          {rebookStep === 5 && rebookSuccessData && (
                            <div className="text-center py-4 space-y-3">
                              <span className="inline-flex p-3 rounded-full bg-green-100 text-green-600">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </span>
                              
                              <h4 className="font-bold text-sm text-gray-800 dark:text-gray-100">
                                {rebookSuccessData.type === "waitlist" ? "Joined Waitlist" : "Rebooked Successfully!"}
                              </h4>
                              
                              <p className="text-xs text-gray-600 dark:text-gray-400 px-4">
                                {rebookSuccessData.type === "waitlist" 
                                  ? "The slot is full. You've been placed on the waitlist and will be notified of opening slots."
                                  : "Your appointment slot has been reserved. Please complete payment to confirm your booking."}
                              </p>

                              {rebookSuccessData.type === "appointment" && (
                                <button
                                  onClick={() => {
                                    window.location.href = `/customer/appointments/${rebookSuccessData.appointment?.id}`;
                                  }}
                                  className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-colors"
                                >
                                  Complete Payment Now
                                </button>
                              )}

                              <button
                                onClick={() => setCurrentFlow(null)}
                                className="text-xs text-blue-600 hover:underline block w-full mt-2"
                              >
                                Done
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* --- DEACTIVATE FLOW --- */}
                      {currentFlow === "deactivate" && (
                        <div className="space-y-4">
                          {deactivateLoading && <div className="text-center py-6 text-sm text-gray-500">Processing...</div>}
                          
                          {deactivateError && (
                            <div className="p-3 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-lg text-xs font-semibold">
                              {deactivateError}
                            </div>
                          )}

                          {deactivateStep === 1 && !deactivateLoading && (
                            <div className="space-y-3">
                              {/* Inline NLP Box */}
                              <div className="p-3 bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 rounded-xl space-y-2">
                                <label className="text-[11px] font-bold text-red-700 dark:text-red-400 block">✨ Quick Autofill with Prompt</label>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={inlineDeactivatePromptText}
                                    onChange={(e) => setInlineDeactivatePromptText(e.target.value)}
                                    placeholder="e.g. deactivate the account of kriti das..."
                                    className="flex-1 text-xs p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleInlineDeactivatePrompt(inlineDeactivatePromptText);
                                        setInlineDeactivatePromptText("");
                                      }
                                    }}
                                  />
                                  <button
                                    onClick={() => {
                                      handleInlineDeactivatePrompt(inlineDeactivatePromptText);
                                      setInlineDeactivatePromptText("");
                                    }}
                                    className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors"
                                  >
                                    Apply
                                  </button>
                                </div>
                              </div>

                              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Search User Name</label>
                              <input
                                type="text"
                                value={deactivateSearchName}
                                onChange={(e) => setDeactivateSearchName(e.target.value)}
                                placeholder="Enter customer or provider name..."
                                className="w-full text-xs p-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleDeactivateSearch(deactivateSearchName);
                                  }
                                }}
                              />
                              <button
                                onClick={() => handleDeactivateSearch(deactivateSearchName)}
                                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors"
                              >
                                Search User
                              </button>
                            </div>
                          )}

                          {deactivateStep === 2 && !deactivateLoading && (
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Ambiguous Name Match — Select User</label>
                              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                {deactivateUsers.map(user => (
                                  <button
                                    key={user.id}
                                    onClick={() => {
                                      setDeactivateSelectedUser(user);
                                      setStepHistory((prev) => [...prev, deactivateStep]);
                                      setDeactivateStep(3);
                                    }}
                                    className="w-full text-left p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                                               rounded-lg text-xs text-gray-800 dark:text-gray-200 hover:border-red-500 flex justify-between items-center"
                                  >
                                    <div>
                                      <span className="font-semibold block">{user.full_name}</span>
                                      <span className="text-[10px] text-gray-500 block">{user.email}</span>
                                    </div>
                                    <div className="text-right">
                                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                                        {user.role}
                                      </span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {deactivateStep === 3 && !deactivateLoading && deactivateSelectedUser && (
                            <div className="space-y-4">
                              <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-800 dark:text-red-400 space-y-1">
                                <h5 className="font-bold">Account Deactivation Request</h5>
                                <p>Are you sure you want to deactivate this account? This will restrict them from logging in or making appointments.</p>
                              </div>

                              <div className="p-3.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl space-y-1 text-xs">
                                <p className="text-gray-700 dark:text-gray-300"><strong>Name</strong>: {deactivateSelectedUser.full_name}</p>
                                <p className="text-gray-700 dark:text-gray-300"><strong>Email</strong>: {deactivateSelectedUser.email}</p>
                                <p className="text-gray-700 dark:text-gray-300"><strong>Role</strong>: <span className="uppercase">{deactivateSelectedUser.role}</span></p>
                                <p className="text-gray-700 dark:text-gray-300"><strong>Status</strong>: {deactivateSelectedUser.is_active ? "Active" : "Inactive"}</p>
                              </div>

                              <button
                                onClick={submitDeactivation}
                                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors"
                              >
                                Deactivate Account
                              </button>
                            </div>
                          )}

                          {deactivateStep === 4 && (
                            <div className="text-center py-4 space-y-3">
                              <span className="inline-flex p-3 rounded-full bg-red-100 text-red-600">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                              </span>
                              <h4 className="font-bold text-sm text-gray-800 dark:text-gray-100">Deactivation Successful</h4>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                The account has been successfully deactivated.
                              </p>
                              <button
                                onClick={() => setCurrentFlow(null)}
                                className="w-full py-2 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg text-xs font-semibold"
                              >
                                Done
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* --- CREATE RULE FLOW --- */}
                      {currentFlow === "create_rule" && (
                        <div className="space-y-4">
                          {ruleLoading && <div className="text-center py-6 text-sm text-gray-500">Creating Rule...</div>}

                          {ruleError && (
                            <div className="p-3 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-lg text-xs font-semibold">
                              {ruleError}
                            </div>
                          )}

                          {ruleStep === 1 && !ruleLoading && (
                            <div className="space-y-3">
                              {/* Inline NLP Box */}
                              <div className="p-3 bg-green-50/50 dark:bg-green-950/20 border border-green-100 dark:border-green-900 rounded-xl space-y-2">
                                <label className="text-[11px] font-bold text-green-700 dark:text-green-400 block">✨ Quick Autofill with Prompt</label>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={inlineRulePromptText}
                                    onChange={(e) => setInlineRulePromptText(e.target.value)}
                                    placeholder="e.g. create a rule called xyz on payment failed..."
                                    className="flex-1 text-xs p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleInlineRulePrompt(inlineRulePromptText);
                                        setInlineRulePromptText("");
                                      }
                                    }}
                                  />
                                  <button
                                    onClick={() => {
                                      handleInlineRulePrompt(inlineRulePromptText);
                                      setInlineRulePromptText("");
                                    }}
                                    className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-colors"
                                  >
                                    Apply
                                  </button>
                                </div>
                              </div>

                              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Step 1: Rule Name</label>
                              <input
                                type="text"
                                value={ruleName}
                                onChange={(e) => setRuleName(e.target.value)}
                                placeholder="e.g. No-Show Prevention"
                                className="w-full text-xs p-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                              />
                              <button
                                onClick={() => {
                                  if (!ruleName.trim()) {
                                    setRuleError("Rule name is required.");
                                    return;
                                  }
                                  setRuleError("");
                                  setStepHistory((prev) => [...prev, ruleStep]);
                                  setRuleStep(2);
                                }}
                                className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-colors"
                              >
                                Next Step
                              </button>
                            </div>
                          )}

                          {ruleStep === 2 && !ruleLoading && (
                            <div className="space-y-3">
                              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Step 2: Description</label>
                              <textarea
                                value={ruleDescription}
                                onChange={(e) => setRuleDescription(e.target.value)}
                                placeholder="What does this rule do?"
                                rows={3}
                                className="w-full text-xs p-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setStepHistory((prev) => [...prev, ruleStep]);
                                    setRuleStep(3);
                                  }}
                                  className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-colors"
                                >
                                  Next Step
                                </button>
                                <button
                                  onClick={() => {
                                    setRuleDescription("");
                                    setStepHistory((prev) => [...prev, ruleStep]);
                                    setRuleStep(3);
                                  }}
                                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-bold"
                                >
                                  Skip
                                </button>
                              </div>
                            </div>
                          )}

                          {ruleStep === 3 && !ruleLoading && (
                            <div className="space-y-3">
                              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Step 3: Trigger Event</label>
                              <select
                                value={ruleTrigger}
                                onChange={(e) => { setRuleTrigger(e.target.value); setRuleError(""); }}
                                className="w-full text-xs p-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                              >
                                <option value="appointment_scheduled">Appointment Scheduled</option>
                                <option value="appointment_cancelled">Appointment Cancelled</option>
                                <option value="provider_registered">Provider Registered</option>
                                <option value="slot_released">Slot Released</option>
                                <option value="payment_failed">Payment Failed</option>
                              </select>
                              <button
                                onClick={() => submitRule()}
                                className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-colors"
                              >
                                Create Rule
                              </button>
                            </div>
                          )}

                          {ruleStep === 4 && (
                            <div className="text-center py-4 space-y-3">
                              <span className="inline-flex p-3 rounded-full bg-green-100 text-green-600">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </span>
                              <h4 className="font-bold text-sm text-gray-800 dark:text-gray-100">Rule Created</h4>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                The rule <strong>{ruleName}</strong> has been successfully created.
                              </p>
                              <button
                                onClick={() => setCurrentFlow(null)}
                                className="w-full py-2 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg text-xs font-semibold"
                              >
                                Done
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : showHistoryList ? (
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50 dark:bg-gray-800">
                <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Previous Chats
                  </span>
                  <button onClick={startNewChat} className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                    + New Chat
                  </button>
                </div>

                {sessionList.length === 0 ? (
                  <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
                    No previous conversations found.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sessionList.map((s) => (
                      <div
                        key={s.session_id}
                        className={`w-full group relative border transition-all flex items-center justify-between rounded-xl hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 ${
                          s.session_id === sessionId
                            ? "border-blue-500 bg-blue-50/30 dark:bg-blue-950/10 font-semibold"
                            : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                        }`}
                      >
                        <button
                          onClick={() => loadPreviousSession(s.session_id)}
                          className="flex-1 text-left p-3 flex flex-col gap-1 focus:outline-none"
                        >
                          <span className="text-sm text-gray-800 dark:text-gray-200 line-clamp-1 pr-6">{s.title}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {new Date(s.last_active * 1000).toLocaleString(undefined, {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </span>
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (window.confirm("Are you sure you want to delete this conversation history?")) {
                              try {
                                await api.delete(`/api/schedully/sessions/${s.session_id}`, { params: { mode: activeTab } });
                                if (s.session_id === sessionId) {
                                  startNewChat();
                                } else {
                                  fetchSessionList();
                                }
                              } catch (err) {
                                console.error("Failed to delete session", err);
                              }
                            }
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title="Delete conversation"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-between h-full">
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scroll-smooth">
                  {activeTab === "rag" && uploadedDocs.length > 0 && (
                    <div className="p-3 bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900 rounded-xl space-y-1.5 text-xs mb-3">
                      <p className="font-semibold text-blue-800 dark:text-blue-400">Active RAG Documents ({uploadedDocs.length}):</p>
                      <div className="flex flex-wrap gap-1.5">
                        {uploadedDocs.map(doc => (
                          <span key={doc.doc_id} className="inline-flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2 py-0.5 rounded-full text-[11px] text-gray-700 dark:text-gray-300">
                            <span className="truncate max-w-[150px]">{doc.filename}</span>
                            <button
                              onClick={async () => {
                                if (window.confirm(`Delete "${doc.filename}" from index?`)) {
                                  try {
                                    await api.delete(`/api/schedully/kb/doc/${doc.doc_id}`);
                                    fetchUploadedDocs();
                                  } catch (err) {
                                    console.error("Failed to delete doc", err);
                                  }
                                }
                              }}
                              className="text-gray-400 hover:text-red-500 font-bold ml-0.5"
                              title="Delete document"
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {messages.map((msg) => (
                    <div key={msg.id} className="flex flex-col gap-1">
                      <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed break-words
                          ${msg.role === "user"
                            ? "bg-blue-600 text-white rounded-br-md"
                            : msg.role === "error"
                            ? "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-bl-md"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md"
                          }`}>
                          {msg.role === "user" ? <span>{msg.text}</span> : parseMarkdownAndCitations(msg.text, msg.sources)}
                        </div>
                      </div>
                      {msg.role === "assistant" && msg.bookingPromptText && (
                        <div className="flex justify-start mb-2 pl-2">
                          <button
                            onClick={async () => {
                              let cats = categoriesList;
                              if (cats.length === 0) {
                                try {
                                  const catRes = await api.get("/api/categories");
                                  cats = catRes.data?.data?.categories || [];
                                  setCategoriesList(cats);
                                } catch (e) {}
                              }
                              const parsed = parseBookingPrompt(msg.bookingPromptText, cats);
                              setBookProviderName(parsed.providerName);
                              setBookLocation(parsed.location);
                              setBookCategoryId(parsed.categoryId);
                              setBookRating(parsed.rating);
                              setBookOrgName(parsed.orgName);
                              setBookDate(parsed.dateVal);
                              setBookOfferingNamePrompt(parsed.serviceType || "");
                              setBookPreferredSlotPrompt(parsed.preferredSlot || "");
                              setBookSpecializationPrompt(parsed.specialization || "");
                              setBookNotes("");
                              setBookError("");
                              setBookSuccessData(null);
                              
                              let targetStep = 1;
                              let historyArray = [];
                              if (parsed.providerName) {
                                targetStep = 6;
                                historyArray = [1];
                              } else {
                                if (!parsed.location) {
                                  targetStep = 2;
                                  historyArray = [1];
                                } else if (!parsed.categoryId) {
                                  targetStep = 3;
                                  historyArray = [1, 2];
                                } else if (!parsed.rating) {
                                  targetStep = 4;
                                  historyArray = [1, 2, 3];
                                } else if (!parsed.orgName) {
                                  targetStep = 5;
                                  historyArray = [1, 2, 3, 4];
                                } else {
                                  targetStep = 6;
                                  historyArray = [1, 2, 3, 4, 5];
                                }
                              }
                              const allFiltersProvided = parsed.providerName || (parsed.location && parsed.categoryId && parsed.rating && parsed.orgName);
                              
                              setActiveTab("automate");
                              if (parsed.dateVal && allFiltersProvided) {
                                setCurrentFlow("book");
                                setStepHistory(historyArray);
                                setBookStep(7);
                                resolveSelectedProvider(parsed.dateVal, parsed);
                              } else {
                                setCurrentFlow("book");
                                setStepHistory(historyArray);
                                setBookStep(targetStep);
                              }
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm transition-colors mt-0.5"
                          >
                            📅 Open Booking Wizard
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-md px-4 py-3">
                        <div className="flex gap-1 items-center">
                          {[0, 1, 2].map((i) => (
                            <div key={i} className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="px-3 py-3 border-t border-gray-200 dark:border-gray-700 shrink-0 bg-white dark:bg-gray-900">
                  <div className="flex items-end gap-2">
                    <textarea
                      ref={inputRef} value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={role === "customer"
                        ? "Ask about booking, cancelling, or using Schedex…"
                        : activeTab === "normal"
                        ? "Ask about appointments, slots, ratings, reviews, stats…"
                        : "Ask questions about uploaded documents and files…"}
                      rows={1} maxLength={2000} disabled={loading}
                      className="flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-600
                                 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                                 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                                 disabled:opacity-50 max-h-24 overflow-y-auto"
                      style={{ lineHeight: "1.5" }}
                      aria-label="Chat message"
                    />
                    <button
                      onClick={sendMessage} disabled={loading || !input.trim()}
                      aria-label="Send message"
                      className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white
                                 flex items-center justify-center shrink-0 disabled:opacity-40
                                 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
    </>
  );
}
