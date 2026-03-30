import type { WorkspaceRole } from "@fieldpulse/module-workspaces";

function formatWorkspaceRoleLabel(role: WorkspaceRole) {
  if (role === "owner") {
    return "Owner";
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function renderWorkspaceInviteEmail(options: {
  magicLink: string;
  email: string;
  workspaceName?: string | null;
  role: WorkspaceRole;
  grantedByEmail?: string | null;
  expiresInMinutes?: number;
}) {
  const {
    magicLink,
    email,
    workspaceName,
    role,
    grantedByEmail,
    expiresInMinutes = 10,
  } = options;
  const resolvedWorkspaceName = workspaceName?.trim() || "your workspace";
  const resolvedGrantedBy = grantedByEmail?.trim() || "your workspace owner";
  const resolvedRole = formatWorkspaceRoleLabel(role);
  const subject = `You have access to ${resolvedWorkspaceName} in NocPulse`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>${subject}</title>
  <style>
    body, table, td, p, a { margin: 0; padding: 0; }
    body {
      width: 100% !important;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
      background-color: #0c120e;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }
    img { border: 0; outline: none; text-decoration: none; }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#0c120e;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0c120e; min-height:100vh;">
    <tr>
      <td align="center" style="padding: 48px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px; background-color:#151e17; border:1px solid rgba(255,255,255,0.06); border-radius:16px; overflow:hidden;">
          <tr>
            <td style="height:3px; background: linear-gradient(90deg, #16a34a 0%, #065f46 100%);"></td>
          </tr>
          <tr>
            <td align="center" style="padding: 36px 32px 0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:10px; height:10px; background-color:#16a34a; border-radius:50%;"></td>
                  <td style="padding-left:8px; font-size:18px; font-weight:600; color:rgba(255,255,255,0.85); letter-spacing:-0.02em;">
                    NocPulse
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 28px 32px 0 32px;">
              <h1 style="font-size:22px; font-weight:400; color:rgba(255,255,255,0.88); line-height:1.3; margin:0; letter-spacing:-0.01em;">
                Your workspace access is ready
              </h1>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 12px 32px 0 32px;">
              <p style="font-size:14px; color:rgba(255,255,255,0.42); line-height:1.5;">
                ${resolvedGrantedBy} granted ${resolvedRole.toLowerCase()} access to ${resolvedWorkspaceName}. Use the button below to open the workspace. This link expires in ${expiresInMinutes} minutes.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 20px 32px 0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:6px 14px; background-color:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06); border-radius:8px;">
                    <span style="font-size:11px; color:rgba(255,255,255,0.32); letter-spacing:0.08em; text-transform:uppercase;">Workspace</span>
                    <div style="padding-top:4px; font-size:14px; color:rgba(255,255,255,0.78);">${resolvedWorkspaceName}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 28px 32px 0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="background-color:#16a34a; border-radius:10px;">
                    <a href="${magicLink}" target="_blank" style="display:inline-block; padding:14px 40px; font-size:14px; font-weight:600; color:#ffffff; text-decoration:none; letter-spacing:0.01em;">
                      Open NocPulse
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 24px 32px 0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:6px 14px; background-color:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06); border-radius:8px;">
                    <span style="font-family:'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', monospace; font-size:12px; color:rgba(255,255,255,0.55);">
                      ${email}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 24px 32px 0 32px;">
              <p style="font-size:11px; color:rgba(255,255,255,0.25); line-height:1.5;">
                If the button does not work, copy and paste this link:
              </p>
              <p style="font-size:11px; color:rgba(255,255,255,0.30); line-height:1.5; word-break:break-all; padding-top:4px;">
                <a href="${magicLink}" style="color:rgba(22,163,74,0.7); text-decoration:underline;">
                  ${magicLink}
                </a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px 32px 0 32px;">
              <div style="height:1px; background-color:rgba(255,255,255,0.06);"></div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 20px 32px 32px 32px;">
              <p style="font-size:11px; color:rgba(255,255,255,0.20); line-height:1.5;">
                You are receiving this because access was granted for this email address. If you were not expecting this, you can ignore this message.
              </p>
              <p style="font-size:10px; color:rgba(255,255,255,0.12); padding-top:12px;">
                NocPulse &mdash; Agricultural Intelligence
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
