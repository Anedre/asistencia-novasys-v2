"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Users, Check, HelpCircle, X } from "lucide-react";
import type { AppEvent, RSVPStatus } from "@/lib/types/event";
import { useRSVP } from "@/hooks/use-events";
import { useSession } from "next-auth/react";

const typeLabels: Record<string, string> = {
  meeting: "Reunion", social: "Social", announcement: "Anuncio", custom: "Otro",
};
const typeColors: Record<string, string> = {
  meeting: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  social: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  announcement: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  custom: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

interface EventCardProps {
  event: AppEvent;
}

export function EventCard({ event }: EventCardProps) {
  const { data: session } = useSession();
  const rsvpMutation = useRSVP();
  const employeeId = (session?.user as Record<string, string>)?.employeeId;

  const myRSVP = event.RSVPs?.[employeeId] as RSVPStatus | undefined;
  const rsvpCounts = Object.values(event.RSVPs || {});
  const goingCount = rsvpCounts.filter((s) => s === "going").length;

  const handleRSVP = (status: string) => {
    rsvpMutation.mutate({ eventId: event.EventID, status });
  };

  const startDate = new Date(event.StartDate);
  const isUpcoming = startDate > new Date();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{event.Title}</CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              {startDate.toLocaleDateString("es-PE", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
              {" "}
              {startDate.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeColors[event.Type] || typeColors.custom}`}>
            {typeLabels[event.Type] || event.Type}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {event.Description && (
          <p className="text-sm text-muted-foreground">{event.Description}</p>
        )}

        {event.Location && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {event.Location}
          </div>
        )}

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {goingCount} asistente{goingCount !== 1 ? "s" : ""} confirmado{goingCount !== 1 ? "s" : ""}
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            Por {event.CreatorName}
          </p>

          {isUpcoming && (
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={myRSVP === "going" ? "default" : "outline"}
                onClick={() => handleRSVP("going")}
                disabled={rsvpMutation.isPending}
                className="h-7 text-xs"
              >
                <Check className="h-3 w-3 mr-1" /> Voy
              </Button>
              <Button
                size="sm"
                variant={myRSVP === "maybe" ? "default" : "outline"}
                onClick={() => handleRSVP("maybe")}
                disabled={rsvpMutation.isPending}
                className="h-7 text-xs"
              >
                <HelpCircle className="h-3 w-3 mr-1" /> Quizas
              </Button>
              <Button
                size="sm"
                variant={myRSVP === "declined" ? "destructive" : "outline"}
                onClick={() => handleRSVP("declined")}
                disabled={rsvpMutation.isPending}
                className="h-7 text-xs"
              >
                <X className="h-3 w-3 mr-1" /> No
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
