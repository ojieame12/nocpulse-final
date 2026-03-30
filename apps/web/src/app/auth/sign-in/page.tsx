import { SignInScreen } from "../../../features/auth/SignInScreen";
import { sanitizeNextPath } from "../../../server/auth/sanitizeNextPath";

type SignInPageProps = {
  searchParams?: Promise<{
    next?: string;
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  return (
    <SignInScreen
      nextPath={sanitizeNextPath(resolvedSearchParams?.next, "/preview")}
    />
  );
}
