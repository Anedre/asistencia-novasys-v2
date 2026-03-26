import { docClient } from "./client";
import { TABLES, INDEXES } from "./tables";
import { GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { Post, PostComment, PostReaction } from "@/lib/types/post";

export async function getPostById(postId: string): Promise<Post | null> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLES.POSTS, Key: { PostID: postId } })
  );
  return (result.Item as Post) ?? null;
}

export async function getPostsByTenant(tenantId: string, limit = 50): Promise<Post[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.POSTS,
      IndexName: INDEXES.POSTS_BY_TENANT,
      KeyConditionExpression: "TenantID = :tid",
      ExpressionAttributeValues: { ":tid": tenantId },
      ScanIndexForward: false,
      Limit: limit,
    })
  );
  return (result.Items as Post[]) ?? [];
}

export async function getPostsByAuthor(authorId: string): Promise<Post[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.POSTS,
      IndexName: INDEXES.POSTS_BY_AUTHOR,
      KeyConditionExpression: "AuthorID = :aid",
      ExpressionAttributeValues: { ":aid": authorId },
      ScanIndexForward: false,
    })
  );
  return (result.Items as Post[]) ?? [];
}

export async function createPost(post: Post): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLES.POSTS,
      Item: post,
      ConditionExpression: "attribute_not_exists(PostID)",
    })
  );
}

export async function updatePost(
  postId: string,
  updates: { Content?: string; ImageUrl?: string; Visibility?: string; TargetArea?: string }
): Promise<void> {
  const expressions: string[] = ["UpdatedAt = :now"];
  const values: Record<string, unknown> = { ":now": new Date().toISOString() };

  const fieldMap: Record<string, string> = {
    Content: "Content",
    ImageUrl: "ImageUrl",
    Visibility: "Visibility",
    TargetArea: "TargetArea",
  };

  for (const [key, attr] of Object.entries(fieldMap)) {
    if ((updates as Record<string, unknown>)[key] !== undefined) {
      expressions.push(`${attr} = :${key.toLowerCase()}`);
      values[`:${key.toLowerCase()}`] = (updates as Record<string, unknown>)[key];
    }
  }

  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.POSTS,
      Key: { PostID: postId },
      UpdateExpression: `SET ${expressions.join(", ")}`,
      ExpressionAttributeValues: values,
    })
  );
}

export async function deletePost(postId: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({ TableName: TABLES.POSTS, Key: { PostID: postId } })
  );
}

export async function addComment(postId: string, comment: PostComment): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.POSTS,
      Key: { PostID: postId },
      UpdateExpression:
        "SET Comments = list_append(if_not_exists(Comments, :empty), :comment), UpdatedAt = :now",
      ExpressionAttributeValues: {
        ":comment": [comment],
        ":empty": [],
        ":now": new Date().toISOString(),
      },
    })
  );
}

export async function removeComment(postId: string, commentIndex: number): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.POSTS,
      Key: { PostID: postId },
      UpdateExpression: `REMOVE Comments[${commentIndex}] SET UpdatedAt = :now`,
      ExpressionAttributeValues: { ":now": new Date().toISOString() },
    })
  );
}

export async function addReaction(postId: string, reaction: PostReaction): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.POSTS,
      Key: { PostID: postId },
      UpdateExpression:
        "SET Reactions = list_append(if_not_exists(Reactions, :empty), :reaction), UpdatedAt = :now",
      ExpressionAttributeValues: {
        ":reaction": [reaction],
        ":empty": [],
        ":now": new Date().toISOString(),
      },
    })
  );
}

export async function removeReaction(postId: string, employeeId: string): Promise<number> {
  const post = await getPostById(postId);
  if (!post) return -1;

  const index = (post.Reactions ?? []).findIndex((r) => r.EmployeeID === employeeId);
  if (index === -1) return -1;

  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.POSTS,
      Key: { PostID: postId },
      UpdateExpression: `REMOVE Reactions[${index}] SET UpdatedAt = :now`,
      ExpressionAttributeValues: { ":now": new Date().toISOString() },
    })
  );

  return index;
}

export async function togglePinPost(postId: string, isPinned: boolean): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.POSTS,
      Key: { PostID: postId },
      UpdateExpression: "SET IsPinned = :pinned, UpdatedAt = :now",
      ExpressionAttributeValues: {
        ":pinned": isPinned,
        ":now": new Date().toISOString(),
      },
    })
  );
}
