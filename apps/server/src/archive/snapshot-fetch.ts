import type { BookmarkRepository } from '@dogear/db'

/**
 * Track A（Workers）可用的轻量快照：fetch 公开页 HTML，截断后写入 archives.metadata。
 * 不内联资源、过不了登录墙——那是 Track B monolith / 浏览器 SingleFile 的事。
 * 失败只标 Job failed，不回滚书签。
 */
export const FETCH_SNAPSHOT_MAX_CHARS = 200_000

export interface SnapshotRunSummary {
  processed: number
  succeeded: number
  failed: number
}

export function createFetchSnapshotProcessor(options: {
  fetchImpl?: typeof fetch
  timeoutMs?: number
  maxChars?: number
  maxJobs?: number
} = {}) {
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? 12_000
  const maxChars = options.maxChars ?? FETCH_SNAPSHOT_MAX_CHARS
  const maxJobs = options.maxJobs ?? 3

  return async function processSnapshotQueue(repository: BookmarkRepository): Promise<SnapshotRunSummary> {
    const jobs = (await repository.archiveJobs.list()) as unknown as Array<Record<string, unknown>>
    const pending = jobs.filter((job) => job.status === 'pending').slice(0, maxJobs)

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
        const html = await fetchHtml(fetchImpl, bookmark.url, timeoutMs, maxChars)
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
          filePath: 'inline:html',
          fileSize: html.bytes,
          mimeType: 'text/html; charset=utf-8',
          metadata: JSON.stringify({ html: html.text, truncated: html.truncated, sourceUrl: bookmark.url }),
        })
        await repository.archiveJobs.update(jobId, { status: 'succeeded' })
        succeeded += 1
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await repository.archiveJobs.update(jobId, { status: 'failed', error: message })
        failed += 1
      }
    }

    return { processed: pending.length, succeeded, failed }
  }
}

async function fetchHtml(
  fetchImpl: typeof fetch,
  url: string,
  timeoutMs: number,
  maxChars: number,
): Promise<{ text: string; bytes: number; truncated: boolean }> {
  const response = await fetchImpl(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; DogEar/1.0; +https://dogear.app)',
      Accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${response.statusText}`)
  const raw = await response.text()
  if (!raw) throw new Error('Fetched an empty document')
  const truncated = raw.length > maxChars
  const text = truncated ? raw.slice(0, maxChars) : raw
  return { text, bytes: text.length, truncated }
}
