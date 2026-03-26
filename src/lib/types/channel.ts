export type ChannelType = "direct" | "group" | "area";

export interface ChatChannel {
  ChannelID: string;        // "CH#uuid"
  TenantID: string;
  Name: string;             // Channel name (for groups), or empty for DMs
  Type: ChannelType;
  Members: string[];        // EmployeeID array
  MemberNames: Record<string, string>;  // EmployeeID -> FullName map
  CreatedBy: string;        // EmployeeID
  LastMessage?: string;     // Preview text
  LastMessageBy?: string;   // Name of sender
  LastMessageAt?: string;   // ISO timestamp
  CreatedAt: string;
  UpdatedAt: string;
}

export interface ChatMessage {
  MessageID: string;        // "MSG#uuid"
  ChannelID: string;
  SenderID: string;
  SenderName: string;
  Content: string;
  Type: "text" | "image" | "file";
  CreatedAt: string;
}
