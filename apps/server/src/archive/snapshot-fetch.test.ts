import { describe, expect, it, vi } from 'vitest'
import { createFetchSnapshotProcessor } from './snapshot-fetch.js'

function makeRepo(jobs: Array<Record<string, unknown>>) {
  const archives: Array<Record<string, unknown>> = []
  const repository: any = {
    archiveJobs: {
      list: async () => jobs,
      update: async (id: string, input: Record<string, unknown>) => {
        const row = jobs.find((job) => job.id === id)
        if (row) Object.assign(row, input)
        return row
      },
    },
    get: async (id: string) => (id === 'bm-1' ? { id, url: 'https://example.com/page' } : undefined),
    archives: {
      get: async (id: string) => archives.find((row) => row.id === id),
      create: async (input: Record<string, unknown>) => {
        archives.push({ ...input })
        return input
      },
      updateStatus: async (id: string, status: string, data: Record<string, unknown>) => {
        const row = archives.find((item) => item.id === id)
        if (row) Object.assign(row, { status, ...data })
        return row
      },
    },
  }
  return { repository, archives, jobs }
}

describe('fetch 快照执行器（Track A）', () => {
  it('fetches HTML and stores it inline on the archive record', async () => {
    const { repository, archives, jobs } = makeRepo([
      { id: 'job-1', bookmarkId: 'bm-1', type: 'snapshot', status: 'pending' },
    ])
    const fetchImpl = vi.fn(async () => new Response('<html><title>Hi</title></html>', { status: 200 }))
    const process = createFetchSnapshotProcessor({ fetchImpl: fetchImpl as unknown as typeof fetch })
    const summary = await process(repository)

    expect(summary).toEqual({ processed: 1, succeeded: 1, failed: 0 })
    expect(jobs[0].status).toBe('succeeded')
    expect(archives[0]).toMatchObject({ status: 'completed', filePath: 'inline:html' })
    const meta = JSON.parse(String(archives[0].metadata))
    expect(meta.html).toContain('<title>Hi</title>')
    expect(meta.truncated).toBe(false)
  })

  it('marks the job failed when fetch is not ok, without creating a completed archive', async () => {
    const { repository, archives, jobs } = makeRepo([
      { id: 'job-1', bookmarkId: 'bm-1', type: 'snapshot', status: 'pending' },
    ])
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 403, statusText: 'Forbidden' }))
    const process = createFetchSnapshotProcessor({ fetchImpl: fetchImpl as unknown as typeof fetch })
    const summary = await process(repository)

    expect(summary).toEqual({ processed: 1, succeeded: 0, failed: 1 })
    expect(jobs[0].status).toBe('failed')
    expect(String(jobs[0].error)).toContain('403')
    expect(archives.filter((row) => row.status === 'completed')).toHaveLength(0)
  })

  it('skips non-snapshot jobs', async () => {
    const { repository, archives, jobs } = makeRepo([
      { id: 'job-1', bookmarkId: 'bm-1', type: 'metadata', status: 'pending' },
    ])
    const fetchImpl = vi.fn()
    const process = createFetchSnapshotProcessor({ fetchImpl: fetchImpl as unknown as typeof fetch })
    const summary = await process(repository)

    expect(summary.failed).toBe(1)
    expect(jobs[0].status).toBe('failed')
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(archives).toHaveLength(0)
  })
})
