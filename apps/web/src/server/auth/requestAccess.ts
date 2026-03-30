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
) {
  const subject = `New NocPulse access request: ${submission.name}`;
  const html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f8faf8;color:#1f2937;font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #ebebeb;border-radius:16px;overflow:hidden;">
      <tr>
        <td style="padding:24px 28px;border-bottom:1px solid #ebebeb;background:#f4f7f3;">
          <div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#8a8f98;">Request Access</div>
          <h1 style="margin:12px 0 0;font-size:28px;font-weight:400;line-height:1.2;color:#111827;">New NocPulse lead</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td style="padding:0 0 16px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#8a8f98;">Name</td>
              <td style="padding:0 0 16px;font-size:14px;color:#111827;">${escapeHtml(submission.name)}</td>
            </tr>
            <tr>
              <td style="padding:0 0 16px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#8a8f98;">Email</td>
              <td style="padding:0 0 16px;font-size:14px;color:#111827;">${escapeHtml(submission.email)}</td>
            </tr>
            <tr>
              <td style="padding:0 0 16px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#8a8f98;">Farm / Operation</td>
              <td style="padding:0 0 16px;font-size:14px;color:#111827;">${escapeHtml(submission.farmName)}</td>
            </tr>
            <tr>
              <td style="padding:0 0 16px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#8a8f98;">Approximate Acreage</td>
              <td style="padding:0 0 16px;font-size:14px;color:#111827;">${formatOptionalValue(submission.acreage)}</td>
            </tr>
            <tr>
              <td style="padding:0;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#8a8f98;vertical-align:top;">Message</td>
              <td style="padding:0;font-size:14px;color:#111827;white-space:pre-wrap;">${formatOptionalValue(submission.message)}</td>
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
  ].join("\n");

  return {
    subject,
    html,
    text,
  };
}
