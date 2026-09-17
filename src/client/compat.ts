/**
 * Harness version compatibility matrix.
 *
 * The harness is in developer preview and ships breaking changes without
 * a changelog. This module maps known harness versions to the plugin
 * behaviors they support, so the plugin can adapt at runtime instead of
 * crashing.
 *
 * Update this file when:
 * 1. A new harness version adds or renames a service method.
 * 2. A harness version changes a slot name or event name.
 * 3. A harness version changes the DOM structure the plugin queries.
 * @module dsh-client-pixel-office/compat
 */

/**
 * A harness version parsed into comparable components.
 * The harness stamps versions like `0.1.2-alpha.1-cd5ef81-dirty`.
 */
export interface ParsedVersion {
  readonly major: number
  readonly minor: number
  readonly patch: number
  readonly preRelease: string
  /** The raw version string this was parsed from. */
  readonly raw: string
}

/**
 * Parse a harness version string into comparable components.
 * @param version - the raw version string, e.g. `0.1.2-alpha.1-cd5ef81`.
 * @returns the parsed version, or undefined when unparseable.
 */
export function parseVersion(version: string | undefined): ParsedVersion | undefined {
  if (version === undefined) return undefined
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/)
  if (match === null) return undefined
  return {
    major: parseInt(match[1]!, 10),
    minor: parseInt(match[2]!, 10),
    patch: parseInt(match[3]!, 10),
    preRelease: match[4] ?? '',
    raw: version,
  }
}

/**
 * Compare two parsed versions.
 * @returns negative if a < b, 0 if equal, positive if a > b.
 */
export function compareVersions(a: ParsedVersion, b: ParsedVersion): number {
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  if (a.patch !== b.patch) return a.patch - b.patch
  // Pre-release versions sort before the release: '' > any pre-release.
  if (a.preRelease === '' && b.preRelease !== '') return 1
  if (a.preRelease !== '' && b.preRelease === '') return -1
  return comparePreRelease(a.preRelease, b.preRelease)
}

/**
 * The leading pre-release identifier of a build-stamped version tail.
 *
 * The harness stamps `0.1.6-alpha.2-cd5ef81-dirty`: semver, then the
 * pre-release, then a dash-separated commit hash and dirty marker. Only the
 * first dash-delimited segment is part of the version — the rest is build
 * metadata. Comparing the raw tail against a milestone's bare `alpha.2` made
 * every real host look *newer* than the newest known version (a longer string
 * with an equal prefix sorts after it), so the plugin warned "以兼容模式运行"
 * on exactly the version it was verified against.
 * @param preRelease - the parsed pre-release tail, possibly with build metadata.
 * @returns the comparable pre-release identifier.
 */
function leadingPreRelease(preRelease: string): string {
  return preRelease.split('-')[0] ?? ''
}

/**
 * Compare two pre-release identifiers segment by segment, numerically where
 * both segments are numeric.
 *
 * Plain `localeCompare` puts `alpha.10` before `alpha.9`, which would misrank
 * a tenth alpha as older than the ninth.
 * @returns negative if a < b, 0 if equal, positive if a > b.
 */
function comparePreRelease(a: string, b: string): number {
  const left = leadingPreRelease(a).split('.')
  const right = leadingPreRelease(b).split('.')
  const length = Math.max(left.length, right.length)
  for (let i = 0; i < length; i += 1) {
    const l = left[i]
    const r = right[i]
    // A shorter identifier is the lower one: `alpha` < `alpha.1`.
    if (l === undefined) return -1
    if (r === undefined) return 1
    const ln = Number(l)
    const rn = Number(r)
    const numeric = l !== '' && r !== '' && Number.isFinite(ln) && Number.isFinite(rn)
    const diff = numeric ? ln - rn : l.localeCompare(r)
    if (diff !== 0) return diff > 0 ? 1 : -1
  }
  return 0
}

/**
 * Known harness versions and their behavioral differences.
 *
 * When a new harness version changes something the plugin depends on,
 * add an entry here. The plugin reads this at startup and adapts.
 */
export interface VersionNotes {
  /** The harness version this entry describes. */
  readonly since: ParsedVersion
  /** Human-readable summary of what changed. */
  readonly summary: string
}

/**
 * Known harness version milestones.
 *
 * These are the versions where the harness changed something the plugin
 * cares about. Entries are ordered **newest first**: index 0 is the newest
 * version this plugin has been verified against, and the last entry is the
 * oldest it still supports. Add new entries at the top when a breaking change
 * is discovered or a version is verified.
 */
export const VERSION_MILESTONES: readonly VersionNotes[] = [
  {
    since: { major: 0, minor: 1, patch: 6, preRelease: 'alpha.2', raw: '0.1.6-alpha.2' },
    summary:
      'sessions.open/openSubagent/clear removed — navigation moved to uiWorkspace.openSession; '
      + 'uiWorkspace grew openSession/openWorkspace/forkSession/unarchiveSession; '
      + 'the details slot was replaced by the dockable rightbar; session summaries gained '
      + 'updatedAt/blank/origin plus subagentsByParent and jobsBySession',
  },
  {
    since: { major: 0, minor: 1, patch: 2, preRelease: 'alpha.1', raw: '0.1.2-alpha.1' },
    summary: 'uiWorkspace service introduced; connectWorkspace/pickDirectory/archiveSession moved from workspaces',
  },
]

/**
 * Check whether the running harness is at least the given version.
 * @param current - the parsed version of the running harness.
 * @param required - the minimum required version.
 * @returns true when current >= required.
 */
export function isAtLeast(current: ParsedVersion | undefined, required: ParsedVersion): boolean {
  if (current === undefined) return false
  return compareVersions(current, required) >= 0
}

/**
 * Check whether the running harness is known-compatible with this plugin.
 *
 * "Known-compatible" means the harness version is >= the oldest version
 * this plugin was tested against. Unknown versions (newer than the latest
 * milestone) are treated as compatible with a warning.
 *
 * @param current - the parsed version of the running harness.
 * @returns a compatibility assessment.
 */
export function assessCompatibility(current: ParsedVersion | undefined): {
  readonly compatible: boolean
  readonly warning: string | null
} {
  if (current === undefined) {
    return { compatible: true, warning: '无法检测底座版本，以兼容模式运行' }
  }

  const oldest = VERSION_MILESTONES[VERSION_MILESTONES.length - 1]!.since
  const newest = VERSION_MILESTONES[0]!.since

  if (compareVersions(current, oldest) < 0) {
    return {
      compatible: false,
      warning: `底座版本 ${current.raw} 低于最低支持版本 ${oldest.raw}，部分功能可能不可用`,
    }
  }

  if (compareVersions(current, newest) > 0) {
    return {
      compatible: true,
      warning: `底座版本 ${current.raw} 高于已知最新版本 ${newest.raw}，以兼容模式运行`,
    }
  }

  return { compatible: true, warning: null }
}