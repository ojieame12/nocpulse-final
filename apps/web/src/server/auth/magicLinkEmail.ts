/**
 * NocPulse branded magic-link email template.
 *
 * Renders a minimal, dark-themed HTML email that matches the NocPulse
 * design aesthetic — forest greens, clean typography, calm hierarchy.
 */

export function renderMagicLinkEmail(options: {
  magicLink: string;
  email: string;
  expiresInMinutes?: number;
}): { subject: string; html: string } {
  const { magicLink, email, expiresInMinutes = 10 } = options;

  const subject = "Sign in to NocPulse";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>${subject}</title>
  <style>
    /* Reset */
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
  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0c120e; min-height:100vh;">
    <tr>
      <td align="center" style="padding: 48px 24px;">

        <!-- Card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px; background-color:#151e17; border:1px solid rgba(255,255,255,0.06); border-radius:16px; overflow:hidden;">

          <!-- Green accent bar -->
          <tr>
            <td style="height:3px; background: linear-gradient(90deg, #16a34a 0%, #065f46 100%);"></td>
          </tr>

          <!-- Logo -->
          <tr>
            <td align="center" style="padding: 36px 32px 0 32px;">
              <img src="https://www.nocpulse.org/nocpulse-logo-light.png" alt="NocPulse" width="120" height="19" style="display:block; width:120px; height:auto;" />
            </td>
          </tr>

          <!-- Heading -->
          <tr>
            <td align="center" style="padding: 28px 32px 0 32px;">
              <h1 style="font-size:22px; font-weight:400; color:rgba(255,255,255,0.88); line-height:1.3; margin:0; letter-spacing:-0.01em;">
                Sign in to your account
              </h1>
            </td>
          </tr>

          <!-- Subtext -->
          <tr>
            <td align="center" style="padding: 12px 32px 0 32px;">
              <p style="font-size:14px; color:rgba(255,255,255,0.42); line-height:1.5;">
                Click the button below to securely sign in. This link expires in ${expiresInMinutes} minutes.
              </p>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding: 28px 32px 0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="background-color:#16a34a; border-radius:10px;">
                    <a href="${magicLink}" target="_blank" style="display:inline-block; padding:14px 40px; font-size:14px; font-weight:600; color:#ffffff; text-decoration:none; letter-spacing:0.01em;">
                      Sign In to NocPulse
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Email badge -->
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

          <!-- Fallback link -->
          <tr>
            <td align="center" style="padding: 24px 32px 0 32px;">
              <p style="font-size:11px; color:rgba(255,255,255,0.25); line-height:1.5;">
                If the button doesn't work, copy and paste this link:
              </p>
              <p style="font-size:11px; color:rgba(255,255,255,0.30); line-height:1.5; word-break:break-all; padding-top:4px;">
                <a href="${magicLink}" style="color:rgba(22,163,74,0.7); text-decoration:underline;">
                  ${magicLink}
                </a>
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 28px 32px 0 32px;">
              <div style="height:1px; background-color:rgba(255,255,255,0.06);"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 20px 32px 32px 32px;">
              <p style="font-size:11px; color:rgba(255,255,255,0.20); line-height:1.5;">
                You're receiving this because a sign-in was requested for this email address.
                If you didn't request this, you can safely ignore it.
              </p>
              <p style="font-size:10px; color:rgba(255,255,255,0.12); padding-top:12px;">
                NocPulse &mdash; Agricultural Intelligence
              </p>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
