"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

/**
 * Popover menu ("chip dropdown") used by the topbar user chip and the sidebar
 * company card. Ported from the design bundle's `Menu` component (shared.jsx).
 *
 * Clicking the trigger toggles; clicking the backdrop or any item closes it.
 */
export function NovaMenu({
  trigger,
  children,
  align = "right",
  dir = "down",
  width,
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  dir?: "up" | "down";
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const popStyle = width ? ({ minWidth: width } as CSSProperties) : undefined;
  return (
    <div className="pop-wrap">
      <div className="pop-trigger" onClick={() => setOpen((o) => !o)}>
        {trigger}
      </div>
      {open && (
        <>
          <div className="pop-backdrop" onClick={() => setOpen(false)} />
          <div className={`pop ${dir} ${align}`} style={popStyle} onClick={() => setOpen(false)} role="menu">
            {children}
          </div>
        </>
      )}
    </div>
  );
}
