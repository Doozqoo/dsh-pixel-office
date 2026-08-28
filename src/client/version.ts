/**
 * The base (harness) version, recovered from the host's own build badge.
 * @module dsh-client-pixel-office/version
 */
import { useEffect, useState } from 'react'

/**
 * Shape of the string the shell prints, e.g. `0.1.2-alpha.1-cd5ef81-dirty` —
 * semver, then an optional dash-separated tail carrying the commit hash and a
 * `-dirty` marker. Kept permissive on purpose: the tail is free-form and gains
 * segments whenever the base changes how it stamps builds.
 */
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

/** The slot anchor the shell wraps the sidebar in (`scoped-slots.tsx`). */
const SIDEBAR_SELECTOR = '[data-slot="sidebar"]'

/**
 * The badge inside it. The host styles it with a CSS module, so the attribute
 * value is a scoped name — vite's default pattern keeps the local name as a
 * substring (`_buildVersion_…`), which is what this matches on. It is a hint,
 * not a contract: {@link scanText} is the fallback if the naming ever changes.
 */
const BADGE_SELECTOR = '[class*="buildVersion"]'

/**
 * Retry delays, in ms, for the initial lookup. The sidebar mounts with the
 * shell, but plugin load is its own async step and can land on either side of
 * it — the first tick covers the common case, the tail covers a slow start.
 */
const RETRY_DELAYS = [120, 380, 1000, 2000, 4000] as const

/**
 * Return the first text node under `root` that is exactly a version string.
 * @param root - subtree to walk; normally the sidebar slot anchor.
 * @returns the version, or `undefined` when no node matches.
 */
function scanText(root: Element): string | undefined {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = (node.nodeValue ?? '').trim()
    if (VERSION_PATTERN.test(text)) return text
  }
  return undefined
}

/**
 * Read the base version out of the sidebar's build badge.
 * @returns the version, or `undefined` when the badge is absent (sidebar
 *   collapsed, different shell, or the host stopped printing it).
 */
function readHostVersion(): string | undefined {
  const sidebar = document.querySelector(SIDEBAR_SELECTOR)
  if (sidebar === null) return undefined
  const badge = sidebar.querySelector(BADGE_SELECTOR)
  const text = badge?.textContent?.trim()
  if (text !== undefined && VERSION_PATTERN.test(text)) return text
  return scanText(sidebar)
}

/**
 * The version of the DSH base this plugin is running inside.
 *
 * There is deliberately no network call and no service lookup here. The web
 * client exposes its build version to nobody: no cordis service carries it
 * (nothing `provide`s `version`/`meta`, so there is nothing to declare in
 * `inject`), nothing is written to `window`, and the host's
 * DSH_CLIENT_VERSION / _COMMIT_HASH / _GIT_DIRTY env values are inlined into
 * the *shell's* bundle at build time — this plugin is built by its own
 * tsdown pass and never sees them. The sidebar brand's rendered text
 * is the only copy that reaches the page as readable data, so it is the source.
 *
 * Returns `undefined` rather than a guess when the badge cannot be found;
 * callers print the product name alone in that case instead of inventing a
 * number. The value is stable for the lifetime of the page, so it is read once
 * and then frozen — a later sidebar collapse does not blank it.
 * @returns the base version, or `undefined` while unavailable.
 */
export function useHostVersion(): string | undefined {
  const [version, setVersion] = useState(readHostVersion)

  useEffect(() => {
    // Already resolved: stop, and stay resolved.
    if (version !== undefined) return
    let timer = 0
    let attempt = 0
    const tick = (): void => {
      const found = readHostVersion()
      if (found !== undefined) { setVersion(found); return }
      const next = RETRY_DELAYS[attempt]
      attempt += 1
      if (next === undefined) return
      timer = window.setTimeout(tick, next)
    }
    timer = window.setTimeout(tick, RETRY_DELAYS[0])
    return () => { window.clearTimeout(timer) }
  }, [version])

  return version
}
