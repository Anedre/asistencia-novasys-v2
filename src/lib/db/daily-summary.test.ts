import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Covers the START write, which now also carries the employee's auto-close
 * opt-in. The flag is what the closer job keys off, so writing it (or not
 * writing it) is the whole contract.
 */

const send = vi.fn();

vi.mock("./client", () => ({ docClient: { send: (...a: unknown[]) => send(...a) } }));
vi.mock("@aws-sdk/lib-dynamodb", () => ({
  UpdateCommand: class {
    constructor(public input: Record<string, unknown>) {}
  },
  GetCommand: class {
    constructor(public input: Record<string, unknown>) {}
  },
  PutCommand: class {
    constructor(public input: Record<string, unknown>) {}
  },
  QueryCommand: class {
    constructor(public input: Record<string, unknown>) {}
  },
  DeleteCommand: class {
    constructor(public input: Record<string, unknown>) {}
  },
}));

const { applyStart } = await import("./daily-summary");

/** The UpdateCommand input of the last send() call. */
function lastInput(): Record<string, unknown> {
  return (send.mock.calls.at(-1)![0] as { input: Record<string, unknown> }).input;
}

beforeEach(() => {
  send.mockReset().mockResolvedValue({});
});

describe("applyStart", () => {
  it("does not write the opt-in when it was not asked for", async () => {
    await applyStart("EMP#ana@x.com", "2026-09-10", "2026-09-10T14:00:00Z", "2026-09-10T09:00:00-05:00", "TENANT#novasys");

    const input = lastInput();
    expect(input.UpdateExpression).not.toContain("autoCloseRequested");
    expect(input.ExpressionAttributeValues).not.toHaveProperty(":acr");
  });

  it("writes the opt-in when the employee asked for it at check-in", async () => {
    await applyStart(
      "EMP#ana@x.com",
      "2026-09-10",
      "2026-09-10T14:00:00Z",
      "2026-09-10T09:00:00-05:00",
      "TENANT#novasys",
      true
    );

    const input = lastInput();
    expect(input.UpdateExpression).toContain("autoCloseRequested = :acr");
    expect(input.ExpressionAttributeValues).toMatchObject({ ":acr": true });
  });

  it("treats an explicit false as no opt-in rather than storing it", async () => {
    await applyStart("EMP#ana@x.com", "2026-09-10", "u", "l", "TENANT#novasys", false);
    // The closer job filters on `autoCloseRequested = true`; storing false
    // would only add a field nothing reads.
    expect(lastInput().UpdateExpression).not.toContain("autoCloseRequested");
  });

  it("keeps guarding against a double check-in", async () => {
    await applyStart("EMP#ana@x.com", "2026-09-10", "u", "l", "TENANT#novasys", true);
    expect(lastInput().ConditionExpression).toBe("attribute_not_exists(firstInUtc)");
  });

  it("still stamps the tenant, the status and the event counter", async () => {
    await applyStart("EMP#ana@x.com", "2026-09-10", "u", "l", "TENANT#novasys", true);

    const input = lastInput();
    expect(input.UpdateExpression).toContain("TenantID = :tid");
    expect(input.UpdateExpression).toContain("eventsCount = if_not_exists(eventsCount, :zero) + :one");
    expect(input.ExpressionAttributeValues).toMatchObject({
      ":tid": "TENANT#novasys",
      ":open": "OPEN",
      ":src": "REALTIME",
    });
  });

  it("works without a tenant id (legacy rows) and still records the opt-in", async () => {
    await applyStart("EMP#ana@x.com", "2026-09-10", "u", "l", undefined, true);

    const input = lastInput();
    expect(input.UpdateExpression).not.toContain("TenantID");
    expect(input.UpdateExpression).toContain("autoCloseRequested = :acr");
  });
});
