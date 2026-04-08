"use client";

/**
 * Sticky footer shown at the bottom of a settings section when there are
 * unsaved changes. Provides Discard and Save actions.
 *
 * Animates in from the bottom when `dirty` flips to true.
 */

import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  saveLabel?: string;
}

export function SettingsFooter({
  dirty,
  saving,
  onSave,
  onDiscard,
  saveLabel = "Guardar cambios",
}: Props) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 -mx-4 mt-6 border-t bg-background/95 px-4 py-3 backdrop-blur transition-all duration-200 sm:-mx-6 sm:px-6",
        dirty
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-2 opacity-0"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {dirty ? "Tienes cambios sin guardar" : ""}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDiscard}
            disabled={saving}
          >
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Descartar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-4 w-4" />
            )}
            {saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
