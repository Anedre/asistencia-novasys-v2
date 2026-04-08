"use client";

/**
 * Generate PDF tab — modernized flow for creating weekly/monthly reports
 * per employee via the existing /api/reports/generate Lambda.
 */

import { useMemo, useState } from "react";
import { useAdminEmployees } from "@/hooks/use-employee";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  FileDown,
  Loader2,
  Users,
  Search,
  CheckCircle,
  XCircle,
  CalendarDays,
  CalendarRange,
} from "lucide-react";

function getCurrentWeek(): string {
  const now = new Date();
  const year = now.getFullYear();
  const oneJan = new Date(year, 0, 1);
  const days = Math.floor(
    (now.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000)
  );
  const week = Math.ceil((days + oneJan.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

interface GenerateResult {
  type: "success" | "error";
  text: string;
  url?: string;
}

export function GeneratePdfTab() {
  const { data, isLoading: loadingEmployees } = useAdminEmployees();
  const employees = data?.employees ?? [];

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [week, setWeek] = useState(getCurrentWeek());
  const [month, setMonth] = useState(getCurrentMonth());
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GenerateResult[]>([]);

  const filtered = useMemo(
    () =>
      employees.filter((e) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          e.fullName.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q) ||
          e.area.toLowerCase().includes(q)
        );
      }),
    [employees, search]
  );

  const allSelected =
    filtered.length > 0 && filtered.every((e) => selectedIds.has(e.employeeId));

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((e) => e.employeeId)));
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  async function handleGenerate(type: "weekly" | "monthly") {
    if (selectedIds.size === 0) return;
    setLoading(true);
    setResults([]);

    const newResults: GenerateResult[] = [];

    for (const employeeId of selectedIds) {
      const emp = employees.find((e) => e.employeeId === employeeId);
      const empName = emp?.fullName ?? employeeId;
      const body =
        type === "weekly"
          ? { employeeId, reportType: "weekly", week }
          : { employeeId, reportType: "monthly", month };

      try {
        const res = await fetch("/api/reports/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload = await res.json();
        if (!res.ok) {
          newResults.push({
            type: "error",
            text: `${empName}: ${payload.error || "Error al generar"}`,
          });
          continue;
        }
        if (payload.url) {
          window.open(payload.url, "_blank");
          newResults.push({
            type: "success",
            text: empName,
            url: payload.url,
          });
        }
      } catch (err) {
        newResults.push({
          type: "error",
          text: `${empName}: ${err instanceof Error ? err.message : "Error"}`,
        });
      }
    }

    setResults(newResults);
    setLoading(false);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      {/* ── Employee selector ── */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5" />
              Empleados
              <Badge variant="secondary" className="ml-1">
                {selectedIds.size} seleccionados
              </Badge>
            </CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, email o área…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingEmployees ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando empleados…
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                  Seleccionar todos ({filtered.length})
                </label>
                {selectedIds.size > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    Limpiar
                  </Button>
                )}
              </div>
              <div className="max-h-80 space-y-1 overflow-y-auto rounded-md border p-1">
                {filtered.map((emp) => {
                  const checked = selectedIds.has(emp.employeeId);
                  return (
                    <label
                      key={emp.employeeId}
                      className={
                        "flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer transition " +
                        (checked
                          ? "bg-primary/5 ring-1 ring-primary/20"
                          : "hover:bg-muted/60")
                      }
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleOne(emp.employeeId)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {emp.fullName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {emp.email} · {emp.area}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {emp.position}
                      </Badge>
                    </label>
                  );
                })}
                {filtered.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No se encontraron empleados.
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Generate panel ── */}
      <Card className="h-fit sticky top-4">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileDown className="h-5 w-5" />
            Generar reporte
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="weekly">
            <TabsList className="w-full">
              <TabsTrigger value="weekly" className="flex-1">
                <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                Semanal
              </TabsTrigger>
              <TabsTrigger value="monthly" className="flex-1">
                <CalendarRange className="mr-1.5 h-3.5 w-3.5" />
                Mensual
              </TabsTrigger>
            </TabsList>

            <TabsContent value="weekly" className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="weekSelect" className="text-xs">
                  Semana
                </Label>
                <Input
                  id="weekSelect"
                  type="week"
                  value={week}
                  onChange={(e) => setWeek(e.target.value)}
                />
              </div>
              <Button
                onClick={() => handleGenerate("weekly")}
                disabled={loading || selectedIds.size === 0 || !week}
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="mr-2 h-4 w-4" />
                )}
                Generar semanal
                {selectedIds.size > 0 && ` · ${selectedIds.size}`}
              </Button>
            </TabsContent>

            <TabsContent value="monthly" className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="monthSelect" className="text-xs">
                  Mes
                </Label>
                <Input
                  id="monthSelect"
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              </div>
              <Button
                onClick={() => handleGenerate("monthly")}
                disabled={loading || selectedIds.size === 0 || !month}
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="mr-2 h-4 w-4" />
                )}
                Generar mensual
                {selectedIds.size > 0 && ` · ${selectedIds.size}`}
              </Button>
            </TabsContent>
          </Tabs>

          {results.length > 0 && (
            <div className="mt-4 space-y-1.5 max-h-64 overflow-y-auto">
              {results.map((r, i) => (
                <div
                  key={i}
                  className={
                    "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs " +
                    (r.type === "success"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300")
                  }
                >
                  {r.type === "success" ? (
                    <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="truncate flex-1">{r.text}</span>
                  {r.url && (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline font-medium shrink-0"
                    >
                      Abrir
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
