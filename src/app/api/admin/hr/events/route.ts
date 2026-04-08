import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { getHRDashboard, createHREvent } from "@/lib/services/hr.service";
import { createHREventSchema } from "@/lib/utils/validation";
import { withErrorHandler, ValidationError } from "@/lib/utils/errors";
import { getAllActiveEmployees } from "@/lib/db/employees";
import { createChannel, getChannelsByMember, updateChannelLastMessage } from "@/lib/db/chat-channels";
import { createMessage } from "@/lib/db/chat-messages";
import { putNotification } from "@/lib/db/notifications";
import { withAudit } from "@/lib/services/audit.service";

export const GET = withErrorHandler(async (req: Request) => {
  const user = await requireAdmin();
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") ?? undefined;
  const dashboard = await getHRDashboard(month, user.tenantId);
  return NextResponse.json({ ok: true, ...dashboard });
});

export const POST = withErrorHandler(async (req: Request) => {
  const user = await requireAdmin();
  const body = await req.json();
  const parsed = createHREventSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues.map((i) => i.message).join(", ")
    );
  }
  // createHREvent returns the ID of the row it just inserted — we need the
  // ID to build the entityKey, so capture it first then audit after the fact.
  const notificationId = await createHREvent(parsed.data, user.employeeId, user.tenantId);

  // Audit as a CREATE. The before snapshot will be null (nothing existed),
  // the after snapshot will be the freshly-inserted row, and reverting this
  // entry will delete it (but NOT recall any broadcast messages already sent).
  try {
    await withAudit(
      {
        actor: user,
        entityType: "HR_EVENT",
        entityKey: { NotificationID: notificationId },
        action: "CREATE",
        reason: `Evento RRHH: ${parsed.data.title}`,
        skipBeforeRead: true,
      },
      async () => undefined
    );
  } catch (err) {
    console.error("[audit] Failed to audit HR event create", err);
  }

  // Broadcast ANNOUNCEMENT and HOLIDAY types as messages to all employees
  if (parsed.data.type === "ANNOUNCEMENT" || parsed.data.type === "HOLIDAY") {
    try {
      const employees = await getAllActiveEmployees(user.tenantId);
      const memberIds = employees.map((e) => e.EmployeeID);
      const memberNames: Record<string, string> = {};
      for (const e of employees) memberNames[e.EmployeeID] = e.FullName;

      const now = new Date().toISOString();
      const broadcastChannelId = `CH#broadcast#${Date.now()}`;
      const typeLabel = parsed.data.type === "HOLIDAY" ? "Feriado" : "Comunicado";
      const msgContent = `📢 ${typeLabel}: ${parsed.data.title}\n\n${parsed.data.message}`;

      // 1. Create a group channel for the broadcast
      await createChannel({
        ChannelID: broadcastChannelId,
        TenantID: user.tenantId,
        Name: `${typeLabel}: ${parsed.data.title}`,
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

      // Send the announcement message in the broadcast channel
      await createMessage({
        MessageID: `MSG#${Date.now()}#${crypto.randomUUID().slice(0, 8)}`,
        ChannelID: broadcastChannelId,
        SenderID: user.employeeId,
        SenderName: user.name,
        Content: msgContent,
        Type: "text",
        CreatedAt: now,
      });

      // 2. Also send as direct message from admin to each employee
      const adminChannels = await getChannelsByMember(user.tenantId, user.employeeId);
      const existingDMs = new Map<string, string>();
      for (const ch of adminChannels) {
        if (ch.Type === "direct" && ch.Members.length === 2) {
          const otherMember = ch.Members.find((m) => m !== user.employeeId);
          if (otherMember) existingDMs.set(otherMember, ch.ChannelID);
        }
      }

      const recipients = employees.filter((e) => e.EmployeeID !== user.employeeId);

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

        // Create notification linked to the DM channel
        await putNotification({
          recipientId: emp.EmployeeID,
          notificationId: `NOTIF#${Date.now()}#${crypto.randomUUID().slice(0, 8)}`,
          createdAt: now,
          type: "ANNOUNCEMENT",
          title: `${typeLabel}: ${parsed.data.title}`,
          message: parsed.data.message.substring(0, 200),
          referenceId: dmChannelId,
          referenceType: "CHANNEL",
          read: false,
          ttl: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        });
      });

      await Promise.allSettled(dmPromises);
    } catch (err) {
      console.error("Error broadcasting announcement:", err);
      // Don't fail the HR event creation if broadcast fails
    }
  }

  return NextResponse.json({ ok: true, notificationId }, { status: 201 });
});
