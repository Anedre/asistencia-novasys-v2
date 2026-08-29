import { describe, it, expect, vi, beforeEach } from "vitest";

// Capture what the SES client is actually asked to send. The real bug hunt
// here was "the app reports success but nothing arrives", so these assert the
// exact shape of the request and that failures are never swallowed as success.
const send = vi.fn();

vi.mock("@aws-sdk/client-sesv2", () => ({
  SESv2Client: class {
    send = send;
  },
  SendEmailCommand: class {
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  },
}));

const params = {
  to: "persona@empresa.com",
  subject: "Asunto",
  html: "<p>hola</p>",
  text: "hola",
};

beforeEach(() => {
  send.mockReset();
  vi.resetModules();
});

describe("sendEmail", () => {
  it("returns ok with the SES message id", async () => {
    send.mockResolvedValue({ MessageId: "0100-abc" });
    const { sendEmail } = await import("./ses-client");

    const result = await sendEmail(params);

    expect(result).toEqual({ ok: true, messageId: "0100-abc" });
  });

  it("reports failure instead of throwing", async () => {
    // Callers treat a rejection as a hard 500; the invitation row is still
    // valid, so a send failure must degrade to ok:false and keep the link.
    send.mockRejectedValue(new Error("Email address is not verified"));
    const { sendEmail } = await import("./ses-client");

    const result = await sendEmail(params);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("not verified");
  });

  it("sends both HTML and plain text to the requested recipient", async () => {
    send.mockResolvedValue({ MessageId: "x" });
    const { sendEmail } = await import("./ses-client");

    await sendEmail(params);

    const input = send.mock.calls[0][0].input;
    expect(input.Destination.ToAddresses).toEqual([params.to]);
    expect(input.Content.Simple.Body.Html.Data).toBe(params.html);
    expect(input.Content.Simple.Body.Text.Data).toBe(params.text);
    expect(input.Content.Simple.Subject.Data).toBe(params.subject);
  });

  it("falls back to the default sender and lets callers override it", async () => {
    send.mockResolvedValue({ MessageId: "x" });
    const { sendEmail, EMAIL_FROM } = await import("./ses-client");

    await sendEmail(params);
    expect(send.mock.calls[0][0].input.FromEmailAddress).toBe(EMAIL_FROM);

    await sendEmail({ ...params, from: "otro@novasys.com.pe" });
    expect(send.mock.calls[1][0].input.FromEmailAddress).toBe("otro@novasys.com.pe");
  });
});
