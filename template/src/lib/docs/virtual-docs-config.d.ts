declare module 'virtual:docs-config' {
  export const docsConfig: {
    basePath?: string
    branches?: Array<{ id: string; root: string }>
  }

  export function getGlobRegistry(): Record<string, {
    content: Record<string, any>
    toc: Record<string, any>
  }>
}
