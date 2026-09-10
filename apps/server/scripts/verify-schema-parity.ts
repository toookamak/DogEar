/**
 * 校验迁移链与运行时初始化器产出的 schema 是否一致。
 *
 * A 库：按顺序执行 packages/db/drizzle/*.sql（D1 路径）
 * B 库：调用 initializeSqliteSchema()（自托管路径）
 *
 * 两者应得到相同的表、列与索引。若不一致，说明 D1 部署会缺结构。
 */
import { Database } from 'bun:sqlite'
import { readdirSync, readFileSync, rmSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { initializeSqliteSchema } from '@dogear/db'

const tmp = join(import.meta.dir, '.schema-check')
rmSync(tmp, { recursive: true, force: true })
mkdirSync(tmp, { recursive: true })

const migrationDir = join(import.meta.dir, '..', '..', '..', 'packages', 'db', 'drizzle')

// ---- A：执行迁移链 ----
const dbA = new Database(join(tmp, 'a.sqlite'))
dbA.run('PRAGMA foreign_keys = ON')
const files = readdirSync(migrationDir).filter((f) => f.endsWith('.sql')).sort()
console.log('migration files:', files.join(', '))
for (const file of files) {
  const sql = readFileSync(join(migrationDir, file), 'utf8')
  // 去掉 drizzle 的分隔标记注释后按语句执行
  const statements = sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.replace(/--[^\n]*/g, '').trim())
    .filter(Boolean)
  for (const statement of statements) {
    try {
      dbA.run(statement)
    } catch (error) {
      console.error(`FAILED in ${file}: ${statement.slice(0, 90)}`)
      throw error
    }
  }
}

// ---- B：运行时初始化器 ----
const dbB = new Database(join(tmp, 'b.sqlite'))
initializeSqliteSchema(dbB)

// ---- 比较 ----
const tablesOf = (db: Database) =>
  db.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all().map((r: any) => r.name).sort()

const columnsOf = (db: Database, table: string) =>
  db.query(`PRAGMA table_info(${table})`).all().map((r: any) => `${r.name}:${r.type}`).sort()

const indexesOf = (db: Database) =>
  db.query("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'")
    .all().map((r: any) => r.name).sort()

const tablesA = tablesOf(dbA)
const tablesB = tablesOf(dbB)
console.log(`\n迁移链表数: ${tablesA.length}`)
console.log(`初始化器表数: ${tablesB.length}`)

const missingInA = tablesB.filter((t) => !tablesA.includes(t))
const extraInA = tablesA.filter((t) => !tablesB.includes(t))
console.log(`迁移链缺少的表: ${missingInA.length ? missingInA.join(', ') : '（无）'}`)
console.log(`迁移链多出的表: ${extraInA.length ? extraInA.join(', ') : '（无）'}`)

let columnDrift = 0
for (const table of tablesB) {
  if (!tablesA.includes(table)) continue
  const a = columnsOf(dbA, table)
  const b = columnsOf(dbB, table)
  const onlyB = b.filter((c) => !a.includes(c))
  const onlyA = a.filter((c) => !b.includes(c))
  if (onlyB.length || onlyA.length) {
    columnDrift++
    console.log(`\n列差异 ${table}:`)
    if (onlyB.length) console.log(`  迁移链缺少: ${onlyB.join(', ')}`)
    if (onlyA.length) console.log(`  迁移链多出: ${onlyA.join(', ')}`)
  }
}

const idxA = indexesOf(dbA)
const idxB = indexesOf(dbB)
const idxMissing = idxB.filter((i) => !idxA.includes(i))
console.log(`\n迁移链缺索引: ${idxMissing.length ? idxMissing.join(', ') : '（无）'}`)

console.log(`\n列漂移表数: ${columnDrift}`)

// ---- 默认数据 ----
const scenesA = dbA.query('SELECT COUNT(*) AS n FROM scenes').get() as any
const scenesB = dbB.query('SELECT COUNT(*) AS n FROM scenes').get() as any
const settingsA = dbA.query('SELECT COUNT(*) AS n FROM settings').get() as any
const settingsB = dbB.query('SELECT COUNT(*) AS n FROM settings').get() as any
console.log(`scenes 迁移链=${scenesA.n} 初始化器=${scenesB.n}`)
console.log(`settings 迁移链=${settingsA.n} 初始化器=${settingsB.n}`)

const ok = missingInA.length === 0 && extraInA.length === 0 && columnDrift === 0 && idxMissing.length === 0
console.log(`\n结论: ${ok ? '一致（D1 迁移链可用于部署）' : '存在差异，需修正迁移'}`)
process.exit(ok ? 0 : 1)
