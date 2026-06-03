import type { ReactNode } from "react";

/**
 * Icons set — the canonical icon library for Asistencia Novasys.
 *
 * Use this with `<IconSvg d={Icons.users} size={18} />` in:
 *  - every page (`src/app/**`)
 *  - every Novaassistance custom component (`src/components/nova`, `shared`,
 *    `admin`, `attendance`, `feed`, `messaging`, `notifications`, …)
 *
 * `lucide-react` icons are reserved for the shadcn primitives in
 * `src/components/ui/*` (calendar, dialog, dropdown-menu, etc.) because
 * those primitives ship lucide as their default chrome. Don't mix the two
 * in feature code — the stroke widths and proportions differ subtly and
 * the drift is the kind of "polish" gap users feel without being able to
 * articulate.
 *
 * If you need an icon that's not here, ADD IT (copy the path from a public
 * icon set, scale to 24×24, stroke-width 1.6) rather than reaching for
 * lucide.
 */

export const Icons: Record<string, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  home: (
    <>
      <path d="M3 12l9-9 9 9" />
      <path d="M5 10v10h14V10" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15 20c0-2.5 2-4.5 4.5-4.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  check: (
    <>
      <path d="M9 11l3 3 7-7" />
      <path d="M20 12v6a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h9" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3l10 17H2L12 3z" />
      <line x1="12" y1="10" x2="12" y2="14" />
      <circle cx="12" cy="17" r="0.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 3v4M16 3v4" />
    </>
  ),
  doc: (
    <>
      <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" />
      <path d="M14 3v6h6" />
    </>
  ),
  pulse: <path d="M3 12h4l2-7 4 14 2-7h6" />,
  building: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3h.1a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8v.1a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
    </>
  ),
  chat: <path d="M21 12a8 8 0 11-3.5-6.6L21 4l-1 4.5A8 8 0 0121 12z" />,
  feed: <path d="M3 5h18M3 12h18M3 19h12" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M21 21l-5-5" />
    </>
  ),
  bell: (
    <>
      <path d="M6 8a6 6 0 0112 0c0 5 2 7 2 7H4s2-2 2-7z" />
      <path d="M10 21h4" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </>
  ),
  arrowLeft: (
    <>
      <path d="M19 12H5" />
      <path d="M11 6l-6 6 6 6" />
    </>
  ),
  chevron: <path d="M9 6l6 6-6 6" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  pin: (
    <>
      <path d="M12 21s-7-7-7-12a7 7 0 0114 0c0 5-7 12-7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  card: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6l-6 6-6 6" />,
  filter: <path d="M3 5h18l-7 9v6l-4-2v-4z" />,
  download: (
    <>
      <path d="M12 3v13" />
      <path d="M7 11l5 5 5-5" />
      <path d="M4 21h16" />
    </>
  ),
  upload: (
    <>
      <path d="M12 21V8" />
      <path d="M17 13l-5-5-5 5" />
      <path d="M4 3h16" />
    </>
  ),
  edit: (
    <>
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 109-9c-3.5 0-6.6 2-8 5" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 7 9-7" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M2 12s4-7 10-7c2.4 0 4.5 1 6.3 2.4" />
      <path d="M9.9 5.2A10 10 0 0112 5c6 0 10 7 10 7-1 1.6-2.4 3.1-4 4.2" />
      <path d="M6.7 6.7A14 14 0 002 12s4 7 10 7c1.5 0 2.9-.4 4.2-1" />
      <line x1="3" y1="3" x2="21" y2="21" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <path d="M19 17l.8 2.4L22 20l-2.2.6L19 23l-.8-2.4L16 20l2.2-.6z" />
      <path d="M5 4l.6 1.7L7.5 6l-1.9.3L5 8l-.6-1.7L2.5 6l1.9-.3z" />
    </>
  ),
  loader: (
    <>
      <path d="M12 2v4" />
      <path d="M12 18v4" />
      <path d="M4.93 4.93l2.83 2.83" />
      <path d="M16.24 16.24l2.83 2.83" />
      <path d="M2 12h4" />
      <path d="M18 12h4" />
      <path d="M4.93 19.07l2.83-2.83" />
      <path d="M16.24 7.76l2.83-2.83" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
      <path d="M3 13h18" />
    </>
  ),
  party: (
    <>
      <path d="M3 21l4-12 12 4z" />
      <path d="M11 9l4 4" />
    </>
  ),
  beach: (
    <>
      <circle cx="12" cy="6" r="3" />
      <path d="M3 21l9-9 9 9" />
      <path d="M12 12v9" />
    </>
  ),
  cake: (
    <>
      <path d="M4 14v7h16v-7" />
      <path d="M4 14a4 4 0 014-4h8a4 4 0 014 4" />
      <path d="M9 8V5M12 8V4M15 8V5" />
    </>
  ),
  coffee: (
    <>
      <path d="M4 8h12v6a4 4 0 01-4 4H8a4 4 0 01-4-4z" />
      <path d="M16 9h2a3 3 0 010 6h-2" />
      <path d="M7 3v3M11 3v3" />
    </>
  ),
  more: (
    <>
      <circle cx="6" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="18" cy="12" r="1.2" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.5 5.5l1.5 1.5M17 17l1.5 1.5M5.5 18.5L7 17M17 7l1.5-1.5" />
    </>
  ),
  moon: <path d="M21 13a9 9 0 11-10-10 7 7 0 0010 10z" />,
  phone: <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.3 1.7.6 2.5a2 2 0 01-.5 2.1L8 9.5a16 16 0 006 6l1.2-1.2a2 2 0 012.1-.5c.8.3 1.6.5 2.5.6a2 2 0 011.7 2z" />,
  share: (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
      <line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
    </>
  ),
  heart: <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1.1 1.1L12 21.2l7.7-7.7 1.1-1.1a5.5 5.5 0 000-7.8z" />,
  send: (
    <>
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4z" />
    </>
  ),
  flag: <path d="M4 22V4a1 1 0 011-1h14l-2 4 2 4H5" />,
  dollar: (
    <>
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </>
  ),
  smile: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </>
  ),
  trendUp: (
    <>
      <polyline points="3 17 9 11 13 15 21 7" />
      <polyline points="14 7 21 7 21 14" />
    </>
  ),
  trendDown: (
    <>
      <polyline points="3 7 9 13 13 9 21 17" />
      <polyline points="14 17 21 17 21 10" />
    </>
  ),
  helpCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.1 9a3 3 0 015.8 1c0 2-3 3-3 3" />
      <circle cx="12" cy="17" r="0.5" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1" />
      <path d="M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </>
  ),
};

interface IconSvgProps {
  d: ReactNode;
  size?: number;
  className?: string;
  stroke?: number;
  style?: React.CSSProperties;
}

export function IconSvg({ d, size = 18, className, stroke = 1.6, style }: IconSvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden
    >
      {typeof d === "string" ? <path d={d} /> : d}
    </svg>
  );
}
