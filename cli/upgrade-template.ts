import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import * as p from '@clack/prompts'

export interface UpgradeTemplateOptions {
  templateDir: string
  outputDir: string
  overwriteAstroConfig?: boolean
}

const UPGRADE_ITEMS = [
  { src: 'ec.config.mjs', dest: '.starfu/ec.config.mjs' },
  { src: 'package.json', dest: '.starfu/package.json' },
  { src: 'src/', dest: '.starfu/src/' },
  { src: 'tsconfig.json', dest: '.starfu/tsconfig.json' },
  { src: 'public/', dest: '.starfu/public/' },
]

const CLEANUP_ITEMS = [
  '.starfu/pnpm-workspace.yaml',
]

async function exists(target: string): Promise<boolean> {
  return fs.access(target).then(() => true, () => false)
}

async function copyItem(templateDir: string, outputDir: string, item: { src: string; dest: string }) {
  const src = path.join(templateDir, item.src)
  const dest = path.join(outputDir, item.dest)

  await fs.rm(dest, { recursive: true, force: true })

  if (item.src.endsWith('/')) {
    await fs.cp(src, dest, { recursive: true })
  } else {
    await fs.mkdir(path.dirname(dest), { recursive: true })
    await fs.copyFile(src, dest)
  }
}

function readConfigValue(content: string, key: string): string | null {
  const match = content.match(new RegExp(`${key}:\\s*process\\.env\\.[A-Z_]+\\s*\\|\\|\\s*['\"]([^'\"]*)['\"]`))
  return match?.[1] ?? null
}

async function writeAstroConfig(templateDir: string, outputDir: string) {
  const dest = path.join(outputDir, '.starfu/astro.config.mjs')
  const current = await fs.readFile(dest, 'utf8').catch(() => '')
  const folderName = path.basename(path.resolve(outputDir))

  const values = {
    title: readConfigValue(current, 'title') ?? folderName,
    platform: readConfigValue(current, 'platform') ?? 'github',
    username: readConfigValue(current, 'username') ?? '',
    repo: readConfigValue(current, 'repo') ?? folderName,
  }

  let content = await fs.readFile(path.join(templateDir, 'astro.config.mjs'), 'utf8')
  content = content.replace(/%%TITLE%%/g, values.title)
  content = content.replace(/%%PLATFORM%%/g, values.platform)
  content = content.replace(/%%USERNAME%%/g, values.username)
  content = content.replace(/%%REPO%%/g, values.repo)

  await fs.writeFile(dest, content, 'utf8')
}

export async function upgradeTemplate({
  templateDir,
  outputDir,
  overwriteAstroConfig = false,
}: UpgradeTemplateOptions) {
  if (!(await exists(templateDir))) {
    throw new Error(`Template directory not found: ${templateDir}`)
  }

  const starfuDir = path.join(outputDir, '.starfu')
  if (!(await exists(starfuDir))) {
    throw new Error('No .starfu/ directory found. Run `starfu` first to scaffold a project.')
  }

  for (const item of UPGRADE_ITEMS) {
    await copyItem(templateDir, outputDir, item)
  }

  for (const item of CLEANUP_ITEMS) {
    await fs.rm(path.join(outputDir, item), { recursive: true, force: true })
  }

  if (overwriteAstroConfig) {
    await writeAstroConfig(templateDir, outputDir)
  }

  return {
    updated: UPGRADE_ITEMS.map((item) => item.dest),
    cleaned: CLEANUP_ITEMS,
    astroConfig: overwriteAstroConfig ? 'overwritten' : 'preserved',
  }
}

export async function runUpgradeTemplate(options: Omit<UpgradeTemplateOptions, 'overwriteAstroConfig'>) {
  p.intro('Starfu Upgrade Template')

  const starfuDir = path.join(options.outputDir, '.starfu')
  if (!(await exists(starfuDir))) {
    p.cancel('No .starfu/ directory found. Run `starfu` first to scaffold a project.')
    return
  }

  p.log.success('Found existing .starfu/')

  let shouldUpgrade = true
  let overwriteAstroConfig = false

  if (process.stdin.isTTY) {
    const answer = await p.confirm({
      message: 'Update Starfu-managed template files?',
      initialValue: true,
    })

    if (p.isCancel(answer) || !answer) {
      p.cancel('Template upgrade cancelled')
      return
    }

    shouldUpgrade = answer

    p.log.warning('.starfu/astro.config.mjs contains project configuration.')
    const configChoice = await p.select({
      message: 'How should astro.config.mjs be handled?',
      options: [
        { value: 'keep', label: 'Keep existing config' },
        { value: 'overwrite', label: 'Overwrite with latest template config' },
      ],
      initialValue: 'keep',
    })

    if (p.isCancel(configChoice)) {
      p.cancel('Template upgrade cancelled')
      return
    }

    overwriteAstroConfig = configChoice === 'overwrite'
  }

  if (!shouldUpgrade) return

  const s = p.spinner()
  s.start('Updating Starfu-managed template files')
  const result = await upgradeTemplate({ ...options, overwriteAstroConfig })
  s.stop('Template upgrade complete')

  for (const item of result.updated) {
    p.log.success(`Updated ${item}`)
  }

  for (const item of result.cleaned) {
    p.log.success(`Removed ${item} if present`)
  }

  if (result.astroConfig === 'overwritten') {
    p.log.success('Updated .starfu/astro.config.mjs')
  } else {
    p.log.info('Preserved .starfu/astro.config.mjs')
  }

  p.outro('Run your package manager install command in .starfu if package.json changed.')
}
