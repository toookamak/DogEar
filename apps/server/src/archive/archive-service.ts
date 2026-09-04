import type { BookmarkRepository } from '@dogear/db'
import { randomUUID } from 'node:crypto'

export type ArchiveJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

export interface ArchiveJob {
  id: string
  bookmarkId: string
  type: 'snapshot' | 'reader' | 'metadata'
  status: ArchiveJobStatus
  filePath?: string
  fileSize?: number
  mimeType?: string
  error?: string
  metadata?: string
  createdAt: number
  completedAt?: number
}

export class ArchiveJobService {
  constructor(private repository: BookmarkRepository) {}

  async createJob(
    bookmarkId: string,
    type: 'snapshot' | 'reader' | 'metadata' = 'snapshot'
  ): Promise<ArchiveJob> {
    const id = randomUUID()
    const job = await this.repository.archives.create({
      id,
      bookmarkId,
      type,
      status: 'pending',
    })
    return job as ArchiveJob
  }

  async getJob(id: string): Promise<ArchiveJob | undefined> {
    const job = await this.repository.archives.get(id)
    return job as ArchiveJob | undefined
  }

  async getJobsByBookmark(bookmarkId: string): Promise<ArchiveJob[]> {
    const jobs = await this.repository.archives.listByBookmark(bookmarkId)
    return jobs as ArchiveJob[]
  }

  async processPending(): Promise<ArchiveJob | null> {
    const pending = await this.repository.archives.listPending(1)
    if (pending.length === 0) return null

    const job = pending[0] as ArchiveJob
    await this.repository.archives.updateStatus(job.id, 'processing')
    return job
  }

  async retryJob(id: string): Promise<ArchiveJob | undefined> {
    const existing = await this.getJob(id)
    if (!existing) return undefined

    if (existing.status !== 'failed') {
      throw new Error('Only failed jobs can be retried')
    }

    return this.repository.archives.updateStatus(id, 'pending') as Promise<ArchiveJob>
  }

  async cancelJob(id: string): Promise<ArchiveJob | undefined> {
    const existing = await this.getJob(id)
    if (!existing) return undefined

    if (!['pending', 'processing'].includes(existing.status)) {
      throw new Error('Only pending or running jobs can be cancelled')
    }

    return this.repository.archives.updateStatus(id, 'cancelled') as Promise<ArchiveJob>
  }
}
