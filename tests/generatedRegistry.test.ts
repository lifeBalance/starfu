import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, readFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { scaffold } from '../cli/scaffold'

const TEMPLATE_ROOT = path.join(process.cwd(), 'template')

async function createTempDir() {
  return mkdtemp(path.join(tmpdir(), 'starfu-registry-test-'))
}

async function cleanup(dir: string) {
  await rm(dir, { recursive: true, force: true })
}

describe('generated registry', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await createTempDir()
  })

  afterEach(async () => {
    await cleanup(tempDir)
  })

  it('scaffolds docs-registry.ts placeholder', async () => {
    await scaffold({ templateDir: TEMPLATE_ROOT, outputDir: tempDir })

    const registryPath = path.join(tempDir, '.starfu', 'docs-registry.ts')
    const content = await readFile(registryPath, 'utf8')

    expect(content).toContain('generatedRegistry')
    expect(content).toContain('Auto-generated')
  })

  it('docs-registry.ts is at project root for correct path resolution', async () => {
    await scaffold({ templateDir: TEMPLATE_ROOT, outputDir: tempDir })

    // The file should be at .starfu/docs-registry.ts (Astro project root)
    // NOT at .starfu/src/lib/docs/generated-registry.ts
    const registryPath = path.join(tempDir, '.starfu', 'docs-registry.ts')
    const content = await readFile(registryPath, 'utf8')

    expect(content).toBeDefined()

    // The deeper path should NOT exist
    const deepPath = path.join(tempDir, '.starfu', 'src', 'lib', 'docs', 'generated-registry.ts')
    await expect(readFile(deepPath, 'utf8')).rejects.toThrow()
  })
})
