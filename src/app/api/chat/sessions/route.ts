import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { withErrorHandler } from "@/lib/utils/errors";
import {
  getChatSessionsByEmployee,
  createChatSession,
} from "@/lib/db/chat-sessions";
import type { ChatSession } from "@/lib/types/chat";

export const GET = withErrorHandler(async () => {
  const user = await requireSession();
  const sessions = await getChatSessionsByEmployee(user.employeeId);
  return NextResponse.json({ sessions });
});

export const POST = withErrorHandler(async () => {
  const user = await requireSession();
  const now = new Date().toISOString();

  const session: ChatSession = {
    SessionID: `CSESS#${crypto.randomUUID()}`,
    EmployeeID: user.employeeId,
    TenantID: user.tenantId,
    Title: "Nueva conversación",
    Messages: [],
    Model: process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    CreatedAt: now,
    UpdatedAt: now,
  };

  await createChatSession(session);
  return NextResponse.json({ ok: true, session });
});
