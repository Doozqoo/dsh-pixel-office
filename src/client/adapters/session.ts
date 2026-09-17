/**
 * Session adapter — wraps all sessions service calls, plus the navigation verb
 * that moved off it.
 *
 * ## Why navigation lives here
 *
 * `0.1.6-alpha.1` deleted `sessions.open(id)` / `openSubagent(address)` /
 * `clear()` from `ISessions`: the service now only *owns* session generations
 * (`retain` / `using` / `binding`), and selecting which one the main panel shows
 * became a view-owner concern on `uiWorkspace.openSession(target)`. Calling the
 * old verb on that base is a silent no-op — `s?.open` is `undefined`, the
 * optional chain swallows it, and clicking a sticky note does nothing at all.
 *
 * The adapter therefore probes the new surface first and falls back to the
 * legacy verb, so one code path drives both bases. `openSubagent` rides the same
 * seam: `openSession` accepts a `SubagentAddress`, so a child chat opens without
 * going through its parent.
 * @module dsh-client-pixel-office/adapters/session
 */

import type { AdapterDeps, CapabilityReport } from './types.ts'
import type {
  SessionFaceMirror, SessionsService, SubagentAddressMirror, UiWorkspaceService,
} from '../contracts.ts'

export interface SessionAdapter {
  /** Open a session (switch the conversation view to it). */
  open: (sessionId: string) => void
  /** Whether any navigation verb exists on this base. */
  canNavigate: boolean
  /**
   * Open a durable subagent child by its address.
   * @returns whether the base exposes any way to do so.
   */
  openSubagent: (address: SubagentAddressMirror) => boolean
  /** Create a blank session bound to a workspace. */
  create: (workspaceId: string) => Promise<string>
  /** Whether create is available (alternative to connectWorkspace). */
  canCreate: boolean
  /**
   * Fork a session and open the child, when the base supports forking.
   * @param sessionId - the source session.
   * @returns the child id, or undefined when forking is unavailable.
   */
  fork: (sessionId: string) => Promise<string | undefined>
  /** Whether forking is usable on this base. */
  canFork: boolean
  /** Resolve the live face of a session for reading message history. */
  binding: (sessionId: string) => SessionFaceMirror | undefined
  probe: () => CapabilityReport
}

export function createSessionAdapter(deps: AdapterDeps): SessionAdapter {
  const s = deps.sessions as SessionsService | undefined
  const u = deps.uiWorkspace as UiWorkspaceService | undefined

  /**
   * The navigation chain: `uiWorkspace.openSession` (0.1.6+) → the removed
   * `sessions.open` (pre-0.1.6 bases). Returns whether a verb actually ran, so
   * callers and the probe agree on the same answer.
   */
  const openTarget = (target: string | SubagentAddressMirror): boolean => {
    if (u?.openSession !== undefined) {
      u.openSession(target)
      return true
    }
    // Legacy bases only know plain session ids; an address cannot be expressed.
    if (typeof target === 'string' && s?.open !== undefined) {
      s.open(target)
      return true
    }
    return false
  }

  const open = (sessionId: string): void => {
    if (openTarget(sessionId)) return
    console.error(
      'pixel-office: no session-navigation surface — neither uiWorkspace.openSession '
      + 'nor sessions.open is available, so clicking a note cannot switch the conversation',
    )
  }

  const canNavigate = u?.openSession !== undefined || s?.open !== undefined

  const openSubagent = (address: SubagentAddressMirror): boolean => openTarget(address)

  const create = async (workspaceId: string): Promise<string> => {
    if (s?.create === undefined) throw new Error('sessions.create unavailable')
    return s.create({ workspaceId })
  }

  const canCreate = s?.create !== undefined

  const canFork = u?.forkSession !== undefined || s?.fork !== undefined

  /**
   * Fork, preferring the verb that hands back the child id.
   *
   * `sessions.fork` resolves the child id and does not navigate, so the plugin
   * can open the child itself and keep the monitor in step with it.
   * `uiWorkspace.forkSession` forks *and* navigates but returns nothing, which
   * would leave the plugin unable to say which session it is now showing — it
   * is the fallback, not the first choice, even though it is the newer API.
   */
  const fork = async (sessionId: string): Promise<string | undefined> => {
    if (s?.fork !== undefined) {
      const childId = await s.fork({ sessionId, increaseTitle: true })
      openTarget(childId)
      return childId
    }
    if (u?.forkSession !== undefined) {
      await u.forkSession(sessionId)
      return undefined
    }
    return undefined
  }

  const binding = (sessionId: string): SessionFaceMirror | undefined => {
    return s?.binding?.(sessionId)?.session
  }

  const probe = (): CapabilityReport => {
    const ok: string[] = []
    const missing: { name: string; reason: string }[] = []

    if (u?.openSession !== undefined) ok.push('uiWorkspace.openSession')
    else if (s?.open !== undefined) ok.push('sessions.open (legacy)')
    else {
      missing.push({
        name: 'session navigation',
        reason: '既无 uiWorkspace.openSession 也无 sessions.open，点击便利贴无法切换会话',
      })
    }

    if (s?.binding !== undefined) ok.push('sessions.binding')
    else missing.push({ name: 'sessions.binding', reason: '消息预览不可用' })

    if (canFork) ok.push('session fork')

    return { ok, missing, viable: missing.length === 0 }
  }

  return { open, canNavigate, openSubagent, create, canCreate, fork, canFork, binding, probe }
}
