import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import * as path from 'node:path'
import * as p from '@clack/prompts'

type Platform = 'github' | 'gitlab'

interface RepoInfo {
  platform: Platform
  username: string
  repo: string
}

function detectRepoInfo(cwd: string): RepoInfo | null {
  try {
    const url = execSync('git ls-remote --get-url origin', {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim()

    const githubMatch = url.match(/github\.com[/:]([\w-]+)\/([\w-]+?)(\.git)?$/)
    if (githubMatch) {
      return { platform: 'github', username: githubMatch[1], repo: githubMatch[2] }
    }

    const gitlabMatch = url.match(/gitlab\.com[/:]([\w-]+)\/([\w-]+?)(\.git)?$/)
    if (gitlabMatch) {
      return { platform: 'gitlab', username: gitlabMatch[1], repo: gitlabMatch[2] }
    }

    return null
  } catch {
    return null
  }
}

const GITHUB_WORKFLOW = `name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
          cache-dependency-path: .starfu/pnpm-lock.yaml

      - name: Install dependencies
        run: pnpm install
        working-directory: .starfu

      - name: Build
        run: pnpm build
        working-directory: .starfu

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: .starfu/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
`

const GITLAB_CI = `image: node:20

stages:
  - build
  - deploy

cache:
  paths:
    - .starfu/node_modules/

build:
  stage: build
  before_script:
    - npm install -g pnpm
    - cd .starfu && pnpm install
  script:
    - cd .starfu && pnpm build
  artifacts:
    paths:
      - .starfu/dist

pages:
  stage: deploy
  script:
    - mv .starfu/dist public
  artifacts:
    paths:
      - public
  only:
    - main
`

export async function runDeploy(cwd: string) {
  p.intro('Starfu Deploy')

  const repoInfo = detectRepoInfo(cwd)

  let finalRepoInfo: RepoInfo

  if (repoInfo) {
    p.log.success(`Detected: ${repoInfo.platform}.com/${repoInfo.username}/${repoInfo.repo}`)
    finalRepoInfo = repoInfo

    // Update astro.config.mjs with detected values (in case placeholders remain from scaffold)
    const configPath = path.join(cwd, '.starfu', 'astro.config.mjs')
    if (existsSync(configPath)) {
      let content = readFileSync(configPath, 'utf8')
      const hadPlaceholders = content.includes('%%')
      content = content.replace(/%%PLATFORM%%/g, finalRepoInfo.platform)
      content = content.replace(/%%USERNAME%%/g, finalRepoInfo.username)
      content = content.replace(/%%REPO%%/g, finalRepoInfo.repo)
      if (hadPlaceholders) {
        writeFileSync(configPath, content, 'utf8')
        p.log.success('Updated .starfu/astro.config.mjs')
      }
    }
  } else {
    p.log.warning('No git remote detected.\n   Push your repository to GitHub or GitLab first, then run this again.')

    const configureManually = await p.confirm({
      message: 'Configure deployment settings manually?',
      initialValue: false,
    })

    if (p.isCancel(configureManually) || !configureManually) {
      p.outro('Setup incomplete')
      return
    }

    // Prompt for platform
    const platformChoice = await p.select({
      message: 'Platform:',
      options: [
        { value: 'github', label: 'GitHub Pages' },
        { value: 'gitlab', label: 'GitLab Pages' },
      ],
    })

    if (p.isCancel(platformChoice)) {
      p.cancel('Cancelled')
      return
    }

    // Prompt for username
    const usernameInput = await p.text({
      message: 'Username or organization:',
      placeholder: 'your-username',
      validate: (value) => {
        if (!value?.trim()) return 'Username is required'
      },
    })

    if (p.isCancel(usernameInput)) {
      p.cancel('Cancelled')
      return
    }

    // Prompt for repo
    const folderName = path.basename(cwd)
    const repoInput = await p.text({
      message: 'Repository name:',
      initialValue: folderName,
      placeholder: folderName,
      validate: (value) => {
        if (!value?.trim()) return 'Repository name is required'
      },
    })

    if (p.isCancel(repoInput)) {
      p.cancel('Cancelled')
      return
    }

    finalRepoInfo = {
      platform: platformChoice as Platform,
      username: usernameInput as string,
      repo: repoInput as string,
    }

    // Update astro.config.mjs with the new values
    const configPath = path.join(cwd, '.starfu', 'astro.config.mjs')
    if (existsSync(configPath)) {
      let content = readFileSync(configPath, 'utf8')
      content = content.replace(/%%PLATFORM%%/g, finalRepoInfo.platform)
      content = content.replace(/%%USERNAME%%/g, finalRepoInfo.username)
      content = content.replace(/%%REPO%%/g, finalRepoInfo.repo)
      writeFileSync(configPath, content, 'utf8')
      p.log.success('Updated .starfu/astro.config.mjs')
    }
  }

  // Ask how to deploy
  const deployMethod = await p.select({
    message: 'How do you want to deploy?',
    options: [
      { value: 'workflow', label: 'Generate CI workflow (recommended)' },
      { value: 'manual', label: 'Deploy manually (push to branch)' },
    ],
  })

  if (p.isCancel(deployMethod)) {
    p.cancel('Cancelled')
    return
  }

  const defaultBranch = finalRepoInfo.platform === 'github' ? 'gh-pages' : 'gl-pages'
  let branch = defaultBranch
  let folder = '/'

  if (deployMethod === 'manual') {
    const branchInput = await p.text({
      message: 'Branch to deploy to:',
      initialValue: defaultBranch,
      placeholder: defaultBranch,
    })

    if (p.isCancel(branchInput)) {
      p.cancel('Cancelled')
      return
    }

    branch = branchInput as string

    const folderInput = await p.text({
      message: 'Folder in branch:',
      initialValue: '/',
      placeholder: '/ (root)',
    })

    if (p.isCancel(folderInput)) {
      p.cancel('Cancelled')
      return
    }

    folder = (folderInput as string).replace(/^\/+|\/+$/g, '') || '/'
  }
  const domain = finalRepoInfo.platform === 'gitlab' ? 'gitlab.io' : 'github.io'
  const siteUrl = `https://${finalRepoInfo.username}.${domain}/${finalRepoInfo.repo}/`

  if (deployMethod === 'workflow') {
    // Generate CI workflow
    const workflowPath = finalRepoInfo.platform === 'github'
      ? path.join(cwd, '.github', 'workflows', 'deploy.yml')
      : path.join(cwd, '.gitlab-ci.yml')

    if (existsSync(workflowPath)) {
      p.log.success(`CI workflow already exists: ${path.relative(cwd, workflowPath)}`)
    } else {
      if (finalRepoInfo.platform === 'github') {
        mkdirSync(path.dirname(workflowPath), { recursive: true })
        writeFileSync(workflowPath, GITHUB_WORKFLOW)
      } else {
        writeFileSync(workflowPath, GITLAB_CI)
      }
      p.log.success(`Created ${path.relative(cwd, workflowPath)}`)
    }

    p.log.info('')
    p.log.step(`Site URL: ${siteUrl}`)
    p.log.step(`Base path: /${finalRepoInfo.repo}/`)

    if (finalRepoInfo.platform === 'github') {
      p.log.info('')
      p.log.info('Enable GitHub Pages:')
      p.log.step('Go to Settings → Pages')
      p.log.step('Under Source, select "GitHub Actions"')
    }

    p.outro('Push to main to trigger the workflow.')
  } else {
    // Deploy manually - push to branch
    const starfuDir = path.join(cwd, '.starfu')
    const distDir = path.join(starfuDir, 'dist')

    // Build first
    const s = p.spinner()
    s.start('Building site')
    try {
      execSync('pnpm build', { cwd: starfuDir, stdio: 'pipe' })
      s.stop('Build complete!')
    } catch (error) {
      s.stop('Build failed')
      p.log.error('Build failed. Run `pnpm build` in .starfu to see errors.')
      return
    }

    // Push to branch
    const folderDisplay = folder === '/' ? '/ (root)' : `/${folder}`
    s.start(`Pushing to ${branch}:${folderDisplay}`)
    try {
      // Get the remote URL
      const remoteUrl = execSync('git remote get-url origin', { cwd, encoding: 'utf8' }).trim()

      let deployDir = distDir

      // If deploying to a subfolder, create the structure
      if (folder !== '/') {
        const tmpDir = path.join(cwd, '.starfu', '.deploy-tmp')
        const targetDir = path.join(tmpDir, folder)

        // Clean up any previous tmp dir
        execSync(`rm -rf "${tmpDir}"`, { stdio: 'pipe' })
        mkdirSync(targetDir, { recursive: true })

        // Copy dist contents to target folder
        execSync(`cp -r "${distDir}/"* "${targetDir}/"`, { stdio: 'pipe' })

        deployDir = tmpDir
      }

      // Add .nojekyll to disable Jekyll processing (GitHub ignores _folders otherwise)
      writeFileSync(path.join(deployDir, '.nojekyll'), '')

      // Create a temporary git repo and push
      execSync('git init', { cwd: deployDir, stdio: 'pipe' })
      execSync('git add -A', { cwd: deployDir, stdio: 'pipe' })
      execSync('git commit -m "Deploy"', { cwd: deployDir, stdio: 'pipe' })
      execSync(`git push -f ${remoteUrl} HEAD:${branch}`, { cwd: deployDir, stdio: 'pipe' })

      // Clean up
      execSync('rm -rf .git', { cwd: deployDir, stdio: 'pipe' })
      if (folder !== '/') {
        execSync(`rm -rf "${deployDir}"`, { stdio: 'pipe' })
      }

      s.stop(`Pushed to ${branch}:${folderDisplay}!`)
    } catch (error) {
      s.stop('Push failed')
      p.log.error('Failed to push. Make sure you have push access to the repository.')
      return
    }

    p.log.info('')
    p.log.step(`Site URL: ${siteUrl}`)
    p.log.step(`Branch: ${branch}`)
    p.log.step(`Folder: ${folderDisplay}`)

    p.log.info('')
    if (finalRepoInfo.platform === 'github') {
      p.log.info('Enable GitHub Pages:')
      p.log.step('Go to Settings → Pages')
      p.log.step(`Under Source, select "Deploy from a branch" → ${branch} → ${folderDisplay}`)
    } else {
      p.log.warning('Configure GitLab Pages:')
      p.log.step('Go to Deploy → Pages')
      p.log.step(`Set branch to "${branch}" and folder to "${folderDisplay}"`)
    }

    p.outro('Deployed!')
  }
}
