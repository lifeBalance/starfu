import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { execa } from 'execa'

export type Platform = 'github' | 'gitlab'

export interface ScaffoldOptions {
  templateDir: string
  outputDir: string
  title: string
  platform: Platform
  username: string
  repo: string
  force?: boolean
}

async function exists(target: string): Promise<boolean> {
  return fs.access(target).then(() => true, () => false)
}

export async function getGitInfo(cwd: string): Promise<{ platform: Platform; username: string; repo: string } | null> {
  try {
    const { stdout } = await execa('git', ['ls-remote', '--get-url', 'origin'], { cwd })
    const url = stdout.trim()

    // GitHub: git@github.com:user/repo.git or https://github.com/user/repo.git
    const githubMatch = url.match(/github\.com[/:]([\w-]+)\/([\w-]+?)(\.git)?$/)
    if (githubMatch) {
      return { platform: 'github', username: githubMatch[1], repo: githubMatch[2] }
    }

    // GitLab: git@gitlab.com:user/repo.git or https://gitlab.com/user/repo.git
    const gitlabMatch = url.match(/gitlab\.com[/:]([\w-]+)\/([\w-]+?)(\.git)?$/)
    if (gitlabMatch) {
      return { platform: 'gitlab', username: gitlabMatch[1], repo: gitlabMatch[2] }
    }

    return null
  } catch {
    return null
  }
}

export async function scaffold({ templateDir, outputDir, title, platform, username, repo, force = false }: ScaffoldOptions) {
  if (!(await exists(templateDir))) {
    throw new Error(`Template directory not found: ${templateDir}`)
  }

  const manifest = JSON.parse(await fs.readFile(path.join(templateDir, 'scaffold-manifest.json'), 'utf8'))

  await fs.mkdir(outputDir, { recursive: true })

  for (const item of manifest) {
    const src = path.join(templateDir, item.src)
    const dest = path.join(outputDir, item.dest)

    if (await exists(dest)) {
      if (!force) throw new Error(`'${item.dest}' already exists. Use --force to overwrite.`)
      await fs.rm(dest, { recursive: true, force: true })
    }

    if (item.src.endsWith('/')) {
      await fs.cp(src, dest, { recursive: true })
    } else {
      await fs.mkdir(path.dirname(dest), { recursive: true })
      await fs.copyFile(src, dest)
    }
  }

  // Replace placeholders in template files
  for (const item of manifest.filter((i: any) => i.template)) {
    const filePath = path.join(outputDir, item.dest)
    let content = await fs.readFile(filePath, 'utf8')
    content = content.replace(/%%TITLE%%/g, title)
    content = content.replace(/%%PLATFORM%%/g, platform)
    content = content.replace(/%%USERNAME%%/g, username)
    content = content.replace(/%%REPO%%/g, repo)
    await fs.writeFile(filePath, content, 'utf8')
  }
}
