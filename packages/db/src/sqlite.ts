export type SqliteDatabase = {
  run: (sql: string) => unknown
  query?: (sql: string) => { all: () => Array<{ name: string }> }
}

const tableDefinitions: Record<string, string> = {
  folders: `CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    parent_id TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    raindrop_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE SET NULL
  )`,
  bookmarks: `CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY NOT NULL,
    url TEXT NOT NULL,
    title TEXT,
    excerpt TEXT,
    cover TEXT,
    type TEXT NOT NULL DEFAULT 'link',
    author TEXT,
    favicon TEXT,
    published_at INTEGER,
    note TEXT,
    intent TEXT,
    important INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'unread',
    source TEXT NOT NULL DEFAULT 'page',
    private INTEGER NOT NULL DEFAULT 0,
    folder_id TEXT,
    domain TEXT,
    broken INTEGER NOT NULL DEFAULT 0,
    raindrop_id TEXT,
    raindrop_extras TEXT,
    sync_status TEXT NOT NULL DEFAULT 'pending',
    version INTEGER NOT NULL DEFAULT 1,
    deleted_at INTEGER,
    last_opened_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
  )`,
  scenes: `CREATE TABLE IF NOT EXISTS scenes (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    aerr TEXT NOT NULL DEFAULT 'reference',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  bookmark_scenes: `CREATE TABLE IF NOT EXISTS bookmark_scenes (
    bookmark_id TEXT NOT NULL,
    scene_id TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (bookmark_id, scene_id),
    FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE,
    FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE
  )`,
  tags: `CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    name_key TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL
  )`,
  bookmark_tags: `CREATE TABLE IF NOT EXISTS bookmark_tags (
    bookmark_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (bookmark_id, tag_id),
    FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
  )`,
  suggestions: `CREATE TABLE IF NOT EXISTS suggestions (
    id TEXT PRIMARY KEY NOT NULL,
    bookmark_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    target_id TEXT,
    target_label TEXT,
    confidence REAL,
    rationale TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    resolved_at INTEGER,
    FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE
  )`,
  access_records: `CREATE TABLE IF NOT EXISTS access_records (
    id TEXT PRIMARY KEY NOT NULL,
    bookmark_id TEXT NOT NULL,
    opened_at INTEGER NOT NULL,
    source TEXT NOT NULL DEFAULT 'original',
    client TEXT NOT NULL DEFAULT 'workbench',
    FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE
  )`,
  operation_log: `CREATE TABLE IF NOT EXISTS operation_log (
    id TEXT PRIMARY KEY NOT NULL,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    detail TEXT,
    revert_token TEXT,
    created_at INTEGER NOT NULL
  )`,
  settings: `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  archive_jobs: `CREATE TABLE IF NOT EXISTS archive_jobs (
    id TEXT PRIMARY KEY NOT NULL,
    bookmark_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'snapshot',
    source TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    error TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER,
    started_at INTEGER,
    completed_at INTEGER,
    FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE
  )`,
  idempotency_keys: `CREATE TABLE IF NOT EXISTS idempotency_keys (
    key TEXT NOT NULL,
    actor TEXT NOT NULL,
    request_path TEXT NOT NULL,
    request_body_hash TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response_body TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (key, actor)
  )`,
  skill_usage: `CREATE TABLE IF NOT EXISTS skill_usage (
    date TEXT NOT NULL,
    bucket TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (date, bucket)
  )`,
  sync_queue: `CREATE TABLE IF NOT EXISTS sync_queue (
    id TEXT PRIMARY KEY NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    payload TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    retry_count INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  channel_config: `CREATE TABLE IF NOT EXISTS channel_config (
	    id TEXT PRIMARY KEY NOT NULL,
	    channel TEXT NOT NULL,
	    label TEXT NOT NULL,
	    config TEXT NOT NULL,
	    enabled INTEGER NOT NULL DEFAULT 1,
	    created_at INTEGER NOT NULL,
	    updated_at INTEGER NOT NULL
	  )`,
	  archives: `CREATE TABLE IF NOT EXISTS archives (
	    id TEXT PRIMARY KEY NOT NULL,
	    bookmark_id TEXT NOT NULL,
	    type TEXT NOT NULL DEFAULT 'snapshot',
	    status TEXT NOT NULL DEFAULT 'pending',
	    file_path TEXT,
	    file_size INTEGER,
	    mime_type TEXT,
	    metadata TEXT,
	    error TEXT,
	    created_at INTEGER NOT NULL,
	    completed_at INTEGER,
	    FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE
	  )`,
	  backups: `CREATE TABLE IF NOT EXISTS backups (
	    id TEXT PRIMARY KEY NOT NULL,
	    tier TEXT NOT NULL,
	    target TEXT NOT NULL,
	    status TEXT NOT NULL DEFAULT 'pending',
	    file_path TEXT,
	    file_size INTEGER,
	    includes TEXT NOT NULL,
	    error TEXT,
	    created_at INTEGER NOT NULL,
	    completed_at INTEGER
	  )`,
	}

const bookmarkColumns: Record<string, string> = {
  title: 'ALTER TABLE bookmarks ADD COLUMN title TEXT',
  excerpt: 'ALTER TABLE bookmarks ADD COLUMN excerpt TEXT',
  cover: 'ALTER TABLE bookmarks ADD COLUMN cover TEXT',
  type: "ALTER TABLE bookmarks ADD COLUMN type TEXT NOT NULL DEFAULT 'link'",
  author: 'ALTER TABLE bookmarks ADD COLUMN author TEXT',
  favicon: 'ALTER TABLE bookmarks ADD COLUMN favicon TEXT',
  published_at: 'ALTER TABLE bookmarks ADD COLUMN published_at INTEGER',
  note: 'ALTER TABLE bookmarks ADD COLUMN note TEXT',
  intent: 'ALTER TABLE bookmarks ADD COLUMN intent TEXT',
  important: 'ALTER TABLE bookmarks ADD COLUMN important INTEGER NOT NULL DEFAULT 0',
  source: "ALTER TABLE bookmarks ADD COLUMN source TEXT NOT NULL DEFAULT 'page'",
  private: 'ALTER TABLE bookmarks ADD COLUMN private INTEGER NOT NULL DEFAULT 0',
  folder_id: 'ALTER TABLE bookmarks ADD COLUMN folder_id TEXT',
  domain: 'ALTER TABLE bookmarks ADD COLUMN domain TEXT',
  broken: 'ALTER TABLE bookmarks ADD COLUMN broken INTEGER NOT NULL DEFAULT 0',
  raindrop_id: 'ALTER TABLE bookmarks ADD COLUMN raindrop_id TEXT',
  raindrop_extras: 'ALTER TABLE bookmarks ADD COLUMN raindrop_extras TEXT',
  sync_status: "ALTER TABLE bookmarks ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'pending'",
  version: 'ALTER TABLE bookmarks ADD COLUMN version INTEGER NOT NULL DEFAULT 1',
  deleted_at: 'ALTER TABLE bookmarks ADD COLUMN deleted_at INTEGER',
  last_opened_at: 'ALTER TABLE bookmarks ADD COLUMN last_opened_at INTEGER',
}

function columnsFor(database: SqliteDatabase, table: string) {
  return new Set((database.query?.(`PRAGMA table_info(${table})`).all() ?? []).map((column) => column.name))
}

function createIndexes(database: SqliteDatabase) {
  database.run('CREATE INDEX IF NOT EXISTS bookmarks_status_created_at_idx ON bookmarks(status, created_at)')
  database.run('CREATE INDEX IF NOT EXISTS bookmarks_deleted_at_created_at_idx ON bookmarks(deleted_at, created_at)')
  database.run('CREATE INDEX IF NOT EXISTS bookmarks_folder_id_idx ON bookmarks(folder_id)')
  database.run('CREATE INDEX IF NOT EXISTS bookmarks_sync_status_idx ON bookmarks(sync_status)')
  database.run('CREATE INDEX IF NOT EXISTS bookmark_scenes_scene_id_idx ON bookmark_scenes(scene_id)')
  database.run('CREATE INDEX IF NOT EXISTS bookmark_tags_tag_id_idx ON bookmark_tags(tag_id)')
  database.run('CREATE INDEX IF NOT EXISTS access_records_bookmark_id_opened_at_idx ON access_records(bookmark_id, opened_at)')
  database.run('CREATE INDEX IF NOT EXISTS suggestions_bookmark_id_status_idx ON suggestions(bookmark_id, status)')
  database.run('CREATE INDEX IF NOT EXISTS operation_log_created_at_idx ON operation_log(created_at)')
  database.run('CREATE INDEX IF NOT EXISTS idempotency_keys_expires_at_idx ON idempotency_keys(expires_at)')
  database.run('CREATE INDEX IF NOT EXISTS sync_queue_status_channel_idx ON sync_queue(status, channel)')
  database.run('CREATE INDEX IF NOT EXISTS sync_queue_created_at_idx ON sync_queue(created_at)')
  database.run('CREATE INDEX IF NOT EXISTS channel_config_channel_enabled_idx ON channel_config(channel, enabled)')
  database.run('CREATE INDEX IF NOT EXISTS archives_bookmark_id_status_idx ON archives(bookmark_id, status)')
  database.run('CREATE INDEX IF NOT EXISTS backups_tier_target_idx ON backups(tier, target)')
  database.run('CREATE INDEX IF NOT EXISTS backups_created_at_idx ON backups(created_at)')
}

function migrateJobStatus(database: SqliteDatabase) {
  database.run("UPDATE archive_jobs SET status = 'running' WHERE status = 'processing'")
  database.run("UPDATE archive_jobs SET status = 'succeeded' WHERE status = 'completed'")
}

function seedDefaults(database: SqliteDatabase) {
  const now = Date.now()
  database.run(`INSERT OR IGNORE INTO scenes (id, name, aerr, sort_order, enabled, created_at, updated_at) VALUES
    ('00000000-0000-4000-8000-000000000001', '工作研究', 'action', 1, 1, ${now}, ${now}),
    ('00000000-0000-4000-8000-000000000002', '灵感收集', 'explore', 2, 1, ${now}, ${now}),
    ('00000000-0000-4000-8000-000000000003', '稍后再读', 'read', 3, 1, ${now}, ${now}),
    ('00000000-0000-4000-8000-000000000004', '长期资料', 'reference', 4, 1, ${now}, ${now})`)
  database.run(`INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
    ('skill.token_hash', '""', ${now}),
    ('skill.capabilities', '{"read":true,"write_new":true,"update_existing":false}', ${now}),
    ('recycle.retention_days', '7', ${now}),
    ('operation_log.retention_days', '30', ${now}),
    ('operation_log.max_rows', '5000', ${now})`)
}

export function initializeSqliteSchema(database: SqliteDatabase) {
  database.run('BEGIN')
  try {
    database.run('PRAGMA foreign_keys = ON')
    database.run(tableDefinitions.folders)
    database.run(tableDefinitions.bookmarks)
    const columns = columnsFor(database, 'bookmarks')
    for (const [column, statement] of Object.entries(bookmarkColumns)) {
      if (!columns.has(column)) database.run(statement)
    }
    for (const table of ['scenes', 'bookmark_scenes', 'tags', 'bookmark_tags', 'suggestions', 'access_records', 'operation_log', 'settings', 'archive_jobs', 'idempotency_keys', 'skill_usage', 'sync_queue', 'channel_config', 'archives', 'backups']) {
      database.run(tableDefinitions[table])
    }
    if (!columnsFor(database, 'access_records').has('client')) {
      database.run("ALTER TABLE access_records ADD COLUMN client TEXT NOT NULL DEFAULT 'workbench'")
    }
    if (!columnsFor(database, 'archive_jobs').has('updated_at')) {
      database.run('ALTER TABLE archive_jobs ADD COLUMN updated_at INTEGER')
    }
    createIndexes(database)
    migrateJobStatus(database)
    seedDefaults(database)
    database.run('COMMIT')
  } catch (error) {
    database.run('ROLLBACK')
    throw error
  }
}
