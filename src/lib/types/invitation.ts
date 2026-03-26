export type InviteStatus = "PENDING" | "USED" | "EXPIRED" | "REVOKED";

export interface Invitation {
  InviteID: string;
  TenantID: string;
  Email: string;
  FullName?: string;
  InvitedBy: string;
  InvitedByName?: string;
  Role: "EMPLOYEE" | "ADMIN";
  Area?: string;
  Position?: string;
  Status: InviteStatus;
  Token: string;
  CreatedAt: string;
  ExpiresAt: string;
}
