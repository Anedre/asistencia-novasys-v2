"use client";

/**
 * Anchored dropdown used by the report filter bar.
 *
 * Portaled to the `.nva-app` root and positioned `fixed`, same approach as
 * NovaDatePicker: the filter bar sits inside `.table-wrap`/`.panel`, both of
 * which clip overflow, so an absolutely-positioned panel would be cut off.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconSvg } from "@/components/nova/icons";

interface Props {
  label: ReactNode;
  icon?: ReactNode;
  /** Small count bubble on the trigger — how many options are active. */
  badge?: number;
  width?: number;
  /** Max height of the scrollable body. */
  maxHeight?: number;
  align?: "left" | "right";
  disabled?: boolean;
  title?: string;
  children: ReactNode | ((close: () => void) => ReactNode);
}

export function FilterPopover({
  label,
  icon,
  badge,
  width = 300,
  maxHeight = 380,
  align = "left",
  disabled,
  title,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const [posn, setPosn] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  function computePos() {
    const el = triggerRef.current;
    if (!el || typeof window === "undefined") return;
    const r = el.getBoundingClientRect();
    const wantLeft = align === "right" ? r.right - width : r.left;
    const left = Math.max(8, Math.min(wantLeft, window.innerWidth - width - 8));
    // Flip above the trigger when the panel would run off the bottom.
    const estimated = maxHeight + 90;
    let top = r.bottom + 6;
    if (top + estimated > window.innerHeight - 8 && r.top - estimated - 6 > 8) {
      top = r.top - estimated - 6;
    }
    setPosn({ top, left });
  }

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onReflow = () => computePos();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const portalTarget =
    typeof document !== "undefined"
      ? document.querySelector(".nva-app") ?? document.body
      : null;

  const panel =
    open && posn && portalTarget
      ? createPortal(
          <div
            ref={popRef}
            className="ndp-pop"
            role="dialog"
            style={{
              position: "fixed",
              top: posn.top,
              left: posn.left,
              width,
              padding: 10,
              maxHeight: maxHeight + 80,
              overflowY: "auto",
            }}
          >
            {typeof children === "function" ? children(() => setOpen(false)) : children}
          </div>,
          portalTarget
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`chip ${open || (badge ?? 0) > 0 ? "active" : ""}`}
        title={title}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (!open) computePos();
          setOpen((o) => !o);
        }}
        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
      >
        {icon && <IconSvg d={icon} size={13} />}
        {label}
        {(badge ?? 0) > 0 && (
          <span
            style={{
              background: "var(--accent)",
              color: "#fff",
              borderRadius: 999,
              fontSize: 10,
              fontWeight: 700,
              minWidth: 16,
              height: 16,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
            }}
          >
            {badge}
          </span>
        )}
        <IconSvg d="M6 9l6 6 6-6" size={12} />
      </button>
      {panel}
    </>
  );
}

/** Section heading inside a popover. */
export function PopoverGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 0.4,
          color: "var(--text-muted)",
          margin: "4px 0 6px",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

/** Checkbox row with an optional hint line. */
export function PopoverCheck({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "5px 6px",
        borderRadius: "var(--r)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        background: checked ? "var(--accent-soft)" : "transparent",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        style={{ accentColor: "var(--accent)", marginTop: 2 }}
      />
      <span style={{ minWidth: 0 }}>
        <span style={{ fontSize: 12, color: "var(--text-primary)", display: "block" }}>{label}</span>
        {hint && (
          <span style={{ fontSize: 10, color: "var(--text-muted)", display: "block", lineHeight: 1.3 }}>
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}
