import { describe, expect, it } from "vitest";
import {
  ALL_FIELD_KEYS,
  DEFAULT_FIELDS,
  addMetrics,
  attendancePct,
  avgHoursPerDay,
  deltaHours,
  emptyMetrics,
  fieldDisplay,
  fieldValue,
  missingHours,
  overtimeHours,
  punctualityPct,
  sanitizeFields,
  type ReportMetrics,
} from "./report-fields";

function metrics(over: Partial<ReportMetrics> = {}): ReportMetrics {
  return { ...emptyMetrics(), ...over };
}

describe("derived metrics", () => {
  it("caps attendance at 100% — overtime does not make someone more than present", () => {
    const m = metrics({ workedHours: 200, plannedHours: 160 });
    expect(attendancePct(m)).toBe(100);
    // The extra hours surface as overtime instead of inflating attendance.
    expect(overtimeHours(m)).toBe(40);
    expect(missingHours(m)).toBe(0);
  });

  it("reports a shortfall as missing hours and a negative delta", () => {
    const m = metrics({ workedHours: 120, plannedHours: 160 });
    expect(attendancePct(m)).toBe(75);
    expect(missingHours(m)).toBe(40);
    expect(overtimeHours(m)).toBe(0);
    expect(deltaHours(m)).toBe(-40);
  });

  it("returns 0 rather than dividing by zero when nothing was planned", () => {
    expect(attendancePct(metrics({ workedHours: 10 }))).toBe(0);
    expect(avgHoursPerDay(metrics({ workedHours: 10 }))).toBe(0);
    expect(punctualityPct(metrics({ lateDays: 3 }))).toBe(0);
  });

  it("counts punctuality against days present, not days recorded", () => {
    const m = metrics({ daysRecorded: 20, daysPresent: 10, lateDays: 2 });
    expect(punctualityPct(m)).toBe(80);
  });

  it("never reports negative punctuality when late days exceed days present", () => {
    // Defensive: a regularization can mark a day late without worked time.
    const m = metrics({ daysPresent: 2, lateDays: 5 });
    expect(punctualityPct(m)).toBe(0);
  });
});

describe("addMetrics", () => {
  it("sums every field so an area rollup equals the sum of its people", () => {
    const a = metrics({
      daysRecorded: 20, daysPresent: 18, absences: 2, regularizations: 1,
      lateDays: 3, openDays: 1, workedHours: 140, plannedHours: 160,
      breakHours: 15, lateHours: 1.5,
    });
    const b = metrics({
      daysRecorded: 10, daysPresent: 10, absences: 0, regularizations: 2,
      lateDays: 1, openDays: 0, workedHours: 80, plannedHours: 80,
      breakHours: 8, lateHours: 0.5,
    });

    const total = addMetrics(metrics(), a);
    addMetrics(total, b);

    expect(total.daysRecorded).toBe(30);
    expect(total.daysPresent).toBe(28);
    expect(total.absences).toBe(2);
    expect(total.regularizations).toBe(3);
    expect(total.lateDays).toBe(4);
    expect(total.openDays).toBe(1);
    expect(total.workedHours).toBe(220);
    expect(total.plannedHours).toBe(240);
    expect(total.breakHours).toBe(23);
    expect(total.lateHours).toBe(2);
  });

  it("mutates the accumulator rather than the source", () => {
    const acc = metrics();
    const src = metrics({ workedHours: 5 });
    addMetrics(acc, src);
    expect(acc.workedHours).toBe(5);
    expect(src.workedHours).toBe(5);
  });
});

describe("sanitizeFields", () => {
  it("keeps the catalogue order regardless of click order", () => {
    expect(sanitizeFields(["workedHours", "area"], DEFAULT_FIELDS.hours)).toEqual([
      "area",
      "workedHours",
    ]);
  });

  it("drops keys this build does not know", () => {
    expect(sanitizeFields(["workedHours", "bogus"], DEFAULT_FIELDS.hours)).toEqual([
      "workedHours",
    ]);
  });

  it("falls back to the view defaults when nothing valid survives", () => {
    expect(sanitizeFields(["nope"], DEFAULT_FIELDS.absences)).toEqual(DEFAULT_FIELDS.absences);
    expect(sanitizeFields([], DEFAULT_FIELDS.payroll)).toEqual(DEFAULT_FIELDS.payroll);
    expect(sanitizeFields(undefined, DEFAULT_FIELDS.areas)).toEqual(DEFAULT_FIELDS.areas);
  });
});

describe("fieldValue / fieldDisplay", () => {
  const row = {
    ...metrics({
      daysRecorded: 22, daysPresent: 20, absences: 2, regularizations: 1,
      lateDays: 4, openDays: 0, workedHours: 171.44, plannedHours: 160,
      breakHours: 20, lateHours: 2.25,
    }),
    area: "Ventas",
    position: "",
  };

  it("rounds hours to one decimal for the spreadsheet cell", () => {
    expect(fieldValue("workedHours", row)).toBe(171.4);
    expect(fieldValue("lateHours", row)).toBe(2.3);
  });

  it("rounds percentages to whole numbers", () => {
    expect(fieldValue("attendancePct", row)).toBe(100);
    expect(fieldValue("punctualityPct", row)).toBe(80);
  });

  it("shows an em dash for missing identity values", () => {
    expect(fieldValue("position", row)).toBe("—");
    expect(fieldValue("area", row)).toBe("Ventas");
  });

  it("signs the delta so a surplus reads as +", () => {
    expect(fieldDisplay("deltaHours", row)).toBe("+11.4h");
    expect(fieldDisplay("deltaHours", { ...row, workedHours: 100 })).toBe("-60.0h");
  });

  it("suffixes hours and percentages", () => {
    expect(fieldDisplay("workedHours", row)).toBe("171.4h");
    expect(fieldDisplay("attendancePct", row)).toBe("100%");
    expect(fieldDisplay("absences", row)).toBe("2");
  });

  it("has a value for every key in the catalogue", () => {
    for (const key of ALL_FIELD_KEYS) {
      expect(fieldValue(key, row), key).toBeDefined();
      expect(typeof fieldDisplay(key, row), key).toBe("string");
    }
  });
});
