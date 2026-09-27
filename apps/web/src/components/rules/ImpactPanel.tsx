import type { ImpactPreview } from "@/lib/service";

const text = (v: unknown) =>
  v === null || v === undefined || v === "" ? "—" : Array.isArray(v) ? v.join("; ") : String(v);

const SAMPLES_SHOWN = 8;

export function ImpactPanel({ preview }: { preview: ImpactPreview }) {
  const { policy, exampleFailures, groupsCompared } = preview;
  return (
    <div className="space-y-3 text-sm">
      <p>
        <strong>{policy.changedGroups}</strong> of {groupsCompared} duplicate groups would get a
        different clean record
        {Object.keys(policy.byField).length > 0 && (
          <>
            :{" "}
            {Object.entries(policy.byField)
              .map(([f, n]) => `${f} (${n})`)
              .join(", ")}
          </>
        )}
        . Matching changes take effect when you go live.
      </p>
      {policy.samples.length > 0 && (
        <ul className="space-y-1">
          {policy.samples.slice(0, SAMPLES_SHOWN).map((s) => (
            <li key={`${s.sourceIds.join()}-${s.field}`} className="text-muted">
              {s.sourceIds.join(" + ")} · <span className="text-ink">{s.field}</span>:{" "}
              {text(s.before)} → <span className="font-medium text-ink">{text(s.after)}</span>
            </li>
          ))}
        </ul>
      )}
      {exampleFailures.length > 0 ? (
        <div className="rounded-lg bg-bad-soft p-3 text-bad">
          <strong>{exampleFailures.length} example check(s) would break:</strong>
          <ul className="mt-1 list-inside list-disc">
            {exampleFailures.map((f) => (
              <li key={`${f.example}-${f.field}`}>
                {f.example}: {f.field} should be "{text(f.expected)}", would be "{text(f.actual)}"
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-good">All saved examples still pass.</p>
      )}
    </div>
  );
}
