import {
  isValidWorkspaceAccessEmail,
  normalizeWorkspaceAccessEmail,
} from "../../features/settings/workspaceAccess";

export type RequestAccessSubmission = {
  name: string;
  email: string;
  farmName: string;
  acreage: string | null;
  message: string | null;
};

export class RequestAccessSubmissionError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "RequestAccessSubmissionError";
    this.status = status;
  }
}

function readTrimmedString(input: unknown) {
  return typeof input === "string" ? input.trim() : "";
}

function readRequiredField(
  input: Record<string, unknown>,
  key: string,
  label: string,
  maxLength: number,
) {
  const value = readTrimmedString(input[key]);

  if (!value) {
    throw new RequestAccessSubmissionError(`${label} is required.`);
  }

  if (value.length > maxLength) {
    throw new RequestAccessSubmissionError(
      `${label} must be ${maxLength} characters or fewer.`,
    );
  }

  return value;
}

function readOptionalField(
  input: Record<string, unknown>,
  key: string,
  label: string,
  maxLength: number,
) {
  const value = readTrimmedString(input[key]);

  if (!value) {
    return null;
  }

  if (value.length > maxLength) {
    throw new RequestAccessSubmissionError(
      `${label} must be ${maxLength} characters or fewer.`,
    );
  }

  return value;
}

export function normalizeRequestAccessSubmission(
  input: Record<string, unknown>,
): RequestAccessSubmission {
  const name = readRequiredField(input, "name", "Name", 120);
  const email = normalizeWorkspaceAccessEmail(input.email);

  if (!email) {
    throw new RequestAccessSubmissionError("Email is required.");
  }

  if (!isValidWorkspaceAccessEmail(email)) {
    throw new RequestAccessSubmissionError("Enter a valid email address.");
  }

  return {
    name,
    email,
    farmName: readRequiredField(input, "farmName", "Farm / Operation", 160),
    acreage: readOptionalField(
      input,
      "acreage",
      "Approximate acreage",
      80,
    ),
    message: readOptionalField(input, "message", "Message", 2000),
  };
}

export function resolveRequestAccessNotificationRecipients(
  input: string | null | undefined,
) {
  if (!input) {
    return [];
  }

  const recipients = input
    .split(/[,\n;]+/)
    .map((value) => normalizeWorkspaceAccessEmail(value))
    .filter((value) => value && isValidWorkspaceAccessEmail(value));

  return Array.from(new Set(recipients));
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatOptionalValue(value: string | null) {
  return value ? escapeHtml(value) : "Not provided";
}

export function renderRequestAccessNotificationEmail(
  submission: RequestAccessSubmission,
  reviewAccessUrl?: string,
) {
  const subject = `New NocPulse access request: ${submission.name}`;

  const ctaHtml = reviewAccessUrl
    ? `<tr>
        <td style="padding:24px 28px;border-top:1px solid #ebebeb;text-align:center;">
          <a href="${escapeHtml(reviewAccessUrl)}" style="display:inline-block;padding:14px 32px;background:#008f4e;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;letter-spacing:0.3px;">Review Request</a>
          <div style="margin-top:12px;font-size:12px;color:#8a8f98;">Open the request review page to grant <strong>${escapeHtml(submission.email)}</strong> workspace access.</div>
        </td>
      </tr>`
    : "";

  const ctaText = reviewAccessUrl
    ? `\n\nReview request: ${reviewAccessUrl}`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <title>${subject}</title>
  <style>
    body, table, td, p, a { margin: 0; padding: 0; }
    body { width: 100% !important; background-color: #0c120e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#0c120e;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0c120e;">
    <tr>
      <td align="center" style="padding: 48px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px; background-color:#151e17; border:1px solid rgba(255,255,255,0.06); border-radius:16px; overflow:hidden;">

          <!-- Green accent bar -->
          <tr><td style="height:3px; background: linear-gradient(90deg, #16a34a 0%, #065f46 100%);"></td></tr>

          <!-- Logo + eyebrow -->
          <tr>
            <td style="padding: 28px 32px 0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td><img src="https://www.nocpulse.org/logo-light.svg" alt="NocPulse" width="102" height="16" style="display:block; width:102px; height:16px; opacity:0.7;" /></td>
                  <td align="right" style="font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:rgba(255,255,255,0.25);">New Lead</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Heading -->
          <tr>
            <td style="padding: 20px 32px 0 32px;">
              <h1 style="font-size:20px; font-weight:400; color:rgba(255,255,255,0.88); line-height:1.3; margin:0;">Access request from ${escapeHtml(submission.name)}</h1>
            </td>
          </tr>

          <!-- Details table -->
          <tr>
            <td style="padding: 24px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:10px 0; font-size:11px; font-weight:600; letter-spacing:0.5px; text-transform:uppercase; color:rgba(255,255,255,0.30); width:140px; vertical-align:top;">Name</td>
                  <td style="padding:10px 0; font-size:14px; color:rgba(255,255,255,0.78);">${escapeHtml(submission.name)}</td>
                </tr>
                <tr><td colspan="2" style="height:1px; background:rgba(255,255,255,0.05);"></td></tr>
                <tr>
                  <td style="padding:10px 0; font-size:11px; font-weight:600; letter-spacing:0.5px; text-transform:uppercase; color:rgba(255,255,255,0.30); vertical-align:top;">Email</td>
                  <td style="padding:10px 0; font-size:14px; color:rgba(255,255,255,0.78);"><a href="mailto:${escapeHtml(submission.email)}" style="color:#4ade80; text-decoration:none;">${escapeHtml(submission.email)}</a></td>
                </tr>
                <tr><td colspan="2" style="height:1px; background:rgba(255,255,255,0.05);"></td></tr>
                <tr>
                  <td style="padding:10px 0; font-size:11px; font-weight:600; letter-spacing:0.5px; text-transform:uppercase; color:rgba(255,255,255,0.30); vertical-align:top;">Farm</td>
                  <td style="padding:10px 0; font-size:14px; color:rgba(255,255,255,0.78);">${escapeHtml(submission.farmName)}</td>
                </tr>
                <tr><td colspan="2" style="height:1px; background:rgba(255,255,255,0.05);"></td></tr>
                <tr>
                  <td style="padding:10px 0; font-size:11px; font-weight:600; letter-spacing:0.5px; text-transform:uppercase; color:rgba(255,255,255,0.30); vertical-align:top;">Acreage</td>
                  <td style="padding:10px 0; font-size:14px; color:rgba(255,255,255,${submission.acreage ? '0.78' : '0.25'});">${formatOptionalValue(submission.acreage)}</td>
                </tr>
                ${submission.message ? `
                <tr><td colspan="2" style="height:1px; background:rgba(255,255,255,0.05);"></td></tr>
                <tr>
                  <td style="padding:10px 0; font-size:11px; font-weight:600; letter-spacing:0.5px; text-transform:uppercase; color:rgba(255,255,255,0.30); vertical-align:top;">Message</td>
                  <td style="padding:10px 0; font-size:13px; color:rgba(255,255,255,0.60); line-height:1.5; white-space:pre-wrap;">${escapeHtml(submission.message)}</td>
                </tr>` : ''}
              </table>
            </td>
          </tr>

          ${reviewAccessUrl ? `
          <!-- CTA -->
          <tr>
            <td align="center" style="padding: 28px 32px 0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="background-color:#16a34a; border-radius:10px;">
                    <a href="${escapeHtml(reviewAccessUrl)}" target="_blank" style="display:inline-block; padding:12px 32px; font-size:14px; font-weight:600; color:#ffffff; text-decoration:none; letter-spacing:0.01em;">Review &amp; Grant Access</a>
                  </td>
                </tr>
              </table>
              <p style="margin-top:12px; font-size:11px; color:rgba(255,255,255,0.25);">Grant <strong style="color:rgba(255,255,255,0.45);">${escapeHtml(submission.email)}</strong> workspace access</p>
            </td>
          </tr>` : ''}

          <!-- Divider -->
          <tr><td style="padding: 24px 32px 0 32px;"><div style="height:1px; background:rgba(255,255,255,0.06);"></div></td></tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 16px 32px 28px 32px;">
              <p style="font-size:10px; color:rgba(255,255,255,0.12);">NocPulse &mdash; Agricultural Intelligence</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  const text = [
    "New NocPulse lead",
    "",
    `Name: ${submission.name}`,
    `Email: ${submission.email}`,
    `Farm / Operation: ${submission.farmName}`,
    `Approximate Acreage: ${submission.acreage ?? "Not provided"}`,
    `Message: ${submission.message ?? "Not provided"}`,
    ctaText,
  ].join("\n");

  return {
    subject,
    html,
    text,
  };
}
