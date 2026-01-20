export type TocEntry = { path: string; label?: string; header?: string }

export type TocConfig = {
  ordered: TocEntry[]
  alias: Map<string, string>
  headers: Map<string, string>
}

// Normalize group slugs by:
// - Collapsing multiple slashes
// - Stripping leading "./"
// - Ensuring trailing slash to denote a group
function normalizeGroup(slug: string) {
  return slug.replace(/\/+/g, '/').replace(/^(\.\/)+/, '').replace(/\/?$/, '/')
}
// Normalize item slugs by:
// - Collapsing multiple slashes
// - Stripping leading "./"
// - Ensuring NO trailing slash (items)
function normalizeItem(slug: string) {
  return slug.replace(/\/+/g, '/').replace(/^(\.\/)+/, '').replace(/\/$/, '')
}

/**
 * Parse a `_toc.ts` module into a normalized config.
 * - Accepts a module with `default` (array) and optional `header` (string) exports
 * - Normalizes paths (groups end with '/', items do not)
 * - Produces:
 *   - `ordered`: normalized entries preserving provided order
 *   - `alias`:   label overrides lookup
 *   - `header`:  optional header text for the group
 */
export function parseTocConfig(mod: unknown): TocConfig {
  const ordered: TocEntry[] = []
  const alias = new Map<string, string>()
  const headers = new Map<string, string>()

  if (!mod) return { ordered, alias, headers }

  const raw = (mod as any)?.default ?? mod

  if (Array.isArray(raw)) {
    for (const e of raw as any[]) {
      if (typeof e === 'string') {
        const isGroup = /\/$/.test(e)
        const p = isGroup ? normalizeGroup(e) : normalizeItem(e)
        ordered.push({ path: p })
      } else if (e && typeof e === 'object') {
        const obj = e as any
        const pathVal = String(obj.path || '')
        if (!pathVal) continue
        const isGroup = /\/$/.test(pathVal)
        const p = isGroup ? normalizeGroup(pathVal) : normalizeItem(pathVal)
        const entry: TocEntry = { path: p }
        if (typeof obj.label === 'string') {
          alias.set(p, obj.label)
          entry.label = obj.label
        }
        if (typeof obj.header === 'string') {
          headers.set(p, obj.header)
          entry.header = obj.header
        }

        ordered.push(entry)
      }
    }
    return { ordered, alias, headers }
  }

  return { ordered, alias, headers }
}
