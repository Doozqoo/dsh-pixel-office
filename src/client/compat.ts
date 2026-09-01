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
  return a.preRelease.localeCompare(b.preRelease)
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
 * cares about. Add new entries at the top when a breaking change is
 * discovered.
 */
export const VERSION_MILESTONES: readonly VersionNotes[] = [
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