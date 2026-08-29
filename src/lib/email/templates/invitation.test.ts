import { describe, it, expect } from "vitest";
import { buildInvitationEmail } from "./invitation";

const base = {
  tenantName: "Novasys Peru",
  inviterName: "Andre Alata",
  role: "EMPLOYEE",
  inviteLink: "https://app.example.com/register?invite=tok123",
  expiresAt: "2026-09-05T00:00:00.000Z",
};

describe("buildInvitationEmail", () => {
  it("names the tenant in the subject", () => {
    expect(buildInvitationEmail(base).subject).toBe(
      "Te invitaron a Novasys Peru en Novasys Asistencia"
    );
  });

  it("puts the invite link in both the HTML and the plain-text part", () => {
    const { html, text } = buildInvitationEmail(base);
    expect(html).toContain(base.inviteLink);
    expect(text).toContain(base.inviteLink);
  });

  it("always produces a plain-text alternative", () => {
    // A missing text/plain part is a well-known spam signal for HTML mail.
    const { text } = buildInvitationEmail(base);
    expect(text.trim().length).toBeGreaterThan(0);
  });

  it("escapes HTML in caller-supplied values", () => {
    const { html } = buildInvitationEmail({
      ...base,
      inviterName: '<script>alert("x")</script>',
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("includes area and position only when given", () => {
    const withDetails = buildInvitationEmail({ ...base, area: "Consultoría", position: "Analista" });
    expect(withDetails.text).toContain("Consultoría");
    expect(withDetails.text).toContain("Analista");

    const without = buildInvitationEmail(base);
    expect(without.text).not.toContain("Área:");
    expect(without.text).not.toContain("Cargo:");
  });

  it("does not leave unresolved template placeholders", () => {
    const { html, text, subject } = buildInvitationEmail(base);
    for (const part of [html, text, subject]) {
      expect(part).not.toContain("undefined");
      expect(part).not.toContain("[object Object]");
    }
  });
});
