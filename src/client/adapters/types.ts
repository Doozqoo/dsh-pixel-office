/**
 * Shared adapter types.
 *
 * Every adapter is a thin wrapper over one harness service surface. When the
 * harness changes a service signature, only the adapter module needs updating —
 * the rest of the plugin code stays untouched.
 * @module dsh-client-pixel-office/adapters/types
 */

import type { Disposer, OverlayProps } from '../contracts.ts'

/** The raw service handles the adapter receives at construction time. */
export interface AdapterDeps {
  readonly slots: unknown
  readonly theme: unknown
  readonly workspaces: unknown
  readonly uiWorkspace: unknown
  readonly sessions: unknown
  /** The Cordis context, for event subscriptions and effects. */
  readonly ctx: {
    on: (event: string, listener: (...args: readonly unknown[]) => void) => Disposer
    effect: (callback: () => Disposer, label?: string) => Disposer
  }
}

/** Result of the capability probe run at startup. */
export interface CapabilityReport {
  /** Every probe that passed. */
  readonly ok: readonly string[]
  /** Every probe that failed, with a human-readable reason. */
  readonly missing: readonly { readonly name: string; readonly reason: string }[]
  /** Whether the plugin can mount (all hard requirements are met). */
  readonly viable: boolean
}