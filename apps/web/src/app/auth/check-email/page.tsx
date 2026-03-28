import { CheckEmailScreen } from "../../../features/auth/CheckEmailScreen";

type CheckEmailPageProps = {
  searchParams?: Promise<{
    email?: string;
    next?: string;
  }>;
};

function sanitizeNextPath(value: string | undefined) {
  return value && value.startsWith("/") ? value : "/";
}

export default async function CheckEmailPage({
  searchParams,
}: CheckEmailPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  return (
    <CheckEmailScreen
      email={resolvedSearchParams?.email}
      nextPath={sanitizeNextPath(resolvedSearchParams?.next)}
    />
  );
}
