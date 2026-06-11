import type { Post } from "@/lib/types/post";

/**
 * Minimal session shape the visibility predicate needs. Kept loose (optional,
 * string-typed fields) so any caller's session object is structurally assignable
 * without a cast.
 */
export type PostViewer = {
  employeeId: string;
  tenantId?: string;
  area?: string;
  role?: string;
};

/**
 * Single source of truth for "can this user see this post", mirroring the feed
 * LIST endpoint's visibility filter. Use it on every direct-by-id access (GET,
 * PUT, reactions, comments) so a leaked/guessed post id can't be read or mutated
 * across the tenant or visibility boundary — private posts, area posts the user
 * doesn't belong to, or posts in another tenant all return false.
 */
export function canViewPost(post: Post, user: PostViewer): boolean {
  if (user.tenantId && post.TenantID && post.TenantID !== user.tenantId) return false;
  if (post.AuthorID === user.employeeId) return true;
  if (post.Visibility === "company") return true;
  if (post.Visibility === "area" && post.TargetArea === user.area) return true;
  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") return true;
  return false;
}
