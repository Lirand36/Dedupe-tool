export const STEPS = [
  { key: "object", label: "Object" },
  { key: "match", label: "Match" },
  { key: "keep", label: "Keep rules" },
  { key: "test", label: "Test" },
  { key: "live", label: "Go live" },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];
