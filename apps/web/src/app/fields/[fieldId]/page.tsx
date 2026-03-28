import { FieldOverviewScreen } from "../../../features/fields/FieldOverviewScreen";

type FieldOverviewPageProps = {
  params: Promise<{
    fieldId: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function FieldOverviewPage({
  params,
}: FieldOverviewPageProps) {
  const { fieldId } = await params;

  return <FieldOverviewScreen fieldId={fieldId} />;
}
