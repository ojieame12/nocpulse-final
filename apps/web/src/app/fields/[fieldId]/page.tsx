import { redirect } from "next/navigation";
import { getPreviewFieldRoute } from "../../preview/previewRoutes";

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
  redirect(getPreviewFieldRoute(fieldId));
}
