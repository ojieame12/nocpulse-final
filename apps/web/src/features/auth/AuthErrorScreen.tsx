import { AuthNoticeScreen } from "./AuthNoticeScreen";

type AuthErrorReason = "missing-code" | "callback-error";

type AuthErrorScreenProps = {
  nextPath?: string;
  reason: AuthErrorReason;
};

function buildSignInHref(nextPath: string) {
  return `/auth/sign-in?next=${encodeURIComponent(nextPath)}`;
}

const COPY: Record<
  AuthErrorReason,
  {
    title: string;
    description: string;
    detail: string;
  }
> = {
  "missing-code": {
    title: "That sign-in link cannot be used",
    description:
      "The callback reached NocPulse without the authorization code required to create a session.",
    detail:
      "This usually means the email link was truncated, opened twice, or redirected through the wrong local origin.",
  },
  "callback-error": {
    title: "NocPulse could not finish signing you in",
    description:
      "Supabase rejected the callback while exchanging your email link for a session.",
    detail:
      "Request a fresh sign-in link and make sure it opens on the same app origin that sent the email.",
  },
};

export function AuthErrorScreen({
  nextPath = "/",
  reason,
}: AuthErrorScreenProps) {
  const copy = COPY[reason];

  return (
    <AuthNoticeScreen
      eyebrow="Auth Error"
      title={copy.title}
      description={copy.description}
      detail={copy.detail}
      actions={[
        {
          href: buildSignInHref(nextPath),
          label: "Request a fresh sign-in link",
        },
        {
          href: "/request-access",
          label: "Need access?",
          variant: "secondary",
        },
      ]}
      footer="If this keeps happening locally, verify APP_URL and the Supabase redirect allow-list match the port you are actually using."
    />
  );
}
