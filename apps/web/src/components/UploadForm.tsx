"use client";

import { useActionState } from "react";
import { type FormState, uploadDatasetAction } from "@/lib/actions";

export function UploadForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(uploadDatasetAction, {});
  return (
    <form action={action} className="card space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <div>
          <label htmlFor="name" className="label">
            Name
          </label>
          <input
            id="name"
            name="name"
            required
            maxLength={100}
            placeholder="Contacts export – Sept"
            className="input"
          />
        </div>
        <div>
          <label htmlFor="entity" className="label">
            Records are
          </label>
          <select id="entity" name="entity" className="input">
            <option value="person">People</option>
            <option value="company">Companies</option>
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="file" className="label">
          CSV file
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          className="input file:mr-3 file:rounded-md file:border-0 file:bg-accent-soft file:px-3 file:py-1 file:text-accent"
        />
        <p className="mt-2 text-xs text-muted">
          Needs <code>id</code>, <code>createdAt</code> and <code>updatedAt</code> columns (dates
          like 2024-03-01). Multi-value cells use <code>;</code>. Up to 25 MB.
        </p>
      </div>
      {state.error && (
        <p className="rounded-lg bg-bad-soft p-3 text-sm whitespace-pre-line text-bad">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Uploading and finding duplicates…" : "Upload and find duplicates"}
      </button>
    </form>
  );
}
