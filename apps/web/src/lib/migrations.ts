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
  [
    "ALTER TABLE datasets ADD COLUMN object_type text NOT NULL DEFAULT 'other.person'",
    "UPDATE datasets SET object_type = 'other.company' WHERE entity = 'company'",
    `CREATE TABLE events (
      id text PRIMARY KEY,
      dataset_id text NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
      kind text NOT NULL,
      summary text NOT NULL,
      detail jsonb NOT NULL DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
    "CREATE INDEX events_by_dataset ON events (dataset_id, created_at DESC)",
  ],
  [
    `CREATE TABLE objects (
      object_type text PRIMARY KEY,
      config jsonb NOT NULL,
      fields jsonb NOT NULL DEFAULT '[]',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,
    `INSERT INTO objects (object_type, config, fields)
     SELECT DISTINCT ON (d.object_type) d.object_type, c.config, d.field_columns
     FROM datasets d JOIN configs c ON c.dataset_id = d.id
     ORDER BY d.object_type, c.updated_at DESC`,
    "ALTER TABLE datasets ADD COLUMN kind text NOT NULL DEFAULT 'crm'",
    "ALTER TABLE datasets ADD COLUMN status text NOT NULL DEFAULT 'ready'",
    "ALTER TABLE datasets ADD COLUMN headers jsonb NOT NULL DEFAULT '[]'",
    "ALTER TABLE datasets ADD COLUMN column_map jsonb",
    "UPDATE datasets SET headers = field_columns",
    "ALTER TABLE examples ADD COLUMN object_type text",
    "UPDATE examples e SET object_type = d.object_type FROM datasets d WHERE e.dataset_id = d.id",
    "ALTER TABLE examples ALTER COLUMN dataset_id DROP NOT NULL",
    "UPDATE examples SET dataset_id = NULL",
    "ALTER TABLE events ADD COLUMN object_type text",
    "UPDATE events e SET object_type = d.object_type FROM datasets d WHERE e.dataset_id = d.id",
    "ALTER TABLE events ALTER COLUMN dataset_id DROP NOT NULL",
    "UPDATE events SET dataset_id = NULL WHERE kind IN ('rules', 'example')",
    "CREATE INDEX events_by_object ON events (object_type, created_at DESC)",
  ],
  [
    "ALTER TABLE identities ADD COLUMN master_id text",
    "ALTER TABLE identities ADD COLUMN merged_at timestamptz",
    "UPDATE identities SET decision = 'approved' WHERE decision = 'merged'",
    "ALTER TABLE objects ADD COLUMN schedule jsonb",
  ],
  // Repairs values the Postgres driver JSON-encoded twice (stored as a JSON string instead of an object).
  [
    "UPDATE datasets SET field_columns = (field_columns #>> '{}')::jsonb WHERE jsonb_typeof(field_columns) = 'string'",
    "UPDATE datasets SET headers = (headers #>> '{}')::jsonb WHERE jsonb_typeof(headers) = 'string'",
    "UPDATE datasets SET column_map = (column_map #>> '{}')::jsonb WHERE jsonb_typeof(column_map) = 'string'",
    "UPDATE dataset_records SET cells = (cells #>> '{}')::jsonb WHERE jsonb_typeof(cells) = 'string'",
    "UPDATE configs SET config = (config #>> '{}')::jsonb WHERE jsonb_typeof(config) = 'string'",
    "UPDATE objects SET config = (config #>> '{}')::jsonb WHERE jsonb_typeof(config) = 'string'",
    "UPDATE objects SET fields = (fields #>> '{}')::jsonb WHERE jsonb_typeof(fields) = 'string'",
    "UPDATE objects SET schedule = (schedule #>> '{}')::jsonb WHERE jsonb_typeof(schedule) = 'string'",
    "UPDATE runs SET stats = (stats #>> '{}')::jsonb WHERE jsonb_typeof(stats) = 'string'",
    "UPDATE runs SET config = (config #>> '{}')::jsonb WHERE jsonb_typeof(config) = 'string'",
    "UPDATE identities SET remove_record_ids = (remove_record_ids #>> '{}')::jsonb WHERE jsonb_typeof(remove_record_ids) = 'string'",
    "UPDATE identities SET source_ids = (source_ids #>> '{}')::jsonb WHERE jsonb_typeof(source_ids) = 'string'",
    "UPDATE identities SET golden = (golden #>> '{}')::jsonb WHERE jsonb_typeof(golden) = 'string'",
    "UPDATE identities SET evidence = (evidence #>> '{}')::jsonb WHERE jsonb_typeof(evidence) = 'string'",
    "UPDATE identities SET overrides = (overrides #>> '{}')::jsonb WHERE jsonb_typeof(overrides) = 'string'",
    "UPDATE examples SET records = (records #>> '{}')::jsonb WHERE jsonb_typeof(records) = 'string'",
    "UPDATE examples SET expected = (expected #>> '{}')::jsonb WHERE jsonb_typeof(expected) = 'string'",
    "UPDATE events SET detail = (detail #>> '{}')::jsonb WHERE jsonb_typeof(detail) = 'string'",
  ],
];
