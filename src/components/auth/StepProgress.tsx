"use client";

/**
 * Horizontal step progress indicator for multi-step auth flows.
 * - Filled circles with checkmarks for completed steps
 * - Primary-colored circle for current step
 * - Muted circles + lines for upcoming steps
 */

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  label: string;
}

interface Props {
  steps: Step[];
  currentIndex: number;
}

export function StepProgress({ steps, currentIndex }: Props) {
  return (
    <div className="flex w-full items-center gap-1">
      {steps.map((step, i) => {
        const isDone = i < currentIndex;
        const isCurrent = i === currentIndex;
        const isLast = i === steps.length - 1;

        return (
          <div key={step.id} className="flex flex-1 items-center gap-1">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all",
                  isDone &&
                    "bg-primary text-primary-foreground",
                  isCurrent &&
                    "bg-primary text-primary-foreground ring-4 ring-primary/20",
                  !isDone && !isCurrent &&
                    "bg-muted text-muted-foreground"
                )}
              >
                {isDone ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium whitespace-nowrap",
                  (isDone || isCurrent)
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div
                className={cn(
                  "mb-5 h-0.5 flex-1 rounded-full transition-colors",
                  isDone ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
