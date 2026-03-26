export interface AIChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface ChatSession {
  SessionID: string; // "CSESS#uuid"
  EmployeeID: string;
  TenantID: string;
  Title: string;
  Messages: AIChatMessage[];
  Model: string; // "anthropic.claude-3-haiku-20240307-v1:0"
  CreatedAt: string;
  UpdatedAt: string;
}
