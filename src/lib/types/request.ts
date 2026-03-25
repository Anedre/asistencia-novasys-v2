export type RequestType =
  | "REGULARIZATION_SINGLE"
  | "REGULARIZATION_RANGE"
  | "PERMISSION"
  | "VACATION";

export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface ApprovalRequest {
  RequestID: string; // "REQ#{timestamp}#{uuid}"
  SK: "METADATA";
  employeeId: string;
  employeeName: string;
  requestType: RequestType;
  status: RequestStatus;
  // Date fields
  effectiveDate?: string; // for single day
  dateFrom?: string; // for range
  dateTo?: string;
  // Time fields (for workday regularizations)
  startTime?: string; // "09:00"
  endTime?: string; // "18:00"
  breakMinutes?: number;
  // Reason
  reasonCode: string;
  reasonNote?: string;
  // Review
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewerNote?: string;
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface CreateRequestInput {
  requestType: RequestType;
  effectiveDate?: string;
  dateFrom?: string;
  dateTo?: string;
  startTime?: string;
  endTime?: string;
  breakMinutes?: number;
  reasonCode: string;
  reasonNote?: string;
}

export interface ReviewRequestInput {
  action: "APPROVE" | "REJECT";
  reviewerNote?: string;
}
