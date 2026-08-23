/**
 * The two Pixel Office palettes and the pairing helper.
 *
 * Both tables carry identical keys so {@link pairTokens} can zip them. Giving
 * light and dark the same value makes the Appearance preference inert: the
 * choice persists, both schemes resolve identically, and nothing on screen
 * changes. Every value therefore differs between the tables.
 *
 * The trailing `--dsw-specific-pxo-*` entries are plugin-private carriers.
 * Theme override validation checks only that each value supplies `light` and
 * `dark`, so an unregistered token name is a legal way to publish a
 * scheme-aware value the stylesheet can read.
 * @module dsh-client-pixel-office/tokens
 */
import type { TokenOverride } from './contracts.ts'

/** Night shift: the office lit by its own monitors. */
export const DARK_TOKENS: Readonly<Record<string, string>> = {
  '--dsw-alias-bg-base': '#0a0f1e',
  '--dsw-alias-bg-layer-1': '#121a33',
  '--dsw-alias-bg-layer-2': '#121a33',
  '--dsw-alias-bg-layer-3': '#232f52',
  '--dsw-alias-bg-overlay': '#121a33',
  '--dsw-alias-bg-module-platform': '#121a33',
  '--dsw-alias-bg-mask-1': 'rgba(4,8,18,.72)',
  '--dsw-specific-bubble': '#1d2a4d',
  '--dsw-specific-input-major': '#0d1425',
  '--dsw-specific-menu': '#16203c',
  '--dsw-specific-tip': '#1b2440',
  '--dsw-specific-selector': '#1b2440',
  '--dsw-specific-sidebar-fill': '#0a0f1e',
  '--dsw-specific-sidebar-nav-item-hover': '#1f2a4b',
  '--dsw-specific-sidebar-nav-item-active': '#26325a',
  '--dsw-specific-sidebar-nav-item-active-accent': '#4dffd0',
  '--dsw-alias-markdown-code-block': '#060a16',
  '--dsw-alias-border-l1': '#2b3a63',
  '--dsw-alias-border-l2': '#46588c',
  '--dsw-alias-border-l3': '#5a6ea8',
  '--dsw-alias-border-l4': '#6d82bd',
  '--dsw-alias-border-l2-darkmode-thin': '#46588c',
  '--dsw-alias-border-inverted': '#0a0f1e',
  '--dsw-alias-line-secondary': '#2b3a63',
  '--dsw-alias-separator-primary': '#2b3a63',
  // The composer backdrop paints the draft with label-primary, so in each
  // scheme this must be the readable ink against that scheme's surfaces.
  '--dsw-alias-label-primary': '#d7f5ff',
  '--dsw-alias-label-secondary': '#9fb4d6',
  '--dsw-alias-label-tertiary': '#8fa3c4',
  '--dsw-alias-label-caption': '#7f93b5',
  '--dsw-alias-label-dimmed': '#7385a6',
  '--dsw-alias-label-primary-bluish': '#b8d4ff',
  '--dsw-alias-label-primary-dimmed': '#9fb4d6',
  // Ink ON a bright solid fill (the send button), never body text.
  '--dsw-alias-label-primary-foreground': '#04241d',
  '--dsw-alias-button-floating-fill': '#1b2440',
  '--dsw-alias-button-floating-hover': '#26325a',
  '--dsw-alias-button-info-fill': '#4dffd0',
  '--dsw-alias-button-info-hover': '#7dffdf',
  '--dsw-alias-interactive-bg-hover': '#1f2a4b',
  '--dsw-alias-interactive-bg-hover-solid': '#26325a',
  '--dsw-alias-interactive-bg-hover-danger': '#3d1f2a',
  '--dsw-alias-scrollbar-bg-l2': '#121a33',
  '--dsw-alias-scrollbar-hover-l2': '#46588c',
  '--dsw-alias-brand-primary': '#4dffd0',
  // Also the composer caret color.
  '--dsw-alias-state-business-primary': '#4dffd0',
  '--dsw-alias-state-business-tertiary': '#123a33',
  '--dsw-alias-state-success-primary': '#4dffd0',
  '--dsw-alias-state-error-primary': '#ff7a7a',
  '--dsw-alias-state-warn-primary': '#ffb057',
  '--dsw-alias-state-warn-secondary': '#4a3418',
  '--dsw-alias-state-warn-tertiary': '#2a1f10',
  '--dsw-alias-state-warn-label': '#ffb057',
  '--dsw-static-blue-450': '#8fd0ff',
  '--dsw-static-deepseek-200': '#b8d4ff',
  '--dsw-static-deepseek-500': '#4dffd0',
  '--dsw-static-neutral-bluish-400': '#8fa3c4',
  '--dsw-specific-pxo-scan': 'rgba(0,0,0,.26)',
  '--dsw-specific-pxo-bevel-dark': '#060a16',
  '--dsw-specific-pxo-bevel-light': '#354a7d',
  '--dsw-specific-pxo-screen-off': '#0c1226',
  '--dsw-specific-pxo-screen-on': '#04241d',
  '--dsw-specific-pxo-glow': 'rgba(77,255,208,.5)',
  '--dsw-specific-pxo-board': '#274536',
  '--dsw-specific-pxo-board-ink': '#bfe8cf',
  '--dsw-specific-pxo-board-dim': '#7fae94',
  '--dsw-specific-pxo-board-mask': 'rgba(8,20,14,.72)',
  '--dsw-specific-pxo-chair': '#3c4a78',
  '--dsw-specific-pxo-chair-seat': '#4a5a8e',
  '--dsw-specific-pxo-chair-dark': '#263155',
  '--dsw-specific-pxo-idle': '#2a3457',
  '--dsw-specific-pxo-monitor-frame': '#35446f',
}

/**
 * Day shift: the same office under fluorescent light. Paper-beige surfaces,
 * dark ink, and a deep teal accent, because the dark scheme's neon mint has
 * far too little contrast against paper.
 */
export const LIGHT_TOKENS: Readonly<Record<string, string>> = {
  '--dsw-alias-bg-base': '#e6e1d3',
  '--dsw-alias-bg-layer-1': '#f4f1e6',
  '--dsw-alias-bg-layer-2': '#f4f1e6',
  '--dsw-alias-bg-layer-3': '#dcd6c4',
  '--dsw-alias-bg-overlay': '#f4f1e6',
  '--dsw-alias-bg-module-platform': '#f4f1e6',
  '--dsw-alias-bg-mask-1': 'rgba(46,42,32,.46)',
  '--dsw-specific-bubble': '#fdfbf2',
  '--dsw-specific-input-major': '#fffdf5',
  '--dsw-specific-menu': '#fffdf5',
  '--dsw-specific-tip': '#f0ecdd',
  '--dsw-specific-selector': '#f0ecdd',
  '--dsw-specific-sidebar-fill': '#e6e1d3',
  '--dsw-specific-sidebar-nav-item-hover': '#ddd8c6',
  '--dsw-specific-sidebar-nav-item-active': '#cfc8b0',
  '--dsw-specific-sidebar-nav-item-active-accent': '#0f8b6b',
  '--dsw-alias-markdown-code-block': '#efeadb',
  '--dsw-alias-border-l1': '#b8b09a',
  '--dsw-alias-border-l2': '#9a917a',
  '--dsw-alias-border-l3': '#7f7660',
  '--dsw-alias-border-l4': '#66604e',
  '--dsw-alias-border-l2-darkmode-thin': '#9a917a',
  '--dsw-alias-border-inverted': '#f4f1e6',
  '--dsw-alias-line-secondary': '#b8b09a',
  '--dsw-alias-separator-primary': '#b8b09a',
  '--dsw-alias-label-primary': '#22252e',
  '--dsw-alias-label-secondary': '#4a4f5c',
  '--dsw-alias-label-tertiary': '#5c6270',
  '--dsw-alias-label-caption': '#6f7482',
  '--dsw-alias-label-dimmed': '#7d8290',
  '--dsw-alias-label-primary-bluish': '#2a3550',
  '--dsw-alias-label-primary-dimmed': '#4a4f5c',
  // The light-scheme bright fill is deep teal, so its ink flips to paper.
  '--dsw-alias-label-primary-foreground': '#f4f1e6',
  '--dsw-alias-button-floating-fill': '#f0ecdd',
  '--dsw-alias-button-floating-hover': '#e2ddc9',
  '--dsw-alias-button-info-fill': '#0f8b6b',
  '--dsw-alias-button-info-hover': '#0c7457',
  '--dsw-alias-interactive-bg-hover': '#ddd8c6',
  '--dsw-alias-interactive-bg-hover-solid': '#cfc8b0',
  '--dsw-alias-interactive-bg-hover-danger': '#f2d6d6',
  '--dsw-alias-scrollbar-bg-l2': '#d8d2c0',
  '--dsw-alias-scrollbar-hover-l2': '#b0a893',
  '--dsw-alias-brand-primary': '#0f8b6b',
  '--dsw-alias-state-business-primary': '#0f8b6b',
  '--dsw-alias-state-business-tertiary': '#d8f0e6',
  '--dsw-alias-state-success-primary': '#0f8b6b',
  '--dsw-alias-state-error-primary': '#c2352f',
  '--dsw-alias-state-warn-primary': '#b4700d',
  '--dsw-alias-state-warn-secondary': '#f6e3c2',
  '--dsw-alias-state-warn-tertiary': '#fbf1de',
  '--dsw-alias-state-warn-label': '#8a5608',
  '--dsw-static-blue-450': '#2a6ca8',
  '--dsw-static-deepseek-200': '#2a3550',
  '--dsw-static-deepseek-500': '#0f8b6b',
  '--dsw-static-neutral-bluish-400': '#5c6270',
  '--dsw-specific-pxo-scan': 'rgba(62,56,42,.10)',
  '--dsw-specific-pxo-bevel-dark': '#a8a08a',
  '--dsw-specific-pxo-bevel-light': '#fffdf5',
  '--dsw-specific-pxo-screen-off': '#cfc8b0',
  '--dsw-specific-pxo-screen-on': '#d8f0e6',
  '--dsw-specific-pxo-glow': 'rgba(15,139,107,.35)',
  '--dsw-specific-pxo-board': '#3c6650',
  '--dsw-specific-pxo-board-ink': '#eaf6ee',
  '--dsw-specific-pxo-board-dim': '#b9d8c5',
  '--dsw-specific-pxo-board-mask': 'rgba(24,54,40,.62)',
  '--dsw-specific-pxo-chair': '#8d97b5',
  '--dsw-specific-pxo-chair-seat': '#a3accb',
  '--dsw-specific-pxo-chair-dark': '#6b7490',
  '--dsw-specific-pxo-idle': '#cfc8b0',
  '--dsw-specific-pxo-monitor-frame': '#9aa2bd',
}

/**
 * Zip the two palettes into the override table the theme service accepts.
 * @param dark - the dark-scheme table, which defines the key set.
 * @param light - the light-scheme table; a missing key falls back to dark.
 * @returns one `{light, dark}` override per key in `dark`.
 */
export function pairTokens(
  dark: Readonly<Record<string, string>>,
  light: Readonly<Record<string, string>>,
): Readonly<Record<string, TokenOverride>> {
  const out: Record<string, TokenOverride> = {}
  for (const [key, darkValue] of Object.entries(dark)) {
    out[key] = { light: light[key] ?? darkValue, dark: darkValue }
  }
  return out
}
