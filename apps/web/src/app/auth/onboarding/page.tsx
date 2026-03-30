import { CreateWorkspaceScreen } from "../../../features/auth/CreateWorkspaceScreen";
import { sanitizeNextPath } from "../../../server/auth/sanitizeNextPath";

type AuthOnboardingPageProps = {
  searchParams?: Promise<{
    next?: string;
  }>;
};

export default async function AuthOnboardingPage({
  searchParams,
}: AuthOnboardingPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  return (
    <CreateWorkspaceScreen
      nextPath={sanitizeNextPath(resolvedSearchParams?.next)}
    />
  );
}
