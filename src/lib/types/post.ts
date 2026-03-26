export type ReactionType = "like" | "love" | "celebrate" | "support" | "insightful";

export interface PostComment {
  CommentID: string;     // "CMT#uuid"
  AuthorID: string;
  AuthorName: string;
  AuthorAvatar?: string;
  Content: string;
  CreatedAt: string;
}

export interface PostReaction {
  EmployeeID: string;
  EmployeeName: string;
  Type: ReactionType;
}

export type PostVisibility = "company" | "area" | "private";

export interface Post {
  PostID: string;           // "POST#uuid"
  TenantID: string;
  AuthorID: string;
  AuthorName: string;
  AuthorAvatar?: string;
  AuthorArea?: string;
  AuthorPosition?: string;
  Content: string;
  ImageUrl?: string;        // Optional image attachment
  Visibility: PostVisibility;
  TargetArea?: string;      // Required when visibility is "area"
  Comments: PostComment[];
  Reactions: PostReaction[];
  IsPinned?: boolean;
  CreatedAt: string;
  UpdatedAt: string;
}
