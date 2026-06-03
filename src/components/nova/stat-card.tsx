import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  suffix?: string;
  hint?: string;
  icon?: React.ElementType;
  delta?: number;
  deltaLabel?: string;
  loading?: boolean;
  accent?: boolean;
  className?: string;
}

/**
 * StatCard — single metric tile from the Orbital design system.
 * Compact, monochrome, with optional accent variant for the "primary" metric.
 */
export function StatCard({
  label,
  value,
  suffix,
  hint,
  icon: Icon,
  delta,
  deltaLabel,
  loading,
  accent,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "relative rounded-[14px] border bg-card p-4 transition-all nova-card-hover",
        accent &&
          "bg-gradient-to-br from-[color:var(--accent-soft)] to-transparent border-[color-mix(in_oklch,var(--accent)_30%,var(--border))]",
        className
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        {Icon && (
          <div
            className={cn(
              "flex h-6.5 w-6.5 size-[26px] items-center justify-center rounded-[6px]",
              "bg-[color:var(--accent-soft)] text-[color:var(--nova-cyan-strong)] dark:text-[color:var(--nova-cyan)]"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </div>
        )}
        <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
      </div>

      <div className="flex items-baseline justify-between gap-2">
        {loading ? (
          <Skeleton className="h-7 w-20" />
        ) : (
          <div className="flex items-baseline gap-1">
            <span className="nova-stat-value">{value}</span>
            {suffix && (
              <span className="text-base font-semibold text-muted-foreground ml-0.5">
                {suffix}
              </span>
            )}
          </div>
        )}
        {!loading && typeof delta === "number" && (
          <span
            className={cn(
              "nova-stat-delta",
              delta >= 0 ? "up" : "down"
            )}
            title={deltaLabel}
          >
            {delta >= 0 ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {Math.abs(delta)}%
          </span>
        )}
      </div>

      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
