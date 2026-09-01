/**
 * Theme adapter — wraps theme token override calls.
 * @module dsh-client-pixel-office/adapters/theme
 */

import type { AdapterDeps, CapabilityReport } from './types.ts'
import type { Disposer, ThemeService, TokenOverride } from '../contracts.ts'

export interface ThemeAdapter {
  /** Override theme tokens for the plugin surface. Returns a disposer. */
  overrideTokens: (id: string, tokens: Readonly<Record<string, TokenOverride>>) => Disposer | undefined
  probe: () => CapabilityReport
}

export function createThemeAdapter(deps: AdapterDeps): ThemeAdapter {
  const t = deps.theme as ThemeService | undefined

  const overrideTokens = (
    id: string,
    tokens: Readonly<Record<string, TokenOverride>>,
  ): Disposer | undefined => {
    return t?.overrideTokens(id, tokens)
  }

  const probe = (): CapabilityReport => {
    if (t?.overrideTokens !== undefined) return { ok: ['theme.overrideTokens'], missing: [], viable: true }
    return { ok: [], missing: [{ name: 'theme.overrideTokens', reason: '主题令牌覆盖不可用' }], viable: true }
  }

  return { overrideTokens, probe }
}