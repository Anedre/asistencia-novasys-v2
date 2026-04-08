"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { History, Loader2, Undo2, AlertTriangle } from "lucide-react";
import type {
  AuditEntry,
  AuditEntityType,
  AuditListResult,
} from "@/lib/types/audit";

const ENTITY_LABELS: Record<AuditEntityType | "ALL", string> = {
  ALL: "Todas las entidades",
  DAILY_SUMMARY: "Asistencia / Regularización",
  APPROVAL_REQUEST: "Solicitudes",
  EMPLOYEE: "Empleados",
  INVITATION: "Invitaciones",
  HR_EVENT: "RRHH",
  HR_DOCUMENT: "Documentos RRHH",
  TENANT_SETTINGS: "Configuración",
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Creado",
  UPDATE: "Modificado",
  DELETE: "Eliminado",
  APPROVE: "Aprobado",
  REJECT: "Rechazado",
  BULK_REGULARIZE: "Regularización en bloque",
  REVERT: "Revertido",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-PE", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function actionBadgeVariant(
  action: string
): "default" | "secondary" | "destructive" | "outline" {
  if (action === "DELETE" || action === "REJECT") return "destructive";
  if (action === "REVERT") return "outline";
  if (action === "APPROVE") return "default";
  return "secondary";
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [entityFilter, setEntityFilter] = useState<AuditEntityType | "ALL">(
    "ALL"
  );
  const [hideReverted, setHideReverted] = useState(false);

  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [revertError, setRevertError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (cursor?: string) => {
      if (cursor) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (entityFilter !== "ALL") params.set("entityType", entityFilter);
        if (hideReverted) params.set("hideReverted", "true");
        if (cursor) params.set("cursor", cursor);
        params.set("limit", "50");

        const res = await fetch(`/api/admin/audit?${params.toString()}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Error ${res.status}`);
        }
        const data = (await res.json()) as AuditListResult;
        if (cursor) {
          setEntries((prev) => [...prev, ...data.items]);
        } else {
          setEntries(data.items);
        }
        setNextCursor(data.nextCursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [entityFilter, hideReverted]
  );

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const grouped = useMemo(() => {
    // Collapse rows that share a groupId under the summary row, so the table
    // shows one "bulk" entry instead of N children.
    const seenGroups = new Set<string>();
    const out: AuditEntry[] = [];
    for (const e of entries) {
      if (e.groupId && !e.isGroupSummary) {
        if (seenGroups.has(e.groupId)) continue;
        // If we haven't seen the summary yet, still show this child.
      }
      if (e.groupId && e.isGroupSummary) {
        seenGroups.add(e.groupId);
      }
      out.push(e);
    }
    return out;
  }, [entries]);

  async function handleRevert() {
    if (!selected) return;
    setReverting(true);
    setRevertError(null);
    try {
      const url = selected.isGroupSummary && selected.groupId
        ? `/api/admin/audit/group/${encodeURIComponent(selected.groupId)}/revert`
        : `/api/admin/audit/${encodeURIComponent(selected.AuditID)}/revert`;

      const res = await fetch(url, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || body.message || `Error ${res.status}`);
      }
      setConfirmOpen(false);
      setSelected(null);
      await loadPage();
    } catch (err) {
      setRevertError(err instanceof Error ? err.message : "Error al revertir");
    } finally {
      setReverting(false);
    }
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <History className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-semibold">Historial de cambios</h1>
          <p className="text-sm text-muted-foreground">
            Revisa y deshace acciones de administración. Se guardan los últimos
            90 días.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1.5">
              <Label>Entidad</Label>
              <Select
                value={entityFilter}
                onValueChange={(v) =>
                  setEntityFilter(v as AuditEntityType | "ALL")
                }
              >
                <SelectTrigger className="w-[240px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ENTITY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="hide-reverted"
                checked={hideReverted}
                onCheckedChange={setHideReverted}
              />
              <Label htmlFor="hide-reverted">Ocultar revertidos</Label>
            </div>
          </div>
          <Button variant="outline" onClick={() => loadPage()} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Refrescar
          </Button>
        </CardHeader>

        <CardContent className="pt-0">
          {error && (
            <div className="mb-3 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" /> {error}
            </div>
          )}

          {loading && entries.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando…
            </div>
          ) : grouped.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              No hay entradas que coincidan con los filtros.
            </div>
          ) : (
            <div className="divide-y">
              {grouped.map((e) => (
                <AuditRow
                  key={e.AuditID}
                  entry={e}
                  onSelect={() => setSelected(e)}
                />
              ))}
            </div>
          )}

          {nextCursor && (
            <div className="pt-4 text-center">
              <Button
                variant="outline"
                onClick={() => loadPage(nextCursor)}
                disabled={loadingMore}
              >
                {loadingMore && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Cargar más
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail drawer */}
      <Sheet
        open={!!selected && !confirmOpen}
        onOpenChange={(o) => !o && setSelected(null)}
      >
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Badge variant={actionBadgeVariant(selected.action)}>
                    {ACTION_LABELS[selected.action] ?? selected.action}
                  </Badge>
                  {selected.entityLabel}
                </SheetTitle>
                <SheetDescription>
                  Por <strong>{selected.actorName}</strong> ·{" "}
                  {formatDate(selected.createdAt)}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                {selected.reason && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Motivo
                    </p>
                    <p className="text-sm">{selected.reason}</p>
                  </div>
                )}

                {selected.revertedAt && (
                  <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
                    Esta entrada ya fue revertida el{" "}
                    {formatDate(selected.revertedAt)}.
                  </div>
                )}

                {selected.isGroupSummary ? (
                  <div className="rounded-md border p-3 text-sm">
                    Operación en bloque con {selected.groupSize ?? "varias"}{" "}
                    entradas. Al revertir, se deshace todo el grupo en conjunto.
                  </div>
                ) : (
                  <DiffPanel diff={selected.diff} />
                )}

                <div className="flex justify-end pt-2">
                  <Button
                    variant="destructive"
                    disabled={!!selected.revertedAt}
                    onClick={() => setConfirmOpen(true)}
                  >
                    <Undo2 className="mr-2 h-4 w-4" /> Revertir
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Confirm dialog */}
      <Dialog
        open={confirmOpen}
        onOpenChange={(o) => {
          if (!o) {
            setConfirmOpen(false);
            setRevertError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar revert</DialogTitle>
            <DialogDescription>
              Esta acción restaurará el estado anterior del registro. Se creará
              una nueva entrada en el historial indicando el revert. Esta
              operación también puede ser deshecha.
            </DialogDescription>
          </DialogHeader>

          {revertError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{revertError}</span>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={reverting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevert}
              disabled={reverting}
            >
              {reverting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sí, revertir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Row ────────────────────────────────────────────────────────────────────

function AuditRow({
  entry,
  onSelect,
}: {
  entry: AuditEntry;
  onSelect: () => void;
}) {
  const reverted = !!entry.revertedAt;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-muted/60"
    >
      <div className="w-24 shrink-0 text-xs text-muted-foreground">
        {formatDate(entry.createdAt)}
      </div>
      <div className="w-36 shrink-0">
        <Badge variant={actionBadgeVariant(entry.action)}>
          {ACTION_LABELS[entry.action] ?? entry.action}
        </Badge>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{entry.entityLabel}</p>
        <p className="truncate text-xs text-muted-foreground">
          {entry.actorName}
          {entry.isGroupSummary && entry.groupSize
            ? ` · ${entry.groupSize} día(s)`
            : ""}
          {entry.reason ? ` · ${entry.reason}` : ""}
        </p>
      </div>
      {reverted && (
        <Badge variant="outline" className="shrink-0">
          Revertido
        </Badge>
      )}
    </button>
  );
}

// ─── Diff ───────────────────────────────────────────────────────────────────

function DiffPanel({ diff }: { diff: AuditEntry["diff"] }) {
  const entries = Object.entries(diff);
  if (entries.length === 0) {
    return (
      <div className="rounded-md border p-3 text-sm text-muted-foreground">
        Sin cambios detectables entre el antes y el después.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Campo</th>
            <th className="px-3 py-2 text-left">Antes</th>
            <th className="px-3 py-2 text-left">Después</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([field, change]) => (
            <tr key={field} className="border-t">
              <td className="px-3 py-2 font-mono text-xs">{field}</td>
              <td className="px-3 py-2 text-xs text-red-600 dark:text-red-400">
                {formatValue(change.from)}
              </td>
              <td className="px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
                {formatValue(change.to)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
