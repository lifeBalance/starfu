import { readFile } from 'node:fs/promises'
import path from 'node:path'

const IDENT = '[A-Za-z_$][\\w$]*'

type ProtectedBlock = {
  token: string
  content: string
}

/**
 * Converts a .mdx source file into plain Markdown by:
 *   1. Reading every `?raw` import's target file as text.
 *   2. Replacing each <Code .../> with a fenced block of that text.
 *   3. Replacing each <Admonition>...</Admonition> with a > [!TYPE] blockquote.
 *   4. Stripping import lines and frontmatter, since neither means anything
 *      outside the MDX compiler.
 *
 * `sourcePath` must already be a resolved, absolute filesystem path to the
 * .mdx file — resolving a docs *route* (e.g. "/concurrency/mutexes") down to
 * that path is the caller's job (see section.ts / docsRoot config), not this
 * function's. Don't guess at that mapping here.
 *
 * Deliberately not a full MDX parser — just enough string surgery to handle
 * the patterns our docs actually use.
 */
export async function exportMdxToMarkdown(sourcePath: string): Promise<string> {
  const dir = path.dirname(sourcePath)
  let source = await readFile(sourcePath, 'utf8')

  source = stripFrontmatter(source)

  const { protectedSource, blocks } = protectFences(source)
  source = protectedSource
  const { protectedSource: inlineProtectedSource, blocks: inlineBlocks } = protectInlineCode(source)
  source = inlineProtectedSource

  // Step 1: read every `?raw` import's target file as text, keyed by its
  // imported variable name. e.g.
  //   import bankAccount from './code/bankaccount/main.go?raw'
  // becomes: rawFiles['bankAccount'] = '<contents of main.go>'
  const rawFiles: Record<string, string> = {}
  const importPattern = new RegExp(
    `^import\\s+(${IDENT})\\s+from\\s+['"]([^'"]+\\?raw)['"];?\\s*$`,
    'gm'
  )

  for (const [, varName, filePath] of source.matchAll(importPattern)) {
    rawFiles[varName] = await readFile(
      path.resolve(dir, filePath.replace(/\?raw$/, '')),
      'utf8'
    )
  }

  // Step 2: replace <Code .../> with the actual file contents, fenced.
  // Attribute order isn't assumed — code/lang/title are each pulled out
  // independently, so `<Code title="x" code={y} lang="go" />` works the
  // same as `<Code code={y} lang="go" title="x" />`.
  source = source.replace(/<Code\b([^>]*)\/>/gs, (full, attrs: string) => {
    const varName = getExpressionAttr(attrs, 'code')
    if (!varName) return full

    const code = rawFiles[varName]
    if (code === undefined) return full

    const lang = getStringAttr(attrs, 'lang') ?? ''
    const title = getStringAttr(attrs, 'title')
    const fence = fenceFor(code)
    const titleLine = title ? `\`${title}\`\n\n` : ''

    return `${titleLine}${fence}${lang}\n${code.trimEnd()}\n${fence}`
  })

  // Replace <Admonition ...>...</Admonition> with a > [!TYPE] blockquote.
  // Maps both `variant` and `type` props (Admonition.astro accepts either),
  // and preserves an explicit `title` if one was given.
  source = source.replace(
    /<Admonition\b([^>]*)>([\s\S]*?)<\/Admonition>/g,
    (_match, attrs: string, body: string) => {
      const tag = alertTypeFromAttrs(attrs)
      const title = getStringAttr(attrs, 'title')
      const quoted = body
        .trim()
        .split(/\r?\n/)
        .map((line) => (line ? `> ${line}` : '>'))
        .join('\n')
      const titleLine = title ? `> **${title}**\n>\n` : ''

      return `> [!${tag}]\n${titleLine}${quoted}\n`
    }
  )

  // Strip remaining import lines — meaningless outside MDX.
  source = source.replace(/^import .+ from .+;?$/gm, '')
  source = restoreProtectedBlocks(source, inlineBlocks)
  source = restoreFences(source, blocks)

  return source.trim() + '\n'
}

function stripFrontmatter(source: string): string {
  return source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
}

function protectFences(source: string): { protectedSource: string; blocks: ProtectedBlock[] } {
  const blocks: ProtectedBlock[] = []

  const protectedSource = source.replace(
    /(^|\n)(`{3,}|~{3,})[\s\S]*?\n\2(?=\n|$)/g,
    (match, prefix: string) => {
      const token = `__STARFU_MARKDOWN_FENCE_${blocks.length}__`
      blocks.push({ token, content: match.slice(prefix.length) })
      return `${prefix}${token}`
    }
  )

  return { protectedSource, blocks }
}

function restoreFences(source: string, blocks: ProtectedBlock[]): string {
  return restoreProtectedBlocks(source, blocks)
}

function protectInlineCode(source: string): { protectedSource: string; blocks: ProtectedBlock[] } {
  const blocks: ProtectedBlock[] = []

  const protectedSource = source.replace(/`+[^`\n]+`+/g, (content) => {
    const token = `__STARFU_MARKDOWN_INLINE_${blocks.length}__`
    blocks.push({ token, content })
    return token
  })

  return { protectedSource, blocks }
}

function restoreProtectedBlocks(source: string, blocks: ProtectedBlock[]): string {
  return blocks.reduce(
    (current, block) => current.replace(block.token, block.content),
    source
  )
}

/** Extracts a string-literal attr value: name="..." or name='...' */
function getStringAttr(attrs: string, name: string): string | null {
  return (
    attrs.match(new RegExp(`${name}="([^"]*)"`))?.[1] ??
    attrs.match(new RegExp(`${name}='([^']*)'`))?.[1] ??
    null
  )
}

/** Extracts a JSX expression attr value: name={identifier} */
function getExpressionAttr(attrs: string, name: string): string | null {
  return attrs.match(new RegExp(`${name}=\\{\\s*(${IDENT})\\s*\\}`))?.[1] ?? null
}

/**
 * Picks a fence of backticks long enough that it can't collide with any
 * backtick run already inside the code (rare for Go, but cheap to guard).
 */
function fenceFor(code: string): string {
  const runs = code.match(/`+/g) ?? []
  const longest = runs.reduce((max, run) => Math.max(max, run.length), 0)
  return '`'.repeat(Math.max(3, longest + 1))
}

/** Maps Admonition's `variant`/`type` props to a GFM alert tag. */
function alertTypeFromAttrs(attrs: string): string {
  const variant = getStringAttr(attrs, 'variant') ?? getStringAttr(attrs, 'type') ?? 'note'

  switch (variant) {
    case 'tip':
      return 'TIP'
    case 'warning':
      return 'WARNING'
    case 'error':
      return 'CAUTION'
    case 'important':
      return 'IMPORTANT'
    case 'info':
    case 'note':
    default:
      return 'NOTE'
  }
}
