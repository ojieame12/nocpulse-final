import { SignInScreen } from "../../../features/auth/SignInScreen";

type SignInPageProps = {
  searchParams?: Promise<{
    next?: string;
  }>;
};

function sanitizeNextPath(value: string | undefined) {
  return value && value.startsWith("/") ? value : "/";
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  return (
    <SignInScreen
      nextPath={sanitizeNextPath(resolvedSearchParams?.next)}
    />
  );
}
