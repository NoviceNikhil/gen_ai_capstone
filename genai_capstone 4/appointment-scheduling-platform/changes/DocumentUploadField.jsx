import { useState } from "react";
import { Upload, Check, AlertCircle, Loader } from "lucide-react";
import toast from "react-hot-toast";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function DocumentUploadField({
  label,
  onDocumentVerified,
  providerOnboardingId,
  disabled = false,
}) {
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState("");

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      setError(null);
      setFileName(file.name);

      // Step 1: Upload file to existing storage endpoint
      // Adjust this endpoint based on your current upload implementation
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await axios.post(
        `${API_BASE_URL}/api/provider/upload-certificate`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          withCredentials: true,
        }
      );

      const fileUrl = uploadResponse.data.file_url;

      // Step 2: Verify document with AI
      const verifyResponse = await axios.post(
        `${API_BASE_URL}/api/provider/verify-document`,
        {
          file_url: fileUrl,
          provider_onboarding_id: providerOnboardingId,
        },
        { withCredentials: true }
      );

      const result = verifyResponse.data;

      if (result.status === "complete") {
        setVerified(true);
        setError(null);
        toast.success("✅ Document verified!");
        onDocumentVerified(true, result);
      } else if (result.status === "incomplete") {
        setVerified(false);
        const missing = result.missing_fields.join(", ");
        setError(`⚠️ ${missing} missing from this document`);
        toast.error(`Missing: ${missing}`);
        onDocumentVerified(false, result);
      }
    } catch (err) {
      setVerified(false);
      const errorMsg = err.response?.data?.detail || "Upload failed";
      setError(errorMsg);
      toast.error(errorMsg);
      onDocumentVerified(false, null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">{label}</label>

      <div className="relative">
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleFileUpload}
          disabled={disabled || loading}
          className="hidden"
          id={`upload-${label}`}
        />

        <label
          htmlFor={`upload-${label}`}
          className={`flex items-center justify-center px-4 py-2 border-2 border-dashed rounded-lg cursor-pointer transition ${
            loading
              ? "bg-gray-50 border-gray-300"
              : verified
              ? "bg-green-50 border-green-300"
              : error
              ? "bg-red-50 border-red-300"
              : "bg-white border-gray-300 hover:border-blue-400"
          }`}
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader className="w-4 h-4 animate-spin" />
              <span className="text-sm text-gray-600">Analyzing...</span>
            </div>
          ) : verified ? (
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-600">{fileName}</span>
            </div>
          ) : error ? (
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-sm text-red-600">{error}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600">
                Click to upload PDF or image
              </span>
            </div>
          )}
        </label>
      </div>
    </div>
  );
}
