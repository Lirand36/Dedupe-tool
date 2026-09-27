/** Append-only: each entry is one schema version. Never edit an entry that has shipped. */
export const MIGRATIONS: readonly (readonly string[])[] = [
  [
    `CREATE TABLE datasets (
      id text PRIMARY KEY,
      name text NOT NULL,
      entity text NOT NULL,
      field_columns jsonb NOT NULL,
      record_count int NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE dataset_records (
      dataset_id text NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
      id text NOT NULL,
      created_at text NOT NULL,
      updated_at text NOT NULL,
      cells jsonb NOT NULL,
      PRIMARY KEY (dataset_id, id)
    )`,
    `CREATE TABLE configs (
      dataset_id text PRIMARY KEY REFERENCES datasets(id) ON DELETE CASCADE,
      config jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE runs (
      id text PRIMARY KEY,
      dataset_id text NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
      stats jsonb NOT NULL,
      config jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE identities (
      run_id text NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      id text NOT NULL,
      tier text NOT NULL,
      confidence real NOT NULL,
      keep_record_id text NOT NULL,
      remove_record_ids jsonb NOT NULL,
      source_ids jsonb NOT NULL,
      golden jsonb NOT NULL,
      evidence jsonb NOT NULL,
      decision text NOT NULL DEFAULT 'pending',
      overrides jsonb NOT NULL DEFAULT '{}',
      decided_at timestamptz,
      PRIMARY KEY (run_id, id)
    )`,
    "CREATE INDEX identities_by_run ON identities (run_id, tier, decision)",
    `CREATE TABLE examples (
      id text PRIMARY KEY,
      dataset_id text NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
      name text NOT NULL,
      records jsonb NOT NULL,
      expected jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
  ],
];
