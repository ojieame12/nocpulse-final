import type { AlertFamily, AlertSeverity, FieldAlert } from "../contracts/FieldAlert";

export type FieldAlertEmailInput = {
  alert: Pick<
    FieldAlert,
    "title" | "summary" | "explanation" | "recommendedAction" | "family" | "severity" | "startedAt"
  >;
  fieldName: string;
  workspaceName?: string | null;
  appOrigin: string;
  fieldId: string;
};

// --- Design tokens mapped from DESIGN-SYSTEM.md ---

type StatusVariant = "danger" | "warning" | "positive" | "info" | "neutral";

const STATUS_BADGES: Record<StatusVariant, { bg: string; fg: string }> = {
  danger:   { bg: "#fee2e2", fg: "#991b1b" },
  warning:  { bg: "#fef3c7", fg: "#92400e" },
  positive: { bg: "#dcfce7", fg: "#004726" },
  info:     { bg: "#dbeafe", fg: "#1e40af" },
  neutral:  { bg: "#f4f4f5", fg: "#374151" },
};

const STATUS_COLORS: Record<StatusVariant, string> = {
  danger:   "#ef4444",
  warning:  "#f59e0b",
  positive: "#16a34a",
  info:     "#3b82f6",
  neutral:  "#6b7280",
};

// Map severity → status variant
function severityToVariant(severity: AlertSeverity): StatusVariant {
  switch (severity) {
    case "critical": return "danger";
    case "high":     return "danger";
    case "medium":   return "warning";
    case "low":      return "info";
  }
}

function severityLabel(severity: AlertSeverity): string {
  switch (severity) {
    case "critical": return "Critical";
    case "high":     return "High";
    case "medium":   return "Warning";
    case "low":      return "Info";
  }
}

function familyLabel(family: AlertFamily): string {
  const labels: Record<AlertFamily, string> = {
    moisture_stress: "Moisture Stress",
    weather_risk:    "Weather Risk",
    hail_risk:       "Hail Risk",
    crop_health:     "Crop Health",
    disease_risk:    "Disease Risk",
    action_brief:    "Action Brief",
    imagery_gap:     "Imagery Gap",
    system:          "System",
  };
  return labels[family] ?? family;
}

function familyIcon(family: AlertFamily): string {
  // Simple text-based icons for email (no image dependencies)
  const icons: Record<AlertFamily, string> = {
    moisture_stress: "&#x1F4A7;", // droplet
    weather_risk:    "&#x26C8;",  // thunder cloud
    hail_risk:       "&#x1F9CA;", // ice
    crop_health:     "&#x1F33F;", // herb
    disease_risk:    "&#x1F41B;", // bug
    action_brief:    "&#x1F4CB;", // clipboard
    imagery_gap:     "&#x1F4F7;", // camera
    system:          "&#x2699;",  // gear
  };
  return icons[family] ?? "&#x26A0;";
}

function formatAlertDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-CA", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return iso;
  }
}

// --- Layout constants ---
const FONT_STACK = "'Sintony', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const MONO_STACK = "'IBM Plex Mono', 'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', monospace";
const CARD_MAX_WIDTH = "520px";

// Text colors from design system
const TEXT = {
  primary:   "#111111",
  secondary: "#6b7280",
  body:      "#474c54",
  muted:     "#8a8f98",
};

const BRAND_GREEN = "#16a34a";
const BRAND_DARK_GREEN = "#004726";

export function renderFieldAlertEmail(input: FieldAlertEmailInput): {
  subject: string;
  html: string;
} {
  const { alert, fieldName, workspaceName, appOrigin, fieldId } = input;

  const variant = severityToVariant(alert.severity);
  const badge = STATUS_BADGES[variant];
  const accentColor = STATUS_COLORS[variant];
  const sevLabel = severityLabel(alert.severity);
  const famLabel = familyLabel(alert.family);
  const icon = familyIcon(alert.family);
  const resolvedWorkspace = workspaceName?.trim() || "your workspace";
  const fieldUrl = `${appOrigin}/fields/${fieldId}`;
  const dateStr = formatAlertDate(alert.startedAt);

  const subject = `${sevLabel}: ${alert.title} — ${fieldName}`;

  // Section label helper — matches NocPulse section label pattern:
  // Sintony 9px bold, letterSpacing 1px, text-muted, uppercase
  const sectionLabel = (text: string) =>
    `<p style="font-family:${FONT_STACK}; font-size:9px; font-weight:700; letter-spacing:1px; color:${TEXT.muted}; text-transform:uppercase; margin:0 0 8px 0;">${text}</p>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(subject)}</title>
  <style>
    body, table, td, p, a, h1, h2 { margin: 0; padding: 0; }
    body {
      width: 100% !important;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
      background-color: #f7f6f6;
      font-family: ${FONT_STACK};
    }
    img { border: 0; outline: none; text-decoration: none; }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#f7f6f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f6f6;">
    <tr>
      <td align="center" style="padding: 48px 24px;">

        <!-- Main card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:${CARD_MAX_WIDTH}; background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow: 0 2px 7px -2px rgba(0,0,0,0.04), 0 8px 28px -8px rgba(0,0,0,0.08);">

          <!-- Severity accent bar (3px) -->
          <tr>
            <td style="height:3px; background-color:${accentColor};"></td>
          </tr>

          <!-- Header: logo + timestamp -->
          <tr>
            <td style="padding: 32px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="middle">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:8px; height:8px; background-color:${BRAND_GREEN}; border-radius:50%;"></td>
                        <td style="padding-left:8px; font-family:${FONT_STACK}; font-size:16px; font-weight:600; color:${TEXT.primary}; letter-spacing:-0.02em;">
                          NocPulse
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" valign="middle" style="font-family:${MONO_STACK}; font-size:11px; color:${TEXT.muted};">
                    ${escapeHtml(dateStr)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 20px 32px 0 32px;">
              <div style="height:1px; background-color:#e5e7eb;"></div>
            </td>
          </tr>

          <!-- Severity + Family badge row -->
          <tr>
            <td style="padding: 24px 32px 0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <!-- Severity badge -->
                  <td style="padding:4px 10px; background-color:${badge.bg}; border-radius:6px;">
                    <span style="font-family:${FONT_STACK}; font-size:11px; font-weight:600; color:${badge.fg}; letter-spacing:0.04em;">
                      ${sevLabel.toUpperCase()}
                    </span>
                  </td>
                  <!-- Family badge -->
                  <td style="padding-left:8px;">
                    <span style="font-family:${FONT_STACK}; font-size:11px; font-weight:600; color:${TEXT.secondary}; padding:4px 10px; background-color:#f4f4f5; border-radius:6px; display:inline-block;">
                      ${icon} ${escapeHtml(famLabel)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Alert title -->
          <tr>
            <td style="padding: 16px 32px 0 32px;">
              <h1 style="font-family:Georgia, 'Times New Roman', serif; font-size:22px; font-weight:500; color:${TEXT.primary}; line-height:1.3; margin:0; letter-spacing:-0.01em;">
                ${escapeHtml(alert.title)}
              </h1>
            </td>
          </tr>

          <!-- Field name pill -->
          <tr>
            <td style="padding: 12px 32px 0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:8px 14px; background-color:#f9fafb; border:1px solid #e5e7eb; border-radius:10px;">
                    <span style="font-family:${FONT_STACK}; font-size:9px; font-weight:700; color:${TEXT.muted}; letter-spacing:1px; text-transform:uppercase;">Field</span>
                    <div style="padding-top:4px; font-family:${FONT_STACK}; font-size:14px; font-weight:600; color:${TEXT.primary};">
                      ${escapeHtml(fieldName)}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${alert.summary ? `
          <!-- Summary -->
          <tr>
            <td style="padding: 24px 32px 0 32px;">
              <p style="font-family:${FONT_STACK}; font-size:14px; color:${TEXT.body}; line-height:1.6; margin:0;">
                ${escapeHtml(alert.summary)}
              </p>
            </td>
          </tr>` : ""}

          ${alert.explanation ? `
          <!-- Explanation section -->
          <tr>
            <td style="padding: 24px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb; border:1px solid #e5e7eb; border-radius:10px;">
                <tr>
                  <td style="padding:16px;">
                    ${sectionLabel("Why this matters")}
                    <p style="font-family:${FONT_STACK}; font-size:13px; color:${TEXT.body}; line-height:1.6; margin:0;">
                      ${escapeHtml(alert.explanation)}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : ""}

          ${alert.recommendedAction ? `
          <!-- Recommended action section -->
          <tr>
            <td style="padding: 16px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${STATUS_BADGES.positive.bg}; border:1px solid #bbf7d0; border-radius:10px;">
                <tr>
                  <td style="padding:16px;">
                    ${sectionLabel("Recommended action")}
                    <p style="font-family:${FONT_STACK}; font-size:13px; color:${BRAND_DARK_GREEN}; line-height:1.6; margin:0;">
                      ${escapeHtml(alert.recommendedAction)}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : ""}

          <!-- CTA button -->
          <tr>
            <td align="center" style="padding: 32px 32px 0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="background-color:${BRAND_GREEN}; border-radius:10px; box-shadow: 0 4px 0 ${BRAND_DARK_GREEN};">
                    <a href="${fieldUrl}" target="_blank" style="display:inline-block; padding:14px 36px; font-family:${FONT_STACK}; font-size:14px; font-weight:600; color:#ffffff; text-decoration:none; letter-spacing:0.01em;">
                      View field details
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 32px 32px 0 32px;">
              <div style="height:1px; background-color:#e5e7eb;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 20px 32px 28px 32px;">
              <p style="font-family:${FONT_STACK}; font-size:11px; color:${TEXT.muted}; line-height:1.5;">
                You are receiving this because you have email alerts enabled for ${escapeHtml(resolvedWorkspace)}.
              </p>
              <p style="font-family:${FONT_STACK}; font-size:10px; color:#c4c7cc; padding-top:12px;">
                NocPulse &mdash; Agricultural Intelligence
              </p>
            </td>
          </tr>

        </table>
        <!-- End main card -->

      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
