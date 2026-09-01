/**
 * Session adapter — wraps all sessions service calls.
 * @module dsh-client-pixel-office/adapters/session
 */

import type { AdapterDeps, CapabilityReport } from './types.ts'
import type { SessionsService, SessionFaceMirror } from '../contracts.ts'

export interface SessionAdapter {
  /** Open a session (switch the conversation view to it). */
  open: (sessionId: string) => void
  /** Create a blank session bound to a workspace. */
  create: (workspaceId: string) => Promise<string>
  /** Whether create is available (alternative to connectWorkspace). */
  canCreate: boolean
  /** Resolve the live face of a session for reading message history. */
  binding: (sessionId: string) => SessionFaceMirror | undefined
  probe: () => CapabilityReport
}

export function createSessionAdapter(deps: AdapterDeps): SessionAdapter {
  const s = deps.sessions as SessionsService | undefined

  const open = (sessionId: string): void => {
    s?.open(sessionId)
  }

  const create = async (workspaceId: string): Promise<string> => {
    if (s?.create === undefined) throw new Error('sessions.create unavailable')
    return s.create({ workspaceId })
  }

  const canCreate = s?.create !== undefined

  const binding = (sessionId: string): SessionFaceMirror | undefined => {
    return s?.binding?.(sessionId)?.session
  }

  const probe = (): CapabilityReport => {
    const ok: string[] = []
    const missing: { name: string; reason: string }[] = []

    if (s?.open !== undefined) ok.push('sessions.open')
    else missing.push({ name: 'sessions.open', reason: '无法打开会话' })

    if (s?.binding !== undefined) ok.push('sessions.binding')
    else missing.push({ name: 'sessions.binding', reason: '消息预览不可用' })

    return { ok, missing, viable: missing.length === 0 }
  }

  return { open, create, canCreate, binding, probe }
}