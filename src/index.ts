/**
 * Node half of the Pixel Office plugin. The browser half carries every
 * behavior; this entry exists because the host Loader imports the row before
 * the browser roster is composed, and a row without an importable node half
 * fails to load.
 * @module dsh-client-pixel-office
 */

/** No host-side services are consumed: the plugin is browser-only. */
export const inject: readonly string[] = []

/**
 * Host-side apply. Intentionally empty — see the module contract above.
 */
export function apply(): void {}
