import { tmpdir } from 'node:os'
import { mkdtemp, rm, stat, readdir, readFile } from 'node:fs/promises'
import * as path from 'node:path'
import { describe, it, expect } from 'vitest'
import { scaffold } from '../cli/scaffold'

const TEMPLATE_ROOT = path.join(process.cwd(), 'template')

const defaultOptions = {
  platform: 'github' as const,
  username: 'test-user',
  repo: 'test-repo',
}

async function createTempDir() {
  return mkdtemp(path.join(tmpdir(), 'starfu-test-'))
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

describe('scaffold', () => {
  it('copies template files', async () => {
    const tempDir = await createTempDir()
    try {
      await scaffold({ templateDir: TEMPLATE_ROOT, outputDir: tempDir, ...defaultOptions })

      const expectedPaths = [
        path.join(tempDir, '.starfu'),
        path.join(tempDir, 'docs'),
      ]

      for (const entry of expectedPaths) {
        expect(await exists(entry)).toBe(true)
      }
    } finally {
      await cleanup(tempDir)
    }
  })

  it('refuses to overwrite without force', async () => {
    const tempDir = await createTempDir()
    try {
      await scaffold({ templateDir: TEMPLATE_ROOT, outputDir: tempDir, ...defaultOptions })

      await expect(scaffold({ templateDir: TEMPLATE_ROOT, outputDir: tempDir, ...defaultOptions })).rejects.toThrow()
    } finally {
      await cleanup(tempDir)
    }
  })

  it('overwrites when force is true', async () => {
    const tempDir = await createTempDir()
    try {
      await scaffold({ templateDir: TEMPLATE_ROOT, outputDir: tempDir, ...defaultOptions })
      await scaffold({ templateDir: TEMPLATE_ROOT, outputDir: tempDir, ...defaultOptions, force: true })

      const entries = await readdir(tempDir)
      expect(entries.length).toBeGreaterThan(0)
    } finally {
      await cleanup(tempDir)
    }
  })

  it('replaces placeholders in astro.config.mjs for GitHub', async () => {
    const tempDir = await createTempDir()
    try {
      await scaffold({
        templateDir: TEMPLATE_ROOT,
        outputDir: tempDir,
        platform: 'github',
        username: 'my-user',
        repo: 'my-docs',
      })

      const astroConfigPath = path.join(tempDir, '.starfu', 'astro.config.mjs')
      const astroConfigContent = await readFile(astroConfigPath, 'utf8')

      expect(astroConfigContent).toContain("platform: process.env.STARFU_PLATFORM || 'github'")
      expect(astroConfigContent).toContain("username: process.env.STARFU_USERNAME || 'my-user'")
      expect(astroConfigContent).toContain("repo: process.env.STARFU_REPO || 'my-docs'")
    } finally {
      await cleanup(tempDir)
    }
  })

  it('replaces placeholders in astro.config.mjs for GitLab', async () => {
    const tempDir = await createTempDir()
    try {
      await scaffold({
        templateDir: TEMPLATE_ROOT,
        outputDir: tempDir,
        platform: 'gitlab',
        username: 'gitlab-user',
        repo: 'gitlab-docs',
      })

      const astroConfigPath = path.join(tempDir, '.starfu', 'astro.config.mjs')
      const astroConfigContent = await readFile(astroConfigPath, 'utf8')

      expect(astroConfigContent).toContain("platform: process.env.STARFU_PLATFORM || 'gitlab'")
      expect(astroConfigContent).toContain("username: process.env.STARFU_USERNAME || 'gitlab-user'")
      expect(astroConfigContent).toContain("repo: process.env.STARFU_REPO || 'gitlab-docs'")
    } finally {
      await cleanup(tempDir)
    }
  })
})
