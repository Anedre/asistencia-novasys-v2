"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { IconSvg, Icons } from "@/components/nova/icons";
import { NovaAvatar } from "@/components/nova/avatar";

interface RouteResult {
  type: "route";
  label: string;
  hint: string;
  href: string;
  icon: React.ReactNode;
}
interface EmployeeResult {
  type: "employee";
  label: string;
  hint: string;
  avatarUrl?: string | null;
  href: string;
}
type SearchResult = RouteResult | EmployeeResult;

// Static routes the user can navigate to from the search
const EMPLOYEE_ROUTES: RouteResult[] = [
  { type: "route", label: "Inicio",         hint: "Tu jornada y check-in",              href: "/dashboard",                  icon: Icons.dashboard },
  { type: "route", label: "Mi asistencia",  hint: "Historial de marcaciones",           href: "/history",                    icon: Icons.history },
  { type: "route", label: "Solicitudes",    hint: "Permisos, vacaciones, regularizar",  href: "/requests",                   icon: Icons.doc },
  { type: "route", label: "Nueva solicitud",hint: "Crear una nueva solicitud",          href: "/requests/new",               icon: Icons.plus },
  { type: "route", label: "Permiso",        hint: "Pedir permiso laboral",              href: "/requests/new?type=permission",icon: Icons.plus },
  { type: "route", label: "Vacaciones",     hint: "Solicitar vacaciones",               href: "/requests/new?type=vacation", icon: Icons.beach },
  { type: "route", label: "Regularizar día",hint: "Corregir una marcación",             href: "/requests/new?type=regularize",icon: Icons.edit },
  { type: "route", label: "Mis reportes",   hint: "Generar reportes PDF",               href: "/reports",                    icon: Icons.pulse },
  { type: "route", label: "Boletas",        hint: "Tus boletas de pago",                href: "/hr?tab=documentos",          icon: Icons.download },
  { type: "route", label: "RRHH",           hint: "Eventos, directorio, documentos",    href: "/hr",                         icon: Icons.heart },
  { type: "route", label: "Directorio",     hint: "Encuentra compañeros",               href: "/hr?tab=directorio",          icon: Icons.users },
  { type: "route", label: "Organigrama",    hint: "Estructura del equipo",              href: "/hr?tab=organigrama",         icon: Icons.users },
  { type: "route", label: "Feed",           hint: "Publicaciones del equipo",           href: "/feed",                       icon: Icons.feed },
  { type: "route", label: "Mensajes",       hint: "Chats directos y grupales",          href: "/messages",                   icon: Icons.chat },
  { type: "route", label: "Mi perfil",      hint: "Datos personales y preferencias",    href: "/profile",                    icon: Icons.user },
  { type: "route", label: "Seguridad",      hint: "Contraseña, sesiones",               href: "/profile?tab=security",       icon: Icons.shield },
];

const ADMIN_ROUTES: RouteResult[] = [
  { type: "route", label: "Dashboard admin",     hint: "Vista general de operaciones",  href: "/admin/dashboard",   icon: Icons.dashboard },
  { type: "route", label: "Asistencia (admin)",  hint: "Revisar y regularizar marcaciones", href: "/admin/attendance", icon: Icons.clock },
  { type: "route", label: "Empleados",           hint: "Listado y detalle del equipo",   href: "/admin/employees",   icon: Icons.users },
  { type: "route", label: "Aprobaciones",        hint: "Solicitudes pendientes",         href: "/admin/approvals",   icon: Icons.check },
  { type: "route", label: "Regularizar",         hint: "Aplicar regularizaciones",       href: "/admin/regularize",  icon: Icons.edit },
  { type: "route", label: "Reportes admin",      hint: "Dashboard y exportación PDF",    href: "/admin/reports",     icon: Icons.pulse },
  { type: "route", label: "Auditoría",           hint: "Historial reversible de cambios",href: "/admin/audit",       icon: Icons.history },
  { type: "route", label: "RRHH (admin)",        hint: "Eventos, cumpleaños, aniversarios", href: "/admin/hr",       icon: Icons.heart },
  { type: "route", label: "Configuración",       hint: "Empresa, sedes, integraciones",  href: "/admin/settings",    icon: Icons.settings },
  { type: "route", label: "Invitar empleado",    hint: "Enviar invitación por correo",   href: "/admin/employees",   icon: Icons.plus },
];

interface DirectoryEmployee {
  EmployeeID?: string;
  employeeId?: string;
  FullName?: string;
  fullName?: string;
  Area?: string;
  area?: string;
  Position?: string;
  position?: string;
  AvatarUrl?: string | null;
  avatarUrl?: string | null;
}

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [employees, setEmployees] = useState<DirectoryEmployee[]>([]);
  const [employeesLoaded, setEmployeesLoaded] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";

  const staticRoutes: RouteResult[] = useMemo(
    () => (isAdmin ? [...ADMIN_ROUTES, ...EMPLOYEE_ROUTES] : EMPLOYEE_ROUTES),
    [isAdmin],
  );

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Click outside closes
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Lazy-load employee directory on first focus
  async function loadEmployees() {
    if (employeesLoaded) return;
    try {
      const res = await fetch("/api/employees/directory");
      if (res.ok) {
        const data = await res.json();
        const raw = (data.employees ?? data ?? []) as DirectoryEmployee[];
        setEmployees(raw);
      }
    } catch {
      // silent — search will just have fewer results
    } finally {
      setEmployeesLoaded(true);
    }
  }

  const results: SearchResult[] = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return staticRoutes.slice(0, 6);

    const routeMatches = staticRoutes.filter(
      (r) => normalize(r.label).includes(q) || normalize(r.hint).includes(q)
    ).slice(0, 6);

    const employeeMatches: EmployeeResult[] = employees
      .filter((e) => {
        const name = (e.FullName ?? e.fullName ?? "").toString();
        return normalize(name).includes(q);
      })
      .slice(0, 5)
      .map((e) => ({
        type: "employee" as const,
        label: (e.FullName ?? e.fullName ?? "Sin nombre") as string,
        hint: [e.Position ?? e.position, e.Area ?? e.area].filter(Boolean).join(" · "),
        avatarUrl: (e.AvatarUrl ?? e.avatarUrl) ?? null,
        href: `/hr?tab=directorio`,
      }));

    return [...routeMatches, ...employeeMatches];
  }, [query, employees]);

  // Reset active index when results change
  useEffect(() => {
    setActiveIdx(0);
  }, [query, open]);

  function handleSelect(r: SearchResult) {
    setOpen(false);
    setQuery("");
    router.push(r.href);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const sel = results[activeIdx];
      if (sel) handleSelect(sel);
    }
  }

  return (
    <div ref={containerRef} className="global-search" style={{ position: "relative", flex: 1, maxWidth: 480 }}>
      <div className="searchbar" style={{ marginLeft: 12 }}>
        <span style={{ color: "var(--text-muted)" }}>
          <IconSvg d={Icons.search} size={16} />
        </span>
        <input
          ref={inputRef}
          type="search"
          role="searchbox"
          name="global-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { setOpen(true); loadEmployees(); }}
          onKeyDown={handleKeyDown}
          placeholder="Buscar páginas, compañeros…"
          autoComplete="off"
          aria-label="Buscar páginas y compañeros"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="global-search-listbox"
        />
        <kbd>⌘K</kbd>
      </div>

      {open && (
        <div
          id="global-search-listbox"
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 12,
            right: 0,
            zIndex: 30,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r)",
            boxShadow: "var(--shadow-md)",
            maxHeight: 420,
            overflowY: "auto",
            padding: 6,
          }}
        >
          {results.length === 0 ? (
            <div style={{ padding: "14px 12px", fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
              Sin resultados para “{query}”
            </div>
          ) : (
            results.map((r, idx) => {
              const isActive = idx === activeIdx;
              return (
                <Link
                  key={`${r.type}-${idx}-${r.href}`}
                  href={r.href}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => { setOpen(false); setQuery(""); }}
                  onMouseEnter={() => setActiveIdx(idx)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "9px 11px",
                    borderRadius: 8,
                    background: isActive ? "var(--accent-soft)" : "transparent",
                    color: "inherit",
                    textDecoration: "none",
                    transition: "background 0.12s",
                  }}
                >
                  {r.type === "route" ? (
                    <span
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        background: "var(--bg-subtle)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--text-secondary)",
                        flexShrink: 0,
                      }}
                    >
                      <IconSvg d={r.icon} size={14} />
                    </span>
                  ) : (
                    <NovaAvatar name={r.label} image={r.avatarUrl ?? undefined} size={30} variant="plain" />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>{r.label}</div>
                    {r.hint && (
                      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 1 }}>{r.hint}</div>
                    )}
                  </div>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    {r.type === "route" ? "Ir" : "Empleado"}
                  </span>
                </Link>
              );
            })
          )}

          <div style={{ borderTop: "1px solid var(--border)", marginTop: 6, paddingTop: 8, paddingLeft: 11, paddingRight: 11, paddingBottom: 4, display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--text-muted)", letterSpacing: "0.04em" }}>
            <span>↑↓ navegar · Enter abrir</span>
            <span>Esc cerrar</span>
          </div>
        </div>
      )}
    </div>
  );
}
