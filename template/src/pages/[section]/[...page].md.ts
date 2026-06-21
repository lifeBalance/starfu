import type { APIRoute } from 'astro'
import { exportMdxToMarkdown } from '@lib/docs/export-markdown'
import { getDocStaticPaths, resolveDocSourcePath } from '@lib/docs/section'

export function getStaticPaths() {
  return getDocStaticPaths().filter(({ params }) => Boolean(params.page))
}

export const GET: APIRoute = async ({ params }) => {
  const section = params.section
  const page = params.page
  const segment = Array.isArray(page) ? page.join('/') : page

  if (!section || !segment) {
    return new Response('Markdown source not found', { status: 404 })
  }

  const sourcePath = resolveDocSourcePath(section, segment)

  if (!sourcePath) {
    return new Response('Markdown source not found', { status: 404 })
  }

  const markdown = await exportMdxToMarkdown(sourcePath)

  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  })
}
