import type { EntryWithTags } from '@/features/entries/types'

export type ExportFormat = 'md' | 'json' | 'excel'

function download(filename: string, content: BlobPart, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function attrsObject(e: EntryWithTags): Record<string, unknown> {
  const a = e.attrs
  return a && typeof a === 'object' && !Array.isArray(a) ? (a as Record<string, unknown>) : {}
}

function toMarkdown(entries: EntryWithTags[]): string {
  return entries
    .map((e) => {
      const attrs = attrsObject(e)
      const fm = [
        '---',
        `title: ${JSON.stringify(e.title)}`,
        `type: ${e.type ?? ''}`,
        `tags: [${e.tags.join(', ')}]`,
        e.source_url ? `source_url: ${e.source_url}` : null,
        `status: ${e.status}`,
        `created_at: ${e.created_at}`,
        ...Object.entries(attrs).map(([k, v]) => `${k}: ${JSON.stringify(v)}`),
        '---',
      ]
        .filter(Boolean)
        .join('\n')
      const body = [e.summary, e.content].filter(Boolean).join('\n\n')
      return `${fm}\n\n${body}\n`
    })
    .join('\n\n')
}

async function toExcel(entries: EntryWithTags[], filename: string) {
  // Lazy-load SheetJS only when Excel export is actually used.
  const XLSX = await import('xlsx')
  const rows = entries.map((e) => ({
    id: e.id,
    title: e.title,
    type: e.type ?? '',
    summary: e.summary ?? '',
    content: e.content ?? '',
    source_url: e.source_url ?? '',
    status: e.status,
    tags: e.tags.join(', '),
    created_at: e.created_at,
    ...attrsObject(e),
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'entries')
  XLSX.writeFile(wb, filename)
}

export function useExport() {
  async function exportEntries(format: ExportFormat, entries: EntryWithTags[], baseName: string) {
    const safe = baseName.replace(/[^\w一-龥-]+/g, '_') || 'knowledge-inbox'
    if (format === 'json') {
      download(`${safe}.json`, JSON.stringify(entries, null, 2), 'application/json')
    } else if (format === 'md') {
      download(`${safe}.md`, toMarkdown(entries), 'text/markdown')
    } else {
      await toExcel(entries, `${safe}.xlsx`)
    }
  }
  return { exportEntries }
}
