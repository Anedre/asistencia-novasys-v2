"use client";

import { useState } from "react";
import { useAdminEmployees } from "@/hooks/use-employee";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FileDown,
  Loader2,
  Users,
  Search,
  CheckCircle,
  XCircle,
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
}

export default function AdminReportsPage() {
  const { data, isLoading: loadingEmployees } = useAdminEmployees();
  const employees = data?.employees ?? [];

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [week, setWeek] = useState(getCurrentWeek());
  const [month, setMonth] = useState(getCurrentMonth());
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GenerateResult[]>([]);

  const filtered = employees.filter((e) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.fullName.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      e.area.toLowerCase().includes(q)
    );
  });

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
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
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

        const data = await res.json();

        if (!res.ok) {
          newResults.push({
            type: "error",
            text: `${empName}: ${data.error || "Error al generar"}`,
          });
          continue;
        }

        if (data.url) {
          window.open(data.url, "_blank");
          newResults.push({
            type: "success",
            text: `${empName}: Reporte generado correctamente`,
          });
        }
      } catch (err) {
        newResults.push({
          type: "error",
          text: `${empName}: ${err instanceof Error ? err.message : "Error desconocido"}`,
        });
      }
    }

    setResults(newResults);
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reportes</h1>
        <p className="text-muted-foreground">
          Genera reportes de asistencia para uno o varios empleados
        </p>
      </div>

      {/* Employee selector */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Seleccionar Empleados ({selectedIds.size} seleccionados)
            </CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, email o area..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingEmployees ? (
            <p className="text-sm text-muted-foreground">Cargando empleados...</p>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2">
                <Checkbox
                  id="selectAll"
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                />
                <Label htmlFor="selectAll" className="text-sm font-medium cursor-pointer">
                  Seleccionar todos ({filtered.length})
                </Label>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1 rounded-md border p-2">
                {filtered.map((emp) => (
                  <label
                    key={emp.employeeId}
                    className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedIds.has(emp.employeeId)}
                      onCheckedChange={() => toggleOne(emp.employeeId)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {emp.fullName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {emp.email} &middot; {emp.area}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {emp.position}
                    </Badge>
                  </label>
                ))}
                {filtered.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No se encontraron empleados
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Report generation */}
      <Card>
        <CardHeader>
          <CardTitle>Generar Reporte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="weekly">
            <TabsList>
              <TabsTrigger value="weekly">Semanal</TabsTrigger>
              <TabsTrigger value="monthly">Mensual</TabsTrigger>
            </TabsList>

            <TabsContent value="weekly" className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="weekSelect">Semana</Label>
                <Input
                  id="weekSelect"
                  type="week"
                  value={week}
                  onChange={(e) => setWeek(e.target.value)}
                  className="max-w-xs"
                />
              </div>
              <Button
                onClick={() => handleGenerate("weekly")}
                disabled={loading || selectedIds.size === 0 || !week}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="mr-2 h-4 w-4" />
                )}
                Generar Reporte Semanal
                {selectedIds.size > 1 && ` (${selectedIds.size} empleados)`}
              </Button>
            </TabsContent>

            <TabsContent value="monthly" className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="monthSelect">Mes</Label>
                <Input
                  id="monthSelect"
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="max-w-xs"
                />
              </div>
              <Button
                onClick={() => handleGenerate("monthly")}
                disabled={loading || selectedIds.size === 0 || !month}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="mr-2 h-4 w-4" />
                )}
                Generar Reporte Mensual
                {selectedIds.size > 1 && ` (${selectedIds.size} empleados)`}
              </Button>
            </TabsContent>
          </Tabs>

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-2 mt-4">
              {results.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded-md p-3 text-sm ${
                    r.type === "success"
                      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                      : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                  }`}
                >
                  {r.type === "success" ? (
                    <CheckCircle className="h-4 w-4 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0" />
                  )}
                  {r.text}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
