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
  | "ANNOUNCEMENT"
  | "SYSTEM"
  // New in v2
  | "NEW_MESSAGE"
  | "NEW_POST"
  | "BIRTHDAY_TODAY"
  | "BIRTHDAY_UPCOMING"
  | "WORK_ANNIVERSARY"
  | "PENDING_REMINDER";

/**
 * Audio cue the frontend should play when a notification of this type
 * arrives. Kept on the notification row itself so the dispatcher (backend
 * or Lambda) can pick the right sound without the client having to guess.
 */
export type NotificationSound =
  | "message"
  | "approval"
  | "reject"
  | "post"
  | "celebrate"
  | "system";

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
  /** Optional audio cue. If missing the client derives a default from `type`. */
  soundType?: NotificationSound;
}

export interface SystemSetting {
  SettingKey: string;
  value: unknown;
  updatedAt: string;
  updatedBy: string;
}
