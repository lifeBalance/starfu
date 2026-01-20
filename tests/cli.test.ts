import { tmpdir } from 'node:os'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import * as path from 'node:path'
import { describe, it, expect } from 'vitest'
import { run } from '../cli/cli'

async function createTempDir() {
  return mkdtemp(path.join(tmpdir(), 'starfu-cli-test-'))
}

async function cleanup(dir: string) {
  await rm(dir, { recursive: true, force: true })
}

describe('cli run', () => {
  it('scaffolds into target directory', async () => {
    const tempDir = await createTempDir()
    try {
      await run(['node', 'cli', '--dir', tempDir, '--title', 'Test Site'])
    } finally {
      await cleanup(tempDir)
    }
  })

  it('supports --force to overwrite an existing scaffold', async () => {
    const tempDir = await createTempDir()
    try {
      await run(['node', 'cli', '--dir', tempDir, '--title', 'Test Site'])
      await expect(run(['node', 'cli', '--dir', tempDir, '--title', 'Test Site'])).rejects.toThrow()

      await run(['node', 'cli', '--dir', tempDir, '--force', '--title', 'Test Site'])
    } finally {
      await cleanup(tempDir)
    }
  })

  it('writes title to astro.config.mjs', async () => {
    const tempDir = await createTempDir()
    try {
      await run(['node', 'cli', '--dir', tempDir, '--title', 'My Custom Title'])

      const astroConfigPath = path.join(tempDir, '.starfu', 'astro.config.mjs')
      const content = await readFile(astroConfigPath, 'utf8')

      expect(content).toContain("'My Custom Title'")
    } finally {
      await cleanup(tempDir)
    }
  })
})
