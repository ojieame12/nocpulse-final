import { CheckEmailScreen } from "../../../features/auth/CheckEmailScreen";
import { sanitizeNextPath } from "../../../server/auth/sanitizeNextPath";

type CheckEmailPageProps = {
  searchParams?: Promise<{
    email?: string;
    next?: string;
  }>;
};

export default async function CheckEmailPage({
  searchParams,
}: CheckEmailPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  return (
    <CheckEmailScreen
      email={resolvedSearchParams?.email}
      nextPath={sanitizeNextPath(resolvedSearchParams?.next, "/preview")}
    />
  );
}
