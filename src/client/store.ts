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

/** The complete scene state. */
export interface SceneState {
  readonly mode: Mode
  readonly active: string | null
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
  /** Short-lived status or error message announced to assistive technology. */
  readonly notice: string | null
  readonly drag: Drag | null
  readonly modal: Modal | null
}

/** Movement in CSS pixels before a pointer press counts as a drag, not a click. */
export const DRAG_THRESHOLD = 6

const INITIAL: SceneState = {
  mode: 'top',
  active: null,
  layout: new Array<string | null>(DESKS).fill(null),
  labels: {},
  order: {},
  limit: 12,
  intensity: 'overdrive',
  grid: true,
  transition: 'idle',
  pending: null,
  notice: null,
  drag: null,
  modal: null,
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
