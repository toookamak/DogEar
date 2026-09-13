import { mapRaindropBookmark, type RaindropBookmark } from '../channels/raindrop.js'

export type RaindropLocal = {
  id: string
  url?: string | null
  cover?: string | null
  excerpt?: string | null
  domain?: string | null
  raindropId?: string | null
  raindropExtras?: string | null
}

function nonempty(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

/** 按 raindropId 优先、其次 URL，把远端条目对应到已有本地行；都没有才算新书签。 */
export function partitionRaindropItems(
  items: RaindropBookmark[],
  locals: RaindropLocal[],
): { fresh: RaindropBookmark[]; matched: Array<{ rd: RaindropBookmark; locals: RaindropLocal[] }> } {
  const byId = new Map<string, RaindropLocal[]>()
  const byUrl = new Map<string, RaindropLocal[]>()
  for (const row of locals) {
    if (row.raindropId) {
      const list = byId.get(String(row.raindropId)) ?? []
      list.push(row)
      byId.set(String(row.raindropId), list)
    }
    if (row.url) {
      const list = byUrl.get(row.url) ?? []
      list.push(row)
      byUrl.set(row.url, list)
    }
  }

  const fresh: RaindropBookmark[] = []
  const matched: Array<{ rd: RaindropBookmark; locals: RaindropLocal[] }> = []
  for (const rd of items) {
    const seen = new Set<string>()
    const rows: RaindropLocal[] = []
    for (const row of byId.get(String(rd._id)) ?? []) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      rows.push(row)
    }
    for (const row of byUrl.get(rd.link) ?? []) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      rows.push(row)
    }
    if (rows.length === 0) fresh.push(rd)
    else matched.push({ rd, locals: rows })
  }
  return { fresh, matched }
}

/** 只补空字段（封面/简介/raindropId 等），不覆盖用户已改的标题。 */
export function emptyMetadataPatch(existing: RaindropLocal, rd: RaindropBookmark): { id: string } & Record<string, unknown> | null {
  const mapped = mapRaindropBookmark(rd)
  const patch: Record<string, unknown> = {}
  if (!nonempty(existing.cover) && mapped.cover) patch.cover = mapped.cover
  if (!nonempty(existing.excerpt) && mapped.excerpt) patch.excerpt = mapped.excerpt
  if (!nonempty(existing.domain) && mapped.domain) patch.domain = mapped.domain
  if (!nonempty(existing.raindropId)) patch.raindropId = mapped.raindropId
  const extrasLackCover = (() => {
    if (!nonempty(existing.raindropExtras)) return true
    try {
      const extras = JSON.parse(String(existing.raindropExtras)) as { cover?: unknown; media?: unknown }
      return !nonempty(extras.cover) && !Array.isArray(extras.media)
    } catch {
      return true
    }
  })()
  if (extrasLackCover && mapped.raindropExtras) patch.raindropExtras = mapped.raindropExtras
  if (Object.keys(patch).length === 0) return null
  return { id: existing.id, ...patch }
}

export function collectMetadataPatches(
  matched: Array<{ rd: RaindropBookmark; locals: RaindropLocal[] }>,
): Array<{ id: string } & Record<string, unknown>> {
  const patches: Array<{ id: string } & Record<string, unknown>> = []
  const seen = new Set<string>()
  for (const { rd, locals } of matched) {
    for (const row of locals) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      const patch = emptyMetadataPatch(row, rd)
      if (patch) patches.push(patch)
    }
  }
  return patches
}
