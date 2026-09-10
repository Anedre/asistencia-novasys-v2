import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import {
  closeOpenShifts,
  findOpenShifts,
  type ClosePolicy,
} from "@/lib/services/shift-close.service";
import { closeOpenShiftsSchema } from "@/lib/utils/validation";
import { withErrorHandler, ValidationError } from "@/lib/utils/errors";
import { workDateLima } from "@/lib/utils/time";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Default window: wide enough to surface a backlog nobody has looked at. */
function defaultRange(): { from: string; to: string } {
  const to = workDateLima();
  const d = new Date(`${to}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - 12);
  return { from: d.toISOString().slice(0, 10), to };
}

/**
 * GET /api/admin/attendance/open-shifts?from=&to=
 *
 * Shifts left open (clocked in, never clocked out) with the clock-out that
 * would be written for each. Read-only: nothing is modified here, so the admin
 * can look before deciding.
 */
export const GET = withErrorHandler(async (req: Request) => {
  const user = await requireAdmin();
  const url = new URL(req.url);

  const fallback = defaultRange();
  const from = url.searchParams.get("from") || fallback.from;
  const to = url.searchParams.get("to") || fallback.to;

  if (!DATE_RE.test(from)) {
    throw new ValidationError("Parámetro 'from' inválido (formato YYYY-MM-DD)");
  }
  if (!DATE_RE.test(to)) {
    throw new ValidationError("Parámetro 'to' inválido (formato YYYY-MM-DD)");
  }
  if (from > to) {
    throw new ValidationError("'from' no puede ser posterior a 'to'");
  }

  const shifts = await findOpenShifts(user.tenantId, from, to);

  return NextResponse.json({
    ok: true,
    range: { from, to },
    count: shifts.length,
    shifts,
  });
});

/**
 * POST /api/admin/attendance/open-shifts
 *
 * Closes the given shifts. Each write is audited under one shared group, so
 * the whole batch can be undone from the audit page in a single action.
 *
 * The tenant always comes from the session: the body carries employee ids,
 * which are guessable, so the service re-checks ownership row by row.
 */
export const POST = withErrorHandler(async (req: Request) => {
  const user = await requireAdmin();
  const body = await req.json();
  const parsed = closeOpenShiftsSchema.parse(body);

  const result = await closeOpenShifts(
    {
      tenantId: user.tenantId,
      targets: parsed.shifts,
      policy: parsed.policy as ClosePolicy | undefined,
      reason: parsed.reason,
    },
    user
  );

  return NextResponse.json({ ok: true, ...result });
});
