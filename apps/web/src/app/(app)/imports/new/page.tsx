import { OBJECT_PRESETS } from "@dedupe/core";
import { UploadFileForm } from "@/components/imports/UploadFileForm";
import { PageHeader } from "@/components/ui";

export default async function NewImportPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; object?: string }>;
}) {
  const params = await searchParams;
  const kind = params.kind === "crm" ? "crm" : "import";
  const presets = OBJECT_PRESETS.map(({ id, system, systemLabel, objectLabel, entity }) => ({
    id,
    system,
    systemLabel,
    objectLabel,
    entity,
  }));
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow={kind === "crm" ? "CRM" : "Imports"}
        title={kind === "crm" ? "Upload a CRM export" : "New import"}
        description={
          kind === "crm"
            ? "Stands in for a live connection: the export shows the duplicates in your CRM today, and lets imports tell new people from existing ones."
            : "Clean a file before it goes into your CRM. Duplicates are merged by the object's rules, and people who already exist become updates."
        }
      />
      <UploadFileForm presets={presets} kind={kind} defaultObject={params.object} />
    </div>
  );
}
