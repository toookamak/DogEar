import { describe, expect, it } from 'vitest'
import { collectMetadataPatches, emptyMetadataPatch, type RaindropLocal } from './raindrop-reconcile.js'
import type { RaindropBookmark } from '../channels/raindrop.js'
import type { TaxonomyIndex } from './raindrop-taxonomy.js'

/**
 * 已有书签的归类回填（2026-10-02）。
 *
 * 起因：用户已有 415 条 Raindrop 书签在库里，再点导入却补不上标签与收藏夹——
 * 原 `emptyMetadataPatch` 只碰 cover/excerpt/domain/raindropId，**完全不碰归类**。
 * 结果就是「重新导入没生效」，而用户无法分辨是没导还是导了不写。
 *
 * 这里钉住两条不可退让的规则：
 * ① 本地为空才回填
 * ② **本地已有归类时绝不覆盖**——本地是工作副本，用户可能手工整理过，
 *    远端那份是旧快照，清空等于毁掉本地工作。
 */

function rd(over: Partial<RaindropBookmark> = {}): RaindropBookmark {
  return {
    _id: 1, link: 'https://e.com/1', title: 't', collection: { $id: 100 },
    tags: ['渲染', '图形学'], created: '', lastUpdate: '', ...over,
  } as RaindropBookmark
}

function index(): TaxonomyIndex {
  return {
    folderByCollectionId: new Map([[100, 'folder-100']]),
    tagIdByNameKey: new Map([['渲染', 'tag-a'], ['图形学', 'tag-b']]),
    collections: 1, foldersCreated: 0, tagNames: 2, tagsCreated: 0, errors: [],
  }
}

function local(over: Partial<RaindropLocal> = {}): RaindropLocal {
  return { id: 'bm-1', url: 'https://e.com/1', raindropId: '1', ...over }
}

describe('emptyMetadataPatch · 收藏夹回填', () => {
  it('本地没有收藏夹时，按远端 collectionId 映射回填', () => {
    const patch = emptyMetadataPatch(local({ folderId: null }), rd(), index())
    expect(patch?.folderId).toBe('folder-100')
  })

  it('本地已有收藏夹时**不覆盖**——本地是工作副本，用户可能手工整理过', () => {
    const patch = emptyMetadataPatch(local({ folderId: 'folder-mine' }), rd(), index())
    expect(patch).not.toHaveProperty('folderId')
  })

  it('没有 taxonomy 映射时不动 folderId（宁可不填，不塞错的）', () => {
    const patch = emptyMetadataPatch(local({ folderId: null }), rd(), undefined)
    expect(patch).not.toHaveProperty('folderId')
  })
})

describe('collectMetadataPatches · 标签回填', () => {
  it('本地一个标签都没挂时，整份回填远端标签', () => {
    const { tagAttachments } = collectMetadataPatches([{ rd: rd(), locals: [local({ tagIds: [] })] }], index())
    expect(tagAttachments).toEqual([{ bookmarkId: 'bm-1', tagIds: ['tag-a', 'tag-b'] }])
  })

  it('本地已有标签时**整份跳过**，既不追加也不清空', () => {
    const { tagAttachments } = collectMetadataPatches([{ rd: rd(), locals: [local({ tagIds: ['tag-mine'] })] }], index())
    expect(tagAttachments).toEqual([])
  })

  it('本地有收藏夹但没标签：只回填标签，不动收藏夹', () => {
    const { metadata, tagAttachments } = collectMetadataPatches(
      [{ rd: rd(), locals: [local({ folderId: 'folder-mine', tagIds: [] })] }], index(),
    )
    expect(tagAttachments).toHaveLength(1)
    expect(metadata[0]).not.toHaveProperty('folderId')
  })

  it('同一条书签被多路匹配（raindropId 与 URL）时只处理一次', () => {
    const { tagAttachments } = collectMetadataPatches(
      [{ rd: rd(), locals: [local({ tagIds: [] }), local({ id: 'bm-1', tagIds: [] })] }], index(),
    )
    expect(tagAttachments).toHaveLength(1)
  })

  it('远端标签在本地映射表里找不到时不挂空数组', () => {
    const empty = index()
    empty.tagIdByNameKey = new Map()
    const { tagAttachments } = collectMetadataPatches([{ rd: rd(), locals: [local({ tagIds: [] })] }], empty)
    expect(tagAttachments).toEqual([])
  })
})
