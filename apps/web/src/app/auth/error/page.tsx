import { AuthErrorScreen } from "../../../features/auth/AuthErrorScreen";
import { sanitizeNextPath } from "../../../server/auth/sanitizeNextPath";

type AuthErrorPageProps = {
  searchParams?: Promise<{
    next?: string;
    reason?: "missing-code" | "callback-error";
  }>;
};

export default async function AuthErrorPage({
  searchParams,
}: AuthErrorPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const reason =
    resolvedSearchParams?.reason === "missing-code" ||
    resolvedSearchParams?.reason === "callback-error"
      ? resolvedSearchParams.reason
      : "callback-error";

  return (
    <AuthErrorScreen
      nextPath={sanitizeNextPath(resolvedSearchParams?.next)}
      reason={reason}
    />
  );
}
