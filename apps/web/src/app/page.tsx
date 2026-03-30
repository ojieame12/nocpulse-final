import { redirect } from "next/navigation";
import { getPreviewHomeRoute } from "./preview/previewRoutes";

export const dynamic = "force-dynamic";

export default async function Home() {
  redirect(getPreviewHomeRoute());
}
