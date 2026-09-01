/**
 * Adapter barrel — creates all adapters from raw harness service handles.
 *
 * This is the single entry point where the plugin touches the harness's
 * service surface. When the harness changes a service signature, only
 * the individual adapter module and this file's `createAdapters` need
 * updating.
 * @module dsh-client-pixel-office/adapters
 */

import type { AdapterDeps, CapabilityReport } from './types.ts'
import { createWorkspaceAdapter } from './workspace.ts'
import type { WorkspaceAdapter } from './workspace.ts'
import { createSessionAdapter } from './session.ts'
import type { SessionAdapter } from './session.ts'
import { createThemeAdapter } from './theme.ts'
import type { ThemeAdapter } from './theme.ts'
import { createSlotsAdapter } from './slots.ts'
import type { SlotsAdapter } from './slots.ts'
import { createEventsAdapter } from './events.ts'
import type { EventsAdapter } from './events.ts'

export type { AdapterDeps, CapabilityReport } from './types.ts'
export type { WorkspaceAdapter } from './workspace.ts'
export type { SessionAdapter } from './session.ts'
export type { ThemeAdapter } from './theme.ts'
export type { SlotsAdapter } from './slots.ts'
export type { EventsAdapter } from './events.ts'

/** The complete set of adapters the plugin uses. */
export interface Adapters {
  readonly workspace: WorkspaceAdapter
  readonly session: SessionAdapter
  readonly theme: ThemeAdapter
  readonly slots: SlotsAdapter
  readonly events: EventsAdapter
}

/**
 * Create all adapters from raw harness service handles.
 * @param deps - raw service handles obtained from `ctx.get()`.
 * @returns the complete adapter set.
 */
export function createAdapters(deps: AdapterDeps): Adapters {
  return {
    workspace: createWorkspaceAdapter(deps),
    session: createSessionAdapter(deps),
    theme: createThemeAdapter(deps),
    slots: createSlotsAdapter(deps),
    events: createEventsAdapter(deps),
  }
}

/**
 * Run the capability probe across all adapters.
 *
 * A failing probe for a hard dependency (slots) means the plugin cannot mount.
 * Soft dependency failures (theme, session binding) are reported but the plugin
 * continues with reduced functionality.
 * @param adapters - the created adapter set.
 * @returns a merged capability report.
 */
export function probeAdapters(adapters: Adapters): CapabilityReport {
  const reports = [
    adapters.slots.probe(),
    adapters.workspace.probe(),
    adapters.session.probe(),
    adapters.theme.probe(),
  ]
  const ok = reports.flatMap(r => r.ok)
  const missing = reports.flatMap(r => r.missing)
  const viable = reports.every(r => r.viable)
  return { ok, missing, viable }
}

/** Plugin identifier used for logging and slot registration. */
export { PLUGIN_ID } from '../constants.ts'