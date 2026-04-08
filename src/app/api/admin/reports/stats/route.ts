import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { getReportsStats } from "@/lib/services/reports-stats.service";
import { withErrorHandler, ValidationError } from "@/lib/utils/errors";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const GET = withErrorHandler(async (req: Request) => {
  const user = await requireAdmin();
  const url = new URL(req.url);

  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const area = url.searchParams.get("area") || undefined;

  if (!from || !DATE_RE.test(from)) {
    throw new ValidationError("Parámetro 'from' inválido (formato YYYY-MM-DD)");
  }
  if (!to || !DATE_RE.test(to)) {
    throw new ValidationError("Parámetro 'to' inválido (formato YYYY-MM-DD)");
  }
  if (from > to) {
    throw new ValidationError("'from' no puede ser posterior a 'to'");
  }

  const stats = await getReportsStats(user.tenantId, from, to, area);
  return NextResponse.json({ ok: true, ...stats });
});
