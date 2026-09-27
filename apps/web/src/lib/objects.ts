import { getPreset } from "@dedupe/core";

export function objectLabel(objectType: string): string {
  const preset = getPreset(objectType);
  return preset ? `${preset.systemLabel} · ${preset.objectLabel}` : "Other";
}

export function objectSystem(objectType: string): string {
  return getPreset(objectType)?.system ?? "other";
}
