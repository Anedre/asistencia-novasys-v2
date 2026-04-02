"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import {
  Cake,
  Trophy,
  Calendar,
  Plus,
  Trash2,
  Megaphone,
  FolderOpen,
  Upload,
  FileText,
  Loader2,
  Send,
  Search,
  X,
  Users,
  Check,
} from "lucide-react";
import { useHREvents, useArchiveHREvent, useResendAnnouncement } from "@/hooks/use-hr";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { BirthdayEntry, AnniversaryEntry, UpcomingBirthday, HREvent } from "@/lib/types";

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export default function AdminHRPage() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const { data, isLoading } = useHREvents(month);
  const archiveMutation = useArchiveHREvent();
  const [resendEventId, setResendEventId] = useState<string | null>(null);

  const birthdays: BirthdayEntry[] = data?.birthdays ?? [];
  const anniversaries: AnniversaryEntry[] = data?.anniversaries ?? [];
  const upcomingBirthdays: UpcomingBirthday[] = data?.upcomingBirthdays ?? [];
  const announcements: HREvent[] = data?.announcements ?? [];

  const resendEvent = announcements.find((a) => a.NotificationID === resendEventId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestión RRHH</h1>
          <p className="text-muted-foreground">
            Administra eventos, cumpleaños y aniversarios
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="month-select">Mes</Label>
            <Input
              id="month-select"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-44"
            />
          </div>
          <Button render={<Link href="/admin/hr/create" />}>
            <Plus className="size-4" />
            Crear Evento
          </Button>
        </div>
      </div>

      {/* Cumpleaños del Mes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cake className="size-5" />
            Cumpleaños del Mes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton />
          ) : birthdays.length === 0 ? (
            <EmptyState
              icon={Cake}
              title="Sin cumpleaños"
              description="No hay cumpleaños este mes"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Edad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {birthdays.map((b) => (
                  <TableRow key={b.employeeId}>
                    <TableCell className="font-medium">
                      🎂 {b.employeeName}
                    </TableCell>
                    <TableCell>{b.area}</TableCell>
                    <TableCell>{b.position}</TableCell>
                    <TableCell>{b.eventDate}</TableCell>
                    <TableCell>{b.years} años</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Aniversarios del Mes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="size-5" />
            Aniversarios del Mes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton />
          ) : anniversaries.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="Sin aniversarios"
              description="No hay aniversarios este mes"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Fecha Ingreso</TableHead>
                  <TableHead>Años</TableHead>
                  <TableHead>Quinquenio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {anniversaries.map((a) => (
                  <TableRow key={a.employeeId}>
                    <TableCell className="font-medium">
                      {a.employeeName}
                    </TableCell>
                    <TableCell>{a.area}</TableCell>
                    <TableCell>{a.position}</TableCell>
                    <TableCell>{a.eventDate}</TableCell>
                    <TableCell>{a.years} años</TableCell>
                    <TableCell>
                      {a.isQuinquenio ? (
                        <Badge variant="default">🏆 Quinquenio</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Próximos Cumpleaños */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="size-5" />
            Próximos Cumpleaños (30 días)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton />
          ) : upcomingBirthdays.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="Sin próximos cumpleaños"
              description="No hay cumpleaños en los próximos 30 días"
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {upcomingBirthdays.map((u) => (
                <Card key={u.employeeId}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">🎂 {u.employeeName}</p>
                        <p className="text-sm text-muted-foreground">
                          {u.area} — {u.position}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {u.daysUntil === 0
                          ? "¡Hoy!"
                          : u.daysUntil === 1
                            ? "Mañana"
                            : `${u.daysUntil} días`}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documentos RRHH */}
      <DocumentosAdmin />

      {/* Comunicados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="size-5" />
            Comunicados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton />
          ) : announcements.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="Sin comunicados"
              description="No hay comunicados ni feriados este mes"
            />
          ) : (
            <div className="space-y-3">
              {announcements.map((evt) => (
                <div
                  key={evt.NotificationID}
                  className="flex items-start justify-between rounded-lg border p-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={evt.Type === "HOLIDAY" ? "secondary" : "default"}>
                        {evt.Type === "HOLIDAY" ? "Feriado" : "Comunicado"}
                      </Badge>
                      <span className="font-medium">{evt.Title}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{evt.Message}</p>
                    <p className="text-xs text-muted-foreground">
                      Fecha: {evt.EventDate}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Reenviar"
                      onClick={() => setResendEventId(evt.NotificationID)}
                    >
                      <Send className="size-4 text-primary" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Archivar"
                      onClick={() => archiveMutation.mutate(evt.NotificationID)}
                      disabled={archiveMutation.isPending}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resend dialog */}
      {resendEvent && (
        <ResendDialog
          event={resendEvent}
          onClose={() => setResendEventId(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ResendDialog                                                      */
/* ------------------------------------------------------------------ */

interface EmployeeOption {
  EmployeeID: string;
  FullName: string;
}

function normalizeEmployee(raw: Record<string, unknown>): EmployeeOption {
  return {
    EmployeeID: (raw.EmployeeID as string) ?? (raw.employeeId as string) ?? "",
    FullName: (raw.FullName as string) ?? (raw.fullName as string) ?? "Sin nombre",
  };
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

function ResendDialog({
  event,
  onClose,
}: {
  event: HREvent;
  onClose: () => void;
}) {
  const resendMutation = useResendAnnouncement();
  const [broadcast, setBroadcast] = useState(true);
  const [sendDMs, setSendDMs] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [employeeList, setEmployeeList] = useState<EmployeeOption[]>([]);
  const [loadingEmps, setLoadingEmps] = useState(false);

  useEffect(() => {
    async function load() {
      setLoadingEmps(true);
      try {
        const res = await fetch("/api/admin/employees");
        const data = await res.json();
        const raw = (data.employees ?? data ?? []) as Record<string, unknown>[];
        setEmployeeList(raw.map(normalizeEmployee));
      } catch {
        // silent
      } finally {
        setLoadingEmps(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return employeeList;
    const q = search.toLowerCase();
    return employeeList.filter((e) => e.FullName.toLowerCase().includes(q));
  }, [employeeList, search]);

  const selectedEmps = useMemo(
    () => employeeList.filter((e) => selectedIds.includes(e.EmployeeID)),
    [employeeList, selectedIds]
  );

  function toggleEmployee(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const canSend = broadcast || (sendDMs && selectedIds.length > 0);

  async function handleSend() {
    await resendMutation.mutateAsync({
      id: event.NotificationID,
      broadcast,
      employeeIds: sendDMs ? selectedIds : undefined,
    });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reenviar comunicado</DialogTitle>
          <DialogDescription>
            {event.Title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Broadcast option */}
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50">
            <input
              type="checkbox"
              checked={broadcast}
              onChange={(e) => setBroadcast(e.target.checked)}
              className="size-4 rounded border-input"
            />
            <Users className="size-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Enviar al grupo de broadcast</p>
              <p className="text-xs text-muted-foreground">
                Crea un grupo con todos los empleados de la empresa
              </p>
            </div>
          </label>

          {/* DM option */}
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50">
            <input
              type="checkbox"
              checked={sendDMs}
              onChange={(e) => setSendDMs(e.target.checked)}
              className="size-4 rounded border-input"
            />
            <Send className="size-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Enviar como mensaje directo</p>
              <p className="text-xs text-muted-foreground">
                Envia un mensaje individual a empleados seleccionados
              </p>
            </div>
          </label>

          {/* Employee picker (visible when DMs enabled) */}
          {sendDMs && (
            <div className="space-y-3 rounded-lg border p-3">
              {/* Selected chips */}
              {selectedEmps.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedEmps.map((emp) => (
                    <span
                      key={emp.EmployeeID}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                    >
                      {emp.FullName.split(" ")[0]}
                      <button
                        type="button"
                        onClick={() => toggleEmployee(emp.EmployeeID)}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar empleado..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Employee list */}
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {loadingEmps ? (
                  <p className="py-3 text-center text-sm text-muted-foreground">
                    Cargando...
                  </p>
                ) : filtered.length === 0 ? (
                  <p className="py-3 text-center text-sm text-muted-foreground">
                    Sin resultados
                  </p>
                ) : (
                  filtered.slice(0, 20).map((emp) => {
                    const selected = selectedIds.includes(emp.EmployeeID);
                    return (
                      <button
                        key={emp.EmployeeID}
                        type="button"
                        onClick={() => toggleEmployee(emp.EmployeeID)}
                        className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/50 ${
                          selected ? "bg-primary/5" : ""
                        }`}
                      >
                        <Avatar className="size-7">
                          <AvatarFallback className="text-xs">
                            {getInitials(emp.FullName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 truncate">{emp.FullName}</span>
                        {selected && (
                          <Check className="size-4 text-primary" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {selectedIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedIds.length} empleado{selectedIds.length !== 1 ? "s" : ""} seleccionado{selectedIds.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={!canSend || resendMutation.isPending}
          >
            {resendMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            {resendMutation.isPending ? "Enviando..." : "Reenviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  DocumentosAdmin                                                   */
/* ------------------------------------------------------------------ */

interface AdminDoc {
  DocID: string;
  Title: string;
  Category: string;
  FileName: string;
  FileSize: number;
  UploadedByName: string;
  CreatedAt: string;
}

const CATEGORIES = ["Politicas", "Manuales", "Formatos", "Otros"];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentosAdmin() {
  const [docs, setDocs] = useState<AdminDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Politicas");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadDocs = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/admin/hr/documents");
      if (!res.ok) throw new Error("Error al cargar documentos");
      const json = await res.json();
      setDocs(json.documents ?? []);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file || !title.trim()) {
      setError("Titulo y archivo son obligatorios");
      return;
    }
    setError(null);
    setUploading(true);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", title.trim());
      fd.append("category", category);

      const res = await fetch("/api/admin/hr/documents", { method: "POST", body: fd });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Error al subir documento");
        return;
      }

      setTitle("");
      setCategory("Politicas");
      if (fileRef.current) fileRef.current.value = "";
      await loadDocs();
    } catch {
      setError("Error de conexion");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(docId: string) {
    try {
      await fetch(`/api/admin/hr/documents/${docId}`, { method: "DELETE" });
      setDocs((prev) => prev.filter((d) => d.DocID !== docId));
    } catch {
      // silent
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="size-5" />
          Documentos RRHH
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload form */}
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="mb-3 text-sm font-medium">Subir nuevo documento</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="doc-title">Titulo</Label>
              <Input
                id="doc-title"
                placeholder="Ej: Politica de vacaciones"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="doc-category">Categoria</Label>
              <select
                id="doc-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="doc-file">Archivo</Label>
              <Input
                id="doc-file"
                type="file"
                ref={fileRef}
                accept=".pdf,.docx,.xlsx,.pptx,.jpg,.jpeg,.png,.webp"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleUpload} disabled={uploading} className="w-full">
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                {uploading ? "Subiendo..." : "Subir"}
              </Button>
            </div>
          </div>
          {error && (
            <p className="mt-2 text-sm text-destructive">{error}</p>
          )}
        </div>

        {/* Document list */}
        {isLoading ? (
          <TableSkeleton />
        ) : docs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Sin documentos"
            description="Sube el primer documento para que los empleados puedan verlo"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titulo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Archivo</TableHead>
                <TableHead>Tamaño</TableHead>
                <TableHead>Subido por</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((doc) => (
                <TableRow key={doc.DocID}>
                  <TableCell className="font-medium">{doc.Title}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{doc.Category}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                    {doc.FileName}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatFileSize(doc.FileSize)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {doc.UploadedByName}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(doc.CreatedAt).toLocaleDateString("es-PE", {
                      day: "numeric",
                      month: "short",
                    })}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDelete(doc.DocID)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
