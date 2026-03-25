"use client";

import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/lib/constants/event-types";
import type { DayStatus } from "@/lib/types";

interface StatusBadgeProps {
  status: DayStatus | string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_LABELS[status] ?? {
    label: status,
    variant: "outline" as const,
  };

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
