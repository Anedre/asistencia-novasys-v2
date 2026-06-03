"use client";

import { useEffect, type ReactNode } from "react";
import { IconSvg, Icons } from "@/components/nova/icons";

interface NovaModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Max width of the sheet in px (defaults to 480). */
  maxWidth?: number;
}

/**
 * Styled modal built on the design-system `.sheet` classes (backdrop blur +
 * spring entry). Replaces native window.confirm/prompt/alert with an on-brand
 * dialog. Closes on Escape and on backdrop click; locks body scroll while open.
 */
export function NovaModal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = 480,
}: NovaModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="sheet-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="sheet"
        style={{ maxWidth }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <div className="sheet-title">{title}</div>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Cerrar">
            <IconSvg d={Icons.x} size={16} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}
