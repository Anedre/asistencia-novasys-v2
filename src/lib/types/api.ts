export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  lastKey?: string;
  count: number;
  total?: number;
}

export type NotificationType =
  | "REQUEST_APPROVED"
  | "REQUEST_REJECTED"
  | "NEW_REQUEST"
  | "HR_EVENT"
  | "SYSTEM";

export interface UserNotification {
  recipientId: string;
  createdAt: string;
  notificationId: string;
  type: NotificationType;
  title: string;
  message: string;
  referenceId?: string;
  referenceType?: string;
  read: boolean;
  ttl?: number;
}

export interface SystemSetting {
  SettingKey: string;
  value: unknown;
  updatedAt: string;
  updatedBy: string;
}
