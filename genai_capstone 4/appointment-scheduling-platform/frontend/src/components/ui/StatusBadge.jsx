import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  pending: {
    borderColor: "border-l-status-pending",
    dotColor: "bg-status-pending",
    label: "PENDING",
  },
  confirmed: {
    borderColor: "border-l-status-confirmed",
    dotColor: "bg-status-confirmed",
    label: "CONFIRMED",
  },
  completed: {
    borderColor: "border-l-status-completed",
    dotColor: "bg-status-completed",
    label: "COMPLETED",
  },
  cancelled: {
    borderColor: "border-l-status-cancelled",
    dotColor: "bg-status-cancelled",
    label: "CANCELLED",
  },
  rejected: {
    borderColor: "border-l-status-rejected",
    dotColor: "bg-status-rejected",
    label: "REJECTED",
  },
  verified: {
    borderColor: "border-l-success",
    dotColor: "bg-success",
    label: "VERIFIED",
  },
  pending_approval: {
    borderColor: "border-l-warning",
    dotColor: "bg-warning",
    label: "PENDING APPROVAL",
  },
};

export default function StatusBadge({ status = "pending", className }) {
  const normStatus = status?.toLowerCase()?.replace(/[\s_-]+/g, "_") || "pending";
  const config = STATUS_CONFIG[normStatus] || {
    borderColor: "border-l-status-pending",
    dotColor: "bg-status-pending",
    label: status?.toUpperCase() || "PENDING",
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md border-y border-r border-l-4 border-border bg-card text-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider gap-1.5 h-6 shrink-0 items-center justify-center inline-flex",
        config.borderColor,
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", config.dotColor)} />
      <span>{config.label}</span>
    </Badge>
  );
}
