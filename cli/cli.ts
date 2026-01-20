#!/usr/bin/env node

import process from 'node:process'
import * as path from 'node:path'
import { realpathSync, existsSync } from 'node:fs'
import { execa } from 'execa'
import * as p from '@clack/prompts'
import { scaffold, getGitInfo } from './scaffold.js'
import { runDeploy } from './deploy.js'

type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun'

function detectPackageManager(cwd: string): PackageManager {
  // First check if invoked via a package manager (pnpm dlx, npx, etc.)
  const userAgent = process.env.npm_config_user_agent
  if (userAgent) {
    if (userAgent.startsWith('pnpm')) return 'pnpm'
    if (userAgent.startsWith('yarn')) return 'yarn'
    if (userAgent.startsWith('bun')) return 'bun'
    if (userAgent.startsWith('npm')) return 'npm'
  }

  // Fallback: check for lockfiles in the target directory
  if (existsSync(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(path.join(cwd, 'yarn.lock'))) return 'yarn'
  if (existsSync(path.join(cwd, 'bun.lockb'))) return 'bun'
  if (existsSync(path.join(cwd, 'package-lock.json'))) return 'npm'

  // Default to pnpm if available, otherwise npm
  return 'pnpm'
}

function getRunCommand(pm: PackageManager, script: string): [string, string[]] {
  if (pm === 'npm') return ['npm', ['run', script]]
  return [pm, [script]]
}

function getInstallCommand(pm: PackageManager): [string, string[]] {
  return [pm, ['install']]
}

interface CliOptions {
  command: 'init' | 'deploy'
  dir?: string
  force?: boolean
  title?: string
}

function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2)
  const options: CliOptions = { command: 'init' }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === 'deploy') {
      options.command = 'deploy'
    } else if (arg === '--dir') {
      options.dir = args[++i]
    } else if (arg.startsWith('--dir=')) {
      options.dir = arg.split('=')[1]
    } else if (arg === '--force') {
      options.force = true
    } else if (arg === '--title') {
      options.title = args[++i]
    } else if (arg.startsWith('--title=')) {
      options.title = arg.split('=')[1]
    }
  }

  return options
}

export async function run(argv: string[] = process.argv) {
  const options = parseArgs(argv)
  const cwd = process.cwd()

  // Handle deploy subcommand
  if (options.command === 'deploy') {
    await runDeploy(cwd)
    return
  }

  const cliDir = path.dirname(new URL(import.meta.url).pathname)
  const templateDir = path.join(cliDir, '..', 'template')
  const outputDir = options.dir ? path.resolve(cwd, options.dir) : cwd
  const starfuDir = path.join(outputDir, '.starfu')

  const pm = detectPackageManager(outputDir)
  const runCmd = (script: string) => getRunCommand(pm, script)
  const installCmd = getInstallCommand(pm)

  p.intro('Starfu')

  // Detect git info, fallback to folder name
  const gitInfo = await getGitInfo(outputDir)
  const folderName = path.basename(path.resolve(outputDir))

  const platform = gitInfo?.platform ?? 'github'
  const username = gitInfo?.username ?? ''
  const repo = gitInfo?.repo ?? folderName

  // Prompt for site title (skip if provided via --title flag)
  let title = options.title
  if (!title) {
    const titleInput = await p.text({
      message: 'Site title:',
      initialValue: repo,
      placeholder: repo,
    })

    if (p.isCancel(titleInput)) {
      p.cancel('Cancelled')
      process.exit(0)
    }

    title = titleInput as string
  }

  const s = p.spinner()

  s.start('Scaffolding project')
  await scaffold({ templateDir, outputDir, title, platform, username, repo, force: options.force })
  s.stop('Scaffolding complete!')

  if (gitInfo) {
    p.log.info(`Detected: ${gitInfo.platform}.com/${gitInfo.username}/${gitInfo.repo}`)
  } else {
    p.log.warning(`No git remote found. Using folder name "${repo}" as base path.\n   Run \`starfu deploy\` after pushing to configure deployment.`)
  }

  if (!process.stdin.isTTY) {
    p.outro(`Run \`${pm} install\` in .starfu to get started.`)
    return { templateDir, outputDir }
  }

  const installDeps = await p.confirm({ message: 'Install dependencies?' })
  if (p.isCancel(installDeps) || !installDeps) {
    p.outro(`Run \`${pm} install\` in .starfu when ready.`)
    return { templateDir, outputDir }
  }

  s.start('Installing dependencies')
  await execa(installCmd[0], installCmd[1], { cwd: starfuDir })
  s.stop('Dependencies installed!')

  const generatePagefind = await p.confirm({ message: 'Generate Pagefind search index?' })
  if (p.isCancel(generatePagefind)) {
    p.outro('Done!')
    return { templateDir, outputDir }
  }

  if (generatePagefind) {
    s.start('Building and generating search index')
    const [cmd, args] = runCmd('build')
    await execa(cmd, args, { cwd: starfuDir })
    s.stop('Search index generated!')
  }

  const startDev = await p.confirm({ message: 'Wanna spin up a dev server?' })
  if (p.isCancel(startDev)) {
    p.outro('Done!')
    return { templateDir, outputDir }
  }

  if (startDev) {
    p.outro('Starting dev server...')
    const [cmd, args] = runCmd('dev')
    await execa(cmd, args, { cwd: starfuDir, stdio: 'inherit' })
  } else {
    const devCmd = pm === 'npm' ? 'npm run dev' : `${pm} dev`
    p.outro(`Run \`${devCmd}\` in .starfu to start the dev server.`)
  }

  return { templateDir, outputDir }
}

const realArgv = realpathSync(process.argv[1])
const realModule = new URL(import.meta.url).pathname

if (realArgv === realModule) {
  run().catch((error) => {
    p.cancel('Operation failed')
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
