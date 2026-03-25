"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
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
import { FileDown, Loader2 } from "lucide-react";

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

export default function ReportsPage() {
  const { data: session } = useSession();
  const employeeId = (session?.user as { employeeId?: string })?.employeeId ?? "";

  const [week, setWeek] = useState(getCurrentWeek());
  const [month, setMonth] = useState(getCurrentMonth());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(type: "weekly" | "monthly") {
    setLoading(true);
    setError(null);

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
        throw new Error(data.error || "Error al generar el reporte");
      }

      if (data.url) {
        window.open(data.url, "_blank");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reportes</h1>
        <p className="text-muted-foreground">
          Descarga tus reportes de asistencia en PDF
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generar Reporte</CardTitle>
        </CardHeader>
        <CardContent>
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
                disabled={loading || !week}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="mr-2 h-4 w-4" />
                )}
                Generar Reporte Semanal
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
                disabled={loading || !month}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="mr-2 h-4 w-4" />
                )}
                Generar Reporte Mensual
              </Button>
            </TabsContent>
          </Tabs>

          {error && (
            <p className="mt-4 text-sm text-destructive">{error}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
