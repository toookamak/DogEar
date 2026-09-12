import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createMonolithSnapshotProcessor } from './snapshot-monolith.js'

/**
 * monolith 执行器的可离线验证部分：
 * - 二进制缺失（本机未装 monolith）→ 明确报错且 Job/记录进入 failed 态，不静默成功
 * - 非 snapshot 类型 Job → failed（无执行器）
 * 真实抓取路径需要外网 + 已安装的 monolith，属部署侧人工验收。
 */

function makeRepo(jobs: Array<Record<string, any>>) {
  const archives: Array<Record<string, unknown>> = []
  const repository: any = {
    archiveJobs: {
      list: async () => jobs,
      get: async (id: string) => jobs.find((j) => j.id === id),
      create: async (input: Record<string, unknown>) => input,
      update: async (id: string, input: Record<string, unknown>) => {
        const job = jobs.find((j) => j.id === id)
        if (job) Object.assign(job, input)
        return job
      },
      getStatus: async (id: string) => jobs.find((j) => j.id === id)?.status,
    },
    get: async () => ({ id: 'bm-1', url: 'https://example.com/' }),
    archives: {
      create: async (input: Record<string, unknown>) => {
        archives.push(input)
        return input
      },
      updateStatus: async (id: string, status: string, patch?: Record<string, unknown>) => {
        const row = archives.find((a) => a.id === id)
        if (row) Object.assign(row, { status }, patch ?? {})
        return row
      },
    },
  }
  return { repository, archives }
}

describe('monolith 快照执行器（L3，Track B）', () => {
  it('binary missing → job fails with an actionable error (no silent success)', async () => {
    const jobs: Array<Record<string, any>> = [{ id: 'job-1', bookmarkId: 'bm-1', type: 'snapshot', status: 'pending' }]
    const { repository, archives } = makeRepo(jobs)
    // DOGEAR_MONOLITH_BIN 指向必然不存在的路径，确保走 ENOENT 分支
    const processor = createMonolithSnapshotProcessor(repository, {
      snapshotsDir: mkdtempSync(join(tmpdir(), 'mono-')),
      timeoutMs: 2000,
    })
    process.env.DOGEAR_MONOLITH_BIN = 'definitely-not-monolith-xyz'
    const summary = await processor(5)
    delete process.env.DOGEAR_MONOLITH_BIN
    expect(summary).toMatchObject({ processed: 1, succeeded: 0, failed: 1 })
    expect(jobs[0].status).toBe('failed')
    expect(String(jobs[0].error)).toContain('monolith binary not found')
    expect(archives.some((a) => a.status === 'failed')).toBe(true)
  })

  it('non-snapshot job type fails fast without spawning anything', async () => {
    const jobs: Array<Record<string, any>> = [{ id: 'job-2', bookmarkId: 'bm-1', type: 'reader', status: 'pending' }]
    const { repository, archives } = makeRepo(jobs)
    const processor = createMonolithSnapshotProcessor(repository, {
      snapshotsDir: mkdtempSync(join(tmpdir(), 'mono-')),
    })
    const summary = await processor(5)
    expect(summary.failed).toBe(1)
    expect(jobs[0].status).toBe('failed')
    expect(String(jobs[0].error)).toContain('No executor')
    expect(archives).toHaveLength(0)
  })
})
