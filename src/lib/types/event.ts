export type AppEventType = "meeting" | "social" | "announcement" | "custom";
export type EventVisibility = "company" | "area" | "private";
export type RSVPStatus = "going" | "maybe" | "declined";

export interface AppEvent {
  EventID: string;
  TenantID: string;
  Title: string;
  Description?: string;
  Type: AppEventType;
  Visibility: EventVisibility;
  TargetArea?: string;
  StartDate: string; // ISO date
  EndDate?: string;
  Location?: string;
  CreatorID: string;
  CreatorName: string;
  RSVPs?: Record<string, RSVPStatus>;
  Status: "ACTIVE" | "CANCELLED";
  CreatedAt: string;
  UpdatedAt: string;
}
