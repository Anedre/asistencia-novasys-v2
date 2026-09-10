import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The aggregation is exercised against a fake Dynamo page and a fake roster:
 * everything interesting here (area rollups, the month matrix, the filters,
 * people with no records) is pure shaping on top of those two inputs.
 */

const send = vi.fn();
const getAllActiveEmployees = vi.fn();

vi.mock("@/lib/db/client", () => ({ docClient: { send: (...a: unknown[]) => send(...a) } }));
vi.mock("@/lib/db/employees", () => ({
  getAllActiveEmployees: (...a: unknown[]) => getAllActiveEmployees(...a),
}));
vi.mock("@aws-sdk/lib-dynamodb", () => ({
  QueryCommand: class {
    constructor(public input: unknown) {}
  },
}));

const { getReportsStats, monthsInRange } = await import("./reports-stats.service");

interface RowSpec {
  emp: string;
  date: string;
  worked?: number;
  planned?: number;
  brk?: number;
  late?: number;
  status?: string;
  source?: string;
  firstIn?: string;
}

function row(spec: RowSpec) {
  return {
    EmployeeID: spec.emp,
    WorkDate: `DATE#${spec.date}`,
    workedMinutes: spec.worked ?? 0,
    plannedMinutes: spec.planned ?? 480,
    breakMinutes: spec.brk ?? 0,
    lateMinutes: spec.late ?? 0,
    status: spec.status ?? "OK",
    source: spec.source ?? "REALTIME",
    ...(spec.firstIn && { firstInLocal: spec.firstIn }),
  };
}

function employee(id: string, name: string, area: string) {
  return {
    EmployeeID: id,
    FullName: name,
    Area: area,
    Position: "Analista",
    DNI: "1234",
    Email: id.replace("EMP#", ""),
  };
}

const ANA = "EMP#ana@x.com";
const BETO = "EMP#beto@x.com";
const CARO = "EMP#caro@x.com";

const ROSTER = [
  employee(ANA, "Ana", "Ventas"),
  // Deliberately spelled without the accent: it must still fold into
  // "Consultoría" everywhere in the report.
  employee(BETO, "Beto", "Consultoria"),
  employee(CARO, "Caro", "Consultoría"),
];

const ROWS = [
  row({ emp: ANA, date: "2026-01-05", worked: 480, brk: 60, firstIn: "2026-01-05T09:00:00" }),
  row({ emp: ANA, date: "2026-01-06", worked: 300, late: 30, status: "SHORT" }),
  row({ emp: ANA, date: "2026-02-02", worked: 480 }),
  row({ emp: ANA, date: "2026-02-03", worked: 0, status: "ABSENCE" }),
  row({ emp: BETO, date: "2026-01-05", worked: 540, status: "REGULARIZED", source: "REGULARIZATION" }),
  row({ emp: BETO, date: "2026-02-10", worked: 0, status: "OPEN" }),
  // Caro has no rows at all — she must still appear, with zeros.
];

beforeEach(() => {
  send.mockReset();
  getAllActiveEmployees.mockReset();
  send.mockResolvedValue({ Items: ROWS, LastEvaluatedKey: undefined });
  getAllActiveEmployees.mockResolvedValue(ROSTER);
});

const RANGE = { from: "2026-01-01", to: "2026-02-28" };

describe("monthsInRange", () => {
  it("walks month by month across a year boundary", () => {
    expect(monthsInRange("2025-11-01", "2026-02-15")).toEqual([
      "2025-11", "2025-12", "2026-01", "2026-02",
    ]);
  });

  it("returns the single month of a within-month range", () => {
    expect(monthsInRange("2026-03-04", "2026-03-05")).toEqual(["2026-03"]);
  });

  it("returns nothing for a reversed range instead of looping forever", () => {
    expect(monthsInRange("2026-05-01", "2026-01-01")).toEqual([]);
  });
});

describe("totals", () => {
  it("converts minutes to hours and counts each kind of day", async () => {
    const stats = await getReportsStats("TENANT#x", RANGE);

    expect(stats.totals.daysRecorded).toBe(6);
    expect(stats.totals.workedHours).toBeCloseTo((480 + 300 + 480 + 540) / 60, 5);
    expect(stats.totals.daysPresent).toBe(4);
    expect(stats.totals.absences).toBe(1);
    expect(stats.totals.regularizations).toBe(1);
    expect(stats.totals.lateDays).toBe(1);
    expect(stats.totals.openDays).toBe(1);
    expect(stats.totals.breakHours).toBe(1);
  });

  it("separates people with records from the roster the report covers", async () => {
    const stats = await getReportsStats("TENANT#x", RANGE);
    expect(stats.totals.employees).toBe(2); // Ana and Beto have rows
    expect(stats.totals.rosterSize).toBe(3); // Caro is covered but empty
  });
});

describe("employee ranking", () => {
  it("keeps someone with no records, as a row of zeros", async () => {
    const stats = await getReportsStats("TENANT#x", RANGE);
    const caro = stats.employeeRanking.find((e) => e.employeeId === CARO);
    // A missing row reads as an oversight; an empty row is information.
    expect(caro).toBeDefined();
    expect(caro?.workedHours).toBe(0);
    expect(caro?.daysRecorded).toBe(0);
  });

  it("is not capped — every employee comes back, sorted by hours", async () => {
    const stats = await getReportsStats("TENANT#x", RANGE);
    expect(stats.employeeRanking.map((e) => e.employeeName)).toEqual(["Ana", "Beto", "Caro"]);
  });

  it("stores the signed delta against planned hours", async () => {
    const stats = await getReportsStats("TENANT#x", RANGE);
    const ana = stats.employeeRanking.find((e) => e.employeeId === ANA)!;
    // 1260 worked vs 1920 planned over four days.
    expect(ana.deltaHours).toBeCloseTo((1260 - 1920) / 60, 5);
  });

  it("carries the identity columns from the employee record", async () => {
    const stats = await getReportsStats("TENANT#x", RANGE);
    const ana = stats.employeeRanking.find((e) => e.employeeId === ANA)!;
    expect(ana.dni).toBe("1234");
    expect(ana.email).toBe("ana@x.com");
    expect(ana.position).toBe("Analista");
  });
});

describe("area breakdown", () => {
  it("folds accent variants into one area with the accented label", async () => {
    const stats = await getReportsStats("TENANT#x", RANGE);
    const labels = stats.areaBreakdown.map((a) => a.area).sort();
    expect(labels).toEqual(["Consultoría", "Ventas"]);

    const consultoria = stats.areaBreakdown.find((a) => a.areaId === "consultoria")!;
    // Beto ("Consultoria") and Caro ("Consultoría") are the same area.
    expect(consultoria.headcount).toBe(2);
    expect(consultoria.withRecords).toBe(1);
  });

  it("sums its people's metrics", async () => {
    const stats = await getReportsStats("TENANT#x", RANGE);
    const ventas = stats.areaBreakdown.find((a) => a.areaId === "ventas")!;
    expect(ventas.workedHours).toBeCloseTo((480 + 300 + 480) / 60, 5);
    expect(ventas.absences).toBe(1);
  });

  it("lists every area of the tenant for the filter chips", async () => {
    const stats = await getReportsStats("TENANT#x", RANGE);
    expect(stats.availableAreas.map((a) => a.label)).toEqual(["Consultoría", "Ventas"]);
    expect(stats.availableAreas.find((a) => a.id === "consultoria")?.headcount).toBe(2);
  });
});

describe("month matrix", () => {
  it("has one column per month of the range", async () => {
    const stats = await getReportsStats("TENANT#x", RANGE);
    expect(stats.months).toEqual(["2026-01", "2026-02"]);
  });

  it("omits months with no records rather than zeroing them", async () => {
    const stats = await getReportsStats("TENANT#x", RANGE);
    const caro = stats.employeeMonthly.find((r) => r.employeeId === CARO)!;
    expect(Object.keys(caro.byMonth)).toEqual([]);

    const ana = stats.employeeMonthly.find((r) => r.employeeId === ANA)!;
    expect(Object.keys(ana.byMonth)).toEqual(["2026-01", "2026-02"]);
    expect(ana.byMonth["2026-01"].workedHours).toBeCloseTo(13, 5);
  });

  it("row totals match the sum of the row's months", async () => {
    const stats = await getReportsStats("TENANT#x", RANGE);
    const ana = stats.employeeMonthly.find((r) => r.employeeId === ANA)!;
    const summed = Object.values(ana.byMonth).reduce((n, c) => n + c.workedHours, 0);
    expect(ana.total.workedHours).toBeCloseTo(summed, 5);
  });
});

describe("yearly rollup", () => {
  it("groups the months into years", async () => {
    const stats = await getReportsStats("TENANT#x", RANGE);
    expect(stats.yearlyTrend).toHaveLength(1);
    expect(stats.yearlyTrend[0].year).toBe("2026");
    expect(stats.yearlyTrend[0].monthsWithData).toBe(2);
    expect(stats.yearlyTrend[0].employees).toBe(2);
  });
});

describe("filters", () => {
  it("narrows to an area, accent-insensitively", async () => {
    const stats = await getReportsStats("TENANT#x", { ...RANGE, areas: ["consultoria"] });
    expect(stats.employeeRanking.map((e) => e.employeeName).sort()).toEqual(["Beto", "Caro"]);
    expect(stats.totals.daysRecorded).toBe(2);
  });

  it("narrows to hand-picked employees", async () => {
    const stats = await getReportsStats("TENANT#x", { ...RANGE, employeeIds: [ANA] });
    expect(stats.employeeRanking).toHaveLength(1);
    expect(stats.totals.daysRecorded).toBe(4);
  });

  it("intersects an area and an employee filter", async () => {
    const stats = await getReportsStats("TENANT#x", {
      ...RANGE,
      areas: ["Ventas"],
      employeeIds: [BETO],
    });
    // Beto is in Consultoría, so the intersection is empty.
    expect(stats.employeeRanking).toHaveLength(0);
    expect(stats.totals.rosterSize).toBe(0);
  });

  it("drops rows outside an explicit month set even though they are in range", async () => {
    const stats = await getReportsStats("TENANT#x", { ...RANGE, months: ["2026-02"] });
    expect(stats.months).toEqual(["2026-02"]);
    expect(stats.totals.daysRecorded).toBe(3);
    const ana = stats.employeeRanking.find((e) => e.employeeId === ANA)!;
    expect(ana.workedHours).toBe(8);
  });

  it("echoes the filters back for headers and filenames", async () => {
    const stats = await getReportsStats("TENANT#x", {
      ...RANGE,
      areas: ["Ventas"],
      months: ["2026-01"],
    });
    expect(stats.filters).toEqual({
      areas: ["Ventas"],
      employeeIds: [],
      months: ["2026-01"],
    });
  });
});

describe("dynamo access", () => {
  it("drains every page of results", async () => {
    send
      .mockResolvedValueOnce({ Items: [ROWS[0]], LastEvaluatedKey: { k: 1 } })
      .mockResolvedValueOnce({ Items: [ROWS[1]], LastEvaluatedKey: undefined });

    const stats = await getReportsStats("TENANT#x", RANGE);
    expect(send).toHaveBeenCalledTimes(2);
    expect(stats.totals.daysRecorded).toBe(2);
  });

  it("scopes the query to the tenant and the outer date bounds", async () => {
    await getReportsStats("TENANT#x", RANGE);
    const input = (send.mock.calls[0][0] as { input: Record<string, unknown> }).input;
    expect(input.ExpressionAttributeValues).toMatchObject({
      ":tid": "TENANT#x",
      ":from": "DATE#2026-01-01",
      ":to": "DATE#2026-02-28",
    });
  });
});

describe("entry heatmap", () => {
  it("buckets a check-in by weekday and hour, Monday first", async () => {
    const stats = await getReportsStats("TENANT#x", RANGE);
    // 2026-01-05 is a Monday, clocked in at 09:00.
    expect(stats.entryHeatmap[0][9]).toBe(1);
    expect(stats.entryHeatmap[1][9]).toBe(0);
  });
});
