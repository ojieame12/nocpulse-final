import { AuthNoticeScreen } from "./AuthNoticeScreen";
import { PendingAccessStatusWatcher } from "./PendingAccessStatusWatcher";

type PendingAccessScreenProps = {
  email?: string | null;
  nextPath?: string;
};

function buildSignInHref(nextPath: string) {
  return `/auth/sign-in?next=${encodeURIComponent(nextPath)}`;
}

function buildOnboardingHref(nextPath: string) {
  return `/auth/onboarding?next=${encodeURIComponent(nextPath)}`;
}

function buildRequestAccessHref(
  email: string | null | undefined,
  nextPath: string,
) {
  const params = new URLSearchParams();

  if (email) {
    params.set("email", email);
  }

  if (nextPath && nextPath !== "/") {
    params.set("next", nextPath);
  }

  const query = params.toString();
  return query ? `/request-access?${query}` : "/request-access";
}

export function PendingAccessScreen({
  email,
  nextPath = "/",
}: PendingAccessScreenProps) {
  return (
    <AuthNoticeScreen
      eyebrow="Access Pending"
      title="Your account is waiting for workspace access"
      description="You successfully authenticated with Supabase, but NocPulse could not match this account to a workspace yet. If you are starting fresh, create your first workspace now. If this email was supposed to be provisioned already, ask NocPulse or the workspace owner to confirm this exact address was attached to the workspace."
      detail={
        email ? (
          <span>
            Signed in as{" "}
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
          "Your session is valid, but no workspace membership was found."
        )
      }
      actions={[
        {
          href: buildOnboardingHref(nextPath),
          label: "Create my first workspace",
        },
        {
          href: buildRequestAccessHref(email, nextPath),
          label: "Request access",
          variant: "secondary",
        },
        {
          href: buildSignInHref(nextPath),
          label: "Back to sign in",
          variant: "secondary",
        },
      ]}
      footer="Creating a workspace provisions your current authenticated email as the owner. If you expect access to an existing workspace, stay on this page or sign in again after that workspace is provisioned for this email."
    >
      <PendingAccessStatusWatcher nextPath={nextPath} />
    </AuthNoticeScreen>
  );
}
