import { describe, it, expect } from 'vitest'
import { parseTocConfig } from '../template/src/lib/docs/tocParser'

describe('parseTocConfig', () => {
  it('returns empty config for null input', () => {
    const result = parseTocConfig(null)
    expect(result.ordered).toEqual([])
    expect(result.alias.size).toBe(0)
  })

  it('returns empty config for undefined input', () => {
    const result = parseTocConfig(undefined)
    expect(result.ordered).toEqual([])
    expect(result.alias.size).toBe(0)
  })

  it('parses simple string entries', () => {
    const result = parseTocConfig(['intro', 'getting-started', 'advanced'])
    expect(result.ordered).toEqual([
      { path: 'intro' },
      { path: 'getting-started' },
      { path: 'advanced' },
    ])
  })

  it('normalizes group paths with trailing slash', () => {
    const result = parseTocConfig(['basics/', 'advanced/'])
    expect(result.ordered).toEqual([
      { path: 'basics/' },
      { path: 'advanced/' },
    ])
  })

  it('normalizes paths with leading ./', () => {
    const result = parseTocConfig(['./intro', './basics/'])
    expect(result.ordered).toEqual([
      { path: 'intro' },
      { path: 'basics/' },
    ])
  })

  it('collapses multiple slashes', () => {
    const result = parseTocConfig(['foo//bar', 'baz///'])
    expect(result.ordered).toEqual([
      { path: 'foo/bar' },
      { path: 'baz/' },
    ])
  })

  it('parses object entries with labels', () => {
    const result = parseTocConfig([
      { path: 'intro', label: 'Introduction' },
      { path: 'api/', label: 'API Reference' },
    ])
    expect(result.ordered).toEqual([
      { path: 'intro', label: 'Introduction' },
      { path: 'api/', label: 'API Reference' },
    ])
    expect(result.alias.get('intro')).toBe('Introduction')
    expect(result.alias.get('api/')).toBe('API Reference')
  })

  it('handles mixed string and object entries', () => {
    const result = parseTocConfig([
      'intro',
      { path: 'basics/', label: 'Getting Started' },
      'advanced',
    ])
    expect(result.ordered).toEqual([
      { path: 'intro' },
      { path: 'basics/', label: 'Getting Started' },
      { path: 'advanced' },
    ])
    expect(result.alias.get('basics/')).toBe('Getting Started')
    expect(result.alias.has('intro')).toBe(false)
  })

  it('skips object entries without path', () => {
    const result = parseTocConfig([
      { label: 'No Path' },
      { path: 'valid', label: 'Valid' },
      { path: '' },
    ])
    expect(result.ordered).toEqual([
      { path: 'valid', label: 'Valid' },
    ])
  })

  it('returns empty config for non-array input', () => {
    const result = parseTocConfig({ not: 'an array' })
    expect(result.ordered).toEqual([])
  })
})
