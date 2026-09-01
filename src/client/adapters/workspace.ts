/**
 * Workspace adapter — wraps all workspace / uiWorkspace service calls.
 *
 * The harness moved `connectWorkspace` / `pickDirectory` / `archiveSession`
 * from `workspaces` (v2) to `uiWorkspace` (master >= 0.1.2-alpha.1). This
 * adapter probes both surfaces and provides a unified API with fallback chains,
 * so the rest of the plugin never needs to know which service carries which
 * method.
 * @module dsh-client-pixel-office/adapters/workspace
 */

import type { AdapterDeps, CapabilityReport } from './types.ts'
import type { WorkspacesService, UiWorkspaceService } from '../contracts.ts'

export interface WorkspaceAdapter {
  /** Create a workspace from a local directory path. */
  create: (path: string) => Promise<unknown>
  /** Delete a workspace by id. */
  delete: (workspaceId: string) => Promise<void>
  /** Rename a workspace (change its displayed title). */
  rename: (workspaceId: string, title: string) => Promise<unknown>
  /** Whether rename is available. */
  canRename: boolean
  /** Open the host-native directory picker and resolve the chosen path. */
  pickDirectory: () => Promise<string | null>
  /** Connect (or create) a blank session bound to a workspace. */
  connectWorkspace: (workspaceId: string) => Promise<string>
  /** Archive a session. */
  archiveSession: (sessionId: string) => Promise<void>
  /** Probe the adapter and report which capabilities are available. */
  probe: () => CapabilityReport
}

export function createWorkspaceAdapter(deps: AdapterDeps): WorkspaceAdapter {
  const w = deps.workspaces as WorkspacesService | undefined
  const u = deps.uiWorkspace as UiWorkspaceService | undefined

  const create = async (path: string): Promise<unknown> => {
    if (w?.create === undefined) throw new Error('workspaces.create unavailable')
    return w.create({ path })
  }

  const deleteWorkspace = async (workspaceId: string): Promise<void> => {
    if (w?.delete === undefined) throw new Error('workspaces.delete unavailable')
    return w.delete(workspaceId)
  }

  const rename = async (workspaceId: string, title: string): Promise<unknown> => {
    if (w?.rename === undefined) throw new Error('workspaces.rename unavailable')
    return w.rename(workspaceId, title)
  }

  const canRename = w?.rename !== undefined

  const pickDirectory = async (): Promise<string | null> => {
    if (u?.pickDirectory !== undefined) return u.pickDirectory()
    if (w?.pickDirectory !== undefined) return w.pickDirectory()
    throw new Error('pickDirectory unavailable on both surfaces')
  }

  const connectWorkspace = async (workspaceId: string): Promise<string> => {
    if (u?.connectWorkspace !== undefined) return u.connectWorkspace(workspaceId)
    if (w?.connectWorkspace !== undefined) return w.connectWorkspace(workspaceId)
    throw new Error('connectWorkspace unavailable on both surfaces')
  }

  const archiveSession = async (sessionId: string): Promise<void> => {
    if (u?.archiveSession !== undefined) { await u.archiveSession(sessionId); return }
    if (w?.archiveSession !== undefined) { await w.archiveSession(sessionId); return }
    throw new Error('archiveSession unavailable on both surfaces')
  }

  const probe = (): CapabilityReport => {
    const ok: string[] = []
    const missing: { name: string; reason: string }[] = []

    if (w?.create !== undefined) ok.push('workspaces.create')
    else missing.push({ name: 'workspaces.create', reason: '无法创建工作区' })

    if (w?.delete !== undefined) ok.push('workspaces.delete')
    else missing.push({ name: 'workspaces.delete', reason: '无法删除工作区' })

    const hasPick = u?.pickDirectory !== undefined || w?.pickDirectory !== undefined
    if (hasPick) ok.push('pickDirectory')
    else missing.push({ name: 'pickDirectory', reason: '无法打开目录选择器' })

    const hasConnect = u?.connectWorkspace !== undefined || w?.connectWorkspace !== undefined
    if (hasConnect) ok.push('connectWorkspace')
    else missing.push({ name: 'connectWorkspace', reason: '无法创建会话' })

    const hasArchive = u?.archiveSession !== undefined || w?.archiveSession !== undefined
    if (hasArchive) ok.push('archiveSession')
    else missing.push({ name: 'archiveSession', reason: '无法归档会话' })

    return { ok, missing, viable: missing.length === 0 }
  }

  return {
    create, delete: deleteWorkspace, rename, canRename,
    pickDirectory, connectWorkspace, archiveSession, probe,
  }
}