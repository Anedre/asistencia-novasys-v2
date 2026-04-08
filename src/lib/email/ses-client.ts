/**
 * AWS SES v2 client + low-level sendEmail wrapper.
 *
 * Uses the same credentials and region pattern as the rest of the AWS SDK
 * usages in the project.
 */

import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const ses = new SESv2Client({
  region:
    process.env.CUSTOM_AWS_REGION || process.env.AWS_REGION || "us-east-1",
  ...((process.env.CUSTOM_ACCESS_KEY_ID &&
    process.env.CUSTOM_SECRET_ACCESS_KEY) && {
    credentials: {
      accessKeyId: process.env.CUSTOM_ACCESS_KEY_ID,
      secretAccessKey: process.env.CUSTOM_SECRET_ACCESS_KEY,
    },
  }),
});

/** Default sender. Override with EMAIL_FROM env var. */
export const EMAIL_FROM =
  process.env.EMAIL_FROM || "Novasys Asistencia <noreply@novasys.com.pe>";

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
}

export interface SendEmailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

/** Sends an email via SES. Never throws — returns ok:false on failure. */
export async function sendEmail(
  params: SendEmailParams
): Promise<SendEmailResult> {
  try {
    const result = await ses.send(
      new SendEmailCommand({
        FromEmailAddress: params.from || EMAIL_FROM,
        Destination: { ToAddresses: [params.to] },
        Content: {
          Simple: {
            Subject: { Data: params.subject, Charset: "UTF-8" },
            Body: {
              Html: { Data: params.html, Charset: "UTF-8" },
              Text: { Data: params.text, Charset: "UTF-8" },
            },
          },
        },
      })
    );
    return { ok: true, messageId: result.MessageId };
  } catch (err) {
    console.error("[ses] sendEmail failed", { to: params.to, err });
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
