/**
 * The plugin's own version, so the pixel chrome can print it.
 *
 * The value is NOT hardcoded here. `tsdown.config.ts` reads `package.json` and
 * substitutes `__PIXEL_OFFICE_VERSION__` at bundle time (rolldown `define`),
 * which keeps one source of truth: bumping the manifest is enough, and the UI
 * can never drift away from it.
 *
 * The `typeof` guard is what makes this safe outside that pipeline. `typeof`
 * on an undeclared identifier evaluates to `'undefined'` instead of throwing,
 * so importing this module from a `tsc`-only type check (or any context that
 * skipped the bundler) yields the fallback rather than a ReferenceError at
 * module-evaluation time — which would kill the whole plugin bundle.
 */
declare const __PIXEL_OFFICE_VERSION__: string

/** e.g. `"0.1.0"` — or `"dev"` when the bundler substitution did not run. */
export const PLUGIN_VERSION: string =
  typeof __PIXEL_OFFICE_VERSION__ === 'string' && __PIXEL_OFFICE_VERSION__ !== ''
    ? __PIXEL_OFFICE_VERSION__
    : 'dev'
