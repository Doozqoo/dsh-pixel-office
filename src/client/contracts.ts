/**
 * Minimal structural types for the DSH client surfaces this plugin consumes.
 *
 * Declared locally on purpose: a standalone repository must install and
 * typecheck without any `@deepseek-ai/*` package present. Importing the real
 * contracts would make this repository unbuildable for anyone who cannot
 * resolve those packages, and the plugin reads only the members below. These
 * are structural mirrors, not a fork of the upstream API: if a signature here
 * disagrees with the running harness, the harness is authoritative.
 * @module dsh-client-pixel-office/contracts
 */

/** Removes one registration or effect. */
export type Disposer = () => void

/** Selector hook over an external snapshot source. */
export type SnapshotHook<S> = <T>(select: (state: S) => T) => T

/** One workspace as the workspace list publishes it. */
export interface WorkspaceRecord {
  readonly workspaceId: string
  readonly title: string
  readonly sessionIds: readonly string[]
}

/** Workspace list state. */
export interface WorkspaceListState {
  readonly items: readonly WorkspaceRecord[]
  readonly archivedSessionIds: readonly string[]
}

/** One session as the session list publishes it. */
export interface SessionRecord {
  readonly displayTitle: string
  readonly running: boolean
}

/** Session list state. */
export interface SessionListState {
  readonly ids: readonly string[]
  readonly byId: Readonly<Record<string, SessionRecord | undefined>>
}

/** Registration options accepted by a list slot. */
export interface SlotRegistration {
  readonly name: string
  readonly id?: string
  readonly order?: number
  readonly label?: string | (() => string)
}

/** The slots service members this plugin uses. */
export interface SlotsService {
  register: (registration: SlotRegistration, component: unknown) => Disposer
  inject: (name: string, register: () => Disposer) => Disposer
}

/** One token override, which must supply both color schemes. */
export interface TokenOverride {
  readonly light: string
  readonly dark: string
}

/** The theme service members this plugin uses. */
export interface ThemeService {
  overrideTokens: (id: string, tokens: Readonly<Record<string, TokenOverride>>) => Disposer
}

/** The workspaces service members this plugin uses. */
export interface WorkspacesService {
  pickDirectory: () => Promise<string | null>
  create: (request: { readonly path: string }) => Promise<unknown>
  delete: (workspaceId: string) => Promise<void>
  /** Creates a session bound to that workspace and resolves its id. */
  connectWorkspace: (workspaceId: string) => Promise<string>
  archiveSession: (sessionId: string) => Promise<void>
}

/** The sessions service members this plugin uses. */
export interface SessionsService {
  open: (sessionId: string) => unknown
}

/** The Cordis client context members this plugin uses. */
export interface ClientContext {
  get: (name: string) => unknown
  effect: (callback: () => Disposer, label?: string) => Disposer
}

/** Owner props the shell passes to a `shell.overlay` occupant. */
export interface OverlayProps {
  readonly useWorkspaces: SnapshotHook<WorkspaceListState>
  readonly useSessions: SnapshotHook<SessionListState>
}

