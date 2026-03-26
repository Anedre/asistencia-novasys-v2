import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { withErrorHandler } from "@/lib/utils/errors";
import {
  getChannelsByMember,
  createChannel,
} from "@/lib/db/chat-channels";
import type { ChatChannel } from "@/lib/types/channel";

export const GET = withErrorHandler(async () => {
  const user = await requireSession();
  const channels = await getChannelsByMember(user.tenantId, user.employeeId);

  // Sort by last message time (most recent first)
  channels.sort((a, b) => {
    const aTime = a.LastMessageAt || a.UpdatedAt;
    const bTime = b.LastMessageAt || b.UpdatedAt;
    return bTime.localeCompare(aTime);
  });

  return NextResponse.json({ channels });
});

export const POST = withErrorHandler(async (req: Request) => {
  const user = await requireSession();
  const body = await req.json();

  const { name, type, members } = body as {
    name?: string;
    type: "direct" | "group" | "area";
    members: { id: string; name: string }[];
  };

  if (!type || !members || !Array.isArray(members) || members.length === 0) {
    return NextResponse.json(
      { error: "Tipo y miembros son requeridos" },
      { status: 400 }
    );
  }

  if (type === "group" && !name) {
    return NextResponse.json(
      { error: "Los grupos requieren un nombre" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();

  // Build member names map (include creator)
  const memberNames: Record<string, string> = {
    [user.employeeId]: user.name,
  };
  const memberIds: string[] = [user.employeeId];

  for (const m of members) {
    if (m.id !== user.employeeId) {
      memberIds.push(m.id);
      memberNames[m.id] = m.name;
    }
  }

  const channel: ChatChannel = {
    ChannelID: `CH#${crypto.randomUUID()}`,
    TenantID: user.tenantId,
    Name: name || "",
    Type: type,
    Members: memberIds,
    MemberNames: memberNames,
    CreatedBy: user.employeeId,
    CreatedAt: now,
    UpdatedAt: now,
  };

  await createChannel(channel);
  return NextResponse.json({ ok: true, channel });
});
