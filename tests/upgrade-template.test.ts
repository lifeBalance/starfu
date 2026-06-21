import { tmpdir } from 'node:os'
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import * as path from 'node:path'
import { describe, it, expect } from 'vitest'
import { scaffold } from '../cli/scaffold'
import { upgradeTemplate } from '../cli/upgrade-template'

const TEMPLATE_ROOT = path.join(process.cwd(), 'template')

const defaultOptions = {
  platform: 'github' as const,
  username: 'test-user',
  repo: 'test-repo',
}

async function createTempDir() {
  return mkdtemp(path.join(tmpdir(), 'starfu-upgrade-test-'))
}

async function cleanup(dir: string) {
  await rm(dir, { recursive: true, force: true })
}

async function exists(target: string) {
  try {
    await stat(target)
    return true
  } catch {
    return false
  }
}

describe('upgradeTemplate', () => {
  it('updates Starfu-managed template files', async () => {
    const tempDir = await createTempDir()
    try {
      await scaffold({ templateDir: TEMPLATE_ROOT, outputDir: tempDir, ...defaultOptions })

      const componentPath = path.join(tempDir, '.starfu/src/components/DocsToc.astro')
      await writeFile(componentPath, 'stale component', 'utf8')

      await upgradeTemplate({ templateDir: TEMPLATE_ROOT, outputDir: tempDir })

      const upgraded = await readFile(componentPath, 'utf8')
      expect(upgraded).not.toBe('stale component')
      expect(upgraded).toContain('data-docs-toc-link')
    } finally {
      await cleanup(tempDir)
    }
  })

  it('does not touch docs content', async () => {
    const tempDir = await createTempDir()
    try {
      await scaffold({ templateDir: TEMPLATE_ROOT, outputDir: tempDir, ...defaultOptions })

      const docsPath = path.join(tempDir, 'docs/tutorial/intro.mdx')
      const customDocs = '# My Project Docs\n\nDo not overwrite this.'
      await writeFile(docsPath, customDocs, 'utf8')

      await upgradeTemplate({ templateDir: TEMPLATE_ROOT, outputDir: tempDir })

      expect(await readFile(docsPath, 'utf8')).toBe(customDocs)
    } finally {
      await cleanup(tempDir)
    }
  })

  it('removes invalid pnpm workspace config from existing projects', async () => {
    const tempDir = await createTempDir()
    try {
      await scaffold({ templateDir: TEMPLATE_ROOT, outputDir: tempDir, ...defaultOptions })

      const workspacePath = path.join(tempDir, '.starfu/pnpm-workspace.yaml')
      await writeFile(workspacePath, 'allowBuilds:\n  esbuild: true\n', 'utf8')

      await upgradeTemplate({ templateDir: TEMPLATE_ROOT, outputDir: tempDir })

      expect(await exists(workspacePath)).toBe(false)
    } finally {
      await cleanup(tempDir)
    }
  })

  it('preserves astro.config.mjs by default', async () => {
    const tempDir = await createTempDir()
    try {
      await scaffold({ templateDir: TEMPLATE_ROOT, outputDir: tempDir, ...defaultOptions })

      const configPath = path.join(tempDir, '.starfu/astro.config.mjs')
      const customConfig = '// custom astro config\nexport default {}\n'
      await writeFile(configPath, customConfig, 'utf8')

      await upgradeTemplate({ templateDir: TEMPLATE_ROOT, outputDir: tempDir })

      expect(await readFile(configPath, 'utf8')).toBe(customConfig)
      expect(await exists(`${configPath}.bak`)).toBe(false)
    } finally {
      await cleanup(tempDir)
    }
  })

  it('overwrites astro.config.mjs when explicitly requested', async () => {
    const tempDir = await createTempDir()
    try {
      await scaffold({
        templateDir: TEMPLATE_ROOT,
        outputDir: tempDir,
        platform: 'github',
        username: 'my-user',
        repo: 'my-docs',
      })

      const configPath = path.join(tempDir, '.starfu/astro.config.mjs')
      await writeFile(configPath, `
const starfuConfig = {
  title: process.env.STARFU_TITLE || 'Custom Title',
  platform: process.env.STARFU_PLATFORM || 'gitlab',
  username: process.env.STARFU_USERNAME || 'custom-user',
  repo: process.env.STARFU_REPO || 'custom-repo',
}
`, 'utf8')

      await upgradeTemplate({ templateDir: TEMPLATE_ROOT, outputDir: tempDir, overwriteAstroConfig: true })

      const upgraded = await readFile(configPath, 'utf8')
      const backup = await readFile(`${configPath}.bak`, 'utf8')
      expect(upgraded).toContain("title: process.env.STARFU_TITLE || 'Custom Title'")
      expect(upgraded).toContain("platform: process.env.STARFU_PLATFORM || 'gitlab'")
      expect(upgraded).toContain("username: process.env.STARFU_USERNAME || 'custom-user'")
      expect(upgraded).toContain("repo: process.env.STARFU_REPO || 'custom-repo'")
      expect(backup).toContain("title: process.env.STARFU_TITLE || 'Custom Title'")
      expect(backup).toContain("platform: process.env.STARFU_PLATFORM || 'gitlab'")
      expect(backup).toContain("username: process.env.STARFU_USERNAME || 'custom-user'")
      expect(backup).toContain("repo: process.env.STARFU_REPO || 'custom-repo'")
    } finally {
      await cleanup(tempDir)
    }
  })

  it('overwrites existing astro.config.mjs.bak with the latest pre-overwrite config', async () => {
    const tempDir = await createTempDir()
    try {
      await scaffold({ templateDir: TEMPLATE_ROOT, outputDir: tempDir, ...defaultOptions })

      const configPath = path.join(tempDir, '.starfu/astro.config.mjs')
      await writeFile(`${configPath}.bak`, 'old backup', 'utf8')
      const customConfig = `
const starfuConfig = {
  title: process.env.STARFU_TITLE || 'Latest Custom Title',
  platform: process.env.STARFU_PLATFORM || 'github',
  username: process.env.STARFU_USERNAME || 'latest-user',
  repo: process.env.STARFU_REPO || 'latest-repo',
}
`
      await writeFile(configPath, customConfig, 'utf8')

      await upgradeTemplate({ templateDir: TEMPLATE_ROOT, outputDir: tempDir, overwriteAstroConfig: true })

      expect(await readFile(`${configPath}.bak`, 'utf8')).toBe(customConfig)
    } finally {
      await cleanup(tempDir)
    }
  })

  it('throws if .starfu does not exist', async () => {
    const tempDir = await createTempDir()
    try {
      await mkdir(path.join(tempDir, 'docs'), { recursive: true })

      await expect(upgradeTemplate({ templateDir: TEMPLATE_ROOT, outputDir: tempDir })).rejects.toThrow(
        'No .starfu/ directory found'
      )
    } finally {
      await cleanup(tempDir)
    }
  })
})
