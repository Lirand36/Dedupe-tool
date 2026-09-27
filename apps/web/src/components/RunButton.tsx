"use client";

import { useActionState } from "react";
import { type FormState, runAction } from "@/lib/actions";

export function RunButton() {
  const [state, action, pending] = useActionState<FormState>(runAction, {});
  return (
    <form action={action} className="flex items-center gap-3">
      {state.error && <span className="text-sm text-bad">{state.error}</span>}
      {state.message && !pending && (
        <span className="hidden text-sm text-good sm:inline">{state.message}</span>
      )}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Finding duplicates…" : "Find duplicates"}
      </button>
    </form>
  );
}
