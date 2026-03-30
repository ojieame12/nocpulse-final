import { RequestAccessScreen } from "../../features/auth/RequestAccessScreen";
import { sanitizeNextPath } from "../../server/auth/sanitizeNextPath";

type RequestAccessPageProps = {
  searchParams?: Promise<{
    email?: string;
    next?: string;
  }>;
};

export default async function RequestAccessPage({
  searchParams,
}: RequestAccessPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  return (
    <RequestAccessScreen
      email={resolvedSearchParams?.email}
      nextPath={sanitizeNextPath(resolvedSearchParams?.next, "/preview")}
    />
  );
}
