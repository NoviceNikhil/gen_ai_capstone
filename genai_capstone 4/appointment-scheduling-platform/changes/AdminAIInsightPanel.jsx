import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, AlertTriangle, Loader, Sparkles } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";
import { analyzeOnboardingDocumentsAPI, getAIInsightAPI } from "../services/apiService";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const riskColors = {
  low: {
    bg: "bg-green-50",
    border: "border-green-300",
    badge: "bg-green-100 text-green-800",
    icon: CheckCircle2,
  },
  medium: {
    bg: "bg-yellow-50",
    border: "border-yellow-300",
    badge: "bg-yellow-100 text-yellow-800",
    icon: AlertTriangle,
  },
  high: {
    bg: "bg-red-50",
    border: "border-red-300",
    badge: "bg-red-100 text-red-800",
    icon: AlertCircle,
  },
};

export default function AdminAIInsightPanel({ providerOnboardingId }) {
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAndAnalyze = async () => {
      try {
        setLoading(true);
        setAnalyzing(true);
        
        // First, analyze the documents
        try {
          await analyzeOnboardingDocumentsAPI(providerOnboardingId);
        } catch (err) {
          console.error("Analysis error:", err);
        }
        
        // Then fetch the insight
        const response = await getAIInsightAPI(providerOnboardingId);
        setInsight(response.data);
        setError(null);
      } catch (err) {
        const errorMsg = err.response?.data?.detail || "Failed to load insight";
        setError(errorMsg);
        toast.error(errorMsg);
      } finally {
        setLoading(false);
        setAnalyzing(false);
      }
    };

    fetchAndAnalyze();
  }, [providerOnboardingId]);

  if (loading) {
    return (
      <div className="border-2 border-gray-300 rounded-lg p-4 flex items-center gap-2">
        <Loader className="w-4 h-4 animate-spin" />
        <span className="text-sm text-gray-600">{analyzing ? "Analyzing documents..." : "Loading insight..."}</span>
      </div>
    );
  }

  if (!insight || insight.status === "not_found") {
    return (
      <div className="border-2 border-gray-300 rounded-lg p-4">
        <p className="text-sm text-gray-600">No AI insight available.</p>
        <p className="text-xs text-gray-500 mt-1">Documents will be analyzed as they are uploaded.</p>
      </div>
    );
  }

  if (insight.status === "failed") {
    return (
      <div className="border-2 border-red-300 bg-red-50 rounded-lg p-4">
        <p className="text-sm text-red-700">⚠️ Analysis failed</p>
        <p className="text-xs text-red-600 mt-1">{insight.message}</p>
      </div>
    );
  }

  // Status === "done"
  const riskLevel = insight.risk_level || "medium";
  const colors = riskColors[riskLevel] || riskColors.medium;
  const RiskIcon = colors.icon;

  return (
    <div
      className={`border-2 ${colors.border} ${colors.bg} rounded-lg p-4 space-y-3`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <span className="font-semibold text-gray-800">🤖 AI Insight</span>
        </div>
        <div className={`flex items-center gap-1 px-3 py-1 rounded-full ${colors.badge}`}>
          <RiskIcon className="w-4 h-4" />
          <span className="text-xs font-semibold capitalize">{riskLevel} Risk</span>
        </div>
      </div>

      {/* Summary */}
      {insight.summary && (
        <p className="text-sm text-gray-700 leading-relaxed">{insight.summary}</p>
      )}

      {/* Highlights */}
      {insight.highlights && insight.highlights.length > 0 && (
        <ul className="space-y-1">
          {insight.highlights.map((highlight, idx) => (
            <li
              key={idx}
              className="text-sm text-gray-700 flex items-start gap-2"
            >
              <span className="text-blue-600 font-bold">•</span>
              <span>{highlight}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Footer note */}
      <p className="text-xs text-gray-500 pt-2 border-t border-current opacity-50">
        AI provides informational insights. Final approval decision rests with admin.
      </p>
    </div>
  );
}
