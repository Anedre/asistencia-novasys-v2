import { cn } from "@/lib/utils";

type PillVariant = "success" | "warn" | "danger" | "accent" | "muted";

interface StatusPillProps {
  variant?: PillVariant;
  label: React.ReactNode;
  icon?: React.ElementType;
  className?: string;
}

/**
 * StatusPill — Orbital badge with semantic color variants.
 */
export function StatusPill({ variant = "muted", label, icon: Icon, className }: StatusPillProps) {
  return (
    <span className={cn(`nova-pill ${variant}`, className)}>
      {Icon && <Icon className="h-3 w-3" />}
      {label}
    </span>
  );
}
