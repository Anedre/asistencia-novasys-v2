import { describe, it, expect } from "vitest";
import { resolveTestRecipient, normalizeEmail } from "./allowed-recipients";

const fallback = "admin@empresa.com";
const allowed = ["patricia.fernandez@empresa.com", "Carlos.Chang@Empresa.com"];

describe("resolveTestRecipient", () => {
  it("falls back to the caller when nothing is requested", () => {
    expect(resolveTestRecipient({ fallback, allowed })).toEqual({ ok: true, to: fallback });
    expect(resolveTestRecipient({ requested: "", fallback, allowed })).toEqual({
      ok: true,
      to: fallback,
    });
    expect(resolveTestRecipient({ requested: "   ", fallback, allowed })).toEqual({
      ok: true,
      to: fallback,
    });
  });

  it("allows an address belonging to the tenant", () => {
    expect(
      resolveTestRecipient({ requested: "patricia.fernandez@empresa.com", fallback, allowed })
    ).toEqual({ ok: true, to: "patricia.fernandez@empresa.com" });
  });

  it("matches regardless of case or surrounding spaces", () => {
    expect(
      resolveTestRecipient({ requested: "  CARLOS.CHANG@empresa.COM ", fallback, allowed })
    ).toEqual({ ok: true, to: "carlos.chang@empresa.com" });
  });

  it("always allows the caller's own address", () => {
    expect(resolveTestRecipient({ requested: fallback, fallback, allowed: [] })).toEqual({
      ok: true,
      to: fallback,
    });
  });

  it("refuses an address outside the tenant", () => {
    // The whole point of the guard: no mailing arbitrary strangers.
    const result = resolveTestRecipient({
      requested: "alguien@dominio-ajeno.com",
      fallback,
      allowed,
    });
    expect(result.ok).toBe(false);
    expect(result).toHaveProperty("error");
  });

  it("refuses a near-miss instead of guessing", () => {
    const result = resolveTestRecipient({
      requested: "patricia.fernandez@empresa.com.attacker.net",
      fallback,
      allowed,
    });
    expect(result.ok).toBe(false);
  });

  it("reports an error when there is no address at all", () => {
    expect(resolveTestRecipient({ fallback: "", allowed: [] }).ok).toBe(false);
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Persona@Empresa.COM  ")).toBe("persona@empresa.com");
  });
});
