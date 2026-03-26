import { QueryCommand, PutCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "./client";
import { TABLES, INDEXES } from "./tables";
import type { Invitation } from "../types/invitation";

/** Get invitation by token (for validation during registration) */
export async function getInvitationByToken(token: string): Promise<Invitation | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.INVITATIONS,
      IndexName: INDEXES.INVITATIONS_BY_TOKEN,
      KeyConditionExpression: "#token = :token",
      ExpressionAttributeNames: { "#token": "Token" },
      ExpressionAttributeValues: { ":token": token },
      Limit: 1,
    })
  );
  return (result.Items?.[0] as Invitation) ?? null;
}

/** Get invitations by tenant */
export async function getInvitationsByTenant(tenantId: string): Promise<Invitation[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.INVITATIONS,
      IndexName: INDEXES.INVITATIONS_BY_TENANT,
      KeyConditionExpression: "TenantID = :tid",
      ExpressionAttributeValues: { ":tid": tenantId },
      ScanIndexForward: false,
    })
  );
  return (result.Items as Invitation[]) ?? [];
}

/** Get invitations by email */
export async function getInvitationsByEmail(email: string): Promise<Invitation[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.INVITATIONS,
      IndexName: INDEXES.INVITATIONS_BY_EMAIL,
      KeyConditionExpression: "Email = :email",
      ExpressionAttributeValues: { ":email": email },
    })
  );
  return (result.Items as Invitation[]) ?? [];
}

/** Create a new invitation */
export async function createInvitation(invitation: Invitation): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLES.INVITATIONS,
      Item: invitation,
      ConditionExpression: "attribute_not_exists(InviteID)",
    })
  );
}

/** Mark invitation as USED */
export async function markInvitationUsed(inviteId: string): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.INVITATIONS,
      Key: { InviteID: inviteId },
      UpdateExpression: "SET #status = :used",
      ExpressionAttributeNames: { "#status": "Status" },
      ExpressionAttributeValues: { ":used": "USED" },
    })
  );
}

/** Revoke an invitation */
export async function revokeInvitation(inviteId: string): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.INVITATIONS,
      Key: { InviteID: inviteId },
      UpdateExpression: "SET #status = :revoked",
      ExpressionAttributeNames: { "#status": "Status" },
      ExpressionAttributeValues: { ":revoked": "REVOKED" },
    })
  );
}

/** Delete an invitation */
export async function deleteInvitation(inviteId: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLES.INVITATIONS,
      Key: { InviteID: inviteId },
    })
  );
}
