import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function StatCard({
  label,
  value,
  icon: Icon,
  color = "var(--color-primary)",
  trend,
  subtext,
  loading = false,
  className,
  ...props
}) {
  if (loading) {
    return (
      <div 
        className={cn("skeleton w-full h-[108px] rounded-xl border border-transparent", className)} 
        aria-hidden="true"
      />
    );
  }

  return (
    <Card 
      className={cn(
        "glass-card-hover group border-border bg-card/60 backdrop-blur-sm",
        props.onClick && "cursor-pointer transition-all duration-300 hover:border-primary/45 active:scale-[0.98]",
        className
      )}
      {...props}
    >
      <CardContent className="p-5 flex flex-col justify-between h-full group-data-[size=sm]/card:px-5 group-data-[size=sm]/card:py-5">
        {/* Header row: Icon & Trend */}
        <div className="flex items-center justify-between mb-4 w-full">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-105 shadow-sm"
            style={{ 
              background: `linear-gradient(135deg, ${color}22, ${color}0b)`,
              border: `1px solid ${color}22`
            }}
          >
            {Icon && <Icon size={20} style={{ color }} />}
          </div>
          
          {trend !== undefined && (
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                  trend >= 0 
                    ? "bg-success/10 text-success border border-success/20" 
                    : "bg-destructive/10 text-destructive border border-destructive/20"
                )}
              >
                {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}%
              </span>
            </div>
          )}
        </div>

        {/* Value and Label */}
        <div className="space-y-1">
          <p className="text-3xl font-bold tracking-tight text-foreground transition-transform duration-300 group-hover:translate-x-0.5">
            {value ?? "0"}
          </p>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            {subtext && (
              <span className="text-[10px] text-muted-foreground/80 font-mono">
                {subtext}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
