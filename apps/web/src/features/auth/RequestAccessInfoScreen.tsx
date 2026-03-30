import { AuthNoticeScreen } from "./AuthNoticeScreen";

type RequestAccessInfoScreenProps = {
  email?: string | null;
  nextPath?: string;
};

function buildSignInHref(nextPath: string) {
  return `/auth/sign-in?next=${encodeURIComponent(nextPath)}`;
}

function buildOnboardingHref(nextPath: string) {
  return `/auth/onboarding?next=${encodeURIComponent(nextPath)}`;
}

export function RequestAccessInfoScreen({
  email,
  nextPath = "/",
}: RequestAccessInfoScreenProps) {
  return (
    <AuthNoticeScreen
      eyebrow="Request Access"
      title="Request NocPulse access"
      description="Use this page when your email has not been provisioned for a workspace yet. After NocPulse confirms access for this address, the normal sign-in flow should take you straight into the product."
      detail={
        email ? (
          <span>
            Ask NocPulse to provision{" "}
            <span
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--text-primary)",
              }}
            >
              {email}
            </span>
            .
          </span>
        ) : (
          "Use the exact email address that should receive NocPulse access."
        )
      }
      actions={[
        {
          href: buildOnboardingHref(nextPath),
          label: "Create my own workspace",
          variant: "secondary",
        },
        {
          href: buildSignInHref(nextPath),
          label: "Return to sign in",
        },
      ]}
      footer="Once this email is provisioned, sign in again and the callback should resolve directly into your workspace."
    />
  );
}
