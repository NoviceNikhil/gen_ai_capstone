import { useEffect, useState } from "react";
import { CreditCard, IndianRupee, ReceiptText, ArrowLeftRight, CheckCircle2, AlertTriangle, HelpCircle, XCircle } from "lucide-react";
import { getMyPaymentRecordsAPI, getMyRefundRecordsAPI } from "../../services/apiService";
import LoadingSpinner from "../../components/LoadingSpinner";
import toast from "react-hot-toast";

export default function CustomerPayments() {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [activeTab, setActiveTab] = useState("transactions"); // transactions | refunds

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [payRes, refRes] = await Promise.all([
          getMyPaymentRecordsAPI(),
          getMyRefundRecordsAPI()
        ]);
        setPayments(payRes.data?.data?.payments || []);
        setRefunds(refRes.data?.data?.refunds || []);
      } catch (e) {
        toast.error(e?.response?.data?.message || "Failed to load payment history");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const totalPaid = payments
    .filter(p => p.status === "paid" || p.status === "partially_refunded")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const totalRefunded = refunds
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);

  const totalDeducted = refunds
    .reduce((sum, r) => sum + Number(r.penalty_deducted || 0), 0);

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fade-in min-h-screen text-foreground relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-heading mb-1.5">Payments & Refunds</h1>
          <p className="text-sm text-text-muted font-medium">View your transaction history and refunds ledger</p>
        </div>
      </div>

      {/* Summary Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <StatTile icon={ReceiptText} label="Transactions" value={payments.length} />
        <StatTile icon={CreditCard} label="Total Paid" value={`₹${totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
        <StatTile icon={ArrowLeftRight} label="Total Refunded" value={`₹${totalRefunded.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} accent />
        <StatTile icon={IndianRupee} label="Retained (Penalty)" value={`₹${totalDeducted.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
      </div>

      {/* Tab Selectors */}
      <div className="flex border-b border-border/80 mb-6 gap-6">
        <button
          onClick={() => setActiveTab("transactions")}
          className={`pb-3 text-sm font-bold tracking-wide uppercase transition-colors relative ${
            activeTab === "transactions" ? "text-primary border-b-2 border-primary" : "text-text-muted hover:text-foreground"
          }`}
        >
          Transactions ({payments.length})
        </button>
        <button
          onClick={() => setActiveTab("refunds")}
          className={`pb-3 text-sm font-bold tracking-wide uppercase transition-colors relative ${
            activeTab === "refunds" ? "text-primary border-b-2 border-primary" : "text-text-muted hover:text-foreground"
          }`}
        >
          Refunds Ledger ({refunds.length})
        </button>
      </div>

      {loading ? (
        <div className="py-12"><LoadingSpinner /></div>
      ) : activeTab === "transactions" ? (
        <div className="space-y-4">
          {payments.map((pay) => (
            <div key={pay.id} className="rounded-2xl border border-border bg-surface-1 p-5 shadow-sm transition-all hover:shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1.5">
                  <p className="font-bold text-base leading-none text-foreground">{pay.provider_name}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getPaymentStatusStyles(pay.status)}`}>
                    {pay.status.toUpperCase().replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-text-muted font-medium mb-2">
                  Session Date: {pay.appointment_date || "N/A"} · {pay.time_slot || "N/A"}
                </p>
                {pay.razorpay_payment_id && (
                  <p className="text-[10px] font-mono text-text-faint">
                    ID: {pay.razorpay_payment_id}
                  </p>
                )}
              </div>
              <div className="text-right flex flex-col items-end justify-center">
                <p className="text-lg font-extrabold font-heading text-foreground">₹{Number(pay.amount || 0).toFixed(2)}</p>
                <p className="text-[10px] text-text-faint mt-0.5">
                  {pay.created_at ? new Date(pay.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ""}
                </p>
              </div>
            </div>
          ))}
          {payments.length === 0 && (
            <EmptyState message="No transactions recorded yet." />
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {refunds.map((ref) => (
            <div key={ref.id} className="rounded-2xl border border-border bg-surface-1 p-5 shadow-sm transition-all hover:shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1.5">
                  <p className="font-bold text-base leading-none text-foreground">{ref.provider_name}</p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
                    REFUND {ref.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-text-muted font-medium mb-2">
                  Original slot: {ref.appointment_date || "N/A"} · {ref.time_slot || "N/A"}
                </p>
                {ref.reason && (
                  <p className="text-xs text-amber-600/90 font-medium max-w-lg">
                    Reason: {ref.reason}
                  </p>
                )}
              </div>
              <div className="text-right flex flex-col items-end justify-center">
                <p className="text-lg font-extrabold font-heading text-emerald-500">₹{Number(ref.amount || 0).toFixed(2)}</p>
                {Number(ref.penalty_deducted || 0) > 0 && (
                  <p className="text-[10px] text-red-500 font-bold mt-0.5">
                    Deducted penalty: ₹{Number(ref.penalty_deducted).toFixed(2)}
                  </p>
                )}
                <p className="text-[10px] text-text-faint mt-1">
                  {ref.created_at ? new Date(ref.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ""}
                </p>
              </div>
            </div>
          ))}
          {refunds.length === 0 && (
            <EmptyState message="No refunds recorded yet." />
          )}
        </div>
      )}
    </div>
  );
}

function StatTile({ icon: Icon, label, value, accent = false }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-1 p-5 shadow-sm">
      <div className="flex items-center gap-2 text-text-faint mb-3">
        <Icon size={15} />
        <p className="text-[10px] font-bold tracking-wider uppercase font-mono">{label}</p>
      </div>
      <p className={`text-2xl font-extrabold font-heading ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-1 p-12 text-center flex flex-col items-center">
      <div className="w-14 h-14 rounded-full bg-surface-2 border border-border flex items-center justify-center mb-4">
        <HelpCircle size={22} className="text-text-muted" />
      </div>
      <p className="text-text-muted text-sm font-semibold">{message}</p>
    </div>
  );
}

function getPaymentStatusStyles(status) {
  switch (status) {
    case "paid":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-500";
    case "refunded":
      return "border-info/20 bg-info/10 text-info";
    case "partially_refunded":
      return "border-amber-500/20 bg-amber-500/10 text-amber-500";
    case "failed":
      return "border-error/20 bg-error/10 text-error";
    default:
      return "border-amber-500/20 bg-amber-500/10 text-amber-500";
  }
}
