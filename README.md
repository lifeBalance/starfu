# ✨ Starfu

Starfu scaffolds a complete docs site in seconds. Each section gets its own table of contents, navigation, and landing page card. Perfect for GitHub Pages and GitLab Pages.

> [!NOTE]
> Beautiful multi-section documentation sites, powered by Astro.

**🔗 Live demo:** https://lifeBalance.github.io/starfu/

## 🚀 Quick Start

```sh
pnpm dlx starfu # or: npx starfu
```

That's it. You'll be guided through:

```sh
┌  Starfu
│
◆  Site title:
│  my-project
│
◇  Scaffolding complete!
│
●  Detected: github.com/username/my-project
│
◆  Install dependencies?
│  ● Yes  ○ No
│
◇  Dependencies installed!
│
◆  Generate Pagefind search index?
│  ● Yes  ○ No
│
◇  Search index generated!
│
◆  Wanna spin up a dev server?
│  ● Yes  ○ No
│
└  Starting dev server...
```

## 🐾 Minimal Footprint

Starfu adds exactly two folders to your project:

```sh
your-project/
├── .starfu/     # Build tooling (you can forget this exists)
└── docs/          # Your markdown goes here
```

**That's it.** No config sprawl, no dozens of files cluttering your repo. Just write in `docs/` and ship.

> [!NOTE]
> If you didn't have a `git` repo initialized, `repo-name` will be the `project-folder`.

## 🧑‍💻 Local Development

Start the development server:
```sh
pnpm dev  # or: npm run dev
```

Your docs are now live at `http://localhost:4321/<repo-name>/` with hot reload enabled.

## ⭐ Features

- **Multi-section docs** — Organize content into separate sections, each with its own sidebar
- **Automatic navigation** — Prev/next links, breadcrumbs, and table of contents
- **Full-text search** — Powered by Pagefind, works offline
- **Dark mode** — Built-in theme toggle
- **GitHub/GitLab Pages ready** — Base path configured automatically from your repo
- **Zero config** — Works out of the box, customize when needed

## 🛠️ CLI Commands

### Scaffold a new project

```sh
pnpm dlx starfu [options] # or: npx starfu [options]
```

Options:

- `--dir <path>` Output directory (default: current directory)
- `--force` Overwrite existing files

### Deploy

```sh
pnpm dlx starfu deploy # or: npx starfu deploy
```

This will detect your GitHub/GitLab repository and offer to either generate a CI workflow or deploy manually by pushing to a Pages branch. Follow the on-screen prompts to configure deployment.

### Upgrade an existing template

```sh
pnpm dlx starfu upgrade-template # or: npx starfu upgrade-template
```

Updates Starfu-managed files in `.starfu/` without touching `docs/`. Use `--dir <path>` to target another project directory.

## 📝 Adding Content

Create markdown or MDX files in `docs/`:

```sh
docs/
├── getting-started/
│   ├── _toc.ts        # Section table of contents
│   ├── intro.md
│   └── installation.md
└── guides/
    ├── _toc.ts
    └── basics.mdx
```

Configure sections in `.starfu/astro.config.mjs`:

```js
docsIntegration({
  title: "My Docs",
  sections: [
    {
      root: "../docs/getting-started",
      title: "Getting Started",
      href: "/getting-started/intro",
    },
    {
      root: "../docs/guides",
      title: "Guides",
      href: "/guides/basics",
    },
  ],
});
```

## 📋 Requirements

- Node.js 18+
- pnpm, npm, or yarn

## 🪪 License

MIT
