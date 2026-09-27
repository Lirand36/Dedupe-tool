import { redirect } from "next/navigation";
import { currentDataset } from "@/lib/service";

/** Review now lives in each object's duplicates table, or in the import's page. */
export default async function InboxPage() {
  const dataset = await currentDataset();
  if (!dataset) redirect("/crm");
  redirect(dataset.kind === "crm" ? `/crm/${dataset.objectType}` : `/imports/${dataset.id}`);
}
