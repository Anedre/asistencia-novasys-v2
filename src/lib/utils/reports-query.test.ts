import { describe, expect, it } from "vitest";
import { endOfMonth, parseReportsQuery } from "./reports-query";

const parse = (qs: string) => parseReportsQuery(new URL(`https://x.test/api?${qs}`));

describe("endOfMonth", () => {
  it("knows month lengths, leap years included", () => {
    expect(endOfMonth("2026-01")).toBe("2026-01-31");
    expect(endOfMonth("2026-04")).toBe("2026-04-30");
    expect(endOfMonth("2026-02")).toBe("2026-02-28");
    expect(endOfMonth("2024-02")).toBe("2024-02-29");
  });
});

describe("period precedence", () => {
  it("derives the range from an explicit month set", () => {
    const { query } = parse("months=2026-01,2026-02,2026-05");
    expect(query.months).toEqual(["2026-01", "2026-02", "2026-05"]);
    expect(query.from).toBe("2026-01-01");
    expect(query.to).toBe("2026-05-31");
  });

  it("keeps the month list so the gap months stay out of the report", () => {
    // The range spans March and April, but they are not in `months`, so the
    // stats service drops their rows.
    const { query } = parse("months=2026-05,2026-01");
    expect(query.months).toEqual(["2026-01", "2026-05"]);
  });

  it("expands years into their twelve months", () => {
    const { query } = parse("years=2025");
    expect(query.months).toHaveLength(12);
    expect(query.months?.[0]).toBe("2025-01");
    expect(query.months?.[11]).toBe("2025-12");
    expect(query.from).toBe("2025-01-01");
    expect(query.to).toBe("2025-12-31");
  });

  it("merges years and loose months into one de-duplicated set", () => {
    const { query } = parse("years=2025&months=2026-03,2025-01");
    expect(query.months).toHaveLength(13);
    expect(query.months?.at(-1)).toBe("2026-03");
    expect(query.to).toBe("2026-03-31");
  });

  it("falls back to a plain from/to range", () => {
    const { query } = parse("from=2026-03-01&to=2026-03-15");
    expect(query.from).toBe("2026-03-01");
    expect(query.to).toBe("2026-03-15");
    expect(query.months).toBeUndefined();
  });

  it("lets a month set override from/to rather than mixing them", () => {
    const { query } = parse("months=2026-07&from=2020-01-01&to=2020-01-02");
    expect(query.from).toBe("2026-07-01");
    expect(query.to).toBe("2026-07-31");
  });
});

describe("rejected input", () => {
  it("rejects a malformed month", () => {
    expect(() => parse("months=2026-13")).toThrow(/Mes inválido/);
    expect(() => parse("months=26-01")).toThrow(/Mes inválido/);
  });

  it("rejects a malformed year", () => {
    expect(() => parse("years=25")).toThrow(/Año inválido/);
  });

  it("rejects a missing or malformed range", () => {
    expect(() => parse("from=2026-03-01")).toThrow(/'to' inválido/);
    expect(() => parse("")).toThrow(/'from' inválido/);
    expect(() => parse("from=03-01-2026&to=2026-03-02")).toThrow(/'from' inválido/);
  });

  it("rejects a reversed range", () => {
    expect(() => parse("from=2026-05-01&to=2026-01-01")).toThrow(/no puede ser posterior/);
  });

  it("caps the period so one request cannot page through a decade", () => {
    expect(() => parse("from=2000-01-01&to=2026-01-01")).toThrow(/60 meses/);
  });
});

describe("filters", () => {
  it("restores the EMP# prefix the URL leaves out", () => {
    const { query } = parse("months=2026-01&employees=a@x.com,b@x.com");
    expect(query.employeeIds).toEqual(["EMP#a@x.com", "EMP#b@x.com"]);
  });

  it("accepts ids that already carry the prefix", () => {
    const { query } = parse("months=2026-01&employees=EMP%23a@x.com");
    expect(query.employeeIds).toEqual(["EMP#a@x.com"]);
  });

  it("de-duplicates and drops blanks", () => {
    const { query } = parse("months=2026-01&areas=Ventas,,Ventas,Consultoría");
    expect(query.areas).toEqual(["Ventas", "Consultoría"]);
  });

  it("omits empty filters entirely so the service sees 'everyone'", () => {
    const { query } = parse("months=2026-01");
    expect(query.areas).toBeUndefined();
    expect(query.employeeIds).toBeUndefined();
  });

  it("refuses an employee list past the cap", () => {
    const many = Array.from({ length: 501 }, (_, i) => `u${i}@x.com`).join(",");
    expect(() => parse(`months=2026-01&employees=${many}`)).toThrow(/Demasiados empleados/);
  });
});

describe("columns and grouping", () => {
  it("keeps the picked columns in catalogue order", () => {
    const { fields } = parse("months=2026-01&cols=workedHours,area");
    expect(fields).toEqual(["area", "workedHours"]);
  });

  it("falls back to the view defaults when no column survives", () => {
    const q = new URL("https://x.test/api?months=2026-01&cols=bogus");
    expect(parseReportsQuery(q, "absences").fields).toEqual([
      "area",
      "absences",
      "regularizations",
      "missingHours",
    ]);
  });

  it("reads the area grouping flag", () => {
    expect(parse("months=2026-01&group=area").groupByArea).toBe(true);
    expect(parse("months=2026-01").groupByArea).toBe(false);
    expect(parse("months=2026-01&group=nope").groupByArea).toBe(false);
  });
});
