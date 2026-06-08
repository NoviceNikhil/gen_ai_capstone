import toast from "react-hot-toast";
import { X } from "lucide-react";

function ToastBody({ t, message }) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-sm font-medium leading-snug flex-1">{message}</div>
      <button
        type="button"
        onClick={() => toast.dismiss(t.id)}
        className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors cursor-pointer"
        aria-label="Dismiss toast"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function appointmentToastSuccess(message, opts = {}) {
  return toast.custom((t) => <ToastBody t={t} message={message} />, {
    duration: 6000,
    ...opts,
  });
}

export function appointmentToastError(message, opts = {}) {
  return toast.custom((t) => <ToastBody t={t} message={message} />, {
    duration: 8000,
    ...opts,
  });
}

