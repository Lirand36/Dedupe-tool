import { type RunConfig, summarizeLogic } from "@dedupe/core";
import { Search, ShieldCheck } from "lucide-react";
import { Badge, SectionTitle } from "@/components/ui";
import { tagTone } from "@/lib/tagStyle";

export function RulesSummary({
  config,
  columns,
}: {
  config: RunConfig;
  columns: readonly string[];
}) {
  const summary = summarizeLogic(config, columns);
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
      <section className="card p-6">
        <SectionTitle
          title="How duplicates are found"
          description={`Matching ${config.match.entity === "person" ? "people" : "companies"}.`}
        />
        <ul className="space-y-3">
          {summary.matching.map((line) => (
            <li key={line} className="flex gap-3 text-sm leading-relaxed">
              <Search size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden />
              {line}
            </li>
          ))}
        </ul>
      </section>
      <section className="card p-6">
        <SectionTitle
          title="What survives a merge"
          description="The clean record takes each value from the record its rule points to."
        />
        <ul className="space-y-4">
          {summary.groups.map((group) => {
            const first = group.fields[0];
            const tag = first ? config.policy.fields[first] : undefined;
            return (
              <li key={group.label} className="flex gap-3 text-sm leading-relaxed">
                <div className="w-32 shrink-0">
                  <Badge tone={tagTone(tag)}>{group.label}</Badge>
                </div>
                <span>{group.sentence}</span>
              </li>
            );
          })}
          {summary.untagged.length > 0 && (
            <li className="flex gap-3 text-sm leading-relaxed text-muted">
              <div className="w-32 shrink-0">
                <Badge>Not tagged</Badge>
              </div>
              <span>{summary.untagged.join(", ")} stay as on the kept record.</span>
            </li>
          )}
        </ul>
        <p className="mt-6 flex items-center gap-2 text-xs text-muted">
          <ShieldCheck size={14} aria-hidden /> Nothing is merged in your CRM from here yet. Results
          are exported as a clean CSV.
        </p>
      </section>
    </div>
  );
}
