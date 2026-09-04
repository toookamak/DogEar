import type { BookmarkRepository } from '@dogear/db'
import { randomUUID } from 'node:crypto'

export type ArchiveJobStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled'

export interface ArchiveJob {
  id: string
  bookmarkId: string
  type: string
  source?: string
  status: ArchiveJobStatus
  error?: string | null
  retryCount?: number
  createdAt: unknown
  updatedAt?: unknown
}

function asJob(row: unknown): ArchiveJob | undefined {
  if (!row || typeof row !== 'object') return undefined
  const job = row as ArchiveJob
  if (job.status === ('processing' as string)) job.status = 'running'
  if (job.status === ('completed' as string)) job.status = 'succeeded'
  return job
}

export class ArchiveJobService {
  constructor(private repository: BookmarkRepository) {}

  async createJob(
    bookmarkId: string,
    type: 'snapshot' | 'reader' | 'metadata' = 'snapshot',
  ): Promise<ArchiveJob> {
    const id = randomUUID()
    const job = await this.repository.archiveJobs.create({
      id,
      bookmarkId,
      type,
      source: 'manual',
      status: 'pending',
    })
    return asJob(job) as ArchiveJob
  }

  async getJob(id: string): Promise<ArchiveJob | undefined> {
    return asJob(await this.repository.archiveJobs.get(id))
  }

  async getJobsByBookmark(bookmarkId: string): Promise<ArchiveJob[]> {
    const jobs = await this.repository.archiveJobs.list(bookmarkId)
    return jobs.map((row) => asJob(row)).filter(Boolean) as ArchiveJob[]
  }

  async retryJob(id: string): Promise<ArchiveJob | undefined> {
    const existing = await this.getJob(id)
    if (!existing) return undefined
    if (existing.status !== 'failed') {
      throw new Error('Only failed jobs can be retried')
    }
    return asJob(await this.repository.archiveJobs.update(id, { status: 'pending' }))
  }

  async cancelJob(id: string): Promise<ArchiveJob | undefined> {
    const existing = await this.getJob(id)
    if (!existing) return undefined
    if (!['pending', 'running'].includes(existing.status)) {
      throw new Error('Only pending or running jobs can be cancelled')
    }
    return asJob(await this.repository.archiveJobs.update(id, { status: 'cancelled' }))
  }
}
