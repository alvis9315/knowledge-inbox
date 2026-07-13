import type { Entry, Json } from '@inbox/shared-types'

/** An entry joined with its tag names — the shape the UI works with. */
export interface EntryWithTags extends Entry {
  tags: string[]
}

/** Filters applied to the card wall. */
export interface EntryFilters {
  search: string
  domain: string | null
  type: string | null
  tag: string | null
}

/** Payload for create/update (tags handled separately via entry_tags). */
export interface EntryInput {
  title: string
  type: string | null
  summary: string | null
  content: string | null
  source_url: string | null
  attrs: Json
  status: 'filed' | 'pending_review'
  tags: string[]
}

export const emptyFilters = (): EntryFilters => {
  return { search: '', domain: null, type: null, tag: null }
}

export type SortMode = 'manual' | 'newest' | 'title'
export type ViewMode = 'card' | 'list' | 'masonry'

export interface PageQuery {
  type: string
  search: string
  sort: SortMode
  page: number
  pageSize: number
  tag?: string | null
  includeClosed?: boolean
}

export interface PageResult {
  rows: EntryWithTags[]
  total: number
}
