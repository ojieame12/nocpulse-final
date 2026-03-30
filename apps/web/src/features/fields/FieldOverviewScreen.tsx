import { redirect } from "next/navigation";

type FieldOverviewScreenProps = {
  fieldId: string;
};

export async function FieldOverviewScreen({
  fieldId,
}: FieldOverviewScreenProps) {
  redirect(`/preview?fieldId=${encodeURIComponent(fieldId)}`);
}
