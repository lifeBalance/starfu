import { describe, it, expect } from 'vitest'
import { normalizeRoot } from '../template/src/lib/docs/integration'

describe('normalizeRoot', () => {
  it('adds leading slash to simple paths', () => {
    expect(normalizeRoot('docs')).toBe('/docs')
    expect(normalizeRoot('docs/tutorial')).toBe('/docs/tutorial')
  })

  it('preserves existing leading slash', () => {
    expect(normalizeRoot('/docs')).toBe('/docs')
    expect(normalizeRoot('/docs/tutorial')).toBe('/docs/tutorial')
  })

  it('removes trailing slash', () => {
    expect(normalizeRoot('docs/')).toBe('/docs')
    expect(normalizeRoot('/docs/')).toBe('/docs')
    expect(normalizeRoot('docs/tutorial/')).toBe('/docs/tutorial')
  })

  it('strips leading ./', () => {
    expect(normalizeRoot('./docs')).toBe('/docs')
    expect(normalizeRoot('./docs/tutorial')).toBe('/docs/tutorial')
  })

  it('preserves relative paths with ../', () => {
    expect(normalizeRoot('../docs')).toBe('../docs')
    expect(normalizeRoot('../docs/tutorial')).toBe('../docs/tutorial')
    expect(normalizeRoot('../../docs')).toBe('../../docs')
  })

  it('removes trailing slash from relative paths', () => {
    expect(normalizeRoot('../docs/')).toBe('../docs')
    expect(normalizeRoot('../docs/tutorial/')).toBe('../docs/tutorial')
  })

  it('normalizes backslashes to forward slashes', () => {
    expect(normalizeRoot('docs\\tutorial')).toBe('/docs/tutorial')
    expect(normalizeRoot('..\\docs\\tutorial')).toBe('../docs/tutorial')
  })

  it('handles combined edge cases', () => {
    expect(normalizeRoot('./docs/')).toBe('/docs')
    expect(normalizeRoot('./../docs')).toBe('../docs')
  })
})
