export type DocsBranch = {
  id?: string
  root: string
  title?: string
  subtitle?: string
  href?: string
}

export type GlobRegistry = Record<string, {
  content: Record<string, any>
  toc: Record<string, any>
}>

const fallbackBranches: DocsBranch[] = [
  { root: '/docs', title: 'Docs', subtitle: '', href: '/docs' },
]

type DocsConfigModule = {
  basePath?: string
  branches?: DocsBranch[]
  title?: string
}

let resolvedConfig: DocsConfigModule = {}
let generatedRegistry: GlobRegistry | undefined

try {
  const mod = await import('virtual:docs-config')
  resolvedConfig = (mod as any).docsConfig ?? {}
} catch (err) {
  resolvedConfig = {}
}

try {
  // Import from project root where paths resolve correctly
  const registry = await import('/docs-registry')
  generatedRegistry = (registry as any).generatedRegistry
} catch (err) {
  generatedRegistry = undefined
}

function normalizeBasePath(raw?: string): string {
  const envBase = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
    ? import.meta.env.BASE_URL
    : '/'
  const base = raw ?? envBase
  const trimmed = base.replace(/\/$/, '')
  return trimmed === '' ? '/' : trimmed
}

const fallbackConfig = {
  basePath: normalizeBasePath(),
  branches: fallbackBranches,
}

function ensureLeadingSlash(path: string): string {
  return path.startsWith('/') ? path : `/${path}`
}

function resolveBranchHref(branch: DocsBranch, basePath?: string): string {
  const id = branch.root.split('/').pop()!
  const sourceHref = branch.href ?? `/${id}`

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(sourceHref)) {
    return sourceHref
  }

  const normalizedBase = normalizeBasePath(basePath)
  const base = normalizedBase === '/' ? '' : normalizedBase

  if (base && sourceHref.startsWith(base)) {
    return sourceHref
  }

  const normalizedHref = ensureLeadingSlash(sourceHref)
  return `${base}${normalizedHref}` || '/'
}

const fallbackRegistry: GlobRegistry = {
  docs: {
    content: import.meta.glob('/docs/**/*.{md,mdx}', { eager: true }),
    toc: import.meta.glob('/docs/**/_toc.ts', { eager: true }),
  },
}

export const docsConfig = {
  basePath: normalizeBasePath(resolvedConfig?.basePath),
  title: resolvedConfig?.title,
  branches: ((resolvedConfig?.branches as DocsBranch[] | undefined) ?? fallbackConfig.branches).map((branch) => ({
    ...branch,
    id: branch.id ?? branch.root.split('/').pop()!,
    title: branch.title ?? branch.root.split('/').pop()!,
    subtitle: branch.subtitle ?? '',
    href: resolveBranchHref(branch, resolvedConfig?.basePath ?? undefined),
  })),
}

export function getGlobRegistry(): GlobRegistry {
  if (generatedRegistry) return generatedRegistry

  return fallbackRegistry
}
