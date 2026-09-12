import { spawn } from 'node:child_process'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { BookmarkRepository } from '@dogear/db'

/**
 * Track B（Bun/Docker）快照执行器：用 **monolith**（外部二进制，CC0）抓取公开页
 * 产出单 HTML（内联资源），落 `data/snapshots/<jobId>.html` 并更新 archives 记录。
 *
 * 口径（备份/快照设计）：
 * - 只有拿到文件才把 archives 标 completed（file_path 有值）；失败标 failed + error，
 *   不回滚书签本身（快照失败不影响 Link）。
 * - 登录墙页面 monolith 抓不到，属预期失败——那类页面走浏览器侧 SingleFile（下一批）。
 * - 二进制未安装（Dockerfile 已装；裸机需自装）时给出可执行提示，不静默。
 *
 * 摘除步骤见 docs/modules/20260912_外部依赖登记.md：删除本文件 + index.ts 注入 +
 * Dockerfile 的 monolith 安装行即可（archives 表结构保留，无耦合）。
 */

export const MONOLITH_BIN = process.env.DOGEAR_MONOLITH_BIN ?? 'monolith'

export interface SnapshotJobView {
  id: string
  bookmarkId: string
  type: string
  status: string
}

export interface SnapshotRunSummary {
  processed: number
  succeeded: number
  failed: number
}

export function createMonolithSnapshotProcessor(
  repository: BookmarkRepository,
  options: { snapshotsDir?: string; timeoutMs?: number } = {},
) {
  const snapshotsDir = options.snapshotsDir
    ?? join(process.env.DOGEAR_DATA_DIR ?? join(process.cwd(), 'data'), 'snapshots')
  const timeoutMs = options.timeoutMs ?? 60_000

  async function snapshotUrl(jobId: string, url: string): Promise<{ filePath: string; bytes: number }> {
    await mkdir(snapshotsDir, { recursive: true })
    const outPath = join(snapshotsDir, `${jobId}.html`)
    await new Promise<void>((resolve, reject) => {
      const child = spawn(MONOLITH_BIN, [url, '-o', outPath], { stdio: 'ignore' })
      const timer = setTimeout(() => {
        child.kill('SIGKILL')
        reject(new Error(`monolith timed out after ${Math.round(timeoutMs / 1000)}s`))
      }, timeoutMs)
      child.on('error', (err: NodeJS.ErrnoException) => {
        clearTimeout(timer)
        if (err.code === 'ENOENT') {
          reject(new Error(
            `monolith binary not found (looked for "${MONOLITH_BIN}"). `
            + 'Install it (e.g. `apt install monolith` / `cargo install monolith`) or set DOGEAR_MONOLITH_BIN. '
            + 'Login-walled pages need the browser-side SingleFile path instead.',
          ))
        } else {
          reject(new Error(`monolith spawn failed: ${err.message}`))
        }
      })
      child.on('exit', (code) => {
        clearTimeout(timer)
        if (code === 0) resolve()
        else reject(new Error(`monolith exited with code ${code}`))
      })
    })
    const bytes = (await readFile(outPath)).byteLength
    if (bytes === 0) throw new Error('monolith produced an empty file')
    return { filePath: outPath, bytes }
  }

  return async function processSnapshotQueue(max = 5): Promise<SnapshotRunSummary> {
    // archiveJobs.list 按 createdAt 倒序；这里取全量后内存筛 pending（作业量 = 手动勾选量，量级很小）
    const jobs = (await repository.archiveJobs.list()) as unknown as Array<Record<string, unknown>>
    const pending = jobs.filter((j) => j.status === 'pending').slice(0, max)

    let succeeded = 0
    let failed = 0
    for (const job of pending) {
      const jobId = String(job.id)
      const type = String(job.type ?? 'snapshot')
      if (type !== 'snapshot') {
        await repository.archiveJobs.update(jobId, { status: 'failed', error: 'No executor for job type' })
        failed += 1
        continue
      }
      await repository.archiveJobs.update(jobId, { status: 'running' })
      const bookmark = await repository.get(String(job.bookmarkId), true) as { url?: string } | undefined
      try {
        if (!bookmark?.url) throw new Error('Bookmark not found for job')
        const { filePath, bytes } = await snapshotUrl(jobId, bookmark.url)
        // 先建 archives 记录再补完成态：file_path 有值才视为 completed（快照口径）。
        // Job 重试时上次失败可能已留记录（主键=jobId）：存在则复用，避免主键冲突
        const existingArchive = await repository.archives.get(jobId)
        if (!existingArchive) {
          await repository.archives.create({
            id: jobId,
            bookmarkId: String(job.bookmarkId),
            type: 'snapshot',
            status: 'pending',
          })
        }
        await repository.archives.updateStatus(jobId, 'completed', {
          filePath,
          fileSize: bytes,
          mimeType: 'text/html',
        })
        await repository.archiveJobs.update(jobId, { status: 'succeeded' })
        succeeded += 1
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await repository.archiveJobs.update(jobId, { status: 'failed', error: message })
        const errId = `${jobId}-err`
        const existingErr = await repository.archives.get(errId).catch(() => undefined)
        if (!existingErr) {
          await repository.archives.create({
            id: errId,
            bookmarkId: String(job.bookmarkId),
            type: 'snapshot',
          }).catch(() => undefined)
        }
        await repository.archives.updateStatus(errId, 'failed', { error: message }).catch(() => undefined)
        failed += 1
      }
    }

    return { processed: pending.length, succeeded, failed }
  }
}

