"use client";

/**
 * Brand panels shown on the left half of auth pages.
 *
 * - DefaultBrandPanel: generic Novasys marketing
 * - TenantBrandPanel:  used by /register?invite=TOKEN to show the inviting
 *                      company's branding + personal welcome
 * - CompanyPreviewPanel: used by /register-company to preview the tenant
 *                       being created in real time
 */

import Image from "next/image";
import {
  Building2,
  Clock,
  MapPin,
  BarChart3,
  Shield,
  Users,
} from "lucide-react";

const BENEFITS = [
  {
    icon: MapPin,
    title: "Marcación con geolocalización",
    desc: "Los empleados marcan entrada y salida desde cualquier lugar.",
  },
  {
    icon: Clock,
    title: "Control de horarios",
    desc: "Regulariza, aprueba permisos y sigue las horas trabajadas.",
  },
  {
    icon: BarChart3,
    title: "Reportes automáticos",
    desc: "Dashboards históricos y exportes mensuales en un click.",
  },
];

/* ─────────────────────────────────────────── DefaultBrandPanel ── */

export function DefaultBrandPanel() {
  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-10 text-white">
      {/* decorative blur blobs */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-fuchsia-400/30 blur-3xl" />

      <div className="relative">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
            <span className="text-xl font-bold">N</span>
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight">
              Novasys Asistencia
            </p>
            <p className="text-xs text-white/70">
              Control de asistencia para equipos modernos
            </p>
          </div>
        </div>
      </div>

      <div className="relative space-y-6">
        <h1 className="text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
          Gestiona la asistencia de tu equipo sin papeles
        </h1>
        <p className="max-w-md text-base text-white/85">
          Registro, regularización, reportes y aprobaciones en una sola
          herramienta. Diseñada para empresas que quieren simplificar.
        </p>

        <ul className="space-y-4 pt-2">
          {BENEFITS.map((b) => {
            const Icon = b.icon;
            return (
              <li key={b.title} className="flex gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{b.title}</p>
                  <p className="text-xs text-white/75">{b.desc}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="relative flex items-center gap-6 text-xs text-white/70">
        <div className="flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5" /> Datos cifrados
        </div>
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" /> Multi-empresa
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────── TenantBrandPanel ── */

interface TenantPanelProps {
  tenantName: string;
  tenantLogoUrl?: string | null;
  role?: string;
  area?: string;
  inviterName?: string;
}

export function TenantBrandPanel({
  tenantName,
  tenantLogoUrl,
  role,
  area,
  inviterName,
}: TenantPanelProps) {
  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-10 text-white">
      <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-violet-500/20 blur-3xl" />

      <div className="relative">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
            <span className="text-xl font-bold">N</span>
          </div>
          <span className="text-xs uppercase tracking-wider text-white/60">
            Novasys Asistencia
          </span>
        </div>
      </div>

      <div className="relative space-y-6">
        <div className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-medium backdrop-blur-sm">
          Invitación recibida
        </div>

        <div className="flex items-center gap-4">
          {tenantLogoUrl ? (
            <div className="relative h-20 w-20 overflow-hidden rounded-2xl bg-white ring-4 ring-white/20">
              <Image
                src={tenantLogoUrl}
                alt={tenantName}
                fill
                className="object-contain p-2"
                sizes="80px"
              />
            </div>
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 text-3xl font-bold backdrop-blur-sm">
              {tenantName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold leading-tight">{tenantName}</h1>
            <p className="mt-1 text-sm text-white/70">
              Te está esperando en Novasys
            </p>
          </div>
        </div>

        <p className="max-w-md text-base leading-relaxed text-white/85">
          {inviterName ? `${inviterName} te invitó ` : "Has sido invitado "}
          a unirte como <strong className="text-white">{role ?? "miembro"}</strong>
          {area && <> del área <strong className="text-white">{area}</strong></>}.
          Crea tu cuenta para empezar a usar el sistema.
        </p>

        <div className="space-y-2 pt-2 text-sm text-white/70">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" /> Marca entrada y salida en segundos
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Desde cualquier dispositivo
          </div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Consulta tus horas trabajadas
          </div>
        </div>
      </div>

      <div className="relative text-xs text-white/50">
        Powered by Novasys Asistencia
      </div>
    </div>
  );
}

/* ──────────────────────────────────── CompanyPreviewPanel ── */

interface CompanyPreviewProps {
  companyName: string;
  companySlug: string;
}

export function CompanyPreviewPanel({
  companyName,
  companySlug,
}: CompanyPreviewProps) {
  const name = companyName.trim() || "Tu empresa";
  const slug = companySlug.trim() || "tu-empresa";
  const initial = name.slice(0, 1).toUpperCase();

  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-10 text-white">
      <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-cyan-300/30 blur-3xl" />

      <div className="relative">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
            <Building2 className="h-6 w-6" />
          </div>
          <span className="text-xs uppercase tracking-wider text-white/75">
            Nueva empresa en Novasys
          </span>
        </div>
      </div>

      <div className="relative space-y-8">
        <div>
          <p className="text-sm text-white/70">Así se verá tu empresa</p>

          {/* Live preview card */}
          <div className="mt-3 rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white text-2xl font-bold text-emerald-700">
                {initial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold">{name}</p>
                <p className="truncate text-xs text-white/70">
                  novasys.pe/{slug}
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-white/10 p-2">
                <p className="text-[10px] uppercase text-white/60">Plan</p>
                <p className="text-xs font-semibold">Free</p>
              </div>
              <div className="rounded-lg bg-white/10 p-2">
                <p className="text-[10px] uppercase text-white/60">Empleados</p>
                <p className="text-xs font-semibold">Hasta 25</p>
              </div>
              <div className="rounded-lg bg-white/10 p-2">
                <p className="text-[10px] uppercase text-white/60">Trial</p>
                <p className="text-xs font-semibold">Sin límite</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl font-bold">En 5 pasos estás listo</h2>
          <ol className="space-y-2 text-sm text-white/85">
            {[
              "Crea tu empresa y cuenta de admin",
              "Personaliza tu logo y colores",
              "Configura horario y feriados",
              "Invita a tus empleados",
              "Empieza a usar el sistema",
            ].map((step, i) => (
              <li key={step} className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="relative text-xs text-white/60">
        Tu empresa queda operativa en minutos
      </div>
    </div>
  );
}
