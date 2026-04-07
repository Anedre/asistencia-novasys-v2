"use client";

import { useState, useMemo } from "react";
import { useAdminEmployees } from "@/hooks/use-employee";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { ALL_REASON_OPTIONS } from "@/lib/constants/reason-codes";
import { Loader2, CheckCircle, XCircle, Search, Users } from "lucide-react";

interface FormMessage {
  type: "success" | "error";
  text: string;
}

export default function RegularizePage() {
  const { data, isLoading: loadingEmployees } = useAdminEmployees();
  const employees = data?.employees ?? [];
  const [empSearch, setEmpSearch] = useState("");

  const filteredEmployees = useMemo(() => {
    if (!empSearch.trim()) return employees;
    const q = empSearch.toLowerCase();
    return employees.filter(
      (e) =>
        e.fullName.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.area.toLowerCase().includes(q)
    );
  }, [employees, empSearch]);

  // Single day form state
  const [singleEmployeeId, setSingleEmployeeId] = useState("");
  const [singleEmployeeName, setSingleEmployeeName] = useState("");
  const [workDate, setWorkDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [breakMinutes, setBreakMinutes] = useState(60);
  const [reasonCode, setReasonCode] = useState("");
  const [reasonNote, setReasonNote] = useState("");
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleMessage, setSingleMessage] = useState<FormMessage | null>(null);

  // Range form state
  const [rangeEmployeeId, setRangeEmployeeId] = useState("");
  const [rangeEmployeeName, setRangeEmployeeName] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rangeStartTime, setRangeStartTime] = useState("09:00");
  const [rangeEndTime, setRangeEndTime] = useState("18:00");
  const [rangeBreakMinutes, setRangeBreakMinutes] = useState(60);
  const [rangeReasonCode, setRangeReasonCode] = useState("");
  const [rangeReasonNote, setRangeReasonNote] = useState("");
  const [weekdaysOnly, setWeekdaysOnly] = useState(true);
  const [pastDatesOnly, setPastDatesOnly] = useState(true);
  const [overwrite, setOverwrite] = useState(false);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [rangeMessage, setRangeMessage] = useState<FormMessage | null>(null);

  function selectEmployee(
    empId: string,
    empName: string,
    target: "single" | "range"
  ) {
    if (target === "single") {
      setSingleEmployeeId(empId);
      setSingleEmployeeName(empName);
    } else {
      setRangeEmployeeId(empId);
      setRangeEmployeeName(empName);
    }
  }

  async function handleSingleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSingleLoading(true);
    setSingleMessage(null);

    try {
      const res = await fetch("/api/regularization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: singleEmployeeId,
          workDate,
          startTime,
          endTime,
          breakMinutes,
          reasonCode,
          reasonNote,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al regularizar");
      }

      setSingleMessage({
        type: "success",
        text: data.message || "Regularizacion aplicada correctamente",
      });
    } catch (err) {
      setSingleMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setSingleLoading(false);
    }
  }

  async function handleRangeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRangeLoading(true);
    setRangeMessage(null);

    try {
      const res = await fetch("/api/regularization/range", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: rangeEmployeeId,
          dateFrom,
          dateTo,
          startTime: rangeStartTime,
          endTime: rangeEndTime,
          breakMinutes: rangeBreakMinutes,
          reasonCode: rangeReasonCode,
          reasonNote: rangeReasonNote,
          weekdaysOnly,
          pastDatesOnly,
          overwrite,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al regularizar rango");
      }

      const processedCount =
        (data.totalCreated ?? 0) + (data.totalOverwritten ?? 0);
      const parts: string[] = [
        `Regularización aplicada a ${processedCount} día(s)`,
      ];
      if (data.totalIgnoredHolidays) {
        parts.push(`${data.totalIgnoredHolidays} feriado(s) respetado(s)`);
      }
      if (data.totalIgnoredWeekends) {
        parts.push(`${data.totalIgnoredWeekends} fin(es) de semana omitido(s)`);
      }
      if (data.totalSkipped) {
        parts.push(`${data.totalSkipped} ya existente(s) sin sobrescribir`);
      }
      setRangeMessage({
        type: "success",
        text: data.message || parts.join(" · "),
      });
    } catch (err) {
      setRangeMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setRangeLoading(false);
    }
  }

  function EmployeeSelector({
    selectedId,
    selectedName,
    target,
  }: {
    selectedId: string;
    selectedName: string;
    target: "single" | "range";
  }) {
    return (
      <div className="space-y-2">
        <Label>Empleado</Label>
        {selectedId ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-md border bg-muted/30 px-3 py-2">
              <p className="text-sm font-medium">{selectedName}</p>
              <p className="text-xs text-muted-foreground">{selectedId}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => selectEmployee("", "", target)}
            >
              Cambiar
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar empleado..."
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {loadingEmployees ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1 rounded-md border p-2">
                {filteredEmployees.map((emp) => (
                  <button
                    key={emp.employeeId}
                    type="button"
                    onClick={() =>
                      selectEmployee(emp.employeeId, emp.fullName, target)
                    }
                    className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                  >
                    <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {emp.fullName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {emp.email} &middot; {emp.area}
                      </p>
                    </div>
                  </button>
                ))}
                {filteredEmployees.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No se encontraron empleados
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Regularizar Asistencia
        </h1>
        <p className="text-muted-foreground">
          Regularizacion directa de dias individuales o rangos
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Regularizacion</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="single">
            <TabsList>
              <TabsTrigger value="single">Dia Individual</TabsTrigger>
              <TabsTrigger value="range">Rango de Fechas</TabsTrigger>
            </TabsList>

            {/* Single Day Tab */}
            <TabsContent value="single" className="mt-4">
              <form onSubmit={handleSingleSubmit} className="space-y-4">
                <EmployeeSelector
                  selectedId={singleEmployeeId}
                  selectedName={singleEmployeeName}
                  target="single"
                />

                <div className="space-y-1.5">
                  <Label htmlFor="workDate">Fecha</Label>
                  <Input
                    id="workDate"
                    type="date"
                    value={workDate}
                    onChange={(e) => setWorkDate(e.target.value)}
                    required
                    className="max-w-xs"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="startTime">Hora Entrada</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="endTime">Hora Salida</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="breakMinutes">Break (minutos)</Label>
                    <Input
                      id="breakMinutes"
                      type="number"
                      min={0}
                      max={480}
                      value={breakMinutes}
                      onChange={(e) =>
                        setBreakMinutes(Number(e.target.value))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reasonCode">Motivo</Label>
                  <select
                    id="reasonCode"
                    value={reasonCode}
                    onChange={(e) => setReasonCode(e.target.value)}
                    required
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Seleccionar motivo...</option>
                    {ALL_REASON_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reasonNote">Nota adicional</Label>
                  <Textarea
                    id="reasonNote"
                    placeholder="Detalle opcional..."
                    value={reasonNote}
                    onChange={(e) => setReasonNote(e.target.value)}
                    rows={3}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={singleLoading || !singleEmployeeId}
                >
                  {singleLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Regularizar Dia
                </Button>

                {singleMessage && (
                  <div
                    className={`flex items-center gap-2 rounded-md p-3 text-sm ${
                      singleMessage.type === "success"
                        ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                    }`}
                  >
                    {singleMessage.type === "success" ? (
                      <CheckCircle className="h-4 w-4 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0" />
                    )}
                    {singleMessage.text}
                  </div>
                )}
              </form>
            </TabsContent>

            {/* Range Tab */}
            <TabsContent value="range" className="mt-4">
              <form onSubmit={handleRangeSubmit} className="space-y-4">
                <EmployeeSelector
                  selectedId={rangeEmployeeId}
                  selectedName={rangeEmployeeName}
                  target="range"
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="dateFrom">Fecha Inicio</Label>
                    <Input
                      id="dateFrom"
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dateTo">Fecha Fin</Label>
                    <Input
                      id="dateTo"
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="rangeStartTime">Hora Entrada</Label>
                    <Input
                      id="rangeStartTime"
                      type="time"
                      value={rangeStartTime}
                      onChange={(e) => setRangeStartTime(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rangeEndTime">Hora Salida</Label>
                    <Input
                      id="rangeEndTime"
                      type="time"
                      value={rangeEndTime}
                      onChange={(e) => setRangeEndTime(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rangeBreakMinutes">Break (minutos)</Label>
                    <Input
                      id="rangeBreakMinutes"
                      type="number"
                      min={0}
                      max={480}
                      value={rangeBreakMinutes}
                      onChange={(e) =>
                        setRangeBreakMinutes(Number(e.target.value))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="rangeReasonCode">Motivo</Label>
                  <select
                    id="rangeReasonCode"
                    value={rangeReasonCode}
                    onChange={(e) => setRangeReasonCode(e.target.value)}
                    required
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Seleccionar motivo...</option>
                    {ALL_REASON_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="rangeReasonNote">Nota adicional</Label>
                  <Textarea
                    id="rangeReasonNote"
                    placeholder="Detalle opcional..."
                    value={rangeReasonNote}
                    onChange={(e) => setRangeReasonNote(e.target.value)}
                    rows={3}
                  />
                </div>

                {/* Toggle options */}
                <div className="space-y-3 rounded-md border p-4">
                  <h3 className="text-sm font-medium">Opciones</h3>
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="weekdaysOnly"
                      className="text-sm font-normal"
                    >
                      Solo dias laborales (lun-vie)
                    </Label>
                    <Switch
                      id="weekdaysOnly"
                      checked={weekdaysOnly}
                      onCheckedChange={setWeekdaysOnly}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="pastDatesOnly"
                      className="text-sm font-normal"
                    >
                      Solo fechas pasadas
                    </Label>
                    <Switch
                      id="pastDatesOnly"
                      checked={pastDatesOnly}
                      onCheckedChange={setPastDatesOnly}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="overwrite"
                      className="text-sm font-normal"
                    >
                      Sobrescribir registros existentes
                    </Label>
                    <Switch
                      id="overwrite"
                      checked={overwrite}
                      onCheckedChange={setOverwrite}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={rangeLoading || !rangeEmployeeId}
                >
                  {rangeLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Regularizar Rango
                </Button>

                {rangeMessage && (
                  <div
                    className={`flex items-center gap-2 rounded-md p-3 text-sm ${
                      rangeMessage.type === "success"
                        ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                    }`}
                  >
                    {rangeMessage.type === "success" ? (
                      <CheckCircle className="h-4 w-4 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0" />
                    )}
                    {rangeMessage.text}
                  </div>
                )}
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
