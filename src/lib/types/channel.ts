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
  Description?: string;     // Group description
  MutedBy?: string[];       // EmployeeIDs who muted this channel
}

export interface MessageReaction {
  emoji: string;            // "👍", "❤️", etc
  userIds: string[];        // EmployeeIDs who reacted
  userNames: string[];      // Names for display
}

export interface ReplyInfo {
  messageId: string;
  senderName: string;
  content: string;          // Truncated preview
}

export interface ChatMessage {
  MessageID: string;        // "MSG#uuid"
  ChannelID: string;
  SenderID: string;
  SenderName: string;
  Content: string;
  Type: "text" | "image" | "file";
  CreatedAt: string;
  Reactions?: Record<string, { userIds: string[]; userNames: string[] }>;
  ReplyTo?: ReplyInfo;
  FileUrl?: string;         // For image/file messages
  FileName?: string;
  FileSize?: number;
}
