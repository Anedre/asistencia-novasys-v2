import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { archiveEvent } from "@/lib/services/hr.service";
import { withErrorHandler } from "@/lib/utils/errors";
import { getHREvent } from "@/lib/db/hr-events";
import { getAllActiveEmployees } from "@/lib/db/employees";
import { createChannel, getChannelsByMember, updateChannelLastMessage } from "@/lib/db/chat-channels";
import { createMessage } from "@/lib/db/chat-messages";
import { putNotification } from "@/lib/db/notifications";
import { withAudit } from "@/lib/services/audit.service";

export const DELETE = withErrorHandler(async (
  req: Request,
  context: unknown
) => {
  const admin = await requireAdmin();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  await withAudit(
    {
      actor: admin,
      entityType: "HR_EVENT",
      entityKey: { NotificationID: id },
      action: "DELETE",
      reason: "Archivado de evento RRHH",
    },
    async () => archiveEvent(id)
  );
  return NextResponse.json({ ok: true });
});

/** POST /api/admin/hr/events/[id] — Resend announcement with options
 *  Body: { broadcast?: boolean, employeeIds?: string[] }
 *  - broadcast=true → create group channel with all employees
 *  - employeeIds → send DMs to specific employees
 *  - both can be combined
 */
export const POST = withErrorHandler(async (
  req: Request,
  context: unknown
) => {
  const user = await requireAdmin();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const body = await req.json().catch(() => ({}));

  const broadcast = body.broadcast !== false; // default true for backwards compat
  const targetIds: string[] | undefined = body.employeeIds;

  const event = await getHREvent(id);
  if (!event) {
    return NextResponse.json({ ok: false, error: "Evento no encontrado" }, { status: 404 });
  }

  if (event.Type !== "ANNOUNCEMENT" && event.Type !== "HOLIDAY") {
    return NextResponse.json(
      { ok: false, error: "Solo se pueden reenviar comunicados y feriados" },
      { status: 400 }
    );
  }

  const allEmployees = await getAllActiveEmployees(user.tenantId);
  const now = new Date().toISOString();
  const typeLabel = event.Type === "HOLIDAY" ? "Feriado" : "Comunicado";
  const msgContent = `📢 ${typeLabel}: ${event.Title}\n\n${event.Message}`;

  let sentCount = 0;

  // 1. Broadcast: create group channel with all employees
  if (broadcast) {
    const memberIds = allEmployees.map((e) => e.EmployeeID);
    const memberNames: Record<string, string> = {};
    for (const e of allEmployees) memberNames[e.EmployeeID] = e.FullName;

    const broadcastChannelId = `CH#broadcast#${Date.now()}`;

    await createChannel({
      ChannelID: broadcastChannelId,
      TenantID: user.tenantId,
      Name: `${typeLabel}: ${event.Title}`,
      Type: "group",
      Members: memberIds,
      MemberNames: memberNames,
      CreatedBy: user.employeeId,
      LastMessage: msgContent.substring(0, 100),
      LastMessageBy: user.name,
      LastMessageAt: now,
      CreatedAt: now,
      UpdatedAt: now,
    });

    await createMessage({
      MessageID: `MSG#${Date.now()}#${crypto.randomUUID().slice(0, 8)}`,
      ChannelID: broadcastChannelId,
      SenderID: user.employeeId,
      SenderName: user.name,
      Content: msgContent,
      Type: "text",
      CreatedAt: now,
    });

    // Notifications for broadcast
    const notifPromises = memberIds
      .filter((mid) => mid !== user.employeeId)
      .map((recipientId) =>
        putNotification({
          recipientId,
          notificationId: `NOTIF#${Date.now()}#${crypto.randomUUID().slice(0, 8)}`,
          createdAt: now,
          type: "ANNOUNCEMENT",
          title: `${typeLabel}: ${event.Title}`,
          message: event.Message.substring(0, 200),
          referenceId: broadcastChannelId,
          referenceType: "CHANNEL",
          read: false,
          ttl: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        })
      );
    await Promise.allSettled(notifPromises);
    sentCount += memberIds.length - 1;
  }

  // 2. DMs to specific employees
  if (targetIds && targetIds.length > 0) {
    const adminChannels = await getChannelsByMember(user.tenantId, user.employeeId);
    const existingDMs = new Map<string, string>();
    for (const ch of adminChannels) {
      if (ch.Type === "direct" && ch.Members.length === 2) {
        const otherMember = ch.Members.find((m) => m !== user.employeeId);
        if (otherMember) existingDMs.set(otherMember, ch.ChannelID);
      }
    }

    const empMap = new Map(allEmployees.map((e) => [e.EmployeeID, e]));
    const recipients = targetIds
      .filter((eid) => eid !== user.employeeId && empMap.has(eid))
      .map((eid) => empMap.get(eid)!);

    const dmPromises = recipients.map(async (emp) => {
      let dmChannelId = existingDMs.get(emp.EmployeeID);

      if (!dmChannelId) {
        dmChannelId = `CH#${crypto.randomUUID()}`;
        await createChannel({
          ChannelID: dmChannelId,
          TenantID: user.tenantId,
          Name: "",
          Type: "direct",
          Members: [user.employeeId, emp.EmployeeID],
          MemberNames: {
            [user.employeeId]: user.name,
            [emp.EmployeeID]: emp.FullName,
          },
          CreatedBy: user.employeeId,
          LastMessage: msgContent.substring(0, 100),
          LastMessageBy: user.name,
          LastMessageAt: now,
          CreatedAt: now,
          UpdatedAt: now,
        });
      } else {
        await updateChannelLastMessage(dmChannelId, msgContent, user.name);
      }

      await createMessage({
        MessageID: `MSG#${Date.now()}#${crypto.randomUUID().slice(0, 8)}`,
        ChannelID: dmChannelId,
        SenderID: user.employeeId,
        SenderName: user.name,
        Content: msgContent,
        Type: "text",
        CreatedAt: now,
      });

      await putNotification({
        recipientId: emp.EmployeeID,
        notificationId: `NOTIF#${Date.now()}#${crypto.randomUUID().slice(0, 8)}`,
        createdAt: now,
        type: "ANNOUNCEMENT",
        title: `${typeLabel}: ${event.Title}`,
        message: event.Message.substring(0, 200),
        referenceId: dmChannelId,
        referenceType: "CHANNEL",
        read: false,
        ttl: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      });
    });

    await Promise.allSettled(dmPromises);
    sentCount += recipients.length;
  }

  return NextResponse.json({ ok: true, sent: sentCount });
});
