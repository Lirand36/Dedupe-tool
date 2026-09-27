import { CheckCircle2, Download, GitMerge, Play, Star, UploadCloud } from "lucide-react";
import type { EventKind } from "@/lib/repo";
import { TONE_CLASS, type Tone } from "@/lib/tagStyle";

const ICONS: Record<EventKind, { icon: typeof Play; tone: Tone }> = {
  upload: { icon: UploadCloud, tone: "sky" },
  run: { icon: Play, tone: "slate" },
  rules: { icon: GitMerge, tone: "violet" },
  decision: { icon: CheckCircle2, tone: "emerald" },
  example: { icon: Star, tone: "amber" },
  export: { icon: Download, tone: "teal" },
};

export function EventIcon({ kind }: { kind: EventKind }) {
  const { icon: Icon, tone } = ICONS[kind] ?? ICONS.run;
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${TONE_CLASS[tone]}`}
    >
      <Icon size={15} aria-hidden />
    </span>
  );
}
