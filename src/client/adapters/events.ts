/**
 * Events adapter — wraps Cordis event bus subscriptions.
 *
 * Event names are the harness's most volatile surface: they can be renamed,
 * re-scoped, or re-typed between releases. Keeping them in one module means
 * a harness event rename is a single-file fix.
 * @module dsh-client-pixel-office/adapters/events
 */

import type { AdapterDeps } from './types.ts'
import type { Disposer } from '../contracts.ts'

/**
 * Harness event names this plugin subscribes to.
 *
 * These are the ONLY places where raw event name strings live. If the harness
 * renames an event, only this module needs to change.
 */
export const EVENTS = {
  /** Fired when the transport connection drops and re-establishes. */
  CONNECTION_RESET: 'connection/reset',
  /** Fired when the host appearance theme changes. */
  THEME_CHANGE: 'theme/change',
} as const

export interface EventsAdapter {
  /** Subscribe to connection/reset. */
  onConnectionReset: (listener: () => void) => Disposer
  /** Subscribe to theme/change. */
  onThemeChange: (listener: (snapshot: unknown) => void) => Disposer
}

export function createEventsAdapter(deps: AdapterDeps): EventsAdapter {
  return {
    onConnectionReset: (listener) => deps.ctx.on(EVENTS.CONNECTION_RESET, listener),
    onThemeChange: (listener) => deps.ctx.on(EVENTS.THEME_CHANGE, (...args) => listener(args[0])),
  }
}