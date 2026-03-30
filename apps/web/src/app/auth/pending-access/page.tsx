import { PendingAccessScreen } from "../../../features/auth/PendingAccessScreen";
import { sanitizeNextPath } from "../../../server/auth/sanitizeNextPath";

type PendingAccessPageProps = {
  searchParams?: Promise<{
    email?: string;
    next?: string;
  }>;
};

export default async function PendingAccessPage({
  searchParams,
}: PendingAccessPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  return (
    <PendingAccessScreen
      email={resolvedSearchParams?.email}
      nextPath={sanitizeNextPath(resolvedSearchParams?.next)}
    />
  );
}
