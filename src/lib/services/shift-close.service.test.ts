import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The close logic is exercised against fake Dynamo reads: what matters here is
 * which clock-out gets chosen, what the stored row ends up looking like, and
 * which rows are refused — none of which needs a real table.
 */

const send = vi.fn();
const upsertDailySummary = vi.fn();
const getEventsByEmployeeAndDate = vi.fn();
const getAllActiveEmployees = vi.fn();
const withAudit = vi.fn();

vi.mock("@/lib/db/client", () => ({ docClient: { send: (...a: unknown[]) => send(...a) } }));
vi.mock("@/lib/db/daily-summary", () => ({
  upsertDailySummary: (...a: unknown[]) => upsertDailySummary(...a),
}));
vi.mock("@/lib/db/attendance", () => ({
  getEventsByEmployeeAndDate: (...a: unknown[]) => getEventsByEmployeeAndDate(...a),
}));
vi.mock("@/lib/db/employees", () => ({
  getAllActiveEmployees: (...a: unknown[]) => getAllActiveEmployees(...a),
}));
vi.mock("@/lib/utils/holidays", () => ({
  getTenantDefaultSchedule: async () => ({ startTime: "09:00", endTime: "18:00" }),
  getTenantPlannedMinutes: async () => 480,
}));
vi.mock("@/lib/services/audit.service", () => ({
  buildGroupId: () => "GRP#test",
  withAudit: (...a: unknown[]) => withAudit(...a),
}));
vi.mock("@aws-sdk/lib-dynamodb", () => ({
  QueryCommand: class {
    constructor(public input: unknown) {}
  },
  GetCommand: class {
    constructor(public input: unknown) {}
  },
}));
// "Today" is pinned so the cap-at-now branch is testable.
vi.mock("@/lib/utils/time", async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return { ...actual, workDateLima: () => "2026-09-10", clockLima: () => "14:30:00" };
});

const { closeOpenShifts, findOpenShifts } = await import("./shift-close.service");
type SessionUser = import("@/lib/auth-helpers").SessionUser;

const TENANT = "TENANT#novasys";
const ANA = "EMP#ana@x.com";
const BETO = "EMP#beto@x.com";

interface RowOpts {
  emp?: string;
  date?: string;
  firstIn?: string;
  brk?: number;
  status?: string;
  tenant?: string;
}

function openRow(o: RowOpts = {}) {
  const date = o.date ?? "2026-09-04";
  return {
    EmployeeID: o.emp ?? ANA,
    WorkDate: `DATE#${date}`,
    TenantID: o.tenant ?? TENANT,
    status: o.status ?? "OPEN",
    firstInLocal: `${date}T${o.firstIn ?? "09:00"}:00-05:00`,
    breakMinutes: o.brk ?? 60,
    plannedMinutes: 480,
    // A field nothing in the close path touches — it must survive.
    photoUrl: "https://example/foto.jpg",
    anomalies: [],
  };
}

const EMPLOYEES = [
  { EmployeeID: ANA, FullName: "Ana", Area: "Ventas", Schedule: { endTime: "18:00" } },
  { EmployeeID: BETO, FullName: "Beto", Area: "Consultoría", Schedule: { endTime: "17:00" } },
];

/** Make the Dynamo mock answer the GSI query and the per-row GetItem. */
function mockReads(rows: ReturnType<typeof openRow>[]) {
  send.mockImplementation((cmd: { input: Record<string, unknown> }) => {
    if (cmd.input.IndexName) {
      return Promise.resolve({ Items: rows, LastEvaluatedKey: undefined });
    }
    const wanted = cmd.input.Key as { EmployeeID: string; WorkDate: string };
    const hit = rows.find(
      (r) => r.EmployeeID === wanted.EmployeeID && r.WorkDate === wanted.WorkDate
    );
    return Promise.resolve({ Item: hit });
  });
}

beforeEach(() => {
  send.mockReset();
  upsertDailySummary.mockReset().mockResolvedValue("OVERWRITTEN");
  getEventsByEmployeeAndDate.mockReset().mockResolvedValue([]);
  getAllActiveEmployees.mockReset().mockResolvedValue(EMPLOYEES);
  withAudit.mockReset().mockImplementation(async (_ctx: unknown, fn: () => Promise<unknown>) => ({
    result: await fn(),
    auditId: "AUD#1",
  }));
});

const ACTOR = {
  id: "admin-1",
  email: "admin@x.com",
  name: "Admin",
  role: "ADMIN",
  employeeId: "EMP#admin@x.com",
  area: "Sistemas",
  tenantId: TENANT,
  tenantSlug: "novasys",
} as const satisfies SessionUser;

describe("findOpenShifts — choosing the clock-out", () => {
  it("falls back to the scheduled end when there is no later event", async () => {
    mockReads([openRow()]);
    const [shift] = await findOpenShifts(TENANT, "2026-01-01", "2026-09-10");

    expect(shift.closeAt).toBe("18:00");
    expect(shift.closeSource).toBe("SCHEDULE_END");
    // 09:00 → 18:00 is 9h, minus a 60-minute break.
    expect(shift.workedMinutes).toBe(480);
  });

  it("keeps overtime when the last event is later than the schedule", async () => {
    getEventsByEmployeeAndDate.mockResolvedValue([
      { EventTS: "TS#2026-09-04T14:00:00+00:00", tsLocal: "2026-09-04T14:00:00-05:00" },
      { EventTS: "TS#2026-09-04T19:30:00+00:00", tsLocal: "2026-09-04T19:30:00-05:00" },
    ]);
    mockReads([openRow()]);
    const [shift] = await findOpenShifts(TENANT, "2026-01-01", "2026-09-10");

    // Throwing this away would silently erase an hour and a half of work.
    expect(shift.closeAt).toBe("19:30");
    expect(shift.closeSource).toBe("LAST_EVENT");
    expect(shift.workedMinutes).toBe(570);
  });

  it("ignores an event that lands before the scheduled end", async () => {
    getEventsByEmployeeAndDate.mockResolvedValue([
      { tsLocal: "2026-09-04T13:00:00-05:00" },
    ]);
    mockReads([openRow()]);
    const [shift] = await findOpenShifts(TENANT, "2026-01-01", "2026-09-10");
    expect(shift.closeAt).toBe("18:00");
    expect(shift.closeSource).toBe("SCHEDULE_END");
  });

  it("never invents hours: today is capped at the current time", async () => {
    mockReads([openRow({ date: "2026-09-10" })]);
    const [shift] = await findOpenShifts(TENANT, "2026-01-01", "2026-09-10");

    // Schedule says 18:00 but it is only 14:30.
    expect(shift.closeAt).toBe("14:30");
    expect(shift.closeSource).toBe("NOW");
    expect(shift.workedMinutes).toBe(270);
  });

  it("uses the employee's own schedule over the tenant default", async () => {
    mockReads([openRow({ emp: BETO })]);
    const [shift] = await findOpenShifts(TENANT, "2026-01-01", "2026-09-10");
    expect(shift.closeAt).toBe("17:00");
    expect(shift.employeeName).toBe("Beto");
  });

  it("survives the events table being unavailable", async () => {
    getEventsByEmployeeAndDate.mockRejectedValue(new Error("throttled"));
    mockReads([openRow()]);
    const [shift] = await findOpenShifts(TENANT, "2026-01-01", "2026-09-10");
    // Losing the nicety must not block the close.
    expect(shift.closeSource).toBe("SCHEDULE_END");
  });

  it("reports how long each shift has been open, oldest first", async () => {
    mockReads([
      openRow({ date: "2026-09-04" }),
      openRow({ date: "2026-03-02", emp: BETO }),
    ]);
    const shifts = await findOpenShifts(TENANT, "2026-01-01", "2026-09-10");

    expect(shifts.map((s) => s.workDate)).toEqual(["2026-03-02", "2026-09-04"]);
    expect(shifts[0].daysOpen).toBe(192);
    expect(shifts[1].daysOpen).toBe(6);
  });

  it("does not write anything while listing", async () => {
    mockReads([openRow()]);
    await findOpenShifts(TENANT, "2026-01-01", "2026-09-10");
    expect(upsertDailySummary).not.toHaveBeenCalled();
  });
});

describe("closeOpenShifts — what gets stored", () => {
  it("fills the missing clock-out and keeps every untouched field", async () => {
    mockReads([openRow()]);
    await closeOpenShifts({ tenantId: TENANT, targets: [{ employeeId: ANA, workDate: "2026-09-04" }] }, ACTOR);

    const [item, overwrite] = upsertDailySummary.mock.calls[0];
    expect(overwrite).toBe(true);
    expect(item.lastOut).toBe("18:00");
    expect(item.lastOutLocal).toBe("2026-09-04T18:00:00-05:00");
    expect(item.workedMinutes).toBe(480);
    expect(item.deltaMinutes).toBe(0);
    expect(item.source).toBe("AUTO_CLOSE");
    expect(item.autoCloseSource).toBe("SCHEDULE_END");
    expect(item.autoClosedAt).toBeTruthy();
    // The row is replaced wholesale, so anything we do not carry over is lost.
    expect(item.photoUrl).toBe("https://example/foto.jpg");
    expect(item.TenantID).toBe(TENANT);
  });

  it("marks a short day SHORT rather than pretending it was complete", async () => {
    mockReads([openRow({ firstIn: "13:00" })]);
    await closeOpenShifts({ tenantId: TENANT, targets: [{ employeeId: ANA, workDate: "2026-09-04" }] }, ACTOR);

    const [item] = upsertDailySummary.mock.calls[0];
    expect(item.workedMinutes).toBe(240);
    expect(item.status).toBe("SHORT");
    expect(item.deltaMinutes).toBe(-240);
  });

  it("marks a full day OK", async () => {
    mockReads([openRow()]);
    await closeOpenShifts({ tenantId: TENANT, targets: [{ employeeId: ANA, workDate: "2026-09-04" }] }, ACTOR);
    expect(upsertDailySummary.mock.calls[0][0].status).toBe("OK");
  });

  it("leaves an anomaly saying the day was auto-closed and how", async () => {
    mockReads([openRow()]);
    await closeOpenShifts({ tenantId: TENANT, targets: [{ employeeId: ANA, workDate: "2026-09-04" }] }, ACTOR);
    expect(upsertDailySummary.mock.calls[0][0].anomalies).toEqual([
      "Auto-cerrado a la hora planificada — revisar",
    ]);
  });

  it("STRICT refuses to guess: no hours, day demoted", async () => {
    mockReads([openRow()]);
    const res = await closeOpenShifts(
      { tenantId: TENANT, targets: [{ employeeId: ANA, workDate: "2026-09-04" }], policy: "STRICT" },
      ACTOR
    );

    const [item] = upsertDailySummary.mock.calls[0];
    expect(item.status).toBe("MISSING");
    expect(item.workedMinutes).toBe(0);
    expect(item.lastOut).toBeUndefined();
    expect(item.anomalies).toEqual(["Auto-cerrado: jornada no finalizada"]);
    expect(res.outcomes[0].workedMinutes).toBe(0);
  });
});

describe("closeOpenShifts — refusals", () => {
  it("skips a shift the employee closed in the meantime", async () => {
    // Listed as OPEN, but by the time the admin clicks it is CLOSED.
    mockReads([openRow({ status: "OK" })]);
    const res = await closeOpenShifts({ tenantId: TENANT, targets: [{ employeeId: ANA, workDate: "2026-09-04" }] }, ACTOR);

    expect(res.closed).toBe(0);
    expect(res.skipped).toBe(1);
    expect(res.outcomes[0].message).toMatch(/Ya no está abierta/);
    // Overwriting a real clock-out with a guess would destroy the record.
    expect(upsertDailySummary).not.toHaveBeenCalled();
  });

  it("skips a row belonging to another tenant", async () => {
    mockReads([openRow({ tenant: "TENANT#otra" })]);
    const res = await closeOpenShifts({ tenantId: TENANT, targets: [{ employeeId: ANA, workDate: "2026-09-04" }] }, ACTOR);

    expect(res.skipped).toBe(1);
    expect(res.outcomes[0].message).toMatch(/otra empresa/);
    expect(upsertDailySummary).not.toHaveBeenCalled();
  });

  it("skips a row that no longer exists", async () => {
    mockReads([]);
    const res = await closeOpenShifts({ tenantId: TENANT, targets: [{ employeeId: ANA, workDate: "2026-09-04" }] }, ACTOR);
    expect(res.skipped).toBe(1);
    expect(res.outcomes[0].message).toMatch(/ya no existe/);
  });

  it("records a failure without aborting the rest of the batch", async () => {
    mockReads([openRow(), openRow({ emp: BETO })]);
    upsertDailySummary.mockRejectedValueOnce(new Error("throughput exceeded"));

    const res = await closeOpenShifts(
      {
        tenantId: TENANT,
        targets: [
          { employeeId: ANA, workDate: "2026-09-04" },
          { employeeId: BETO, workDate: "2026-09-04" },
        ],
      },
      ACTOR
    );

    expect(res.failed).toBe(1);
    expect(res.closed).toBe(1);
  });

  it("rejects an empty or oversized selection", async () => {
    await expect(closeOpenShifts({ tenantId: TENANT, targets: [] }, ACTOR)).rejects.toThrow(
      /ninguna jornada/
    );

    const many = Array.from({ length: 501 }, (_, i) => ({
      employeeId: ANA,
      workDate: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
    }));
    await expect(closeOpenShifts({ tenantId: TENANT, targets: many }, ACTOR)).rejects.toThrow(
      /Demasiadas jornadas/
    );
  });
});

describe("closeOpenShifts — audit", () => {
  it("files every write under one group so the batch can be undone at once", async () => {
    mockReads([openRow(), openRow({ emp: BETO })]);
    const res = await closeOpenShifts(
      {
        tenantId: TENANT,
        targets: [
          { employeeId: ANA, workDate: "2026-09-04" },
          { employeeId: BETO, workDate: "2026-09-04" },
        ],
      },
      ACTOR
    );

    expect(withAudit).toHaveBeenCalledTimes(2);
    const contexts = withAudit.mock.calls.map((c) => c[0]);
    expect(new Set(contexts.map((c) => c.groupId)).size).toBe(1);
    expect(contexts[0].groupSize).toBe(2);
    expect(contexts[0].entityType).toBe("DAILY_SUMMARY");
    expect(contexts[0].action).toBe("UPDATE");
    expect(res.groupId).toBe(contexts[0].groupId);
  });

  it("carries the admin's reason, with a default that says what happened", async () => {
    mockReads([openRow()]);
    await closeOpenShifts({ tenantId: TENANT, targets: [{ employeeId: ANA, workDate: "2026-09-04" }] }, ACTOR);
    expect(withAudit.mock.calls[0][0].reason).toBe("Cierre de jornadas abiertas");

    withAudit.mockClear();
    mockReads([openRow()]);
    await closeOpenShifts(
      { tenantId: TENANT, targets: [{ employeeId: ANA, workDate: "2026-09-04" }], reason: "Cierre de mes" },
      ACTOR
    );
    expect(withAudit.mock.calls[0][0].reason).toBe("Cierre de mes");
  });
});
