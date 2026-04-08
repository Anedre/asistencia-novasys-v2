"use client";

/**
 * Reusable color picker: 6 presets + custom HEX input.
 * Used by the branding settings page and the /welcome wizard.
 */

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { COLOR_PRESETS } from "@/lib/constants/tenant-defaults";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function ColorPicker({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {COLOR_PRESETS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            className={cn(
              "relative h-11 w-11 rounded-xl ring-2 ring-offset-2 ring-offset-background transition hover:scale-105",
              value === c.value ? "ring-foreground" : "ring-transparent"
            )}
            style={{ background: c.value }}
            title={c.name}
            aria-label={c.name}
          >
            {value === c.value && (
              <Check className="absolute inset-0 m-auto h-5 w-5 text-white drop-shadow" />
            )}
          </button>
        ))}
        <label
          className={cn(
            "flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed text-xs text-muted-foreground transition",
            "hover:border-foreground hover:text-foreground",
            !COLOR_PRESETS.some((p) => p.value === value) &&
              "border-foreground text-foreground"
          )}
          title="Color personalizado"
        >
          +
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="sr-only"
          />
        </label>
      </div>
      <p className="font-mono text-xs text-muted-foreground">{value}</p>
    </div>
  );
}
