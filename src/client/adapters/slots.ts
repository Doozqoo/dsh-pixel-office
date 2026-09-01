/**
 * Slots adapter — wraps slot registration calls.
 * @module dsh-client-pixel-office/adapters/slots
 */

import type { AdapterDeps, CapabilityReport } from './types.ts'
import type { Disposer, SlotRegistration, SlotsService } from '../contracts.ts'

export interface SlotsAdapter {
  /** Register a component into a parent slot. */
  inject: (slotName: string, register: () => Disposer) => Disposer
  /** Register a component. */
  register: (registration: SlotRegistration, component: unknown) => Disposer
  probe: () => CapabilityReport
}

export function createSlotsAdapter(deps: AdapterDeps): SlotsAdapter {
  const s = deps.slots as SlotsService | undefined

  const inject = (slotName: string, register: () => Disposer): Disposer => {
    if (s === undefined) throw new Error('slots service unavailable')
    return s.inject(slotName, register)
  }

  const register = (registration: SlotRegistration, component: unknown): Disposer => {
    if (s === undefined) throw new Error('slots service unavailable')
    return s.register(registration, component)
  }

  const probe = (): CapabilityReport => {
    if (s === undefined) {
      return { ok: [], missing: [{ name: 'slots', reason: '插槽服务不可用，场景无法挂载' }], viable: false }
    }
    return { ok: ['slots'], missing: [], viable: true }
  }

  return { inject, register, probe }
}