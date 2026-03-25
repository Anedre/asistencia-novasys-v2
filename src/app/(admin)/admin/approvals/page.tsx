"use client";

import { useState } from "react";
import {
  CheckCircle,
  XCircle,
  Inbox,
  Clock,
  CalendarDays,
  User,
  MessageSquare,
} from "lucide-react";
import { usePendingRequests, useReviewRequest } from "@/hooks/use-requests";
import { REQUEST_TYPE_LABELS, REQUEST_STATUS_LABELS } from "@/lib/constants/event-types";
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
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import type { ApprovalRequest } from "@/lib/types";

function ApprovalCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </CardContent>
      <CardFooter className="gap-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
      </CardFooter>
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

function ApprovalCard({
  request,
  onAction,
}: {
  request: ApprovalRequest;
  onAction: (requestId: string, action: "APPROVE" | "REJECT") => void;
}) {
  const typeLabel = REQUEST_TYPE_LABELS[request.requestType] ?? request.requestType;
  const reasonLabel = REASON_LABELS[request.reasonCode] ?? request.reasonCode;
  const statusInfo = REQUEST_STATUS_LABELS[request.status] ?? {
    label: request.status,
    variant: "outline" as const,
  };

  const dateDisplay =
    request.dateFrom && request.dateTo
      ? `${formatDate(request.dateFrom)} — ${formatDate(request.dateTo)}`
      : formatDate(request.effectiveDate);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {typeLabel}
          <Badge variant={statusInfo.variant} className="ml-auto">
            {statusInfo.label}
          </Badge>
        </CardTitle>
        <CardDescription className="flex items-center gap-1">
          <User className="h-3.5 w-3.5" />
          {request.employeeName}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{dateDisplay}</span>
        </div>

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

        <div className="flex items-center gap-2">
          <span className="font-medium text-muted-foreground">Motivo:</span>
          <span>{reasonLabel}</span>
        </div>

        {request.reasonNote && (
          <div className="flex items-start gap-2">
            <MessageSquare className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">{request.reasonNote}</span>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          Creado el {formatDate(request.createdAt)}
        </div>
      </CardContent>

      <CardFooter className="gap-2">
        <Button
          size="sm"
          className="bg-green-600 text-white hover:bg-green-700"
          onClick={() => onAction(request.RequestID, "APPROVE")}
        >
          <CheckCircle className="h-4 w-4" />
          Aprobar
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => onAction(request.RequestID, "REJECT")}
        >
          <XCircle className="h-4 w-4" />
          Rechazar
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function ApprovalsPage() {
  const { data, isLoading, isError, error } = usePendingRequests();
  const reviewMutation = useReviewRequest();
  const requests = data?.requests ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [reviewerNote, setReviewerNote] = useState("");

  const handleAction = (requestId: string, action: "APPROVE" | "REJECT") => {
    setSelectedRequestId(requestId);
    setSelectedAction(action);
    setReviewerNote("");
    setDialogOpen(true);
  };

  const handleConfirm = () => {
    if (!selectedRequestId) return;

    reviewMutation.mutate(
      {
        requestId: selectedRequestId,
        action: selectedAction,
        reviewerNote: reviewerNote.trim() || undefined,
      },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setSelectedRequestId(null);
          setReviewerNote("");
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Aprobaciones</h1>
        <p className="text-muted-foreground">
          Cola de solicitudes pendientes de aprobacion
        </p>
      </div>

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <ApprovalCardSkeleton key={i} />
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
          icon={Inbox}
          title="Sin solicitudes pendientes"
          description="No hay solicitudes que requieran tu aprobacion en este momento."
        />
      )}

      {!isLoading && requests.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {requests.map((req) => (
            <ApprovalCard
              key={req.RequestID}
              request={req}
              onAction={handleAction}
            />
          ))}
        </div>
      )}

      {/* Review Confirmation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedAction === "APPROVE"
                ? "Aprobar solicitud"
                : "Rechazar solicitud"}
            </DialogTitle>
            <DialogDescription>
              {selectedAction === "APPROVE"
                ? "Confirma la aprobacion de esta solicitud. Puedes agregar una nota opcional."
                : "Confirma el rechazo de esta solicitud. Se recomienda agregar un motivo."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="reviewerNote">Nota del revisor (opcional)</Label>
            <Textarea
              id="reviewerNote"
              placeholder="Escribe un comentario..."
              value={reviewerNote}
              onChange={(e) => setReviewerNote(e.target.value)}
              rows={3}
            />
          </div>

          {reviewMutation.isError && (
            <p className="text-sm text-destructive">
              {(reviewMutation.error as Error).message}
            </p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={reviewMutation.isPending}
            >
              Cancelar
            </Button>
            {selectedAction === "APPROVE" ? (
              <Button
                className="bg-green-600 text-white hover:bg-green-700"
                onClick={handleConfirm}
                disabled={reviewMutation.isPending}
              >
                <CheckCircle className="h-4 w-4" />
                {reviewMutation.isPending ? "Procesando..." : "Confirmar aprobacion"}
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={handleConfirm}
                disabled={reviewMutation.isPending}
              >
                <XCircle className="h-4 w-4" />
                {reviewMutation.isPending ? "Procesando..." : "Confirmar rechazo"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
