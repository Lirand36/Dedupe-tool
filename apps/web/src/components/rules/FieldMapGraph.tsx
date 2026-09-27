import type { FieldTag, Policy } from "@dedupe/core";
import { TONE_HEX, tagSource, tagTone } from "@/lib/tagStyle";

const ROW = 40;
const TOP = 56;
const WIDTH = 920;
const SOURCE_X = 24;
const SOURCE_W = 260;
const FIELD_X = 620;
const FIELD_W = 276;
const BOX_H = 30;
const MAX_SOURCE_LABEL = 38;

const sourceKey = (tag: FieldTag) => tagSource(tag);

/** Left: where a value comes from. Right: the clean record's fields. One colored line per field. */
export function FieldMapGraph({ policy }: { policy: Policy }) {
  const entries = Object.entries(policy.fields);
  if (entries.length === 0) return <p className="text-sm text-muted">No fields are tagged yet.</p>;
  const sources = [...new Map(entries.map(([, tag]) => [sourceKey(tag), tag])).entries()];
  const ordered = sources.flatMap(([key]) => entries.filter(([, tag]) => sourceKey(tag) === key));
  const fieldY = new Map(ordered.map(([field], i) => [field, TOP + i * ROW]));
  const sourceY = new Map(
    sources.map(([key]) => {
      const ys = ordered
        .filter(([, tag]) => sourceKey(tag) === key)
        .map(([f]) => fieldY.get(f) ?? 0);
      return [key, ys.reduce((a, b) => a + b, 0) / ys.length];
    }),
  );
  const height = TOP + ordered.length * ROW + 16;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        className="w-full min-w-[720px]"
        role="img"
        aria-label="Field map: where each clean value comes from"
      >
        <text x={SOURCE_X} y={28} className="fill-slate-500 text-[12px] font-medium uppercase">
          Value comes from
        </text>
        <text x={FIELD_X} y={28} className="fill-slate-500 text-[12px] font-medium uppercase">
          Clean record field
        </text>
        {ordered.map(([field, tag]) => {
          const [strong] = TONE_HEX[tagTone(tag)];
          const y1 = (sourceY.get(sourceKey(tag)) ?? 0) + BOX_H / 2;
          const y2 = (fieldY.get(field) ?? 0) + BOX_H / 2;
          const x1 = SOURCE_X + SOURCE_W;
          const mid = (x1 + FIELD_X) / 2;
          return (
            <path
              key={`edge-${field}`}
              d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${FIELD_X} ${y2}`}
              fill="none"
              stroke={strong}
              strokeOpacity={0.55}
              strokeWidth={1.75}
            />
          );
        })}
        {sources.map(([key, tag]) => {
          const [strong, soft] = TONE_HEX[tagTone(tag)];
          const y = sourceY.get(key) ?? 0;
          const label =
            key.length > MAX_SOURCE_LABEL ? `${key.slice(0, MAX_SOURCE_LABEL - 1)}…` : key;
          return (
            <g key={`src-${key}`}>
              <title>{key}</title>
              <rect
                x={SOURCE_X}
                y={y}
                width={SOURCE_W}
                height={BOX_H}
                rx={8}
                fill={soft}
                stroke={strong}
                strokeOpacity={0.4}
              />
              <text
                x={SOURCE_X + 12}
                y={y + 19}
                fill={strong}
                className="text-[12.5px] font-medium"
              >
                {label}
              </text>
            </g>
          );
        })}
        {ordered.map(([field, tag]) => {
          const [strong] = TONE_HEX[tagTone(tag)];
          const y = fieldY.get(field) ?? 0;
          return (
            <g key={`field-${field}`}>
              <rect
                x={FIELD_X}
                y={y}
                width={FIELD_W}
                height={BOX_H}
                rx={8}
                fill="#ffffff"
                stroke="#e2e8f0"
              />
              <rect x={FIELD_X} y={y} width={4} height={BOX_H} rx={2} fill={strong} />
              <text
                x={FIELD_X + 14}
                y={y + 19}
                className="fill-slate-800 text-[12.5px] font-medium"
              >
                {field}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
