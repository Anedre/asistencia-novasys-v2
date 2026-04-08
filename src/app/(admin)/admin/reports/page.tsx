"use client";

import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { BarChart3, FileDown } from "lucide-react";
import { DashboardTab } from "@/components/admin/reports/DashboardTab";
import { GeneratePdfTab } from "@/components/admin/reports/GeneratePdfTab";

export default function AdminReportsPage() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reportes</h1>
        <p className="text-sm text-muted-foreground">
          Analiza métricas históricas del equipo o genera reportes PDF por
          empleado.
        </p>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">
            <BarChart3 className="mr-1.5 h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="pdf">
            <FileDown className="mr-1.5 h-4 w-4" />
            Generar PDF
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <DashboardTab />
        </TabsContent>

        <TabsContent value="pdf" className="mt-6">
          <GeneratePdfTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
