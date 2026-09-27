"use client";

import { deleteDatasetAction } from "@/lib/actions";

export function DeleteDatasetButton({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={deleteDatasetAction}
      onSubmit={(e) => {
        if (
          !confirm(`Delete "${name}" with its runs, decisions and examples? This cannot be undone.`)
        )
          e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="btn-danger px-3 py-1.5 text-xs">
        Delete
      </button>
    </form>
  );
}
