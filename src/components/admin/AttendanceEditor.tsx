"use client";

/**
 * Admin attendance editor.
 *
 * Shown inside the "Asistencia" tab of /admin/employees/[id].
 * Loads a month of DailySummary rows and lets the admin switch between
 * Calendar and List views, pick a day, edit or delete it. Every mutation
 * is audited server-side via withAudit and reversible from /admin/audit.
 */

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Save,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  LayoutGrid,
  List,
  Clock,
  LogIn,
  LogOut,
  Coffee,
  CalendarDays,
  Info,
} from "lucide-react";
import {
  AttendanceCalendarView,
  type AttendanceDayRow,
} from "./AttendanceCalendarView";
import { AttendanceListView } from "./AttendanceListView";
import { cn } from "@/lib/utils";

interface DetailSummary extends AttendanceDayRow {
  firstIn?: string | null;
  lastOut?: string | null;
  regularizationReasonLabel?: string | null;
  regularizationNote?: string | null;
  anomalies?: string[];
  [key: string]: unknown;
}

const STATUSES = [
  "OPEN",
  "CLOSED",
  "OK",
  "SHORT",
  "REGULARIZED",
  "ABSENCE",
  "MISSING",
  "NO_RECORD",
  "HOLIDAY",
];

type FormMessage = { type: "success" | "error"; text: string };
type ViewMode = "calendar" | "list";

function getMonthBounds(monthStr: string): { from: string; to: string } {
  const [yStr, mStr] = monthStr.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const from = `${yStr}-${mStr}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${yStr}-${mStr}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

function todayMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(monthStr: string): string {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("es-PE", { month: "long", year: "numeric" });
}

/** Extracts HH:MM from a local ISO string like "2026-04-01T09:00:00-05:00". */
function isoToHm(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = iso.match(/T(\d{2}:\d{2})/);
  return m ? m[1] : "";
}

/** Rebuilds a local ISO string preserving the original date + offset. */
function hmToIso(hm: string, templateIso: string, workDate: string): string {
  if (!hm) return "";
  // Prefer the template's offset; fall back to -05:00 (Lima) if missing.
  const offsetMatch = templateIso?.match(/([+-]\d{2}:\d{2})$/);
  const offset = offsetMatch ? offsetMatch[1] : "-05:00";
  return `${workDate}T${hm}:00${offset}`;
}

function fmtHours(min: number): string {
  if (!min) return "0h";
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.abs(min) % 60;
  const sign = min < 0 ? "-" : "";
  return m > 0 ? `${sign}${h}h ${m}m` : `${sign}${h}h`;
}

function fmtWorkDate(workDate: string): string {
  // "2026-04-01" → "martes, 1 de abril de 2026"
  try {
    const [y, m, d] = workDate.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("es-PE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return workDate;
  }
}

const STATUS_META: Record<
  string,
  { label: string; tone: string }
> = {
  OK: { label: "Jornada OK", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
  CLOSED: { label: "Cerrado", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
  REGULARIZED: { label: "Regularizado", tone: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200" },
  ABSENCE: { label: "Ausente", tone: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200" },
  SHORT: { label: "Jornada corta", tone: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" },
  MISSING: { label: "Falta sin justificar", tone: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200" },
  NO_RECORD: { label: "Sin registro", tone: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300" },
  HOLIDAY: { label: "Feriado", tone: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200" },
  OPEN: { label: "Abierto", tone: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200" },
};

function shiftMonth(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface Props {
  employeeId: string;
  employeeName: string;
}

export function AttendanceEditor({ employeeId, employeeName }: Props) {
  const [month, setMonth] = useState(todayMonth());
  const [view, setView] = useState<ViewMode>("calendar");

  const [rows, setRows] = useState<AttendanceDayRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [listMessage, setListMessage] = useState<FormMessage | null>(null);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailSummary | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [detailMessage, setDetailMessage] = useState<FormMessage | null>(null);

  // Form state: we keep user-friendly HH:MM values and convert back to ISO on save.
  const [firstInHm, setFirstInHm] = useState("");
  const [lastOutHm, setLastOutHm] = useState("");
  const [breakMinutes, setBreakMinutes] = useState(60);
  const [status, setStatus] = useState("");
  const [reason, setReason] = useState("");

  const loadRange = useCallback(async () => {
    if (!employeeId || !month) return;
    const { from, to } = getMonthBounds(month);
    setLoadingRows(true);
    setListMessage(null);
    try {
      const res = await fetch(
        `/api/admin/daily-summary/${encodeURIComponent(
          employeeId
        )}?from=${from}&to=${to}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Error ${res.status}`);
      }
      const body = (await res.json()) as { items: AttendanceDayRow[] };
      setRows(body.items);
      if (body.items.length === 0) {
        setListMessage({
          type: "error",
          text: "Sin registros en este mes.",
        });
      }
    } catch (err) {
      setListMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error al cargar",
      });
    } finally {
      setLoadingRows(false);
    }
  }, [employeeId, month]);

  useEffect(() => {
    loadRange();
  }, [loadRange]);

  async function openDetail(workDate: string) {
    setSelectedDate(workDate);
    setDetail(null);
    setDetailMessage(null);
    setLoadingDetail(true);
    try {
      const url = `/api/admin/daily-summary/${encodeURIComponent(
        employeeId
      )}/${encodeURIComponent(workDate)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const body = (await res.json()) as { summary: DetailSummary | null };
      setDetail(body.summary);
      if (body.summary) {
        setFirstInHm(isoToHm(body.summary.firstInLocal));
        setLastOutHm(isoToHm(body.summary.lastOutLocal));
        setBreakMinutes(Number(body.summary.breakMinutes ?? 60));
        setStatus(body.summary.status ?? "");
        setReason("");
      }
    } catch (err) {
      setDetailMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error al cargar",
      });
    } finally {
      setLoadingDetail(false);
    }
  }

  function closeDetail() {
    setSelectedDate(null);
    setDetail(null);
    setDetailMessage(null);
  }

  async function handleSave() {
    if (!detail || !selectedDate) return;
    setSaving(true);
    setDetailMessage(null);
    try {
      const url = `/api/admin/daily-summary/${encodeURIComponent(
        employeeId
      )}/${encodeURIComponent(selectedDate)}`;
      const firstInLocal = firstInHm
        ? hmToIso(firstInHm, detail.firstInLocal ?? "", selectedDate)
        : undefined;
      const lastOutLocal = lastOutHm
        ? hmToIso(lastOutHm, detail.lastOutLocal ?? detail.firstInLocal ?? "", selectedDate)
        : undefined;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstInLocal,
          lastOutLocal,
          breakMinutes,
          status: status || undefined,
          reason: reason || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Error ${res.status}`);
      // Refresh the open sheet with the recalculated summary so the
      // trabajadas/planeadas/delta tiles reflect the new values without
      // having to close and reopen the day.
      if (body.summary) {
        setDetail(body.summary as DetailSummary);
        setFirstInHm(isoToHm(body.summary.firstInLocal));
        setLastOutHm(isoToHm(body.summary.lastOutLocal));
        setBreakMinutes(Number(body.summary.breakMinutes ?? 60));
        setStatus(body.summary.status ?? "");
        setReason("");
      }
      setDetailMessage({
        type: "success",
        text: "Guardado. Puedes revertir el cambio desde Historial.",
      });
      await loadRange();
    } catch (err) {
      setDetailMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error al guardar",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedDate) return;
    setDeleting(true);
    setDetailMessage(null);
    try {
      const url = `/api/admin/daily-summary/${encodeURIComponent(
        employeeId
      )}/${encodeURIComponent(selectedDate)}`;
      const res = await fetch(url, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Error ${res.status}`);
      setConfirmDelete(false);
      closeDetail();
      await loadRange();
    } catch (err) {
      setDetailMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error al eliminar",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Asistencia</CardTitle>
            <p className="text-xs text-muted-foreground">
              Toca cualquier día para editarlo o eliminarlo. Los cambios quedan
              en{" "}
              <a
                href="/admin/audit"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Historial
              </a>
              .
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center rounded-md border p-0.5">
              <Button
                type="button"
                variant={view === "calendar" ? "default" : "ghost"}
                size="sm"
                className="h-7 px-2"
                onClick={() => setView("calendar")}
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">Calendario</span>
              </Button>
              <Button
                type="button"
                variant={view === "list" ? "default" : "ghost"}
                size="sm"
                className="h-7 px-2"
                onClick={() => setView("list")}
              >
                <List className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">Lista</span>
              </Button>
            </div>

            {/* Month navigation */}
            <div className="flex items-center gap-1 rounded-md border p-0.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setMonth(shiftMonth(month, -1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-2 text-xs font-medium capitalize min-w-[120px] text-center">
                {monthLabel(month)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setMonth(shiftMonth(month, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadRange}
              disabled={loadingRows}
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4",
                  loadingRows && "animate-spin"
                )}
              />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {listMessage && (
            <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{listMessage.text}</span>
            </div>
          )}

          {loadingRows && rows.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando…
            </div>
          ) : view === "calendar" ? (
            <AttendanceCalendarView
              rows={rows}
              monthStr={month}
              onPick={openDetail}
            />
          ) : (
            <AttendanceListView rows={rows} onPick={openDetail} />
          )}
        </CardContent>
      </Card>

      {/* Detail sheet */}
      <Sheet
        open={!!selectedDate && !confirmDelete}
        onOpenChange={(o) => !o && closeDetail()}
      >
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
          {/* ── Header with gradient + status pill ── */}
          <div className="border-b bg-gradient-to-br from-muted/40 to-transparent px-6 pt-6 pb-5">
            <SheetHeader className="space-y-2 p-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                <span>{employeeName}</span>
              </div>
              <SheetTitle className="text-xl capitalize">
                {selectedDate ? fmtWorkDate(selectedDate) : ""}
              </SheetTitle>
              {detail?.status && (
                <div className="pt-1">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                      STATUS_META[detail.status]?.tone ??
                        "bg-muted text-muted-foreground"
                    )}
                  >
                    {STATUS_META[detail.status]?.label ?? detail.status}
                  </span>
                  {detail.source && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {detail.source}
                    </span>
                  )}
                </div>
              )}
              <SheetDescription className="sr-only">
                Editar asistencia del día
              </SheetDescription>
            </SheetHeader>
          </div>

          <div className="space-y-6 px-6 py-6">
            {loadingDetail && (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
              </div>
            )}

            {detailMessage && (
              <div
                className={
                  detailMessage.type === "success"
                    ? "flex items-start gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300"
                    : "flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                }
              >
                {detailMessage.type === "success" ? (
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <span>{detailMessage.text}</span>
              </div>
            )}

            {!loadingDetail && !detail && (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                <Info className="mx-auto mb-2 h-5 w-5 opacity-60" />
                Este día no tiene registro. Usa{" "}
                <a href="/admin/regularize" className="underline font-medium">
                  Regularizar
                </a>{" "}
                para crear uno.
              </div>
            )}

            {detail && (
              <>
                {/* ── Summary cards: trabajadas · planeadas · delta ── */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Trabajadas
                    </p>
                    <p className="mt-0.5 text-lg font-semibold">
                      {fmtHours(detail.workedMinutes)}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Planeadas
                    </p>
                    <p className="mt-0.5 text-lg font-semibold">
                      {fmtHours(detail.plannedMinutes)}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "rounded-lg border p-3",
                      detail.deltaMinutes < 0
                        ? "border-destructive/30 bg-destructive/5"
                        : detail.deltaMinutes > 0
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "bg-muted/30"
                    )}
                  >
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Delta
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 text-lg font-semibold",
                        detail.deltaMinutes < 0 && "text-destructive",
                        detail.deltaMinutes > 0 &&
                          "text-emerald-600 dark:text-emerald-400"
                      )}
                    >
                      {detail.deltaMinutes > 0 ? "+" : ""}
                      {fmtHours(detail.deltaMinutes)}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* ── Editable fields ── */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="firstIn"
                        className="flex items-center gap-1.5 text-xs"
                      >
                        <LogIn className="h-3.5 w-3.5 text-muted-foreground" />
                        Entrada
                      </Label>
                      <Input
                        id="firstIn"
                        type="time"
                        value={firstInHm}
                        onChange={(e) => setFirstInHm(e.target.value)}
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="lastOut"
                        className="flex items-center gap-1.5 text-xs"
                      >
                        <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
                        Salida
                      </Label>
                      <Input
                        id="lastOut"
                        type="time"
                        value={lastOutHm}
                        onChange={(e) => setLastOutHm(e.target.value)}
                        className="font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="break"
                        className="flex items-center gap-1.5 text-xs"
                      >
                        <Coffee className="h-3.5 w-3.5 text-muted-foreground" />
                        Break (min)
                      </Label>
                      <Input
                        id="break"
                        type="number"
                        min={0}
                        max={480}
                        step={5}
                        value={breakMinutes}
                        onChange={(e) =>
                          setBreakMinutes(Number(e.target.value))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="status"
                        className="flex items-center gap-1.5 text-xs"
                      >
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        Estado
                      </Label>
                      <Select
                        value={status || undefined}
                        onValueChange={(v) => setStatus(v ?? "")}
                      >
                        <SelectTrigger id="status">
                          <SelectValue placeholder="Selecciona…" />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {STATUS_META[s]?.label ?? s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="reason" className="text-xs">
                      Motivo del cambio
                      <span className="ml-1 font-normal text-muted-foreground">
                        · aparecerá en Historial
                      </span>
                    </Label>
                    <Textarea
                      id="reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Ej. Corrección por error de regularización anterior"
                      rows={2}
                    />
                  </div>
                </div>

                {/* ── Metadata footer ── */}
                {(detail.regularizationReasonCode || detail.updatedAt) && (
                  <div className="rounded-md border bg-muted/20 p-3 text-xs space-y-1">
                    {detail.regularizationReasonCode && (
                      <div className="flex items-start gap-2">
                        <span className="text-muted-foreground">
                          Razón anterior:
                        </span>
                        <span className="font-medium">
                          {detail.regularizationReasonLabel ??
                            detail.regularizationReasonCode}
                        </span>
                      </div>
                    )}
                    {detail.regularizationNote && (
                      <div className="flex items-start gap-2">
                        <span className="text-muted-foreground">Nota:</span>
                        <span className="italic">
                          {detail.regularizationNote}
                        </span>
                      </div>
                    )}
                    {detail.updatedAt && (
                      <div className="flex items-start gap-2">
                        <span className="text-muted-foreground">
                          Modificado:
                        </span>
                        <span>
                          {new Date(detail.updatedAt).toLocaleString("es-PE")}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Sticky action bar ── */}
          {detail && (
            <div className="sticky bottom-0 border-t bg-background/95 backdrop-blur-sm px-6 py-3">
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(true)}
                  disabled={deleting || saving}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Eliminar
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={closeDetail}
                    disabled={saving || deleting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={saving || deleting}
                  >
                    {saving ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-1.5 h-4 w-4" />
                    )}
                    Guardar cambios
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog
        open={confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar registro del día</DialogTitle>
            <DialogDescription>
              Se eliminará el registro de <strong>{employeeName}</strong> del
              día <strong>{selectedDate}</strong>. Queda auditado y puedes
              revertirlo desde Historial.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sí, eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
