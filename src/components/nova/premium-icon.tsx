import type { CSSProperties } from "react";

/**
 * Novaassistance — Premium duotone icon system.
 * Ported verbatim from the design handoff `premium-icons.jsx`.
 *
 * Recipe per icon: soft colored glow + gradient-filled body + white highlight
 * + crisp white detail strokes. Used for navigation, KPIs, statuses, and weather.
 * For small functional UI (arrows, chevrons, close, search) use the line icons
 * in `./icons` instead.
 *
 * The shared radial-gradient <defs> live in <PremiumIconDefs/>, which must be
 * mounted ONCE in the document (done in the root layout). Icons reference the
 * gradients by global id (url(#gAccent) …), so a single defs block serves all.
 *
 * The `tone` prop recolors the accent-based icons per category, matching the
 * corporate multicolor palette (Indigo / Teal / Violet / Amber / Rose / Slate …).
 */

export type PremiumIconTone =
  | "Accent"
  | "Indigo"
  | "Teal"
  | "Green"
  | "Amber"
  | "Violet"
  | "Rose"
  | "Slate"
  | "Gold";

// Base hexes used by the glow + crisp-detail strokes inside the icon bodies.
const C = {
  gold: "#F59E0B",
  accent: "#3FBEFF",
  green: "#10B981",
  amber: "#F59E0B",
  red: "#F43F5E",
  slate: "#94A3B8",
  violet: "#8B5CF6",
};

const glow = (c: string, r = 14) =>
  `<circle cx="22" cy="22" r="${r}" fill="${c}" opacity="0.13"/>`;
const hl = (x = 18.5, y = 18, r = 2.4) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="0.45"/>`;
const wd =
  'fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

const I: Record<string, string> = {
  // weather
  sun:
    glow(C.gold, 13.5) +
    `<g stroke="#F59E0B" stroke-width="2.4" stroke-linecap="round"><line x1="22" y1="4.5" x2="22" y2="9"/><line x1="34.4" y1="9.6" x2="31.2" y2="12.8"/><line x1="39.5" y1="22" x2="35" y2="22"/><line x1="34.4" y1="34.4" x2="31.2" y2="31.2"/><line x1="22" y1="39.5" x2="22" y2="35"/><line x1="9.6" y1="34.4" x2="12.8" y2="31.2"/><line x1="4.5" y1="22" x2="9" y2="22"/><line x1="9.6" y1="9.6" x2="12.8" y2="12.8"/></g><circle cx="22" cy="22" r="8.5" fill="url(#gGold)"/>` +
    hl(18.8, 18.8, 2.6),
  cloud:
    glow(C.slate) +
    `<path d="M14 31a6.5 6.5 0 010-13 8.5 8.5 0 0116.2-1.8A6.3 6.3 0 0130 31z" fill="url(#gSlate)"/>` +
    hl(16, 18, 2.2),
  rain:
    glow(C.accent) +
    `<path d="M14 27a6.5 6.5 0 010-13 8.5 8.5 0 0116.2-1.8A6.3 6.3 0 0130 27z" fill="url(#gAccent)"/><g ${wd}><line x1="16" y1="31" x2="14.5" y2="35"/><line x1="22" y1="31" x2="20.5" y2="35"/><line x1="28" y1="31" x2="26.5" y2="35"/></g>` +
    hl(16, 18, 2.2),
  // status
  clock:
    glow(C.green) +
    `<circle cx="22" cy="22" r="13" fill="url(#gGreen)"/><path ${wd} d="M22 14.5V22l5 3"/><circle cx="22" cy="22" r="1.6" fill="#fff"/>` +
    hl(17, 16, 2.6),
  coffee:
    glow(C.amber) +
    `<path d="M8 14h18v8a6 6 0 01-6 6h-6a6 6 0 01-6-6z" fill="url(#gAmber)"/><path ${wd} d="M26 16h3.5a3.5 3.5 0 010 7H26"/><g ${wd}><path d="M13 6v3.5M19 6v3.5"/></g>` +
    hl(13, 18, 2.4),
  check:
    glow(C.accent) +
    `<circle cx="22" cy="22" r="13" fill="url(#gAccent)"/><path ${wd} d="M16 22.5l4 4 8-8.5"/>` +
    hl(17, 16, 2.6),
  alert:
    glow(C.red) +
    `<path d="M22 6.5l14.5 25.5h-29z" fill="url(#gRed)"/><path ${wd} d="M22 16.5v7"/><circle cx="22" cy="28" r="1.3" fill="#fff"/>` +
    hl(18, 17, 2.2),
  absent:
    glow(C.red) +
    `<circle cx="22" cy="22" r="13" fill="url(#gRed)"/><path ${wd} d="M17.5 17.5l9 9M26.5 17.5l-9 9"/>` +
    hl(17, 16, 2.6),
  // nav
  dashboard:
    glow(C.accent) +
    `<g fill="url(#gAccent)"><rect x="7" y="7" width="13" height="16" rx="3.5"/><rect x="24" y="7" width="13" height="9.5" rx="3.5"/><rect x="24" y="20.5" width="13" height="16.5" rx="3.5"/><rect x="7" y="27" width="13" height="10" rx="3.5"/></g>` +
    hl(11, 11, 2.2),
  users:
    glow(C.accent) +
    `<g fill="url(#gAccent)"><circle cx="17" cy="15" r="6"/><path d="M6 35c0-6 5-9.5 11-9.5S28 29 28 35z"/><circle cx="30" cy="16.5" r="4.3"/><path d="M28.5 25.5c4.2 0 7.5 3 7.5 7.5"/></g>` +
    hl(14, 12.5, 2.4),
  user:
    glow(C.accent) +
    `<g fill="url(#gAccent)"><circle cx="22" cy="15" r="7"/><path d="M8 37c0-7 6-11 14-11s14 4 14 11z"/></g>` +
    hl(18, 12, 2.6),
  calendar:
    glow(C.accent) +
    `<rect x="7" y="9" width="30" height="28" rx="5" fill="url(#gAccent)"/><g ${wd}><path d="M7 17h30"/><path d="M15 5.5V12M29 5.5V12"/></g><g fill="#fff"><circle cx="16" cy="24" r="1.5"/><circle cx="22" cy="24" r="1.5"/><circle cx="28" cy="24" r="1.5"/><circle cx="16" cy="30" r="1.5"/><circle cx="22" cy="30" r="1.5"/></g>` +
    hl(13, 14, 2.4),
  chart:
    glow(C.accent) +
    `<rect x="7" y="7" width="30" height="30" rx="7" fill="url(#gAccent)"/><path ${wd} d="M14 26l5-5 4 4 7-7.5"/><circle cx="30" cy="17.5" r="1.6" fill="#fff"/>` +
    hl(13, 13, 2.4),
  settings:
    glow(C.accent) +
    `<circle cx="22" cy="22" r="13" fill="url(#gAccent)"/><circle ${wd} cx="22" cy="22" r="4.6"/><g ${wd} stroke-width="2.2"><path d="M22 9.5v3M22 31.5v3M9.5 22h3M31.5 22h3M13.2 13.2l2.1 2.1M28.7 28.7l2.1 2.1M13.2 30.8l2.1-2.1M28.7 15.3l2.1-2.1"/></g>` +
    hl(16, 15, 2.4),
  chat:
    glow(C.accent) +
    `<path d="M11 8h22a4 4 0 014 4v9a4 4 0 01-4 4H18l-6 5v-5a4 4 0 01-4-4v-9a4 4 0 013-4z" fill="url(#gAccent)"/><g ${wd}><path d="M15 16.5h14M15 21.5h9"/></g>` +
    hl(14, 13, 2.4),
  home:
    glow(C.accent) +
    `<path d="M22 7l14 12v16a2.5 2.5 0 01-2.5 2.5h-23A2.5 2.5 0 018 35V19z" fill="url(#gAccent)"/><path ${wd} d="M18 36V25h8v11"/>` +
    hl(15, 16, 2.2),
  history:
    glow(C.accent) +
    `<circle cx="22" cy="22" r="13" fill="url(#gAccent)"/><path ${wd} d="M22 15v7.5l5 3"/><path ${wd} d="M11 18.5A12 12 0 0122 12"/>` +
    hl(17, 16, 2.4),
  feed:
    glow(C.accent) +
    `<rect x="7" y="7" width="30" height="30" rx="7" fill="url(#gAccent)"/><g ${wd}><path d="M14 15h16M14 22h16M14 29h10"/></g>` +
    hl(13, 13, 2.2),
  building:
    glow(C.accent) +
    `<rect x="10" y="6" width="24" height="32" rx="4" fill="url(#gAccent)"/><g fill="#fff"><rect x="16" y="13" width="4" height="4" rx="1"/><rect x="24" y="13" width="4" height="4" rx="1"/><rect x="16" y="21" width="4" height="4" rx="1"/><rect x="24" y="21" width="4" height="4" rx="1"/><rect x="19" y="30" width="6" height="8" rx="1.5"/></g>` +
    hl(15, 11, 2.2),
  briefcase:
    glow(C.accent) +
    `<rect x="6" y="14" width="32" height="22" rx="5" fill="url(#gAccent)"/><path ${wd} d="M16 14v-2.5a3 3 0 013-3h6a3 3 0 013 3V14"/><path ${wd} d="M6 24h32"/>` +
    hl(13, 19, 2.2),
  doc:
    glow(C.accent) +
    `<path d="M13 6h11l8 8v22a2 2 0 01-2 2H13a2 2 0 01-2-2V8a2 2 0 012-2z" fill="url(#gAccent)"/><path ${wd} d="M24 6v8h8"/><g ${wd}><path d="M16 24h12M16 30h8"/></g>` +
    hl(16, 13, 2.2),
  pulse:
    glow(C.accent) +
    `<rect x="7" y="7" width="30" height="30" rx="7" fill="url(#gAccent)"/><path ${wd} d="M12 22h4l3-7 5 13 3-6h5"/>` +
    hl(13, 13, 2.2),
  shield:
    glow(C.accent) +
    `<path d="M22 6l13 4.8v10c0 8-5.5 13-13 14.5C13.5 33.8 8 28.8 8 20.8v-10z" fill="url(#gAccent)"/><path ${wd} d="M16.5 21.5l4 4 7-7.5"/>` +
    hl(16, 14, 2.4),
  // action / utility
  pin:
    glow(C.accent) +
    `<path d="M22 38s-12-11-12-20a12 12 0 0124 0c0 9-12 20-12 20z" fill="url(#gAccent)"/><circle cx="22" cy="18" r="4" fill="#fff"/>` +
    hl(17, 12, 2.2),
  bell:
    glow(C.accent) +
    `<path d="M11 29c0-1.8 1.5-3 1.5-10a9.5 9.5 0 0119 0c0 7 1.5 8.2 1.5 10z" fill="url(#gAccent)"/><path ${wd} d="M18 33a4 4 0 008 0"/>` +
    hl(16, 14, 2.4),
  download:
    glow(C.accent) +
    `<rect x="7" y="7" width="30" height="30" rx="7" fill="url(#gAccent)"/><path ${wd} d="M22 14v11M17 20.5l5 5 5-5"/>` +
    hl(13, 13, 2.4),
  edit:
    glow(C.accent) +
    `<path d="M9 35l1.5-7L27 11.5l5.5 5.5L16 33.5z" fill="url(#gAccent)"/><path ${wd} d="M24 14.5l5.5 5.5"/>` +
    hl(15, 17, 2.2),
  beach:
    glow(C.gold) +
    `<path d="M9 26a13 13 0 0126 0z" fill="url(#gGold)"/><g fill="none" stroke="#0096D6" stroke-width="2" stroke-linecap="round"><path d="M7 31c2-2 4-2 6 0s4 2 6 0 4-2 6 0 4 2 6 0 4-2 6 0"/></g>` +
    hl(17, 18, 2.4),
  mail:
    glow(C.accent) +
    `<rect x="6" y="9" width="32" height="26" rx="5" fill="url(#gAccent)"/><path ${wd} d="M8 13l14 11 14-11"/>` +
    hl(13, 14, 2.2),
  lock:
    glow(C.accent) +
    `<rect x="9" y="19" width="26" height="18" rx="5" fill="url(#gAccent)"/><path ${wd} d="M15 19v-4a7 7 0 0114 0v4"/><circle cx="22" cy="27" r="2.2" fill="#fff"/><path ${wd} d="M22 28.5V31"/>` +
    hl(14, 24, 2.2),
  phone:
    glow(C.accent) +
    `<path d="M14 7h16a3 3 0 013 3v24a3 3 0 01-3 3H14a3 3 0 01-3-3V10a3 3 0 013-3z" fill="url(#gAccent)"/><path ${wd} d="M19 32h6"/>` +
    hl(16, 13, 2.2),
  heart:
    glow(C.red) +
    `<path d="M22 35S8 27 8 17a7 7 0 0114-3 7 7 0 0114 3c0 10-14 18-14 18z" fill="url(#gRed)"/>` +
    hl(16, 16, 2.6),
  cake:
    glow(C.amber) +
    `<path d="M9 24a4 4 0 014-4h18a4 4 0 014 4v11a2 2 0 01-2 2H11a2 2 0 01-2-2z" fill="url(#gAmber)"/><g ${wd}><path d="M9 29c2.2 0 2.2 2 4.3 2s2.2-2 4.4-2 2.2 2 4.3 2 2.2-2 4.4-2 2.2 2 4.3 2"/><path d="M15 20v-4M22 20v-5M29 20v-4"/></g><g fill="#fff"><circle cx="15" cy="14" r="1.4"/><circle cx="22" cy="13" r="1.4"/><circle cx="29" cy="14" r="1.4"/></g>` +
    hl(14, 24, 2.2),
  party:
    glow(C.violet) +
    `<path d="M8 36l5-15 11 4z" fill="url(#gViolet)"/><g fill="none" stroke="#7C3AED" stroke-width="2" stroke-linecap="round"><path d="M24 9c2 0 2 2 4 2M28 16c2 0 2-2 4-2M30 22l3-1M27 8l1-3"/></g>` +
    hl(13, 28, 2),
  send:
    glow(C.accent) +
    `<path d="M37 7L7 19l11 4 4 11z" fill="url(#gAccent)"/><path ${wd} d="M37 7L18 23"/>` +
    hl(15, 16, 2.2),
  dollar:
    glow(C.green) +
    `<circle cx="22" cy="22" r="13" fill="url(#gGreen)"/><path ${wd} d="M22 14v16M26 17.5c-1-1.5-2.5-2-4-2-2.2 0-4 1.2-4 3.2s2 2.8 4 3.3 4 1.3 4 3.3-1.8 3.2-4 3.2c-1.6 0-3.2-.6-4-2"/>` +
    hl(17, 16, 2.4),
  trendUp:
    glow(C.green) +
    `<rect x="7" y="7" width="30" height="30" rx="7" fill="url(#gGreen)"/><path ${wd} d="M13 28l6-6 4 4 8-8.5"/><path ${wd} d="M26 17h6v6"/>` +
    hl(13, 13, 2.2),
  timer:
    glow(C.violet) +
    `<circle cx="22" cy="23" r="13" fill="url(#gViolet)"/><path ${wd} d="M22 16v7l4 2.5"/><path ${wd} d="M17 6h10"/>` +
    hl(17, 17, 2.4),
  help:
    glow(C.accent) +
    `<circle cx="22" cy="22" r="13" fill="url(#gAccent)"/><path ${wd} d="M18 18.5a4 4 0 017.5 1.8c0 2.7-3.5 3-3.5 5"/><circle cx="22" cy="29.5" r="1.4" fill="#fff"/>` +
    hl(17, 16, 2.4),
};

// tone → glow hex (for recoloring accent-based icons per category)
const TONE_HEX: Record<PremiumIconTone, string> = {
  Accent: "#3FBEFF",
  Indigo: "#6366F1",
  Teal: "#14B8A6",
  Green: "#10B981",
  Amber: "#F59E0B",
  Violet: "#8B5CF6",
  Rose: "#FB7185",
  Slate: "#94A3B8",
  Gold: "#F59E0B",
};

export type PremiumIconName = keyof typeof I;

export const PREMIUM_ICON_NAMES = Object.keys(I);

export function hasPremiumIcon(name: string): boolean {
  return !!I[name];
}

/**
 * Shared radial-gradient defs. Render exactly ONCE per document (root layout).
 * Icons reference these by global id, so a single hidden svg serves the whole app.
 */
export function PremiumIconDefs() {
  return (
    <svg
      id="__nova_icon_defs"
      width="0"
      height="0"
      aria-hidden="true"
      style={{ position: "absolute" }}
    >
      <defs>
        <radialGradient id="gGold" cx="0.4" cy="0.34" r="0.75">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="55%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#F59E0B" />
        </radialGradient>
        <radialGradient id="gAccent" cx="0.4" cy="0.32" r="0.8">
          <stop offset="0%" stopColor="#BAE6FD" />
          <stop offset="55%" stopColor="#3FBEFF" />
          <stop offset="100%" stopColor="#0096D6" />
        </radialGradient>
        <radialGradient id="gGreen" cx="0.4" cy="0.32" r="0.8">
          <stop offset="0%" stopColor="#6EE7B7" />
          <stop offset="55%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#059669" />
        </radialGradient>
        <radialGradient id="gAmber" cx="0.4" cy="0.32" r="0.8">
          <stop offset="0%" stopColor="#FCD34D" />
          <stop offset="55%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </radialGradient>
        <radialGradient id="gRed" cx="0.4" cy="0.32" r="0.8">
          <stop offset="0%" stopColor="#FDA4AF" />
          <stop offset="55%" stopColor="#F43F5E" />
          <stop offset="100%" stopColor="#E11D48" />
        </radialGradient>
        <radialGradient id="gSlate" cx="0.4" cy="0.32" r="0.8">
          <stop offset="0%" stopColor="#E2E8F0" />
          <stop offset="55%" stopColor="#94A3B8" />
          <stop offset="100%" stopColor="#64748B" />
        </radialGradient>
        <radialGradient id="gViolet" cx="0.4" cy="0.32" r="0.8">
          <stop offset="0%" stopColor="#DDD6FE" />
          <stop offset="55%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#7C3AED" />
        </radialGradient>
        <radialGradient id="gIndigo" cx="0.4" cy="0.32" r="0.8">
          <stop offset="0%" stopColor="#C7D2FE" />
          <stop offset="55%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#4F46E5" />
        </radialGradient>
        <radialGradient id="gTeal" cx="0.4" cy="0.32" r="0.8">
          <stop offset="0%" stopColor="#99F6E4" />
          <stop offset="55%" stopColor="#14B8A6" />
          <stop offset="100%" stopColor="#0D9488" />
        </radialGradient>
        <radialGradient id="gRose" cx="0.4" cy="0.32" r="0.8">
          <stop offset="0%" stopColor="#FECDD3" />
          <stop offset="55%" stopColor="#FB7185" />
          <stop offset="100%" stopColor="#E11D48" />
        </radialGradient>
      </defs>
    </svg>
  );
}

interface PremiumIconProps {
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
  tone?: PremiumIconTone;
}

export function PremiumIcon({
  name,
  size = 20,
  className,
  style,
  tone,
}: PremiumIconProps) {
  let inner = I[name];
  if (!inner) {
    // Unknown name → fall back to a simple accent dot, matching the design.
    return (
      <span
        className={className}
        style={{
          display: "inline-block",
          width: size,
          height: size,
          borderRadius: "50%",
          background: "var(--accent)",
          ...style,
        }}
      />
    );
  }
  if (tone && tone !== "Accent" && TONE_HEX[tone]) {
    inner = inner
      .split("url(#gAccent)")
      .join("url(#g" + tone + ")")
      .split('fill="#3FBEFF" opacity="0.13"')
      .join('fill="' + TONE_HEX[tone] + '" opacity="0.13"');
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      className={className}
      style={{ display: "block", ...style }}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}
