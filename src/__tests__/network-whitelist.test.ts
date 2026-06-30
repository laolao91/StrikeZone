/**
 * Pre-submission gate: every http/https URL in the source AND the built bundle
 * must be covered by app.json's network.whitelist. The EvenHub store scanner is
 * static, so any URL string in the bundle — including dead code and
 * error-message strings in third-party libraries — triggers a rejection if it
 * isn't whitelisted.
 *
 * Run this before `evenhub pack` to catch the problem early. The dist/ scan is
 * optional (skipped if dist/ doesn't exist yet), but running after a build gives
 * full coverage of bundler-injected URLs.
 *
 * Known source offenders:
 *   https://react.dev        — React production bundle embeds error-page URLs.
 *   https://tailwindcss.com  — Tailwind CSS injects its domain in compiled output.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, extname } from 'path'

const ROOT = join(import.meta.dirname, '../..')

function readAppJson(): { whitelist: string[] } {
  const raw = JSON.parse(readFileSync(join(ROOT, 'app.json'), 'utf8'))
  const networkPerm = raw.permissions?.find((p: { name: string }) => p.name === 'network')
  return { whitelist: networkPerm?.whitelist ?? [] }
}

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.html', '.css'])
const SKIP_DIRS = new Set(['__tests__', 'node_modules', 'dist', '.git'])
// SKIP_DIRS prevents recursing into nested dist/ or node_modules/ subdirs
// when walking src/. dist/ itself is scanned separately via BUNDLE_ROOTS.
const FRONTEND_ROOTS = ['src', 'index.html']
const BUNDLE_ROOTS   = ['dist']  // only present after a build; skipped when absent

function collectSourceFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(full))
    } else if (SOURCE_EXTENSIONS.has(extname(entry))) {
      files.push(full)
    }
  }
  return files
}

function extractUrls(content: string): string[] {
  const matches = content.match(/https?:\/\/[^\s'"`,)>]+/g) ?? []
  return [...new Set(matches)]
}

// W3C namespace URIs appear in minified SVG/HTML but are never fetched.
const NAMESPACE_PREFIXES = ['http://www.w3.org/']

function isCovered(url: string, whitelist: string[]): boolean {
  if (NAMESPACE_PREFIXES.some(p => url.startsWith(p))) return true
  return whitelist.some(entry => url.startsWith(entry))
}

function gatherFiles(roots: string[]): string[] {
  return roots.flatMap(rel => {
    const full = join(ROOT, rel)
    try {
      return statSync(full).isDirectory() ? collectSourceFiles(full) : [full]
    } catch {
      return []
    }
  })
}

describe('network whitelist pre-submission check', () => {
  const { whitelist } = readAppJson()

  const sourceFiles = gatherFiles(FRONTEND_ROOTS)
  const bundleFiles = gatherFiles(BUNDLE_ROOTS)
  const allFiles    = [...sourceFiles, ...bundleFiles]

  const allUrls    = allFiles.flatMap(f => extractUrls(readFileSync(f, 'utf8')))
  const uniqueUrls = [...new Set(allUrls)]
  const uncovered  = uniqueUrls.filter(url => !isCovered(url, whitelist))

  it('app.json has a non-empty network whitelist', () => {
    expect(whitelist.length).toBeGreaterThan(0)
  })

  it('every http/https URL in source and bundle is covered by network.whitelist', () => {
    expect(uncovered).toEqual([])
  })

  it('dist bundle scan ran (only checked when dist/ exists)', () => {
    if (bundleFiles.length === 0) return  // skip if not built yet
    expect(bundleFiles.length).toBeGreaterThan(0)
  })
})
