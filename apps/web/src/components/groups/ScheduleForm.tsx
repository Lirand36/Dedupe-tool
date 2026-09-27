"use client";

import { CalendarClock } from "lucide-react";
import { useState, useTransition } from "react";
import { saveScheduleAction } from "@/lib/groupActions";
import type { MergeSchedule } from "@/lib/groups";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DEFAULT: MergeSchedule = { enabled: false, frequency: "daily", time: "02:00", weekday: 1 };

/** The recurring auto-merge job: merges every ready group of the object on a schedule. */
export function ScheduleForm(props: {
  objectType: string;
  initial: MergeSchedule | null;
  readyGroups: number;
  nextRunLabel: string | null;
  connected: boolean;
}) {
  const [schedule, setSchedule] = useState<MergeSchedule>(props.initial ?? DEFAULT);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const save = (next: MergeSchedule) => {
    setSchedule(next);
    startTransition(async () => {
      const r = await saveScheduleAction(props.objectType, next);
      setStatus(r.error ?? r.message ?? null);
    });
  };

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-start gap-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <CalendarClock size={18} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Auto-merge schedule</h2>
          <p className="text-sm text-muted">
            Merges every ready group (high confidence, or approved by you). Uncertain groups wait
            here.
          </p>
          <p className="mt-1 text-sm">
            {schedule.enabled && props.nextRunLabel ? (
              <>
                Next run <strong>{props.nextRunLabel}</strong> would merge{" "}
                <strong>{props.readyGroups}</strong> group
                {props.readyGroups === 1 ? "" : "s"}.
              </>
            ) : (
              <>
                Off. <strong>{props.readyGroups}</strong> group
                {props.readyGroups === 1 ? " is" : "s are"} ready now.
              </>
            )}
          </p>
          {!props.connected && (
            <p className="mt-1 text-xs text-warn">
              Runs start merging in Salesforce once the connection is set up. Until then the
              schedule is saved only.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={schedule.enabled}
              disabled={pending}
              onChange={(e) => save({ ...schedule, enabled: e.target.checked })}
              className="h-4 w-4 accent-[var(--color-accent)]"
            />
            On
          </label>
          <select
            aria-label="Frequency"
            className="input w-auto py-1.5"
            value={schedule.frequency}
            onChange={(e) =>
              save({ ...schedule, frequency: e.target.value as MergeSchedule["frequency"] })
            }
          >
            <option value="daily">Every day</option>
            <option value="weekly">Every week</option>
          </select>
          {schedule.frequency === "weekly" && (
            <select
              aria-label="Weekday"
              className="input w-auto py-1.5"
              value={schedule.weekday ?? 1}
              onChange={(e) => save({ ...schedule, weekday: Number(e.target.value) })}
            >
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          )}
          <input
            aria-label="Time (UTC)"
            type="time"
            className="input w-auto py-1.5"
            defaultValue={schedule.time}
            onBlur={(e) => {
              if (e.target.value && e.target.value !== schedule.time)
                save({ ...schedule, time: e.target.value });
            }}
          />
          <span className="text-xs text-muted">UTC</span>
        </div>
      </div>
      {status && <p className="mt-2 text-xs text-muted">{status}</p>}
    </section>
  );
}
