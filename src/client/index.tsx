/**
 * Browser half of the Pixel Office plugin: reads the workspace and session
 * lists and registers the scene into `shell.overlay`.
 *
 * Every side effect is owned by the Cordis fiber, so unloading the plugin
 * removes the stylesheet, theme overrides, and overlay registration, and the
 * shipped theme returns with no page reload.
 *
 * All harness service calls are routed through the adapter layer
 * ({@link ./adapters}), so a harness API change is a single-file fix.
 * @module dsh-client-pixel-office/client
 */
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { ClientContext, Disposer, OverlayProps } from './contracts.ts'
import type { SessionFaceMirror } from './contracts.ts'
import { createAdapters, probeAdapters, PLUGIN_ID } from './adapters/index.ts'
import type { Adapters } from './adapters/index.ts'
import { clickSettingsTrigger } from './adapters/dom.ts'
import { assessCompatibility, parseVersion } from './compat.ts'
import { loadScene, persistScene, pruneScene } from './persist.ts'
import {
  DESKS, UNGROUPED_KEY,
  LINK_LOST_TOAST_MS, NOTICE_TOAST_MS, ENTER_TRANSITION_MS, LEAVE_TRANSITION_MS,
  OPEN_GRACE_MS,
} from './constants.ts'
import { STR } from './strings.ts'
import { fitInto, sameGrid } from './placement.ts'
import { createStore } from './store.ts'
import { insertBaseStyles, insertStyles } from './styles.ts'
import { DARK_TOKENS, LIGHT_TOKENS, pairTokens } from './tokens.ts'
import { DeskView, Dialogs, DragGhost, PixelOfficeSettings, TopView, lastMessageFromFace, useScene } from './views.tsx'
import type { DeskRecord, NoteRecord } from './views.tsx'
import { readHostVersion } from './version.ts'

/**
 * Read the host appearance scheme from a theme/change snapshot.
 * @param snapshot - the payload of the theme/change event.
 * @returns the scheme, or undefined when the shape is unexpected.
 */
function readScheme(snapshot: unknown): 'light' | 'dark' | undefined {
  const snap = snapshot as
    | { active?: { colorScheme?: string }; preference?: string }
    | undefined
  const scheme = snap?.active?.colorScheme
  if (scheme === 'light' || scheme === 'dark') return scheme
  const preference = snap?.preference
  if (preference === 'light' || preference === 'dark') return preference
  return undefined
}

/**
 * Services this plugin consumes, declared so the plugin fiber can resolve
 * them from the host root context.
 */
export const inject = ['slots', 'theme', 'workspaces', 'uiWorkspace', 'sessions']

/**
 * Mount the Pixel Office scene.
 *
 * A function plugin with named exports, never a default export.
 * @param ctx - the client plugin context.
 */
export function apply(ctx: ClientContext): void {
  // ── Create adapters from raw service handles ──────────────────────────
  const adapters: Adapters = createAdapters({
    ctx: { on: ctx.on.bind(ctx), effect: ctx.effect.bind(ctx) },
    slots: ctx.get('slots'),
    theme: ctx.get('theme'),
    workspaces: ctx.get('workspaces'),
    uiWorkspace: ctx.get('uiWorkspace'),
    sessions: ctx.get('sessions'),
  })

  // ── Capability probe ──────────────────────────────────────────────────
  const report = probeAdapters(adapters)
  if (!report.viable) {
    console.error(
      `${PLUGIN_ID}: capability probe failed`,
      report.missing.map(m => `${m.name}: ${m.reason}`),
    )
    return
  }
  if (report.missing.length > 0) {
    console.warn(
      `${PLUGIN_ID}: soft dependencies missing`,
      report.missing.map(m => `${m.name}: ${m.reason}`),
    )
  }

  // ── Version compatibility check ───────────────────────────────────────
  const compat = assessCompatibility(parseVersion(readHostVersion()))
  if (!compat.compatible) {
    console.error(`${PLUGIN_ID}: ${compat.warning}`)
  } else if (compat.warning !== null) {
    console.warn(`${PLUGIN_ID}: ${compat.warning}`)
  }

  /**
   * Resolve the most recent message of a session for the hover preview.
   */
  const readLastMessage = (sessionId: string): { role: string; text: string } | undefined => {
    const face = adapters.session.binding(sessionId)
    return lastMessageFromFace(face)
  }

  // ── Fiber-owned timers ────────────────────────────────────────────────
  const pendingTimers = new Set<number>()
  ctx.effect(() => () => {
    for (const handle of pendingTimers) window.clearTimeout(handle)
    pendingTimers.clear()
  }, `${PLUGIN_ID}:timers`)

  const later = (callback: () => void, delay: number): void => {
    const handle = window.setTimeout(() => {
      pendingTimers.delete(handle)
      callback()
    }, delay)
    pendingTimers.add(handle)
  }

  // ── Store ─────────────────────────────────────────────────────────────
  const store = createStore(loadScene())
  ctx.effect(() => persistScene(store), `${PLUGIN_ID}:persist`)

  /**
   * Rename a workspace (the "re-label the workstation" action).
   */
  const renameWorkspace = async (workspaceId: string, title: string): Promise<void> => {
    if (!adapters.workspace.canRename) {
      store.set({ notice: STR.NOTICE_RENAME_OFFLINE })
      return
    }
    try {
      await adapters.workspace.rename(workspaceId, title)
      store.set({ notice: STR.NOTICE_RENAME_OK })
    } catch (error) {
      console.error(`${PLUGIN_ID}: workspace rename failed`, error)
      store.set({ notice: STR.NOTICE_RENAME_FAILED })
    }
  }

  // ── Styles ────────────────────────────────────────────────────────────
  ctx.effect(() => {
    const removeBase = insertBaseStyles()
    let removeSkin: Disposer | undefined
    let removeTokens: Disposer | undefined
    const applySkin = (on: boolean): void => {
      if (on && removeSkin === undefined) {
        removeSkin = insertStyles()
        removeTokens = adapters.theme.overrideTokens(PLUGIN_ID, pairTokens(DARK_TOKENS, DARK_TOKENS))
      } else if (!on && removeSkin !== undefined) {
        removeSkin(); removeTokens?.(); removeSkin = undefined; removeTokens = undefined
      }
    }
    applySkin(store.get().enabled)
    const unsubscribe = store.subscribe(() => applySkin(store.get().enabled))
    return () => { unsubscribe(); applySkin(false); removeBase() }
  }, `${PLUGIN_ID}:styles`)

  // ── Events ────────────────────────────────────────────────────────────
  const offReset = adapters.events.onConnectionReset(() => {
    store.set({ link: 'lost', notice: STR.NOTICE_LINK_LOST })
    later(() => store.set({ link: 'ok' }), LINK_LOST_TOAST_MS)
  })
  const offTheme = adapters.events.onThemeChange((snapshot) => {
    const scheme = readScheme(snapshot)
    if (scheme !== undefined) store.set({ scheme })
  })
  ctx.effect(() => () => { offReset(); offTheme() }, `${PLUGIN_ID}:events`)

  function Scene(props: OverlayProps): ReactNode {
    const scene = useScene(store)
    const [consumed, setConsumed] = useState(0)

    const desks = props.useWorkspaces(state => state.items.map(w => ({
      id: w.workspaceId,
      title: w.title,
      sessionIds: [...w.sessionIds],
      ...(w.path === undefined ? {} : { path: w.path }),
    }))) as readonly DeskRecord[]

    const archived = props.useWorkspaces(state => state.archivedSessionIds.join(','))
    const archivedIds = archived === '' ? [] : archived.split(',')

    const allIds = props.useSessions(state => [...state.ids])
    const realSessionIds = props.useWorkspaces(
      state => state.items.flatMap(w => [...w.sessionIds]),
    ) as readonly string[]
    const ungroupedIds = allIds.filter(
      id => !archivedIds.includes(id) && !realSessionIds.includes(id),
    )

    const stationList = [
      { id: UNGROUPED_KEY, title: '未分组', sessionIds: ungroupedIds },
      ...desks,
    ] as readonly DeskRecord[]
    const noteEntries = props.useSessions(state => state.ids.map((id) => {
      const record = state.byId[id]
      return record === undefined
        ? null
        : [id, {
            title: record.displayTitle,
            running: record.running,
            ...(record.updatedAt === undefined ? {} : { updatedAt: record.updatedAt }),
            ...(record.blank === undefined ? {} : { blank: record.blank }),
            ...(record.origin === undefined ? {} : { origin: record.origin }),
          }] as const
    }))
    const notes: Record<string, NoteRecord> = {}
    for (const entry of noteEntries) if (entry !== null) notes[entry[0]] = entry[1]

    /**
     * Direct subagent children per parent session.
     *
     * The harness grew a durable parent/child catalog in this span: a session
     * can own continuable child chats, surfaced in the host as a lineage strip
     * plus a side chat. The board shows the count so a busy parent is visible
     * without opening it; `openSession` accepts the child's address, so the
     * count is also the way in.
     */
    const subagents = props.useSessions((state) => {
      const out: Record<string, number> = {}
      for (const [parentId, catalog] of Object.entries(state.subagentsByParent ?? {})) {
        const children = (catalog?.entries ?? []).filter(e => e.kind === 'child').length
        if (children > 0) out[parentId] = children
      }
      return out
    })

    /** Background jobs per session (the host's own `jobsBySession` projection). */
    const jobs = props.useSessions((state) => {
      const out: Record<string, number> = {}
      for (const [sid, list] of Object.entries(state.jobsBySession ?? {})) {
        if (list !== undefined && list.length > 0) out[sid] = list.length
      }
      return out
    })

    const running: Record<string, boolean> = {}
    const liveCounts: Record<string, number> = {}
    const subCounts: Record<string, number> = {}
    const recency: Record<string, number> = {}
    const archivedByDesk: Record<string, readonly string[]> = {}
    for (const desk of stationList) {
      const live = desk.sessionIds.filter(
        id => notes[id] !== undefined && !archivedIds.includes(id),
      )
      liveCounts[desk.id] = live.length
      running[desk.id] = live.some(id => notes[id]?.running === true)
      subCounts[desk.id] = live.reduce((sum, id) => sum + (subagents[id] ?? 0), 0)
      recency[desk.id] = live.reduce(
        (max, id) => Math.max(max, notes[id]?.updatedAt ?? 0), 0,
      )
      // Newest torn-off note first: the drawer is a "what did I just put away"
      // surface, so host order (which is registry order) is the wrong sort.
      archivedByDesk[desk.id] = desk.sessionIds
        .filter(id => archivedIds.includes(id))
        .sort((a, b) => (notes[b]?.updatedAt ?? 0) - (notes[a]?.updatedAt ?? 0))
    }
    // Archived sessions no workspace accounts for belong to the 未分组 desk:
    // that station is the host's own home for "not in any workspace", and an
    // archived session whose workspace was deleted has to land somewhere or it
    // could never be restored.
    archivedByDesk[UNGROUPED_KEY] = archivedIds
      .filter(id => !realSessionIds.includes(id))
      .sort((a, b) => (notes[b]?.updatedAt ?? 0) - (notes[a]?.updatedAt ?? 0))

    const deskIdKey = stationList.map(d => d.id).join(',')
    useEffect(() => {
      const ids = deskIdKey === '' ? [] : deskIdKey.split(',')
      const aimed = scene.pendingLayout
      if (aimed !== null) {
        const before = aimed.before === '' ? [] : aimed.before.split(',')
        const fresh = ids.find(id => !before.includes(id))
        if (fresh !== undefined) {
          const layout = store.get().layout.slice()
          const free = layout[aimed.pos] === null || layout[aimed.pos] === undefined
            ? aimed.pos
            : layout.indexOf(null)
          if (free >= 0) layout[free] = fresh
          store.set({ layout, pendingLayout: null })
        }
        return
      }
      if (ids.length === 0) return
      const reconciled = fitInto(store.get().layout, ids, DESKS, false)
      const next: (string | null)[] = [...reconciled]
      if (next[0] !== UNGROUPED_KEY) {
        const displaced = next[0] ?? null
        const at = next.indexOf(UNGROUPED_KEY)
        if (at > 0) next[at] = displaced
        next[0] = UNGROUPED_KEY
      }
      if (!sameGrid(next, store.get().layout)) store.set({ layout: next })
    }, [deskIdKey, scene.pendingLayout])

    const sessionIdKey = Object.keys(notes).join(',')
    useEffect(() => {
      const current = store.get()
      const pruned = pruneScene(
        current.order,
        current.labels,
        deskIdKey === '' ? [] : deskIdKey.split(','),
        sessionIdKey === '' ? [] : sessionIdKey.split(','),
      )
      if (pruned.order !== current.order || pruned.labels !== current.labels) {
        store.set({ order: pruned.order, labels: pruned.labels })
      }
    }, [deskIdKey, sessionIdKey])

    const active = scene.active
    const activeDesk = active === null ? undefined : stationList.find(d => d.id === active)
    const liveKey = activeDesk === undefined
      ? ''
      : activeDesk.sessionIds.filter(id => notes[id] !== undefined && !archivedIds.includes(id)).join(',')

    useEffect(() => {
      if (active === null) return
      if (store.get().pending?.wsId === active) return
      const current = store.get().order[active]
      const ids = liveKey === '' ? [] : liveKey.split(',')
      const next = fitInto(current, ids, store.get().limit, true)
      if (!sameGrid(next, current)) {
        store.set({ order: { ...store.get().order, [active]: next } })
      }
    }, [liveKey, scene.limit, active, scene.pending])

    const missing = scene.mode === 'desk' && activeDesk === undefined
    useEffect(() => {
      if (missing) store.set({ mode: 'top', active: null })
    }, [missing])

    const createWorkspace = async (pos?: number) => {
      try {
        store.set({ notice: STR.NOTICE_SCANNING })
        const path = await adapters.workspace.pickDirectory()
        if (path === null || path === '') {
          store.set({ notice: null, pendingLayout: null })
          return
        }
        if (pos !== undefined) {
          store.set({ pendingLayout: { pos, before: deskIdKey } })
        }
        await adapters.workspace.create(path)
        store.set({ notice: STR.NOTICE_LINKED })
      } catch (error) {
        console.error(`${PLUGIN_ID}: workspace creation failed`, error)
        store.set({ notice: STR.NOTICE_LINK_FAILED, pendingLayout: null })
      }
    }

    const openSession = (sessionId: string) => {
      if (!adapters.session.canNavigate) {
        store.set({ notice: STR.NOTICE_NAV_OFFLINE })
        return
      }
      adapters.session.open(sessionId)
      store.set({
        opened: sessionId,
        // Bridge the host round-trip between "we asked for this session" and
        // "the workspace list agrees it is on this desk". See OPEN_GRACE_MS.
        openedGrace: Date.now() + OPEN_GRACE_MS,
        activity: { ...store.get().activity, [sessionId]: Date.now() },
      })
    }

    /**
     * Stick a torn-off note back on the board.
     *
     * This is the other half of the tear gesture, and it only became possible
     * once `uiWorkspace.unarchiveSession` / `workspaces.unarchiveSession`
     * shipped: the host restores the session to its *recorded* workspace
     * position, so the plugin does not have to guess a cell — the reconcile
     * pass picks the restored id up and `fitInto` places it in the lowest free
     * slot on whichever desk it belonged to.
     */
    const restoreSession = async (sessionId: string) => {
      if (!adapters.workspace.canUnarchive) {
        store.set({ notice: STR.NOTICE_RESTORE_OFFLINE })
        return
      }
      try {
        await adapters.workspace.unarchiveSession(sessionId)
        store.set({ notice: STR.NOTICE_RESTORED })
      } catch (error) {
        console.error(`${PLUGIN_ID}: session restore failed`, error)
        store.set({ notice: STR.NOTICE_RESTORE_FAILED })
      }
    }

    const forkSession = async (sessionId: string) => {
      if (!adapters.session.canFork) {
        store.set({ notice: STR.NOTICE_FORK_OFFLINE })
        return
      }
      try {
        store.set({ notice: STR.NOTICE_SPAWNING })
        const childId = await adapters.session.fork(sessionId)
        // `uiWorkspace.forkSession` already navigated; a bare `sessions.fork`
        // returns the child id for the caller to place. Either way the monitor
        // should follow the new link.
        if (childId !== undefined) openSession(childId)
        store.set({ notice: STR.NOTICE_FORKED })
      } catch (error) {
        console.error(`${PLUGIN_ID}: session fork failed`, error)
        store.set({ notice: STR.NOTICE_FORK_FAILED })
      }
    }

    const enterDesk = (workspaceId: string) => {
      store.set({
        mode: 'desk', active: workspaceId, opened: null,
        transition: 'entering', notice: STR.NOTICE_ENTERED,
        // The drawer belongs to the desk it was opened on; carrying it into the
        // next one would show another workspace's archive before the user asked.
        archiveOpen: false,
      })
      later(() => {
        if (store.get().mode === 'desk') store.set({ transition: 'idle' })
      }, ENTER_TRANSITION_MS)
    }

    const leaveDesk = () => {
      store.set({
        mode: 'top', active: null, opened: null, modal: null,
        transition: 'entering', notice: null, archiveOpen: false,
      })
      later(() => {
        if (store.get().mode === 'top') store.set({ transition: 'idle' })
      }, LEAVE_TRANSITION_MS)
    }

    const openSettings = () => {
      if (!clickSettingsTrigger()) {
        console.error(`${PLUGIN_ID}: settings trigger not found`)
      }
    }

    const clearWorkspace = (workspaceId: string) => {
      const desk = stationList.find(d => d.id === workspaceId)
      store.set({ modal: { kind: 'clear', wsId: workspaceId, title: desk?.title ?? '' } })
    }

    const renameWorkspaceReq = (workspaceId: string) => {
      const desk = stationList.find(d => d.id === workspaceId)
      store.set({ modal: { kind: 'rename', wsId: workspaceId, title: desk?.title ?? '' } })
    }

    /**
     * Resolve (or create) the id of a blank session bound to `workspaceId`.
     * Tries uiWorkspace.connectWorkspace → workspaces.connectWorkspace →
     * sessions.create, in that order.
     */
    const resolveSessionId = async (workspaceId: string): Promise<string> => {
      try {
        return await adapters.workspace.connectWorkspace(workspaceId)
      } catch {
        if (adapters.session.canCreate) {
          return adapters.session.create(workspaceId)
        }
        throw new Error('no session-create surface available')
      }
    }

    const addSession = async (pos: number, text: string) => {
      if (activeDesk?.id === UNGROUPED_KEY) {
        store.set({ notice: STR.NOTICE_UNGROUPED_RO })
        return
      }
      if (activeDesk === undefined) {
        store.set({ modal: null, notice: STR.NOTICE_SESSION_OFFLINE })
        return
      }
      const wsId = activeDesk.id
      store.set({ modal: null, pending: { wsId, pos }, notice: STR.NOTICE_SPAWNING })
      try {
        const sid = await resolveSessionId(wsId)
        const labels = { ...store.get().labels }
        if (text !== '') labels[sid] = text
        const placed = (store.get().order[wsId] ?? []).slice()
        while (placed.length < store.get().limit) placed.push(null)
        for (let i = 0; i < placed.length; i += 1) if (placed[i] === sid) placed[i] = null
        const free = placed[pos] === null || placed[pos] === undefined
        const target = free ? pos : placed.indexOf(null)
        if (target >= 0) placed[target] = sid
        store.set({
          labels,
          order: { ...store.get().order, [wsId]: placed },
          pending: null,
          notice: STR.NOTICE_SPAWNED,
        })
        setConsumed(value => value + 1)
        openSession(sid)
      } catch (error) {
        console.error(`${PLUGIN_ID}: session creation failed`, error)
        store.set({ pending: null, notice: STR.NOTICE_SPAWN_FAILED })
      }
    }

    const openedLive = scene.opened !== null
      && activeDesk !== undefined
      && activeDesk.sessionIds.includes(scene.opened)
      && notes[scene.opened] !== undefined
      && !archivedIds.includes(scene.opened)

    useEffect(() => {
      if (scene.opened === null || openedLive) return
      if (store.get().mode !== 'desk') return
      // A session created or forked a moment ago is not in the workspace list
      // yet; sweeping it here would blank the monitor the user just lit. The
      // grace is a deadline rather than a flag, so a session that never lands
      // stops being exempt on its own.
      if (Date.now() < scene.openedGrace) return
      store.set({ opened: null })
    }, [scene.opened, openedLive, scene.openedGrace])

    useEffect(() => {
      if (scene.notice === null) return
      const id = setTimeout(() => { store.set({ notice: null }) }, NOTICE_TOAST_MS)
      return () => { clearTimeout(id) }
    }, [scene.notice])

    useEffect(() => {
      if (!scene.enabled) return
      const el = document.createElement('div')
      el.className = 'pxo-scan'
      document.body.appendChild(el)
      return () => { el.remove() }
    }, [scene.enabled])

    if (!scene.enabled) return null

    return (
      <div
        className="pxo-root"
        data-mode={scene.mode}
        data-screen={openedLive ? 'on' : 'off'}
        data-intensity={scene.intensity}
        data-grid={scene.grid ? 'on' : 'off'}
        data-transition={scene.transition}
      >
        {scene.mode === 'top'
          ? (
              <TopView
                store={store}
                desks={stationList}
                running={running}
                liveCounts={liveCounts}
                subCounts={subCounts}
                recency={recency}
                onCreate={(index) => { void createWorkspace(index) }}
                onEnter={enterDesk}
                onClear={clearWorkspace}
                onRename={renameWorkspaceReq}
                onSettings={openSettings}
              />
            )
          : activeDesk === undefined
            ? null
            : (
                <DeskView
                  store={store}
                  desk={activeDesk}
                  notes={notes}
                  onOpen={openSession}
                  onBack={leaveDesk}
                  onSettings={openSettings}
                  consumed={consumed}
                  isUngrouped={activeDesk?.id === UNGROUPED_KEY}
                  readLastMessage={readLastMessage}
                  archived={archivedByDesk[activeDesk.id] ?? []}
                  subagents={subagents}
                  jobs={jobs}
                  canRestore={adapters.workspace.canUnarchive}
                  canFork={adapters.session.canFork}
                  onRestore={(sessionId) => { void restoreSession(sessionId) }}
                  onFork={(sessionId) => { void forkSession(sessionId) }}
                />
              )}
        <DragGhost store={store} notes={notes} />
        {scene.notice === null
          ? null
          : <div className="pxo-toast" role="status" aria-live="polite"><span />{scene.notice}</div>}
        <Dialogs
          store={store}
          notes={notes}
          onAdd={(pos, text) => { void addSession(pos, text) }}
          onTear={(sessionId) => {
            void adapters.workspace.archiveSession(sessionId).catch((error) => {
              console.error(`${PLUGIN_ID}: archive session failed`, error)
            })
          }}
          onFork={(sessionId) => { void forkSession(sessionId) }}
          onClear={async (workspaceId) => {
            await adapters.workspace.delete(workspaceId)
          }}
          onRename={(workspaceId, title) => { void renameWorkspace(workspaceId, title) }}
        />
      </div>
    )
  }

  ctx.effect(
    () => adapters.slots.inject('shell.overlay', () => adapters.slots.register(
      { name: 'shell.overlay', id: PLUGIN_ID, order: 100 },
      Scene,
    )),
    `${PLUGIN_ID}:overlay`,
  )

  ctx.effect(
    () => adapters.slots.inject('settings.section', () => adapters.slots.register(
      { name: 'settings.section', id: PLUGIN_ID, order: 60, label: STR.SETTINGS_TITLE },
      (owner: { close: () => void }) => <PixelOfficeSettings store={store} close={owner.close} />,
    )),
    `${PLUGIN_ID}:settings`,
  )
}