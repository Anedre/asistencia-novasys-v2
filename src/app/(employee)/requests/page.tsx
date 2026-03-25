"use client";

import Link from "next/link";
import { Plus, Send, XCircle, Clock, CalendarDays } from "lucide-react";
import { useMyRequests, useCancelRequest } from "@/hooks/use-requests";
import { REQUEST_STATUS_LABELS, REQUEST_TYPE_LABELS } from "@/lib/constants/event-types";
import { REASON_LABELS } from "@/lib/constants/reason-codes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import type { ApprovalRequest } from "@/lib/types";

function RequestCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </CardContent>
    </Card>
  );
}

function formatDate(iso: string | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function RequestCard({ request }: { request: ApprovalRequest }) {
  const cancelMutation = useCancelRequest();
  const statusInfo = REQUEST_STATUS_LABELS[request.status] ?? {
    label: request.status,
    variant: "outline" as const,
  };
  const typeLabel = REQUEST_TYPE_LABELS[request.requestType] ?? request.requestType;
  const reasonLabel = REASON_LABELS[request.reasonCode] ?? request.reasonCode;

  const dateDisplay =
    request.dateFrom && request.dateTo
      ? `${formatDate(request.dateFrom)} — ${formatDate(request.dateTo)}`
      : formatDate(request.effectiveDate);

  const isPending = request.status === "PENDING";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-4 w-4 text-muted-foreground" />
          {typeLabel}
        </CardTitle>
        <CardAction>
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
        </CardAction>
        <CardDescription className="flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5" />
          {dateDisplay}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium text-muted-foreground">Motivo:</span>
          <span>{reasonLabel}</span>
        </div>
        {request.reasonNote && (
          <div className="flex items-start gap-2">
            <span className="font-medium text-muted-foreground">Nota:</span>
            <span className="text-muted-foreground">{request.reasonNote}</span>
          </div>
        )}
        {request.startTime && request.endTime && (
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span>
              {request.startTime} — {request.endTime}
            </span>
            {request.breakMinutes != null && (
              <span className="text-muted-foreground">
                ({request.breakMinutes} min break)
              </span>
            )}
          </div>
        )}
        {request.reviewedByName && (
          <div className="flex items-center gap-2">
            <span className="font-medium text-muted-foreground">Revisado por:</span>
            <span>{request.reviewedByName}</span>
            {request.reviewedAt && (
              <span className="text-xs text-muted-foreground">
                el {formatDate(request.reviewedAt)}
              </span>
            )}
          </div>
        )}
        {request.reviewerNote && (
          <div className="flex items-start gap-2">
            <span className="font-medium text-muted-foreground">Comentario:</span>
            <span className="text-muted-foreground">{request.reviewerNote}</span>
          </div>
        )}
      </CardContent>

      {isPending && (
        <CardFooter>
          <Button
            variant="destructive"
            size="sm"
            disabled={cancelMutation.isPending}
            onClick={() => cancelMutation.mutate(request.RequestID)}
          >
            <XCircle className="h-4 w-4" />
            {cancelMutation.isPending ? "Cancelando..." : "Cancelar solicitud"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

export default function RequestsPage() {
  const { data, isLoading, isError, error } = useMyRequests();
  const requests = data?.requests ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mis Solicitudes</h1>
          <p className="text-muted-foreground">
            Gestiona tus solicitudes de regularizacion y permisos
          </p>
        </div>
        <Button render={<Link href="/requests/new" />}>
          <Plus className="h-4 w-4" />
          Nueva solicitud
        </Button>
      </div>

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <RequestCardSkeleton key={i} />
          ))}
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-destructive">
            Error al cargar solicitudes: {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && requests.length === 0 && (
        <EmptyState
          icon={Send}
          title="Sin solicitudes"
          description="Aun no has creado ninguna solicitud. Crea una nueva para comenzar."
          action={
            <Button render={<Link href="/requests/new" />}>
              <Plus className="h-4 w-4" />
              Crear solicitud
            </Button>
          }
        />
      )}

      {!isLoading && requests.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {requests.map((req) => (
            <RequestCard key={req.RequestID} request={req} />
          ))}
        </div>
      )}
    </div>
  );
}
