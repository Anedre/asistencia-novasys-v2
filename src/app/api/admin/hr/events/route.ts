import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { getHRDashboard, createHREvent } from "@/lib/services/hr.service";
import { createHREventSchema } from "@/lib/utils/validation";
import { withErrorHandler, ValidationError } from "@/lib/utils/errors";
import { getAllActiveEmployees } from "@/lib/db/employees";
import { createChannel } from "@/lib/db/chat-channels";
import { createMessage } from "@/lib/db/chat-messages";
import { putNotification } from "@/lib/db/notifications";

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
  const notificationId = await createHREvent(parsed.data, user.employeeId, user.tenantId);

  // Broadcast ANNOUNCEMENT and HOLIDAY types as messages to all employees
  if (parsed.data.type === "ANNOUNCEMENT" || parsed.data.type === "HOLIDAY") {
    try {
      const employees = await getAllActiveEmployees(user.tenantId);
      const memberIds = employees.map((e) => e.EmployeeID);
      const memberNames: Record<string, string> = {};
      for (const e of employees) memberNames[e.EmployeeID] = e.FullName;

      const now = new Date().toISOString();
      const channelId = `CH#broadcast#${Date.now()}`;
      const typeLabel = parsed.data.type === "HOLIDAY" ? "Feriado" : "Comunicado";
      const msgContent = `📢 ${typeLabel}: ${parsed.data.title}\n\n${parsed.data.message}`;

      // Create a group channel for the broadcast
      await createChannel({
        ChannelID: channelId,
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

      // Send the announcement message
      await createMessage({
        MessageID: `MSG#${Date.now()}#${crypto.randomUUID().slice(0, 8)}`,
        ChannelID: channelId,
        SenderID: user.employeeId,
        SenderName: user.name,
        Content: msgContent,
        Type: "text",
        CreatedAt: now,
      });

      // Create notification for each employee
      const notifPromises = memberIds
        .filter((id) => id !== user.employeeId)
        .slice(0, 50) // Limit to 50 notifications at a time
        .map((recipientId) =>
          putNotification({
            recipientId,
            notificationId: `NOTIF#${Date.now()}#${crypto.randomUUID().slice(0, 8)}`,
            createdAt: now,
            type: "ANNOUNCEMENT",
            title: `${typeLabel}: ${parsed.data.title}`,
            message: parsed.data.message.substring(0, 200),
            referenceId: channelId,
            referenceType: "CHANNEL",
            read: false,
            ttl: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
          })
        );
      await Promise.allSettled(notifPromises);
    } catch (err) {
      console.error("Error broadcasting announcement:", err);
      // Don't fail the HR event creation if broadcast fails
    }
  }

  return NextResponse.json({ ok: true, notificationId }, { status: 201 });
});
