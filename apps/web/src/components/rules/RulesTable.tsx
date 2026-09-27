import type { RunConfig } from "@dedupe/core";
import { TagBadge } from "@/components/ui";
import { tagSource } from "@/lib/tagStyle";

export const MATCH_LABELS: Record<string, string> = {
  email: "Email",
  firstName: "First name",
  lastName: "Last name",
  fullName: "Full name",
  phone: "Phone",
  company: "Company",
  website: "Website",
};

export function RulesTable({ config, columns }: { config: RunConfig; columns: readonly string[] }) {
  const matchRole = new Map(
    Object.entries(config.match.fields).map(([key, column]) => [column, MATCH_LABELS[key] ?? key]),
  );
  const tagged = columns.filter((c) => c in config.policy.fields);
  const untagged = columns.filter((c) => !(c in config.policy.fields));
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b border-line bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-5 py-3 font-medium">Field</th>
            <th className="px-5 py-3 font-medium">Rule</th>
            <th className="px-5 py-3 font-medium">Value comes from</th>
            <th className="px-5 py-3 font-medium">Used to match</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {[...tagged, ...untagged].map((field) => {
            const tag = config.policy.fields[field];
            return (
              <tr key={field} className={tag ? "" : "text-muted"}>
                <td className="px-5 py-3 font-medium">{field}</td>
                <td className="px-5 py-3">
                  <TagBadge tag={tag} />
                </td>
                <td className="px-5 py-3">{tagSource(tag)}</td>
                <td className="px-5 py-3">
                  {matchRole.get(field) ?? <span className="text-slate-300">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
