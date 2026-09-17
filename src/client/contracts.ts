/**
 * Minimal structural types for the DSH client surfaces this plugin consumes.
 *
 * Declared locally on purpose: a standalone repository must install and
 * typecheck without any `@deepseek-ai/*` package present. Importing the real
 * contracts would make this repository unbuildable for anyone who cannot
 * resolve those packages, and the plugin reads only the members below. These
 * are structural mirrors, not a fork of the upstream API: if a signature here
 * disagrees with the running harness, the harness is authoritative.
 *
 * Mirrored against `dsh-v0.1.6-alpha.2` (2026-09-18). The two breaking changes
 * in that span are recorded here rather than papered over:
 *
 * 1. `sessions.open(id)` / `sessions.openSubagent(address)` / `sessions.clear()`
 *    were **removed** from `ISessions`; session navigation now belongs to
 *    `uiWorkspace.openSession(target)`. `retain()` / `using()` replaced the old
 *    open verbs with a reference-counted ownership model.
 * 2. The `details` slot is gone; the right column became the dockable
 *    `rightbar` / `sidebar.right.pane.tab` surface.
 * @module dsh-client-pixel-office/contracts
 */

/** Removes one registration or effect. */
export type Disposer = () => void

/** Selector hook result of an external snapshot source. */
export type SnapshotHook<S> = <T>(select: (state: S) => T) => T

/**
 * Note on `ctx.remote`: it is NOT modelled here on purpose.
 *
 * The Host Remote namespaces belong to `@deepseek-ai/dsh-api-gateway`, which
 * is not part of the web composition (`packages/bundle/web-app/cordis.patch.yml`
 * lists neither `api-gateway` nor `typert`), and the runner's guard rejects any
 * read of it from a dynamic plugin with
 * `cannot get property "remote.…" without inject`. Every mutation therefore
 * goes through the direct services below.
 */

/**
 * One session the host list publishes.
 *
 * `updatedAt` is the host's own last-mutation instant: it survives a reload,
 * so the plugin uses it for the activity ranking and the hover preview instead
 * of trusting only its own in-page stamps. `blank` marks an empty session — the
 * one `connectWorkspace` reuses rather than creating another.
 */
export interface SessionSummaryMirror {
  readonly displayTitle: string
  readonly running: boolean
  readonly updatedAt?: number
  readonly blank?: boolean
  readonly cwd?: string
  readonly parentId?: string
  /** 'subagent' for a durable child row; absent for a top-level session. */
  readonly origin?: string
}

/** One direct-child catalog entry as the subagent catalog publishes it. */
export interface SubagentEntryMirror {
  readonly kind: 'child' | 'diagnostic'
  readonly id: string
  readonly activity?: 'running' | 'inactive'
  readonly hasChildren?: boolean
  readonly mode?: 'one-shot' | 'continuable'
  readonly label?: string
}

/** One parent-addressed subagent catalog. */
export interface SubagentCatalogMirror {
  readonly entries?: readonly SubagentEntryMirror[]
  readonly state?: 'loading' | 'ready' | 'error'
  readonly parentAvailable?: boolean
}

/** One background job a session can see. */
export interface JobMirror {
  readonly id?: string
  readonly state?: string
  readonly label?: string
}

/** Session list state. */
export interface SessionListState {
  readonly ids: readonly string[]
  readonly byId: Readonly<Record<string, SessionSummaryMirror | undefined>>
  /** Direct-child catalogs keyed by the parent session id. */
  readonly subagentsByParent?: Readonly<Record<string, SubagentCatalogMirror | undefined>>
  /** Background jobs per session id; an absent key is an empty set. */
  readonly jobsBySession?: Readonly<Record<string, readonly JobMirror[] | undefined>>
}

/** One workspace as the workspace list publishes it. */
export interface WorkspaceRecord {
  readonly workspaceId: string
  readonly title: string
  readonly sessionIds: readonly string[]
  /** Canonical host directory path. */
  readonly path?: string
}

/** Workspace list state. */
export interface WorkspaceListState {
  readonly items: readonly WorkspaceRecord[]
  readonly archivedSessionIds: readonly string[]
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
  /** Creates a session bound to that workspace and resolves its id. */
  connectWorkspace?: (workspaceId: string) => Promise<string>
  /** Moves a session out of the visible list without deleting its log. */
  archiveSession?: (sessionId: string) => Promise<void>
  /** Restores an archived session to its recorded workspace position. */
  unarchiveSession?: (sessionId: string) => Promise<void>
  /** Renames a workspace (changes its displayed title). */
  rename?: (workspaceId: string, title: string) => Promise<unknown>
  /** Reorders a workspace before another one. */
  insertBefore?: (workspaceId: string, beforeWorkspaceId?: string) => Promise<void>
}

/**
 * A durable direct-parent subagent address.
 *
 * `uiWorkspace.openSession` accepts one at the same seam as a plain session id,
 * which is how the plugin opens a child chat without asking the parent.
 */
export interface SubagentAddressMirror {
  readonly parentSessionId: string
  readonly childSessionId: string
  readonly mode: 'one-shot' | 'continuable'
}

/** A session id, or a subagent address standing in for one. */
export type SessionTarget = string | SubagentAddressMirror

/**
 * The `uiWorkspace` capability surface.
 *
 * Introduced in `0.1.2-alpha.1` (connectWorkspace / pickDirectory /
 * archiveSession moved off `workspaces`) and widened since:
 *
 * | method | since |
 * |---|---|
 * | `connectWorkspace`, `startSession`, `archiveSession`, `pickDirectory` | 0.1.2-alpha.1 |
 * | `openSession`, `openWorkspace`, `forkSession`, `unarchiveSession` | 0.1.6-alpha.1 |
 * | `listDirectory`, `createDirectory` | 0.1.6-alpha.1 |
 *
 * `openSession` is the replacement for the removed `sessions.open()` and is
 * therefore the navigation primitive this plugin depends on.
 */
export interface UiWorkspaceService {
  /** Selects a session (or subagent child) and shows its conversation. */
  openSession?: (target: SessionTarget) => void
  /** Connects a workspace and opens its session. */
  openWorkspace?: (workspaceId: string, beforeOpen?: (sessionId: string) => void) => Promise<void>
  /** Forks a session and opens the child. */
  forkSession?: (sessionId: string) => Promise<void>
  /** Connects (or creates) the blank session bound to a workspace. */
  connectWorkspace: (workspaceId: string) => Promise<string>
  /** Starts a New Session flow and navigates to its session. */
  startSession?: (workspaceId?: string) => void
  /** Archives (and clears if current) a session. */
  archiveSession: (sessionId: string) => Promise<void>
  /** Unarchives a session, restoring it to its recorded workspace position. */
  unarchiveSession?: (sessionId: string) => Promise<void>
  /** Opens the host-native directory picker. */
  pickDirectory: () => Promise<string | null>
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

/** A borrowed session binding, the shape `sessions.binding(id)` resolves. */
export interface SessionBindingMirror {
  readonly sessionId: string
  readonly session: SessionFaceMirror
}

/**
 * One owned use of an exact session generation.
 *
 * Upstream this extends `Disposable` (which needs `esnext.disposable` in the
 * lib set); the mirror spells out the one member the plugin would call, so the
 * plugin's narrower `lib` does not have to widen just for a symbol.
 */
export interface SessionReferenceMirror {
  readonly sessionId: string
  readonly ready?: Promise<unknown>
  release: () => void
}

/** Consumer identity for one reference acquisition. */
export interface SessionRetainOptionsMirror {
  readonly source: string
  readonly signal?: AbortSignal
}

/** The sessions service members this plugin uses. */
export interface SessionsService {
  /**
   * Legacy navigation verb, removed in `0.1.6-alpha.1`. Kept as an optional
   * member because the plugin still prefers it over "no navigation at all"
   * when running on an older base, and probing for it is how the adapter tells
   * the two bases apart.
   */
  open?: (sessionId: string) => unknown
  /**
   * Create a blank session bound to a workspace (the internal implementation
   * of `connectWorkspace` on every supported base).
   */
  create?: (request: { readonly workspaceId?: string }) => Promise<string>
  /**
   * Resolve the live face of a session. The returned `.session` is a
   * `SessionFace` (`ISession & ObservableSnapshot<ConversationSnapshot>`), which
   * exposes the full message history — the sticky-note hover preview reads the
   * last message from here. Messages ARE exposed by the harness; this was
   * previously a misconception in the plugin.
   */
  binding?: (sessionId: string) => SessionBindingMirror | undefined
  /** Reference-counted ownership of one session generation. */
  retain?: (target: SessionTarget, options: SessionRetainOptionsMirror) => SessionReferenceMirror
  /** Retain for the duration of a callback. */
  using?: <T>(
    target: SessionTarget,
    options: SessionRetainOptionsMirror,
    operation: (reference: SessionReferenceMirror) => T | Promise<T>,
  ) => Promise<T>
  /** Fork a session from a completed-turn prefix of the source. */
  fork?: (opts: { readonly sessionId: string; readonly atSeq?: number; readonly increaseTitle?: boolean }) => Promise<string>
  /** Refresh the host-authoritative session list. */
  refresh?: () => Promise<void>
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
