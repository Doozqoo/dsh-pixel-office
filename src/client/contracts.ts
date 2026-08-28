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

/** Selector hook result of an external snapshot source. */
export type SnapshotHook<S> = <T>(select: (state: S) => T) => T

/**
 * Wire success/failure envelope the host Remote layer returns.
 *
 * Matches `@deepseek-ai/dsh-typert-protocol`'s `RemoteResult<T>` exactly:
 * a flat `{ ok: true, value } | { ok: false, error }` — there is NO `result`
 * wrapper. A handler that reads `outcome.result.ok` would throw
 * "Cannot read properties of undefined" the moment the call resolves, so the
 * plugin always reads `outcome.ok` / `outcome.value` / `outcome.error` directly.
 */
export type RemoteResult<T> =
  | { readonly ok: true, readonly value: T }
  | { readonly ok: false, readonly error: { readonly code: string, readonly message: string } }

/** Minimum surface of the host-generated Workspace Remote namespace. */
export interface WorkspaceRemoteApi {
  create(input: { readonly path: string }): Promise<RemoteResult<unknown>>
  delete(input: { readonly workspaceId: string }): Promise<RemoteResult<unknown>>
  rename(input: { readonly workspaceId: string, readonly title: string }): Promise<RemoteResult<unknown>>
  archiveSession(input: { readonly sessionId: string }): Promise<RemoteResult<unknown>>
}

/** Minimum surface of the host-generated Session Remote namespace. */
export interface SessionRemoteApi {
  create(input: { readonly workspaceId?: string, readonly cwd?: string, readonly sessionId?: string, readonly agentPreset?: string }): Promise<RemoteResult<{ readonly sessionId: string }>>
}

/** Minimum surface of the host-generated Directory Picker Remote namespace. */
export interface DirectoryPickerRemoteApi {
  pick(): Promise<RemoteResult<string | null>>
}

/**
 * Subset of the host gateway `ctx.remote` this plugin reaches for.
 *
 * Third-party theme plugins run in a Cordis context that does NOT expose the
 * internal `workspaces` / `uiWorkspace` controller services on `master`; the
 * only reliable write surface is the generated Host Remote namespace. We keep
 * the service lookups (`workspaces`, `uiWorkspace`, `sessions`) as fast paths
 * for `v2` or future versions that may expose them, and fall back to
 * `ctx.remote.{workspace,session,directoryPicker}` when they are absent.
 */
export interface HostRemote {
  readonly workspace: WorkspaceRemoteApi
  readonly session: SessionRemoteApi
  readonly directoryPicker: DirectoryPickerRemoteApi
}

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
  pickDirectory?: () => Promise<string | null>
  create: (request: { readonly path: string }) => Promise<unknown>
  delete: (workspaceId: string) => Promise<void>
  /** Creates a session bound to that workspace and resolves its id (v2 only). */
  connectWorkspace?: (workspaceId: string) => Promise<string>
  archiveSession?: (sessionId: string) => Promise<void>
  /** Renames a workspace (changes its displayed title). */
  rename?: (workspaceId: string, title: string) => Promise<unknown>
}

/**
 * The `uiWorkspace` capability surface introduced in
 * `master` (>= 0.1.2-alpha.1).
 *
 * `connectWorkspace` / `pickDirectory` / `archiveSession` were moved off the
 * `workspaces` (WorkspaceController) service into a separate
 * `UiWorkspaceService` registered under the `'uiWorkspace'` Cordis key.
 * On `v2` this service does not exist and the runtime falls back to
 * `workspaces`. The runtime code picks whichever side is present.
 */
export interface UiWorkspaceService {
  /** Connects (or creates) the blank Session bound to a Workspace. */
  connectWorkspace: (workspaceId: string) => Promise<string>
  /** Opens the host-native directory picker. */
  pickDirectory: () => Promise<string | null>
  /** Archives (and clears if current) a Session. */
  archiveSession: (sessionId: string) => Promise<void>
}

/**
 * One message node in a conversation snapshot.
 *
 * Mirrors the union the harness publishes (`UserMessageNode` /
 * `AssistantMessageNode`); both expose their text either as `content[]` (user)
 * or `blocks[]` (assistant), with a possible flat `text` fallback. The reader
 * tolerates whichever shape the running harness uses.
 */
export interface MessageNodeMirror {
  readonly kind: 'user' | 'assistant' | 'system'
  readonly content?: readonly { readonly text?: string }[]
  readonly blocks?: readonly { readonly text?: string }[]
  readonly text?: string
}

/** A reactive conversation snapshot (the message history). */
export interface ConversationSnapshotMirror {
  readonly nodes?: readonly MessageNodeMirror[]
}

/** A live session face: the session verbs plus a reactive snapshot source. */
export interface SessionFaceMirror {
  getSnapshot: () => ConversationSnapshotMirror
}

/** The sessions service members this plugin uses. */
export interface SessionsService {
  open: (sessionId: string) => unknown
  /**
   * Create a blank Session bound to a Workspace (the internal implementation
   * of `connectWorkspace` on both v2 and master). Some Cordis contexts expose
   * this directly; if not, the plugin falls back to `ctx.remote.session.create`.
   */
  create?: (request: { readonly workspaceId: string }) => Promise<string>
  /**
   * Resolve the live face of a session. The returned `.session` is a
   * `SessionFace` (`ISession & ObservableSnapshot<ConversationSnapshot>`), which
   * exposes the full message history — the sticky-note hover preview reads the
   * last message from here. Messages ARE exposed by the harness; this was
   * previously a misconception in the plugin.
   */
  binding?: (sessionId: string) => { session?: SessionFaceMirror } | undefined
}

/** The Cordis client context members this plugin uses. */
export interface ClientContext {
  get: (name: string) => unknown
  effect: (callback: () => Disposer, label?: string) => Disposer
  /**
   * Subscribe to a namespaced event on the Cordis event bus.
   *
   * `ClientContext` is the merged Cordis `Context`, so `on` is the real
   * `ctx.on(name, listener)` from the events mixin. Domain state (workspaces,
   * sessions, settings) is snapshot-driven rather than event-driven, but a few
   * cross-cutting signals arrive as events: `theme/change`, `connection/reset`,
   * `slots/changed`, and the `internal/*` lifecycle events. Returns a disposer.
   */
  on: (event: string, listener: (...args: readonly unknown[]) => void) => Disposer
}

/** Owner props the shell passes to a `shell.overlay` occupant. */
export interface OverlayProps {
  readonly useWorkspaces: SnapshotHook<WorkspaceListState>
  readonly useSessions: SnapshotHook<SessionListState>
}

