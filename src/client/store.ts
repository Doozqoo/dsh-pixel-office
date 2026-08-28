/**
 * Pixel Office scene store and pointer-drag state.
 *
 * A hand-rolled store rather than a dependency: the plugin needs one
 * process-local object with subscribe/snapshot, and everything the browser
 * bundle pulls in must be inlined (the shell's module table answers only the
 * baseline specifiers), so an external store library would be dead weight.
 * @module dsh-client-pixel-office/store
 */
import { DESKS, type Placement } from './placement.ts'

/** Which view the scene is showing. */
export type Mode = 'top' | 'desk'

/** An in-flight pointer drag. */
export type Drag =
  | { kind: 'desk'; from: number; x: number; y: number; moved: boolean; over: number }
  | { kind: 'sticker'; pos: number; sid: string; x: number; y: number; moved: boolean; over: number }
  | { kind: 'stack'; x: number; y: number; moved: boolean; over: number }

/** A dialog awaiting the user. */
export type Modal =
  | { kind: 'new'; pos: number }
  | { kind: 'edit'; sid: string }
  | { kind: 'full' }
  | { kind: 'tear'; sid: string }
  | { kind: 'clear'; wsId: string; title: string }
  | { kind: 'rename'; wsId: string; title: string }

/** The complete scene state. */
export interface SceneState {
  /** Whether the fixed pixel skin is active; always true in this plugin version. */
  readonly enabled: boolean
  readonly mode: Mode
  readonly active: string | null
  /**
   * The session the user picked on the current desk, or null for a dark screen.
   *
   * The conversation is the shell's own portaled slot: it keeps showing
   * whichever session was opened last, and nothing about entering a desk
   * changes that. Revealing it on desk mode alone therefore displayed the
   * previous workspace's session on a desk that might have no notes at all.
   * The monitor now only lights up while this names a session pinned to the
   * active desk, so entering a desk always starts dark.
   */
  readonly opened: string | null
  readonly layout: Placement
  /** Display text per session id, overriding the session's own title. */
  readonly labels: Readonly<Record<string, string>>
  /** Note placement per workspace id. */
  readonly order: Readonly<Record<string, Placement>>
  readonly limit: number
  /** User-facing cyberdeck intensity: calm keeps the look but trims ambient motion. */
  readonly intensity: 'calm' | 'overdrive'
  /** Whether the diegetic grid and terminal overlays are visible. */
  readonly grid: boolean
  /**
   * Brief transition phase for cinematic desk entry/exit.
   *
   * Only ever 'entering' or 'idle'. There is deliberately no 'leaving': that
   * phase deferred the mode switch behind a timer, and any competing store
   * write inside the window stranded the scene collapsed and unreachable.
   * Leaving now commits the mode immediately and animates the arriving view.
   */
  readonly transition: 'idle' | 'entering'
  /**
   * A slot reserved by an in-flight drop, until its session id exists.
   *
   * Creating a session is asynchronous, so the workspace list can publish the
   * new id — and the reconcile effect can auto-place it in the lowest free
   * cell — before the drop handler learns which id it created. Two writers
   * then race for the same grid. While this is set for a workspace, the
   * reconcile effect leaves that grid alone and the drop handler is the sole
   * authority for it.
   */
  readonly pending: { readonly wsId: string; readonly pos: number } | null
  /**
   * A workspace creation in flight with an aimed cell.
   *
   * Same race as {@link pending}, one level up: `workspaces.create` publishes
   * the new id asynchronously and returns nothing usable, so the top-view
   * reconcile would sweep the fresh workspace into the lowest free cell no
   * matter which empty station the user clicked. While this is set, the layout
   * reconcile waits for the id that is NOT in `before` (the desk-id snapshot
   * taken when creation started) and drops it at `pos`. It is volatile runtime
   * state and deliberately not persisted.
   */
  readonly pendingLayout: { readonly pos: number; readonly before: string } | null
  /** Short-lived status or error message announced to assistive technology. */
  readonly notice: string | null
  /**
   * Last-activity timestamp per session id (epoch ms).
   *
   * The approximate "this session was touched" signal the v2 features share:
   * the sticker preview (A), the cat state machine (B), the desk lamp and the
   * today panel (C), and the standby thumbnails (D) all read it. It is an
   * approximation — `openSession()` stamps it — not a real event stream, and it
   * is deliberately NOT persisted: it is volatile runtime state, so it stays
   * out of {@link PersistedScene} and out of `localStorage`.
   */
  readonly activity: Readonly<Record<string, number>>
  readonly drag: Drag | null
  readonly modal: Modal | null
  /** Host transport link state, driven by the `connection/reset` event. */
  readonly link: 'ok' | 'lost'
  /** Host appearance scheme reported by `theme/change`. */
  readonly scheme: 'light' | 'dark'
  /**
   * Top-view desk-order mode, reflected by the toolbar sort control.
   *
   * `'manual'` (default) leaves `layout` to the user's drag arrangement;
   * `'activity'` means the last applied sort was by recent activity. The mode
   * is UI-only state and is deliberately NOT persisted — only `layout` (the
   * actual order) survives a reload. Applying a sort is a one-shot reorder of
   * `layout`; afterwards the user can still drag to fine-tune.
   */
  readonly sortMode: 'manual' | 'activity'
}

/** Movement in CSS pixels before a pointer press counts as a drag, not a click. */
export const DRAG_THRESHOLD = 6

const INITIAL: SceneState = {
  enabled: true,
  mode: 'top',
  active: null,
  opened: null,
  layout: new Array<string | null>(DESKS).fill(null),
  labels: {},
  order: {},
  limit: 12,
  intensity: 'overdrive',
  grid: true,
  transition: 'idle',
  pending: null,
  pendingLayout: null,
  notice: null,
  activity: {},
  drag: null,
  modal: null,
  link: 'ok',
  scheme: 'dark',
  sortMode: 'manual',
}

type Listener = () => void

/** Subscribable snapshot holder. */
export interface Store {
  get: () => SceneState
  set: (patch: Partial<SceneState>) => void
  subscribe: (listener: Listener) => () => void
}

/**
 * Create the scene store.
 * @param seed - restored fields merged over the defaults, so a reload keeps the
 * user's arrangement. Volatile fields (mode, drag, modal, notice) are never
 * seeded: a page load always starts at the top view with nothing in flight.
 * @returns a store seeded with the initial scene state.
 */
export function createStore(seed?: Partial<SceneState>): Store {
  // Seed merges over defaults. Previously `enabled`, `intensity`, and `grid`
  // were forced back to their defaults on every write so the presentation was
  // immutable; they are now user-controllable (the settings section drives
  // them), so the seed and writes are taken at face value.
  let state: SceneState = seed === undefined ? INITIAL : { ...INITIAL, ...seed }
  const listeners = new Set<Listener>()
  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...patch }
      for (const listener of listeners) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

/**
 * Locate the cell under a viewport point.
 * @param registry - cell index to element, as populated by React refs.
 * @param x - viewport x.
 * @param y - viewport y.
 * @returns the cell index, or -1 when the point is outside every cell.
 */
export function hitIndex(
  registry: Readonly<Record<number, HTMLElement | null>>,
  x: number,
  y: number,
): number {
  for (const [key, element] of Object.entries(registry)) {
    if (element === null || element === undefined) continue
    const rect = element.getBoundingClientRect()
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return Number(key)
  }
  return -1
}
