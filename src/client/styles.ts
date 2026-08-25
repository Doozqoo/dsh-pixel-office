/**
 * The Pixel Office stylesheet, injected through a Cordis-owned effect.
 *
 * Plain text rather than a CSS Module: this repository builds with a standalone
 * tsdown config and has no CSS pipeline. Writing CSS as a string keeps the
 * bundle small, makes the layered rules straightforward to scan, and lets us
 * scrub the imported conversation slot in a single rule set.
 *
 * The scene is deliberately always-dark — it is a screen, not a surface. Every
 * raw color below is hard-coded from the office palette so the room looks
 * identical regardless of the host Appearance preference. Only the embedded
 * conversation (a portaled slot the renderer ships) borrows the host tokens.
 * @module dsh-client-pixel-office/styles
 */

/**
 * Geometry + the office palette.
 *
 * `--pxo-accent` is per-workspace: each desk stamps its own neon onto the name
 * plate, the desk frame, the monitor bezel, and the offline dot, giving the 3x2
 * grid six distinct colors while RUN/IDLE stay semantically green/amber.
 */
const GEOMETRY = ':root{'
  // Desk-view geometry: the planning board sits on the left, the CRT-bezel
  // monitor on the right. All values are viewport-relative so the layout
  // adapts without scaling.
  //
  // `--pxo-dock` is the reserved strip along the bottom holding the new-note
  // stack and the caption. The board and the CRT BOTH end there, so the two
  // panes share one baseline. Deriving `--pxo-sh` from it is what keeps them
  // aligned: hard-coding the screen height separately is how they drifted
  // 120px apart, which let the CRT's neck and PWR badge cover the stack.
  + '--pxo-sy:108px;--pxo-dock:150px;'
  + '--pxo-sx:52vw;--pxo-sw:44vw;'
  + '--pxo-sh:calc(100vh - var(--pxo-sy) - var(--pxo-dock));'
  + '--pxo-bx:2.5vw;--pxo-bw:48vw;'
  // Reserved band along the bottom of the top view. The caption strip lives
  // inside it and the desk grid stops at its edge, so the last row cannot
  // overlap the glyphs the way it did when the grid stopped at a bare 30px.
  + '--pxo-foot:44px;'
  + '--pxo-font:"JetBrains Mono","Cascadia Mono","Consolas",ui-monospace,"Courier New",monospace;'
  // Ink.
  + '--pxo-ink:#e3ecff;--pxo-dim:#8fa1bf;--pxo-faint:#5c6b85;'
  // Surfaces (deep navy → near-black, hard bevels, neon trim).
  + '--pxo-bg:#0a0f1a;--pxo-bg2:#10182a;--pxo-bg3:#16213a;'
  + '--pxo-desk:#1a2238;--pxo-crt:#03060d;'
  + '--pxo-edge:#243150;--pxo-line:#34426a;--pxo-hi:#5b6f9a;'
  // Neon palette (kept readable on a near-black surface).
  + '--pxo-neon:#5cff9e;--pxo-cyan:#5ce0ff;--pxo-yellow:#ffe35c;'
  + '--pxo-magenta:#ff5cab;--pxo-orange:#ff9e1c;--pxo-blue:#6699ff;--pxo-red:#ff5c5c;--pxo-violet:#a780ff;'
  // NOTE: `glow` is bound to whatever accent currently sits on the desk.
  + '--pxo-glow:rgba(92,255,158,.45);'
  + '--pxo-accent:var(--pxo-neon);'
  + '}'

/**
 * Sidebar removal.
 *
 * The settings panel is rendered by the settings plugin into the
 * `sidebar.settings` seat, nested inside the sidebar's own wrapper rather than
 * as a direct child of the slot anchor. `display:none` on any ancestor kills
 * the whole subtree unconditionally — no descendant rule can revive it — which
 * takes the nav rail, every shipped section, AND the panel the trigger opens.
 * The trigger then looks dead: React opens the panel and it renders into
 * nothing.
 *
 * Clipping the sidebar to a 0x0 fixed box strips its normal-flow chrome while
 * the subtree stays alive. The escaping dialog and its wrapper restore
 * interactivity (they are portaled and exempt from the clip rect).
 *
 * z-index 500 sits above the desk-mode conversation (40) and monitor bezel
 * (45), and deliberately BELOW the 1100 that portaled dropdown lists use.
 */
const SIDEBAR = '[data-slot="sidebar"]{'
  + 'display:block!important;position:fixed!important;left:0!important;top:0!important;'
  + 'width:0!important;height:0!important;overflow:hidden!important;'
  + 'pointer-events:none!important;z-index:500;}'
  + '[data-slot="sidebar"] div:has(> [role="dialog"]),'
  + '[data-slot="sidebar"] [role="dialog"]{pointer-events:auto!important;}'
  // Skin the escaping settings dialog into the pixel language.
  + '[data-slot="sidebar"] [role="dialog"]{font-family:var(--pxo-font)!important;'
  + 'border-radius:0!important;background:var(--pxo-bg2)!important;color:var(--pxo-ink)!important;'
  + 'box-shadow:0 0 0 3px var(--pxo-edge),0 0 0 6px var(--pxo-bg),0 0 0 9px var(--pxo-edge),'
  + '0 0 24px var(--pxo-glow),10px 10px 0 rgba(0,0,0,.45)!important;}'
  + '[data-slot="sidebar"] [role="dialog"] *{border-radius:0!important;'
  + 'font-family:var(--pxo-font)!important;background:var(--pxo-bg2)!important;color:var(--pxo-ink)!important;}'
  + '[data-slot="sidebar"] [role="dialog"] button{letter-spacing:1px;border-radius:0!important;}'
  + '[data-slot="sidebar"] [role="dialog"] input,'
  + '[data-slot="sidebar"] [role="dialog"] textarea{background:var(--pxo-bg3)!important;color:var(--pxo-ink)!important;'
  + 'border-radius:0!important;font-family:var(--pxo-font)!important;}'
  + 'body [role="menu"]{font-family:var(--pxo-font)!important;border-radius:0!important;}'
  + 'body [role="menu"] *{border-radius:0!important;font-family:var(--pxo-font)!important;}'

/**
 * Confine the real conversation to the monitor screen in desk mode, and paint
 * it like a phosphor terminal.
 *
 * `body:has(.pxo-root[data-mode=...])` would suffice in modern engines, but it
 * ties the skin to a feature that's still spotty in older Safari/Webview builds.
 * The runtime guard in index.tsx removes the stylesheet when the plugin unmounts
 * — same scope, smaller blast radius.
 *
 * The reveal is gated on `data-screen="on"`, not on desk mode alone. The slot is
 * the shell's own portal and keeps rendering whichever session was opened last,
 * with no "closed" state to read: keying on the mode showed the previous
 * workspace's conversation on a desk that might hold no notes at all.
 */
const CONVERSATION = 'body:has(.pxo-root[data-mode="top"]) [data-slot="conversation"]{visibility:hidden!important;}'
  + 'body:has(.pxo-root[data-screen="off"]) [data-slot="conversation"]{visibility:hidden!important;}'
  + 'body:has(.pxo-root[data-mode="desk"]) [data-slot="details"]{display:none!important;}'
  + 'body:has(.pxo-root[data-mode="desk"]) [data-slot="conversation"]{'
  + 'display:block!important;position:fixed!important;'
  + 'left:var(--pxo-sx)!important;top:var(--pxo-sy)!important;'
  + 'width:var(--pxo-sw)!important;height:var(--pxo-sh)!important;'
  + 'z-index:40;overflow:hidden;background:var(--pxo-crt);color:var(--pxo-ink);'
  + 'box-shadow:inset 0 0 46px rgba(92,255,158,.08)!important;}'
  + 'body:has(.pxo-root[data-mode="desk"]) [data-slot="conversation"] > *{width:100%!important;height:100%!important;}'
  + 'body:has(.pxo-root[data-mode="desk"]) [data-slot="conversation"] *{border-radius:0!important;font-family:var(--pxo-font)!important;}'

/**
 * Composer: the textarea is transparent (caret only); the backdrop paints the
 * glyphs. Setting the textarea to a color makes the draft illegible.
 */
const COMPOSER = 'body:has(.pxo-root[data-mode="desk"]) [data-slot="conversation"] textarea{'
  + 'background:transparent!important;color:transparent!important;'
  + '-webkit-text-fill-color:transparent!important;caret-color:var(--pxo-neon)!important;}'
  + 'body:has(.pxo-root[data-mode="desk"]) [data-slot="conversation"] textarea::placeholder{'
  + 'color:var(--pxo-dim)!important;-webkit-text-fill-color:var(--pxo-dim)!important;}'
  + 'body:has(.pxo-root[data-mode="desk"]) [data-slot="conversation"] '
  + 'input:not([type="range"]):not([type="checkbox"]):not([type="radio"]){'
  + 'background:var(--pxo-bg3)!important;color:var(--pxo-ink)!important;'
  + '-webkit-text-fill-color:var(--pxo-ink)!important;caret-color:var(--pxo-neon)!important;}'
  + 'body:has(.pxo-root[data-mode="desk"]) [data-slot="conversation"] input::placeholder{'
  + 'color:var(--pxo-dim)!important;-webkit-text-fill-color:var(--pxo-dim)!important;}'

/* ----------------------------------------------------------------------------
 * Cross-cutting visual reset.
 *
 * The office uses pure CSS responsive layout (not transform-scale): everything
 * is `position:fixed` against the viewport, sized in `vw`/`vh`/`%` so the layout
 * fills any window. The header pins to the top, the caption pins to the
 * bottom, the main content fills the middle.
 * --------------------------------------------------------------------------*/
const ROOT = '.pxo-root{font-family:var(--pxo-font);pointer-events:none;'
  + 'position:fixed;inset:0;color:var(--pxo-ink);}'
  + '.pxo-root *{box-sizing:border-box;border-radius:0!important;image-rendering:pixelated;'
  + 'font-family:var(--pxo-font);}'
  // The workspace canvas. The flat fill + single grid moved into the layered
  // backdrop below; what remains here is the deepest tone, so the room still
  // reads as a lit space even before the parallax layers paint.
  + '.pxo-fill{position:fixed;inset:0;pointer-events:auto;overflow:hidden;'
  + 'background:radial-gradient(130% 95% at 50% -12%,#1a2a5e 0%,#101a3a 38%,#0a0f22 66%,#05070f 100%);}'
  // Rolling CRT scanlines — pinned overlay, the "film grain" of the office.
  // Two bands at different speeds: the fine raster never moves, the soft bloom
  // sweeps, so the screen feels alive without any element jumping.
  + '.pxo-scan{position:fixed;inset:0;pointer-events:none;z-index:55;}'
  + '.pxo-scan::before{content:"";position:fixed;inset:0;'
  + 'background:repeating-linear-gradient(0deg,rgba(0,0,0,.26) 0 1px,transparent 1px 3px);'
  + 'mix-blend-mode:multiply;}'
  + '.pxo-scan::after{content:"";position:fixed;left:0;right:0;top:-28vh;height:28vh;'
  + 'background:linear-gradient(180deg,transparent,rgba(120,220,255,.05) 40%,'
  + 'rgba(92,255,158,.09) 55%,transparent);'
  + 'animation:pxo-sweep 9s cubic-bezier(.4,0,.6,1) infinite;}'

/* ----------------------------------------------------------------------------
 * Layered backdrop.
 *
 * Five stacked layers replace what used to be one flat navy fill plus a 32px
 * grid. Each layer is a single fixed element with a pure-CSS paint and its own
 * slow animation, so the room reads as deep space rather than a wallpaper:
 *
 *   .sky     drifting aurora blooms (two counter-moving gradient blobs)
 *   .grid    a perspective floor grid that scrolls toward the horizon
 *   .motes   three parallax layers of pixel dust
 *   .vign    corner vignette + horizon glow, pinned on top
 *
 * All of them are pointer-events:none and sit below the content z-indices.
 * `data-grid="off"` hides the floor grid; `data-intensity="calm"` slows or
 * stops the motion (see the INTENSITY block).
 * --------------------------------------------------------------------------*/
const BACKDROP = '.pxo-bg-layers{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden;}'
  // ── Aurora: two large soft blobs that drift on long, offset cycles. Blur is
  //    deliberately heavy so no pixel edge shows; this is the only non-pixel
  //    element in the scene and it sits far enough back to read as atmosphere.
  + '.pxo-sky{position:absolute;inset:-20%;filter:blur(70px);opacity:.55;}'
  + '.pxo-sky::before,.pxo-sky::after{content:"";position:absolute;border-radius:50%!important;}'
  + '.pxo-sky::before{width:64%;height:58%;left:2%;top:-6%;'
  + 'background:radial-gradient(circle,rgba(92,255,158,.5),rgba(64,190,255,.22) 45%,transparent 70%);'
  + 'animation:pxo-drift-a 34s ease-in-out infinite;}'
  + '.pxo-sky::after{width:58%;height:56%;right:0%;top:14%;'
  + 'background:radial-gradient(circle,rgba(255,92,171,.42),rgba(167,128,255,.24) 45%,transparent 70%);'
  + 'animation:pxo-drift-b 44s ease-in-out infinite;}'
  // ── Perspective floor grid. Two repeating-linear-gradients rotated into
  //    perspective; the vertical scroll is what sells the depth. Masked at the
  //    top so the lines dissolve into the horizon instead of ending abruptly.
  + '.pxo-grid-floor{position:absolute;left:-50%;right:-50%;bottom:-10%;height:78%;'
  + 'background-image:repeating-linear-gradient(90deg,rgba(92,255,158,.22) 0 2px,transparent 2px 88px),'
  + 'repeating-linear-gradient(0deg,rgba(92,255,158,.20) 0 2px,transparent 2px 88px);'
  + 'transform:perspective(320px) rotateX(74deg);transform-origin:50% 100%;'
  + '-webkit-mask-image:linear-gradient(180deg,transparent,#000 34%,#000 100%);'
  + 'mask-image:linear-gradient(180deg,transparent,#000 34%,#000 100%);'
  + 'animation:pxo-floor 6s linear infinite;opacity:.5;}'
  // A matching ceiling grid, flipped — the room gets a top and a bottom.
  + '.pxo-grid-sky{position:absolute;left:-50%;right:-50%;top:-10%;height:52%;'
  + 'background-image:repeating-linear-gradient(90deg,rgba(92,180,255,.16) 0 2px,transparent 2px 88px),'
  + 'repeating-linear-gradient(0deg,rgba(92,180,255,.14) 0 2px,transparent 2px 88px);'
  + 'transform:perspective(320px) rotateX(-74deg);transform-origin:50% 0%;'
  + '-webkit-mask-image:linear-gradient(0deg,transparent,#000 40%,#000 100%);'
  + 'mask-image:linear-gradient(0deg,transparent,#000 40%,#000 100%);'
  + 'animation:pxo-floor 9s linear infinite reverse;opacity:.34;}'
  + '.pxo-root[data-grid="off"] .pxo-grid-floor,'
  + '.pxo-root[data-grid="off"] .pxo-grid-sky{display:none;}'
  // ── Pixel motes. Each layer is one element whose background is a handful of
  //    hard-stop radial gradients (square-ish dots at this size), tiled and
  //    scrolled at a different speed → cheap parallax with zero DOM cost.
  + '.pxo-motes{position:absolute;inset:-10% -10% -10% -10%;'
  + 'background-repeat:repeat;will-change:transform;}'
  + '.pxo-motes.a{background-image:'
  + 'radial-gradient(1.5px 1.5px at 18% 22%,rgba(92,255,158,.85),transparent 100%),'
  + 'radial-gradient(1.5px 1.5px at 62% 8%,rgba(140,235,255,.7),transparent 100%),'
  + 'radial-gradient(1.5px 1.5px at 84% 46%,rgba(255,227,92,.6),transparent 100%),'
  + 'radial-gradient(1.5px 1.5px at 33% 71%,rgba(255,140,205,.6),transparent 100%);'
  + 'background-size:260px 260px;animation:pxo-mote-a 26s linear infinite;opacity:.75;}'
  + '.pxo-motes.b{background-image:'
  + 'radial-gradient(2px 2px at 44% 34%,rgba(180,245,255,.6),transparent 100%),'
  + 'radial-gradient(2px 2px at 8% 62%,rgba(92,255,158,.5),transparent 100%),'
  + 'radial-gradient(2px 2px at 73% 84%,rgba(167,128,255,.55),transparent 100%);'
  + 'background-size:420px 420px;animation:pxo-mote-b 40s linear infinite;opacity:.55;}'
  + '.pxo-motes.c{background-image:'
  + 'radial-gradient(3px 3px at 28% 52%,rgba(92,224,255,.35),transparent 100%),'
  + 'radial-gradient(3px 3px at 88% 18%,rgba(255,158,28,.3),transparent 100%);'
  + 'background-size:640px 640px;animation:pxo-mote-c 62s linear infinite;opacity:.4;}'
  // ── Vignette + horizon bloom, pinned above the parallax but below content.
  + '.pxo-vign{position:absolute;inset:0;'
  + 'background:radial-gradient(120% 80% at 50% 42%,transparent 46%,rgba(3,5,12,.55) 78%,rgba(2,3,8,.86) 100%),'
  + 'linear-gradient(180deg,rgba(92,255,158,.07) 0,transparent 22%);}'


const CHROME = '.pxo-header{position:fixed;left:0;right:0;top:0;height:54px;z-index:60;'
  + 'display:flex;align-items:center;padding:0 24px;gap:18px;'
  + 'background:var(--pxo-bg2);border-bottom:1px solid var(--pxo-edge);'
  + 'box-shadow:0 2px 0 var(--pxo-bg3);}'
  + '.pxo-logo{display:flex;align-items:center;gap:12px;}'
  + '.pxo-logo-square{width:34px;height:34px;background:var(--pxo-neon);'
  + 'position:relative;box-shadow:0 0 0 1px var(--pxo-edge),0 0 12px var(--pxo-glow);}'
  + '.pxo-logo-square::after{content:"";position:absolute;inset:6px;background:var(--pxo-bg);}'
  + '.pxo-logo-text{display:flex;flex-direction:column;gap:2px;}'
  + '.pxo-logo-main{font-size:14px;font-weight:700;letter-spacing:3px;'
  + 'text-shadow:1px 0 0 var(--pxo-edge),0 1px 0 var(--pxo-edge),1px 1px 0 var(--pxo-edge);}'
  + '.pxo-logo-sub{font-size:9px;color:var(--pxo-dim);letter-spacing:2px;}'
  + '.pxo-breadcrumb{font-size:11px;letter-spacing:2px;color:var(--pxo-dim);margin-left:14px;}'
  + '.pxo-breadcrumb b{color:var(--pxo-ink);font-weight:700;letter-spacing:2px;}'
  + '.pxo-status-pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;'
  + 'background:var(--pxo-crt);border:1px solid var(--pxo-neon);font-size:10px;'
  + 'font-weight:700;letter-spacing:2px;color:var(--pxo-neon);'
  + 'box-shadow:inset 0 0 12px rgba(92,255,158,.18);}'
  + '.pxo-status-pill .dot{width:6px;height:6px;background:var(--pxo-neon);'
  + 'animation:pxo-blink 1s steps(2) infinite;box-shadow:0 0 6px var(--pxo-neon);}'
  + '.pxo-search{display:flex;align-items:center;gap:6px;background:var(--pxo-bg3);'
  + 'border:1px solid var(--pxo-edge);padding:6px 10px;font-size:11px;color:var(--pxo-dim);'
  + 'margin-left:auto;}'
  + '.pxo-search input{background:transparent;color:var(--pxo-ink);border:0;outline:none;'
  + 'width:140px;font-size:11px;font-family:var(--pxo-font);}'
  + '.pxo-search .kbd{font-size:9px;color:var(--pxo-faint);background:var(--pxo-bg);'
  + 'padding:1px 4px;margin-left:6px;border:1px solid var(--pxo-edge);}'
  + '.pxo-ico-search{width:12px;height:12px;position:relative;}'
  + '.pxo-ico-search::before{content:"";position:absolute;left:0;top:0;width:8px;height:8px;'
  + 'border:2px solid var(--pxo-dim);}'
  + '.pxo-ico-search::after{content:"";position:absolute;right:0;bottom:0;width:4px;height:2px;'
  + 'background:var(--pxo-dim);transform:rotate(-45deg);transform-origin:right;}'
  // Toolbar.
  + '.pxo-toolbar{position:fixed;left:0;right:0;top:54px;height:46px;z-index:58;'
  + 'display:flex;align-items:center;padding:0 24px;gap:14px;background:var(--pxo-bg);'
  + 'border-bottom:1px solid var(--pxo-edge);}'
  + '.pxo-toolbar-block{width:4px;height:20px;background:var(--pxo-neon);'
  + 'box-shadow:0 0 6px var(--pxo-glow);}'
  + '.pxo-toolbar-title{font-size:13px;font-weight:700;letter-spacing:2px;color:var(--pxo-ink);}'
  + '.pxo-toolbar-sub{font-size:11px;color:var(--pxo-dim);letter-spacing:1px;}'
  + '.pxo-toolbar-right{margin-left:auto;display:flex;align-items:center;gap:8px;}'
  + '.pxo-chip{display:inline-flex;align-items:center;gap:6px;background:var(--pxo-bg3);'
  + 'border:1px solid var(--pxo-edge);padding:5px 9px;font-size:10px;'
  + 'letter-spacing:1px;color:var(--pxo-ink);cursor:pointer;font-weight:700;}'
  + '.pxo-chip .dot{width:6px;height:6px;background:var(--pxo-neon);}'
  + '.pxo-chip .caret{margin-left:2px;color:var(--pxo-dim);}'
  // Neon "+ 新建工位" CTA: filled accent over dark ink.
  + '.pxo-btn-new{display:inline-flex;align-items:center;gap:6px;background:var(--pxo-neon);'
  + 'color:var(--pxo-bg);font-weight:700;font-size:11px;letter-spacing:1px;padding:6px 10px;'
  + 'border:0;cursor:pointer;box-shadow:0 0 12px var(--pxo-glow),inset -2px -2px 0 rgba(0,0,0,.25),'
  + 'inset 2px 2px 0 rgba(255,255,255,.3);}'
  + '.pxo-btn-new:hover{filter:brightness(1.15);}'
  // Cyan Settings button (matches the cyan "+" in the chips).
  + '.pxo-btn-set{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;'
  + 'background:var(--pxo-bg3);color:var(--pxo-cyan);font-weight:700;font-size:11px;'
  + 'letter-spacing:1px;border:1px solid var(--pxo-edge);cursor:pointer;}'
  + '.pxo-btn-set:hover{color:var(--pxo-ink);}'
  // Orange "离开工位" button — only on the desk view.
  + '.pxo-btn-leave{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;'
  + 'background:var(--pxo-bg3);color:var(--pxo-orange);font-weight:700;font-size:11px;'
  + 'letter-spacing:2px;border:1px solid var(--pxo-orange);cursor:pointer;'
  + 'box-shadow:inset 0 0 12px rgba(255,158,28,.18);}'
  + '.pxo-btn-leave:hover{color:var(--pxo-ink);background:var(--pxo-orange);}'
  // Generic pixel button: hard bevel, press-inverts, neon on hover. Used by
  // the HUD, the dialogs, and the settings section.
  + '.pxo-btn{display:inline-flex;align-items:center;gap:6px;background:var(--pxo-bg2);'
  + 'color:var(--pxo-ink);border:1px solid var(--pxo-edge);padding:8px 12px;font-size:12px;'
  + 'letter-spacing:1px;font-weight:700;cursor:pointer;'
  + 'box-shadow:inset -3px -3px 0 var(--pxo-edge),inset 3px 3px 0 var(--pxo-line);}'
  + '.pxo-btn:hover{color:var(--pxo-neon);'
  + 'box-shadow:inset -3px -3px 0 var(--pxo-neon),inset 3px 3px 0 var(--pxo-line),0 0 12px var(--pxo-glow);}'
  + '.pxo-btn:active{box-shadow:inset 3px 3px 0 var(--pxo-edge),inset -3px -3px 0 var(--pxo-line);}'
  + '.pxo-btn.danger:hover{color:var(--pxo-red);'
  + 'box-shadow:inset -3px -3px 0 var(--pxo-red),inset 3px 3px 0 var(--pxo-line);}'

/* ----------------------------------------------------------------------------
 * Grid of 24 desks (6x4).
 * --------------------------------------------------------------------------*/
// The bottom stop clears the caption strip rather than sitting on top of it:
// `bottom:30px` left only 12px below the last desk row, so the caption's
// glyphs were overlapped by the row above it. --pxo-foot is the reserved band.
const GRID = '.pxo-grid{position:fixed;left:0;right:0;top:100px;'
  + 'bottom:var(--pxo-foot);'
  + 'padding:16px 16px 0;display:grid;'
  + 'grid-template-columns:repeat(6,1fr);grid-template-rows:repeat(4,minmax(0,1fr));gap:10px;min-height:0;}'
  + '.pxo-desk{position:relative;background:var(--pxo-bg2);padding:3px 3px 4px;'
  + 'display:flex;flex-direction:column;align-items:stretch;cursor:pointer;gap:2px;'
  + 'overflow:hidden;min-height:0;'
  + 'box-shadow:inset 0 0 0 2px var(--pxo-edge),0 0 0 1px var(--pxo-bg),'
  + 'inset -4px -4px 0 rgba(0,0,0,.35),inset 4px 4px 0 rgba(255,255,255,.04);'
  + 'transition:transform .08s steps(2);touch-action:none;}'
  + '.pxo-desk:hover{transform:translate(-2px,-2px);'
  + 'box-shadow:inset 0 0 0 2px var(--pxo-accent),0 0 22px var(--pxo-glow),'
  + 'inset -4px -4px 0 rgba(0,0,0,.35),inset 4px 4px 0 rgba(255,255,255,.04),'
  + '4px 4px 0 rgba(0,0,0,.5);}'
  + '.pxo-desk[data-drag="1"]{opacity:.4;}'
  + '.pxo-desk[data-over="1"]{box-shadow:inset 0 0 0 2px var(--pxo-neon),0 0 22px var(--pxo-glow),'
  + 'inset -4px -4px 0 rgba(0,0,0,.35),inset 4px 4px 0 rgba(255,255,255,.04),'
  + '4px 4px 0 rgba(0,0,0,.5);}'
  // Empty station: dashed border with the accent trimmed to dashed lines.
  + '.pxo-desk[data-empty="1"]{box-shadow:inset 0 0 0 2px var(--pxo-edge);}'
  + '.pxo-desk[data-empty="1"]:hover{box-shadow:inset 0 0 0 2px var(--pxo-yellow),'
  + '0 0 22px rgba(255,227,92,.4),inset -4px -4px 0 rgba(0,0,0,.35),'
  + 'inset 4px 4px 0 rgba(255,255,255,.04),4px 4px 0 rgba(0,0,0,.5);}'

/* ----------------------------------------------------------------------------
 * Station: status row, 田 desk surface, name plate, footer.
 * --------------------------------------------------------------------------*/
const STATION = // Top-row "ONLINE / IDLE" badge + clear/more icons.
  '.pxo-desk-top{display:flex;align-items:center;justify-content:space-between;gap:6px;'
  + 'min-height:18px;}'
  + '.pxo-state{display:inline-flex;align-items:center;gap:5px;padding:3px 7px;'
  + 'background:var(--pxo-crt);font-size:10px;font-weight:700;letter-spacing:2px;'
  + 'box-shadow:inset 0 0 0 1px currentColor;}'
  + '.pxo-state .dot{width:7px;height:7px;background:currentColor;}'
  + '.pxo-state.run{color:var(--pxo-neon);}'
  + '.pxo-state.run .dot{animation:pxo-blink 1s steps(2) infinite;box-shadow:0 0 8px var(--pxo-neon);}'
  + '.pxo-state.idle{color:var(--pxo-yellow);}'
  + '.pxo-state.idle .dot{background:var(--pxo-yellow);}'
  + '.pxo-state.off{color:var(--pxo-faint);}'
  + '.pxo-state.off .dot{background:var(--pxo-faint);}'
  + '.pxo-desk-actions{display:flex;}'
  + '.pxo-ico{width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;'
  + 'background:var(--pxo-bg3);color:var(--pxo-dim);font-size:13px;cursor:pointer;'
  + 'border:1px solid var(--pxo-edge);}'
  + '.pxo-ico + .pxo-ico{border-left:0;}'
  + '.pxo-ico:hover{color:var(--pxo-neon);}'
  // 田 (field) desk surface: dark slab, neon-cut inner border, cross hairs.
  // flex:1 + min-height:0 lets the tile grow to fill whatever vertical space
  // the card has after the fixed-height rows (status / plate / meta / cta).
  + '.pxo-tian{position:relative;flex:1 1 0;min-height:0;background:var(--pxo-desk);'
  + 'overflow:hidden;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;'
  + 'box-shadow:inset 0 0 0 2px var(--pxo-bg),inset 2px 2px 0 var(--pxo-line),'
  + 'inset -2px -2px 0 var(--pxo-edge),inset 0 0 0 3px var(--pxo-accent),'
  + '0 0 16px rgba(92,255,158,.12);}'
  // Crosshair: a 2px vertical and horizontal centre line (drawn as a single
  // overlay rather than per-quadrant borders so the accent trim stays clean).
  + '.pxo-tian::before{content:"";position:absolute;left:50%;top:0;bottom:0;width:2px;'
  + 'background:var(--pxo-edge);margin-left:-1px;}'
  // Empty station: hide the cross dividers (there is nothing to divide) and
  // make the dashed frame a muted gray instead of the accent.
  + '.pxo-desk[data-empty="1"] .pxo-tian{'
  + 'box-shadow:inset 0 0 0 2px var(--pxo-bg),inset 2px 2px 0 var(--pxo-line),'
  + 'inset -2px -2px 0 var(--pxo-edge),inset 0 0 0 3px var(--pxo-faint);'
  + 'background:var(--pxo-desk);opacity:.85;}'
  + '.pxo-desk[data-empty="1"] .pxo-tian::before,'
  + '.pxo-desk[data-empty="1"] .pxo-tian::after{display:none;}'
  + '.pxo-tian::after{content:"";position:absolute;top:50%;left:0;right:0;height:2px;'
  + 'background:var(--pxo-edge);margin-top:-1px;}'
  // Each quadrant is a "tile" — a 1px inset border, with the four assets
  // inside (CRT top-left, sticky top-right, notebook bottom-left, coffee
  // bottom-right). The actual assets sit centered within the tile.
  + '.pxo-tile{position:relative;}'
  // ─── Pixel-art assets, each sized relative to the tile (≈ half the desk
  //     width in the design). Built as pure-CSS rectangles so the whole station
  //     re-renders crisply at any zoom level. ───────────────────────────────
  // Monitor: top-left quadrant. The screen itself is a thin bezel + a flicker-
  // animated phosphor pattern of bars + a couple of colored status dots.
  + '.pxo-art-monitor{position:absolute;left:14%;top:18%;width:72%;height:64%;'
  + 'background:var(--pxo-bg3);box-shadow:inset 2px 2px 0 rgba(255,255,255,.06),'
  + 'inset -2px -2px 0 rgba(0,0,0,.4),inset 0 0 0 2px var(--pxo-edge);}'
  + '.pxo-art-monitor::after{content:"";position:absolute;inset:5px;background:var(--pxo-crt);}'
  + '.pxo-art-monitor.is-run{box-shadow:0 0 0 2px var(--pxo-accent),inset 0 0 14px rgba(92,255,158,.18);}'
  + '.pxo-art-monitor.is-run::after{animation:pxo-flicker .45s steps(2) infinite;}'
  // ─── Cat face on the running monitor. Monochrome on purpose: the screen is
  //     the one surface that should read as a display, not as painted scenery,
  //     so the face is white-on-black and takes no accent colour. It holds
  //     still and blinks — no head motion.
  + '.pxo-art-monitor .pxo-catface{position:absolute;z-index:1;'
  + 'left:50%;top:50%;transform:translate(-50%,-50%);'
  + 'width:62%;aspect-ratio:1;max-height:78%;}'
  // Face: the head block itself.
  + '.pxo-art-monitor .pxo-catface .face{position:absolute;inset:14% 0 0 0;'
  + 'background:#e8eef7;'
  + 'box-shadow:inset -2px -2px 0 rgba(0,0,0,.22),inset 2px 2px 0 rgba(255,255,255,.5);}'
  // Ears: hard triangles perched on the head's top corners.
  + '.pxo-art-monitor .pxo-catface .ear{position:absolute;top:0;width:0;height:0;'
  + 'border-left:5px solid transparent;border-right:5px solid transparent;'
  + 'border-bottom:9px solid #e8eef7;}'
  + '.pxo-art-monitor .pxo-catface .ear.l{left:8%;}'
  + '.pxo-art-monitor .pxo-catface .ear.r{right:8%;}'
  // Eyes: solid dark blocks that blink shut together. `scaleY` on a stepped
  // timeline snaps the lid closed rather than easing it, which is what reads
  // as a pixel blink.
  + '.pxo-art-monitor .pxo-catface .eye{position:absolute;top:26%;width:20%;height:20%;'
  + 'background:#141a24;transform-origin:center;'
  + 'animation:pxo-cat-blink 4.1s steps(1) infinite;}'
  + '.pxo-art-monitor .pxo-catface .eye.l{left:16%;}'
  + '.pxo-art-monitor .pxo-catface .eye.r{right:16%;}'
  + '.pxo-art-monitor .pxo-catface .nose{position:absolute;top:54%;left:46%;'
  + 'width:8%;height:7%;background:#141a24;}'
  // Whiskers: one flat bar each side, offset from the nose.
  + '.pxo-art-monitor .pxo-catface .whisker{position:absolute;top:60%;width:26%;height:2px;'
  + 'background:rgba(20,26,36,.45);}'
  + '.pxo-art-monitor .pxo-catface .whisker.l{left:2%;}'
  + '.pxo-art-monitor .pxo-catface .whisker.r{right:2%;}'
  + '.pxo-art-monitor .beacon{position:absolute;top:6px;right:5px;width:4px;height:4px;'
  + 'background:var(--pxo-red);box-shadow:0 0 4px var(--pxo-red);'
  + 'animation:pxo-blink 1s steps(2) infinite;}'
  + '.pxo-art-monitor .beacon.g{background:var(--pxo-neon);box-shadow:0 0 4px var(--pxo-neon);}'
  // Sticky note icon: top-right quadrant. A pastel paper with a tape strip.
  + '.pxo-art-note{position:absolute;left:18%;top:18%;width:64%;height:64%;'
  + 'background:var(--pxo-bg3);box-shadow:inset -2px -2px 0 rgba(0,0,0,.4),'
  + 'inset 2px 2px 0 rgba(255,255,255,.06);}'
  + '.pxo-art-note::before{content:"";position:absolute;top:-2px;left:18%;width:30%;height:6px;'
  + 'background:rgba(92,255,158,.55);}'
  + '.pxo-art-note::after{content:"";position:absolute;left:14%;top:30%;width:72%;height:6px;'
  + 'background:rgba(0,0,0,.5);box-shadow:0 14px 0 rgba(0,0,0,.5),0 28px 0 rgba(0,0,0,.35);}'
  // Notebook: bottom-left quadrant. Stack of cream rectangles with a header bar.
  + '.pxo-art-book{position:absolute;left:18%;top:22%;width:64%;height:62%;'
  + 'background:#f5e0a0;box-shadow:inset -2px -2px 0 rgba(0,0,0,.35),'
  + 'inset 2px 2px 0 rgba(255,255,255,.4),2px 2px 0 rgba(0,0,0,.5);}'
  + '.pxo-art-book::after{content:"";position:absolute;top:0;left:0;right:0;height:14%;'
  + 'background:#ff5cab;}'
  + '.pxo-art-book .ln{position:absolute;left:14%;right:18%;height:3px;background:rgba(10,15,26,.6);}'
  + '.pxo-art-book .ln:nth-child(2){top:32%;width:60%;}'
  + '.pxo-art-book .ln:nth-child(3){top:48%;width:80%;}'
  + '.pxo-art-book .ln:nth-child(4){top:64%;width:50%;}'
  // Coffee mug: bottom-right quadrant. A cup with a steam trail. Absolutely
  // placed within the tile — the handle hangs off `left:88%`, so putting the
  // cup in flex flow pushed that handle past the tile edge.
  + '.pxo-art-cup{position:absolute;left:34%;top:38%;width:32%;height:42%;'
  + 'background:#1f2950;box-shadow:inset -2px -2px 0 rgba(0,0,0,.45),'
  + 'inset 2px 2px 0 rgba(255,255,255,.1),inset 0 -6px 0 rgba(0,0,0,.35);}'
  + '.pxo-art-cup::before{content:"";position:absolute;top:-22%;left:30%;right:30%;height:22%;'
  + 'background:repeating-linear-gradient(0deg,rgba(92,255,158,.55) 0 2px,transparent 2px 5px);}'
  + '.pxo-art-cup::after{content:"";position:absolute;left:88%;top:30%;width:30%;height:30%;'
  + 'border:2px solid #1f2950;border-left:0;background:transparent;}'
  // Empty-seat station.
  + '.pxo-empty-chair{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);'
  + 'width:46%;height:46%;}'
  + '.pxo-empty-chair::before{content:"";position:absolute;inset:0;'
  + 'border:2px dashed var(--pxo-edge);}'
  + '.pxo-empty-chair svg{width:100%;height:100%;}'

/* ----------------------------------------------------------------------------
 * Name plate: neon double-underline stamp beneath the desk.
 * --------------------------------------------------------------------------*/
const PLATE = // The plate itself — a single dark slab with the project's title.
  '.pxo-plate{position:relative;background:var(--pxo-crt);color:var(--pxo-accent);'
  + 'padding:5px 8px;font-size:18px;font-weight:700;letter-spacing:1px;'
  + 'box-shadow:inset 0 0 0 2px var(--pxo-accent),inset 0 -3px 0 var(--pxo-accent),'
  + 'inset 2px 2px 0 rgba(255,255,255,.12),inset -2px -2px 0 rgba(0,0,0,.35),'
  + '0 0 16px var(--pxo-glow);'
  + 'display:flex;align-items:center;justify-content:space-between;gap:6px;'
  + 'white-space:nowrap;overflow:hidden;}'
  // The "double underline pixel" effect: a 2px accent strip at the bottom of
  // the plate (the inner shadow above) and a 1px pixel row drawn via
  // `text-decoration: underline` rendered in the accent color.
  + '.pxo-plate b{display:block;color:var(--pxo-ink);font-weight:700;'
  + 'letter-spacing:1px;text-decoration:underline;text-decoration-color:var(--pxo-accent);'
  + 'text-decoration-thickness:2px;text-underline-offset:3px;'
  + 'overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;}'
  + '.pxo-plate .id{color:var(--pxo-faint);font-size:11px;font-weight:400;letter-spacing:1px;flex-shrink:0;}'
  + '.pxo-plate.empty{color:var(--pxo-faint);box-shadow:inset 0 0 0 2px var(--pxo-edge),'
  + 'inset 0 -3px 0 var(--pxo-edge);}'
  + '.pxo-plate.empty b{color:var(--pxo-faint);text-decoration-color:var(--pxo-edge);}'
  // Footer meta (last activity + sticky count).
  + '.pxo-meta{display:flex;align-items:center;justify-content:space-between;'
  + 'padding:2px 4px 0;font-size:10px;letter-spacing:1px;color:var(--pxo-faint);}'
  + '.pxo-meta .count{color:var(--pxo-orange);font-weight:700;letter-spacing:1px;}'
  + '.pxo-meta.empty .count{color:var(--pxo-faint);font-weight:400;letter-spacing:1px;}'

/* ----------------------------------------------------------------------------
 * Empty-station modal CTA prompt (inline, not a dialog).
 * --------------------------------------------------------------------------*/
const EMPTY_CTA = '.pxo-empty-cta{width:100%;background:transparent;border:0;color:var(--pxo-yellow);'
  + 'text-align:center;font-size:12px;font-weight:700;letter-spacing:2px;'
  + 'padding:6px 0 2px;cursor:pointer;display:flex;flex-direction:column;'
  + 'align-items:center;gap:2px;margin-top:auto;}'
  + '.pxo-empty-cta .plus{font-size:20px;line-height:1;'
  + 'text-shadow:0 0 14px rgba(255,227,92,.65);}'
  + '.pxo-empty-cta .label{font-size:12px;letter-spacing:2px;}'
  + '.pxo-empty-cta small{display:block;font-size:9px;color:var(--pxo-faint);'
  + 'font-weight:400;letter-spacing:1px;margin-top:1px;}'
  + '.pxo-empty-cta:hover{color:var(--pxo-ink);}'
  + '.pxo-empty-cta:hover .plus{color:var(--pxo-yellow);}'

/* ----------------------------------------------------------------------------
 * Bottom chrome: caption row.
 *
 * Occupies the reserved --pxo-foot band and centres its text there, instead of
 * floating at a bare `bottom:18px` under a grid that stopped 12px above it.
 * --------------------------------------------------------------------------*/
const CAPTION = '.pxo-caption{position:fixed;left:0;right:0;bottom:0;'
  + 'height:var(--pxo-foot);display:flex;align-items:center;padding:0 24px;'
  + 'font-size:11px;color:var(--pxo-faint);letter-spacing:2px;z-index:50;'
  + 'pointer-events:none;}'
  + '.pxo-caption b{color:var(--pxo-dim);font-weight:700;letter-spacing:2px;}'

/* ----------------------------------------------------------------------------
 * Desk view: planning board + CRT bezel framing + new-note stack.
 * --------------------------------------------------------------------------*/
const DESK_CHROME = // Side bands the CRT cutout floats inside (deep navy + grid).
  '.pxo-band{position:fixed;pointer-events:auto;background:var(--pxo-bg);'
  + 'background-image:linear-gradient(var(--pxo-bg3) 1px,transparent 1px),'
  + 'linear-gradient(90deg,var(--pxo-bg3) 1px,transparent 1px);'
  + 'background-size:32px 32px;z-index:20;}'
  + '.pxo-band.t{left:0;top:54px;width:100vw;height:calc(var(--pxo-sy) - 54px);}'
  + '.pxo-band.b{left:0;top:calc(var(--pxo-sy) + var(--pxo-sh));width:100vw;bottom:0;}'
  + '.pxo-band.l{left:0;top:var(--pxo-sy);width:var(--pxo-sx);height:var(--pxo-sh);}'
  + '.pxo-band.r{left:calc(var(--pxo-sx) + var(--pxo-sw));top:var(--pxo-sy);right:0;height:var(--pxo-sh);}'

/* ----------------------------------------------------------------------------
 * CRT bezel: a thick neon rim around the conversation slot.
 * --------------------------------------------------------------------------*/
const BEZEL = '.pxo-bezel{position:fixed;left:var(--pxo-sx);top:var(--pxo-sy);'
  + 'width:var(--pxo-sw);height:var(--pxo-sh);pointer-events:none;z-index:45;'
  + 'box-shadow:0 0 0 4px var(--pxo-edge),0 0 0 7px var(--pxo-bg3),0 0 0 11px var(--pxo-edge),'
  + 'inset 0 0 0 1px var(--pxo-cyan),0 0 38px var(--pxo-glow);background:transparent;}'
  // The bottom "neck" of the CRT — a 16px slab extending below the screen.
  + '.pxo-bezel::after{content:"";position:absolute;left:30%;right:30%;bottom:-22px;height:18px;'
  + 'background:var(--pxo-bg3);box-shadow:inset -3px -3px 0 var(--pxo-edge);}'
  // A neon "● PWR" indicator on the bottom-right of the bezel.
  + '.pxo-bezel::before{content:"●  PWR";position:absolute;right:10px;bottom:-14px;font-size:9px;'
  + 'color:var(--pxo-neon);letter-spacing:2px;animation:pxo-blink 2s steps(2) infinite;'
  + 'background:var(--pxo-bg);padding:2px 6px;border:1px solid var(--pxo-edge);}'

/* ----------------------------------------------------------------------------
 * Standby screen: what the monitor shows before a note is picked.
 *
 * Shares the bezel's geometry vars so it fills the same cutout exactly, and
 * sits between the conversation (40) and the bezel rim (45). Only drawn while
 * the root carries `data-screen="off"`, which is also when the conversation is
 * hidden — the two are mutually exclusive by construction.
 * --------------------------------------------------------------------------*/
const STANDBY = '.pxo-standby{position:fixed;left:var(--pxo-sx);top:var(--pxo-sy);'
  + 'width:var(--pxo-sw);height:var(--pxo-sh);z-index:42;pointer-events:none;'
  + 'display:none;align-items:center;justify-content:center;'
  + 'background:var(--pxo-crt);'
  // Faint scanline wash so the dark screen still reads as a powered CRT.
  + 'background-image:repeating-linear-gradient(0deg,'
  + 'rgba(92,255,158,.035) 0 1px,transparent 1px 3px);'
  + 'box-shadow:inset 0 0 46px rgba(92,255,158,.06);}'
  + '.pxo-root[data-screen="off"] .pxo-standby{display:flex;}'
  + '.pxo-standby-in{display:flex;flex-direction:column;align-items:center;gap:10px;'
  + 'text-align:center;padding:0 24px;}'
  + '.pxo-standby .ttl{font-size:20px;font-weight:700;letter-spacing:6px;'
  + 'color:var(--pxo-neon);opacity:.5;text-shadow:0 0 14px var(--pxo-glow);'
  + 'animation:pxo-standby-dim 3.6s ease-in-out infinite;}'
  + '.pxo-standby .sub{font-size:11px;letter-spacing:2px;color:var(--pxo-faint);}'
  // Blinking block cursor, so the idle screen still feels alive.
  + '.pxo-standby .cursor{width:8px;height:14px;background:var(--pxo-neon);opacity:.7;'
  + 'animation:pxo-blink 1.1s steps(2) infinite;}'

/* ----------------------------------------------------------------------------
 * Planning board: dark green slate with a neon frame and a 4x2 sticky grid.
 * --------------------------------------------------------------------------*/
const BOARD = '.pxo-board{position:fixed;left:var(--pxo-bx);top:var(--pxo-sy);'
  + 'width:var(--pxo-bw);height:var(--pxo-sh);pointer-events:auto;z-index:30;'
  + 'background:#0c1a14;padding:18px;display:flex;flex-direction:column;gap:12px;'
  + 'box-shadow:inset 0 0 0 3px var(--pxo-edge),inset 0 0 0 6px var(--pxo-bg),'
  + 'inset 0 0 0 9px var(--pxo-edge),inset 0 0 60px rgba(0,0,0,.5),'
  + '0 0 30px rgba(92,255,158,.1);}'
  + '.pxo-board-hd{display:flex;align-items:center;justify-content:space-between;'
  + 'color:var(--pxo-neon);font-size:12px;font-weight:700;letter-spacing:3px;'
  + 'text-shadow:0 0 12px var(--pxo-glow);}'
  + '.pxo-board-hd .trail{color:var(--pxo-dim);font-size:11px;font-weight:400;letter-spacing:2px;}'
  // The grid fills the slate. The view layer measures this element and picks
  // counts that divide it evenly, so both axes are plain `1fr` tracks: there
  // is nothing to scroll and no leftover band. The note inside each cell is
  // sized from `--pxo-note-w` and centred, so a roomy cell shows margin rather
  // than a stretched sticker.
  + '.pxo-slots{flex:1 1 auto;display:grid;gap:10px;min-height:0;'
  + 'align-content:stretch;justify-content:stretch;overflow:hidden;}'
  // Cell backing: faint diagonal hatching so the slate reads as pinboard cork
  // rather than flat void even when few notes are pinned.
  + '.pxo-slot{position:relative;'
  + 'background:repeating-linear-gradient(45deg,rgba(255,255,255,.015) 0 6px,'
  + 'rgba(0,0,0,.08) 6px 12px);'
  + 'box-shadow:inset 0 0 0 2px rgba(92,255,158,.06);'
  + 'display:flex;align-items:center;justify-content:center;}'
  + '.pxo-slot[data-over="1"]{box-shadow:inset 0 0 0 3px var(--pxo-neon),'
  + '0 0 14px var(--pxo-glow),inset 0 0 24px rgba(92,255,158,.12);}'
  // Empty slot — the invite box matches the note footprint, so its outline
  // sits exactly where the sticker would land.
  + '.pxo-slot.empty::before{content:"";position:absolute;'
  + 'width:min(100%,var(--pxo-note-w,156px));aspect-ratio:156/168;max-height:100%;'
  + 'box-shadow:inset 0 0 0 2px var(--pxo-yellow);}'
  + '.pxo-slot.empty{cursor:cell;}'
  + '.pxo-slot.empty::after{content:"+";color:var(--pxo-yellow);font-size:32px;font-weight:700;'
  + 'text-shadow:0 0 12px rgba(255,227,92,.6);}'

/* ----------------------------------------------------------------------------
 * Sticky notes: paper rectangles with tape strip, pixel-pixel sway.
 * --------------------------------------------------------------------------*/
// The cell fills its share of the board; the note sizes itself from
// `--pxo-note-w` (measured by the view layer) and centres, so surplus cell
// space becomes margin instead of a stretched sticker. `aspect-ratio` works
// here because only the width is definite.
const STICKY = '.pxo-sticker{position:relative;'
  + 'width:min(100%,var(--pxo-note-w,156px));aspect-ratio:156/168;'
  + 'max-height:100%;margin:auto;'
  + 'padding:9px 10px 12px;color:#141a24;'
  + 'font-size:11px;line-height:1.35;font-weight:700;cursor:pointer;overflow:hidden;'
  + 'word-break:break-word;display:flex;flex-direction:column;gap:5px;'
  + 'box-shadow:3px 3px 0 rgba(0,0,0,.5),inset -2px -2px 0 rgba(0,0,0,.18),'
  + 'inset 2px 2px 0 rgba(255,255,255,.4);'
  + 'transform-origin:top center;touch-action:none;}'
  + '.pxo-sticker .tape{position:absolute;top:0;left:24%;width:30%;height:6px;opacity:.55;}'
  + '.pxo-sticker .tag{font-size:9px;letter-spacing:2px;color:#141a24;font-weight:700;}'
  + '.pxo-sticker .title{font-size:13px;line-height:1.25;flex:1;}'
  + '.pxo-sticker .meta{display:flex;justify-content:space-between;font-size:9px;letter-spacing:1px;}'
  + '.pxo-sticker[data-drag="1"]{opacity:.3;}'
  // Sway per-sticker, with a per-sticker delay computed in the view layer.
  + '.pxo-sticker{animation:pxo-sway 2.6s steps(3) infinite;}'
  // Right-bottom pixel: each sticker gets its own phase via animation-delay.
  + '.pxo-sticker .curl{position:absolute;right:0;bottom:0;width:13px;height:13px;'
  + 'background:rgba(0,0,0,.18);animation:pxo-curl 1.8s steps(3) infinite;}'
  + '.pxo-sticker.run{outline:3px solid var(--pxo-neon);outline-offset:-3px;'
  + 'box-shadow:0 0 14px var(--pxo-glow),3px 3px 0 rgba(0,0,0,.5);}'
  // The note currently on the monitor. Cyan reads as "selected" against the
  // green "running" outline, so a note can show both states at once: lifted and
  // ringed, with a corner marker that does not depend on colour alone.
  + '.pxo-sticker.is-open{outline:3px solid var(--pxo-cyan);outline-offset:-3px;'
  + 'transform:translateY(-3px) rotate(0deg);'
  + 'box-shadow:0 0 20px rgba(92,224,255,.5),4px 6px 0 rgba(0,0,0,.5);}'
  + '.pxo-sticker.is-open::after{content:"▶";position:absolute;left:5px;bottom:3px;'
  + 'font-size:9px;line-height:1;color:#0b2b33;opacity:.85;}'

/* ----------------------------------------------------------------------------
 * Sticker hover preview (Feature A): the read-only summary card.
 * --------------------------------------------------------------------------*/
const PREVIEW = '.pxo-preview{position:fixed;z-index:75;pointer-events:auto;'
  + 'background:var(--pxo-bg2);color:var(--pxo-ink);padding:12px 13px 11px;'
  + 'box-shadow:inset -3px -3px 0 var(--pxo-edge),inset 3px 3px 0 var(--pxo-line),'
  + '0 0 0 2px var(--pxo-edge),0 0 28px var(--pxo-glow),6px 6px 0 rgba(0,0,0,.5);'
  + 'animation:pxo-preview-in .16s cubic-bezier(.16,1.1,.3,1) both;}'
  + '.pxo-preview.closing{animation:pxo-preview-out .1s steps(2) both;}'
  + '.pxo-preview-hd{display:flex;align-items:baseline;justify-content:space-between;'
  + 'gap:8px;border-bottom:1px solid var(--pxo-edge);padding-bottom:7px;margin-bottom:8px;}'
  + '.pxo-preview-title{font-size:13px;font-weight:700;letter-spacing:1px;color:var(--pxo-ink);'
  + 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
  + '.pxo-preview-node{font-size:9px;letter-spacing:2px;color:var(--pxo-faint);flex:none;}'
  + '.pxo-preview-status{display:flex;align-items:center;gap:6px;font-size:10px;'
  + 'letter-spacing:1px;color:var(--pxo-dim);font-weight:700;}'
  + '.pxo-preview-status .dot{width:7px;height:7px;}'
  + '.pxo-preview-status .dot.run{background:var(--pxo-neon);box-shadow:0 0 6px var(--pxo-neon);}'
  + '.pxo-preview-status .dot.idle{background:var(--pxo-yellow);}'
  + '.pxo-preview-time{font-size:10px;letter-spacing:1px;color:var(--pxo-faint);margin-top:5px;}'
  // The message body is a placeholder: the session service does not expose
  // message contents to the plugin, so per the v2 handoff the preview degrades
  // to title + running state + time + note meta (§2.3). A faux transcript keeps
  // the card reading like a real preview rather than an empty box.
  + '.pxo-preview-msg{margin-top:9px;padding:8px;background:var(--pxo-crt);'
  + 'box-shadow:inset 0 0 0 1px var(--pxo-edge);display:flex;flex-direction:column;gap:5px;}'
  + '.pxo-preview-msg .ln{height:5px;background:var(--pxo-line);opacity:.7;}'
  + '.pxo-preview-msg .ln.short{width:60%;}'
  + '.pxo-preview-msg .ph{margin-top:3px;font-size:9px;letter-spacing:1px;'
  + 'color:var(--pxo-faint);font-style:italic;}'
  + '.pxo-preview-role{display:block;font-size:9px;letter-spacing:2px;'
  + 'color:var(--pxo-neon);margin-bottom:4px;}'
  + '.pxo-preview-text{display:-webkit-box;-webkit-box-orient:vertical;'
  + '-webkit-line-clamp:3;overflow:hidden;font-size:11px;line-height:1.5;'
  + 'color:var(--pxo-ink);word-break:break-word;white-space:pre-wrap;}'
  + '.pxo-preview-actions{display:flex;gap:6px;margin-top:10px;}'
  + '.pxo-btn-pv{flex:1;padding:6px 4px;font-size:10px;font-weight:700;letter-spacing:1px;'
  + 'background:var(--pxo-bg3);color:var(--pxo-ink);border:1px solid var(--pxo-edge);'
  + 'cursor:pointer;text-align:center;}'
  + '.pxo-btn-pv:hover{color:var(--pxo-neon);border-color:var(--pxo-neon);}'
  + '.pxo-btn-pv.open{background:var(--pxo-neon);color:var(--pxo-bg);border-color:var(--pxo-neon);}'
  + '.pxo-btn-pv.open:hover{color:var(--pxo-bg);filter:brightness(1.12);}'

/* ----------------------------------------------------------------------------
 * "New stack" — a couple of mis-rotated sticky blocks the user drags onto
 * empty slots to spawn a new session.
 * --------------------------------------------------------------------------*/
const STACK = '.pxo-stack-zone{position:fixed;left:var(--pxo-bx);'
  + 'bottom:30px;width:calc(var(--pxo-bw) - 36px);height:120px;pointer-events:auto;z-index:30;'
  + 'display:flex;align-items:center;gap:16px;}'
  + '.pxo-stack-visual{position:relative;width:160px;height:104px;}'
  + '.pxo-stack-note{position:absolute;width:108px;height:80px;'
  + 'box-shadow:inset -2px -2px 0 rgba(0,0,0,.3),inset 2px 2px 0 rgba(255,255,255,.4),'
  + '2px 2px 0 rgba(0,0,0,.5);cursor:grab;display:flex;align-items:center;justify-content:center;'
  + 'font-size:11px;font-weight:700;letter-spacing:2px;text-align:center;color:#141a24;transition:left .25s steps(3),top .25s steps(3),transform .25s steps(3),background .25s steps(3);}'
  + '.pxo-stack-info{flex:1;color:var(--pxo-ink);font-size:11px;line-height:1.7;letter-spacing:1px;}'
  + '.pxo-stack-info b{color:var(--pxo-yellow);letter-spacing:3px;font-weight:700;}'
  + '.pxo-stack-arrow{font-size:18px;color:var(--pxo-yellow);font-weight:700;letter-spacing:3px;}'
  + '.pxo-stack-hint{color:var(--pxo-faint);font-size:10px;letter-spacing:1px;}'

/* ----------------------------------------------------------------------------
 * Link-lost overlay: what the office shows when the host transport resets.
 * A full-bleed red CRT "NO CARRIER" so a dropped link reads as a dead terminal
 * rather than a silently frozen room. Pointer-events pass through; the toast
 * carries the spoken announcement.
 * --------------------------------------------------------------------------*/
const LINKLOST = '.pxo-lost{position:fixed;inset:0;z-index:70;pointer-events:none;'
  + 'display:flex;align-items:center;justify-content:center;'
  + 'background:repeating-linear-gradient(0deg,rgba(255,60,60,.10) 0 2px,transparent 2px 4px),'
  + 'radial-gradient(120% 80% at 50% 50%,rgba(40,4,8,.55),rgba(8,2,4,.86));'
  + 'animation:pxo-fade .2s ease-out both;}'
  + '.pxo-lost-in{display:flex;flex-direction:column;align-items:center;gap:10px;'
  + 'text-align:center;padding:0 24px;}'
  + '.pxo-lost .ttl{font-size:26px;font-weight:700;letter-spacing:8px;color:var(--pxo-red);'
  + 'text-shadow:0 0 18px rgba(255,92,92,.6);animation:pxo-blink 1.1s steps(2) infinite;}'
  + '.pxo-lost .sub{font-size:11px;letter-spacing:2px;color:#ffb0b0;}'
  + '.pxo-lost .cursor{width:9px;height:15px;background:var(--pxo-red);opacity:.7;'
  + 'animation:pxo-blink 1.1s steps(2) infinite;}'

/* ----------------------------------------------------------------------------
 * Dialogs, drag ghost, settings.
 * --------------------------------------------------------------------------*/
const DIALOGS = '.pxo-modal-bg{position:fixed;inset:0;z-index:90;pointer-events:auto;'
  + 'background:rgba(4,8,18,.72);display:flex;align-items:center;justify-content:center;}'
  + '.pxo-modal{width:400px;max-width:88vw;background:var(--pxo-bg2);padding:20px;'
  + 'box-shadow:inset -4px -4px 0 var(--pxo-edge),inset 4px 4px 0 var(--pxo-line),'
  + '0 0 0 4px var(--pxo-edge),0 0 30px var(--pxo-glow);}'
  + '.pxo-modal-bg.board{inset:auto;left:var(--pxo-bx);top:var(--pxo-sy);'
  + 'width:var(--pxo-bw);height:var(--pxo-sh);background:rgba(4,10,8,.72);}'
  + '.pxo-modal-bg.board .pxo-modal{width:min(340px,calc(100% - 28px));max-width:none;padding:16px;'
  + 'box-shadow:inset -4px -4px 0 var(--pxo-edge),inset 4px 4px 0 var(--pxo-line),'
  + '0 0 0 4px var(--pxo-edge),6px 6px 0 rgba(0,0,0,.45);}'
  + '.pxo-modal-bg.board .pxo-modal h3{font-size:12px;}'
  + '.pxo-modal-bg.board .pxo-modal p{margin-bottom:12px;}'
  + '.pxo-modal h3{margin:0 0 6px;color:var(--pxo-neon);font-size:13px;letter-spacing:2px;'
  + 'text-shadow:0 0 10px var(--pxo-glow);}'
  + '.pxo-modal p{margin:0 0 14px;color:var(--pxo-dim);font-size:10px;letter-spacing:1px;line-height:1.6;}'
  + '.pxo-input{width:100%;background:var(--pxo-bg3);color:var(--pxo-ink);border:0;padding:10px;'
  + 'font-size:12px;box-shadow:inset 2px 2px 0 var(--pxo-edge),'
  + 'inset -2px -2px 0 var(--pxo-line);outline:none;}'
  + '.pxo-input:focus{box-shadow:inset 2px 2px 0 var(--pxo-edge),'
  + 'inset -2px -2px 0 var(--pxo-neon);}'
  + '.pxo-input::placeholder{color:var(--pxo-faint);}'
  + '.pxo-row{display:flex;gap:8px;justify-content:flex-end;margin-top:16px;}'
  + '.pxo-range{width:100%;accent-color:var(--pxo-neon);}'
  + '.pxo-set-row{display:flex;justify-content:space-between;align-items:center;color:var(--pxo-ink);'
  + 'font-size:11px;letter-spacing:1px;margin-bottom:8px;}'
  + '.pxo-preview{display:flex;gap:4px;margin-top:10px;flex-wrap:wrap;}'
  + '.pxo-pv{background:var(--pxo-yellow);box-shadow:2px 2px 0 rgba(0,0,0,.4);}'
  + '.pxo-note{color:var(--pxo-dim);font-size:10px;letter-spacing:1px;line-height:1.7;margin:14px 0 0;}'
  + '.pxo-ghost{position:fixed;z-index:80;pointer-events:none;padding:7px;font-size:10px;'
  + 'font-weight:700;color:#141a24;box-shadow:4px 4px 0 rgba(0,0,0,.5);opacity:.92;overflow:hidden;}'

/* ----------------------------------------------------------------------------
 * Toast: the transient status line the scene raises for workspace/session work.
 *
 * `views.tsx` has always rendered `.pxo-toast`, but no rule matched it, so every
 * notice was unstyled body text in the top-left corner. It is a bottom HUD
 * strip with a neon leader block and a slide-in.
 *
 * It is offset to the RIGHT rather than centred. The new-note stack sits in the
 * lower-left of the desk view (30px..150px tall) and centres its `→ DRAG →`
 * column near 90px, so a centred strip at the original `bottom:56px` laid
 * itself straight across that glyph row whenever a notice was up. Clearing the
 * stack horizontally keeps the notice low in the frame; raising it above the
 * dock instead pushed it far up into the scene.
 * --------------------------------------------------------------------------*/
const TOAST = '.pxo-toast{position:fixed;left:50%;bottom:28px;'
  + 'z-index:95;pointer-events:none;'
  + 'display:flex;align-items:center;gap:10px;padding:10px 18px 10px 14px;'
  + 'background:rgba(8,14,28,.92);color:var(--pxo-ink);font-size:11px;font-weight:700;'
  + 'letter-spacing:2px;white-space:nowrap;'
  + 'box-shadow:inset 0 0 0 2px var(--pxo-edge),0 0 0 2px rgba(3,6,13,.9),'
  + '0 0 26px var(--pxo-glow),6px 6px 0 rgba(0,0,0,.5);'
  + 'animation:pxo-toast-in .34s cubic-bezier(.16,1.1,.3,1) both;}'
  + '.pxo-toast > span{width:5px;height:16px;flex:none;background:var(--pxo-neon);'
  + 'box-shadow:0 0 10px var(--pxo-neon);animation:pxo-pulse 1.1s ease-in-out infinite;}'

/* ----------------------------------------------------------------------------
 * Master switch, styled independently of the skin.
 *
 * Everything else in this file lives in the sheet the switch removes, so with
 * the skin bypassed those rules are gone and the section would render as raw
 * unstyled markup — the one control the user needs to get back is the one that
 * would look broken. These rules therefore ship in a separate always-present
 * sheet and inherit the host's own theme tokens instead of the pixel palette,
 * so the card looks native in both the shipped light and dark schemes.
 * --------------------------------------------------------------------------*/
const MASTER = '.pxo-set-master{padding:14px;border:1px solid var(--dsw-alias-border-l1,#8884);'
  + 'border-radius:6px;display:flex;flex-direction:column;gap:10px;'
  + 'background:var(--dsw-alias-bg-layer-2,transparent);'
  + 'color:var(--dsw-alias-label-primary,inherit);font-family:inherit;}'
  + '.pxo-set-master .pxo-set-row{display:flex;align-items:center;'
  + 'justify-content:space-between;gap:12px;margin:0;font-size:13px;font-weight:600;'
  + 'color:var(--dsw-alias-label-primary,inherit);}'
  + '.pxo-set-master output{font-size:11px;letter-spacing:1px;'
  + 'color:var(--dsw-alias-label-tertiary,inherit);'
  + 'font-family:ui-monospace,monospace;}'
  // NOTE: No master-specific .pxo-toggle rules here. The master toggle uses
  // className="pxo-toggle" just like the grid toggle, so it picks up the
  // generic .pxo-toggle > span / ::after path from SETTINGS_BASE (base mode)
  // or from the skin's .pxo-toggle block (pixel mode). This avoids the
  // specificity war where base .pxo-set-master .pxo-toggle > span (round lamp)
  // fought against skin overrides — a battle that caused first-load
  // misalignment across multiple fix attempts.
  + '.pxo-set-master .pxo-note{margin:0;font-size:11px;line-height:1.7;'
  + 'letter-spacing:normal;color:var(--dsw-alias-label-secondary,inherit);}'

/* ----------------------------------------------------------------------------
 * Base settings panel: always injected so the section looks polished even
 * when the pixel skin is off. Uses host theme tokens (--dsw-*) so it adapts
 * to light/dark automatically. The pixel skin's two-class selectors
 * (.pxo-set-master ...) override these on specificity when the skin loads.
 * --------------------------------------------------------------------------*/
const SETTINGS_BASE = '.pxo-settings{display:flex;flex-direction:column;gap:16px;'
  + 'font-family:inherit;}'
  + '.pxo-settings-hero{padding:16px 18px;'
  + 'background:var(--dsw-alias-bg-layer-2,transparent);'
  + 'border-radius:8px;border:1px solid var(--dsw-alias-border-l1,#e5e7eb);}'
  + '.pxo-settings-kicker{display:inline-block;font-size:10px;letter-spacing:2px;'
  + 'text-transform:uppercase;color:var(--dsw-alias-label-tertiary,#9ca3af);'
  + 'font-weight:600;}'
  + '.pxo-settings-hero h2{margin:6px 0 4px;font-size:18px;font-weight:700;'
  + 'color:var(--dsw-alias-label-primary,#111827);letter-spacing:.5px;}'
  + '.pxo-settings-hero p{margin:0;font-size:12px;line-height:1.6;'
  + 'color:var(--dsw-alias-label-secondary,#6b7280);}'
  + '.pxo-set-card{padding:16px;background:var(--dsw-alias-bg-layer-2,transparent);'
  + 'border-radius:8px;border:1px solid var(--dsw-alias-border-l1,#e5e7eb);}'
  + '.pxo-set-card .pxo-set-row{margin-bottom:10px;}'
  + '.pxo-set-card > .pxo-set-row > span,'
  + '.pxo-set-card label{color:var(--dsw-alias-label-primary,#111827);'
  + 'font-size:13px;font-weight:600;}'
  + '.pxo-set-card output{color:var(--dsw-alias-accent-primary,#3b82f6);'
  + 'font-size:11px;font-weight:700;padding:3px 8px;'
  + 'background:var(--dsw-alias-bg-layer-3,f9fafb);border-radius:4px;'
  + 'border:1px solid var(--dsw-alias-border-l2,#e5e7eb);}'
  // Segmented control — native-looking pill group.
  + '.pxo-segment{display:flex;gap:0;border-radius:6px;'
  + 'overflow:hidden;border:1px solid var(--dsw-alias-border-l1,#e5e7eb);'
  + 'background:var(--dsw-alias-bg-layer-3,f9fafb);}'
  + '.pxo-segment button{flex:1;padding:8px 12px;font-size:12px;font-weight:600;'
  + 'cursor:pointer;border:0;background:transparent;'
  + 'color:var(--dsw-alias-label-secondary,#6b7280);'
  + 'transition:color .15s,background .15s;}'
  + '.pxo-segment button:hover{color:var(--dsw-alias-label-primary,#111827);'
  + 'background:var(--dsw-alias-interactive-bg-hover,f3f4f6);}'
  + '.pxo-segment button[aria-pressed="true"]{'
  + 'background:var(--dsw-alias-accent-primary,#3b82f6);color:#fff;}'
  // Grid / generic toggle — native-looking switch.
  + '.pxo-toggle{display:inline-flex;align-items:center;gap:8px;'
  + 'cursor:pointer;font-size:12px;font-weight:600;'
  + 'color:var(--dsw-alias-label-primary,#111827);'
  + 'background:transparent;border:0;padding:0;}'
  + '.pxo-toggle > span{position:relative;display:inline-flex;flex:none;'
  + 'width:36px;height:20px;border-radius:10px;'
  + 'background:var(--dsw-alias-border-l2,#d1d5db);'
  + 'transition:background .2s ease;}'
  + '.pxo-toggle > span::after{content:"";position:absolute;top:2px;left:2px;'
  + 'width:16px;height:16px;border-radius:50%;background:#fff;'
  + 'box-shadow:0 1px 3px rgba(0,0,0,.15);'
  + 'transition:left .2s ease,background .2s ease;}'
  + '.pxo-toggle[aria-pressed="true"] > span{'
  + 'background:var(--dsw-alias-accent-primary,#3b82f6);}'
  + '.pxo-toggle[aria-pressed="true"] > span::after{left:18px;}'
  + '.pxo-toggle:hover{color:var(--dsw-alias-accent-primary,#3b82f6);}'
  // Notes.
  + '.pxo-note{margin:8px 0 0;font-size:11px;line-height:1.6;'
  + 'color:var(--dsw-alias-label-tertiary,#9ca3af);}'

/** Styles that must survive the skin being switched off. */
export const BASE_CSS: string = MASTER + SETTINGS_BASE

/* ----------------------------------------------------------------------------
 * Settings section: hero, cards, segmented control, toggle.
 *
 * Also previously unstyled — the shipped settings panel is beige/dark per the
 * host scheme, so these rules paint their own dark pixel surface rather than
 * inheriting, and stay legible either way.
 * --------------------------------------------------------------------------*/
const SETTINGS = '.pxo-settings{display:flex;flex-direction:column;gap:14px;'
  + 'font-family:var(--pxo-font);}'
  + '.pxo-settings-hero{position:relative;overflow:hidden;padding:16px 18px;'
  + 'background:linear-gradient(135deg,#101a33 0%,#0a1020 60%,#111d38 100%);'
  + 'box-shadow:inset 0 0 0 2px var(--pxo-edge),inset 0 0 40px rgba(92,255,158,.08);}'
  // A slow diagonal shimmer across the hero so the panel is not a dead slab.
  + '.pxo-settings-hero::after{content:"";position:absolute;top:-60%;left:-60%;'
  + 'width:60%;height:220%;transform:rotate(18deg);'
  + 'background:linear-gradient(90deg,transparent,rgba(140,235,255,.13),transparent);'
  + 'animation:pxo-sheen 5.5s ease-in-out infinite;}'
  + '.pxo-settings-kicker{display:inline-block;font-size:9px;letter-spacing:3px;'
  + 'color:var(--pxo-neon);text-shadow:0 0 12px var(--pxo-glow);}'
  + '.pxo-settings-hero h2{margin:6px 0 4px;font-size:16px;letter-spacing:3px;'
  + 'color:var(--pxo-ink);font-weight:700;'
  + 'text-shadow:2px 0 0 rgba(255,92,171,.5),-2px 0 0 rgba(92,224,255,.5);}'
  + '.pxo-settings-hero p{margin:0;font-size:10px;line-height:1.7;letter-spacing:1px;'
  + 'color:var(--pxo-dim);}'
  + '.pxo-set-card{padding:14px;background:var(--pxo-bg2);'
  + 'box-shadow:inset 0 0 0 2px var(--pxo-edge),inset -3px -3px 0 rgba(0,0,0,.3),'
  + 'inset 3px 3px 0 rgba(255,255,255,.03);}'
  // Re-skin the master card. Its own rules are two-class selectors that would
  // otherwise outrank the generic pixel ones regardless of sheet order, leaving
  // a native-looking control stranded in the middle of the pixel panel.
  //
  // The master card shares the same vertical layout as .pxo-set-card
  // (title row -> toggle bar -> note) and the same pixel card shell.
  //
  // The master toggle uses className="pxo-toggle" just like the grid toggle,
  // so it picks up the generic .pxo-toggle / > span / ::after rules below.
  // No master-specific toggle overrides needed — this eliminates the
  // specificity war that caused first-load misalignment across many fix
  // attempts.
  + '.pxo-settings .pxo-set-master{padding:14px;background:var(--pxo-bg2);'
  + 'box-shadow:inset 0 0 0 2px var(--pxo-edge),inset -3px -3px 0 rgba(0,0,0,.3),'
  + 'inset 3px 3px 0 rgba(255,255,255,.03);'
  + 'font-family:var(--pxo-font);color:var(--pxo-ink);}'
  + '.pxo-settings .pxo-set-master .pxo-set-row{color:var(--pxo-ink);font-size:11px;'
  + 'font-weight:700;letter-spacing:2px;margin-bottom:0;}'
  + '.pxo-settings .pxo-set-master output{color:var(--pxo-neon);background:var(--pxo-crt);'
  + 'font-family:var(--pxo-font);letter-spacing:2px;}'
  + '.pxo-settings .pxo-set-master .pxo-note{color:var(--pxo-dim);font-size:10px;letter-spacing:1px;}'
  + '.pxo-set-card .pxo-set-row{margin-bottom:10px;}'
  + '.pxo-set-card label,.pxo-set-card > .pxo-set-row > span{color:var(--pxo-ink);'
  + 'font-size:11px;font-weight:700;letter-spacing:2px;}'
  + '.pxo-set-card output{color:var(--pxo-neon);font-size:10px;font-weight:700;'
  + 'letter-spacing:2px;padding:3px 8px;background:var(--pxo-crt);'
  + 'box-shadow:inset 0 0 0 1px var(--pxo-neon),inset 0 0 12px rgba(92,255,158,.2);}'
  // Segmented control (CALM / OVERDRIVE).
  + '.pxo-segment{display:flex;gap:0;}'
  + '.pxo-segment button{flex:1;padding:9px 10px;font-size:11px;font-weight:700;'
  + 'letter-spacing:2px;cursor:pointer;border:0;background:var(--pxo-bg3);'
  + 'color:var(--pxo-dim);font-family:var(--pxo-font);'
  + 'box-shadow:inset 0 0 0 2px var(--pxo-edge);'
  + 'transition:color .12s steps(2),background .12s steps(2);}'
  + '.pxo-segment button + button{margin-left:-2px;}'
  + '.pxo-segment button:hover{color:var(--pxo-ink);}'
  + '.pxo-segment button[aria-pressed="true"]{background:var(--pxo-crt);color:var(--pxo-neon);'
  + 'box-shadow:inset 0 0 0 2px var(--pxo-neon),inset 0 0 18px rgba(92,255,158,.22),'
  + '0 0 14px var(--pxo-glow);}'
  // Grid toggle: a pixel switch whose knob slides between two hard positions.
  + '.pxo-toggle{display:flex;align-items:center;gap:10px;width:100%;padding:9px 12px;'
  + 'background:var(--pxo-bg3);color:var(--pxo-dim);border:0;cursor:pointer;'
  + 'font-size:11px;font-weight:700;letter-spacing:2px;font-family:var(--pxo-font);'
  + 'box-shadow:inset 0 0 0 2px var(--pxo-edge);}'
  + '.pxo-toggle > span{position:relative;flex:none;width:34px;height:16px;'
  + 'background:var(--pxo-crt);box-shadow:inset 0 0 0 2px var(--pxo-edge);}'
  + '.pxo-toggle > span::after{content:"";position:absolute;top:2px;left:2px;'
  + 'width:12px;height:12px;background:var(--pxo-faint);'
  + 'transition:left .16s steps(3),background .16s steps(3),box-shadow .16s steps(3);}'
  + '.pxo-toggle[aria-pressed="true"]{color:var(--pxo-neon);}'
  + '.pxo-toggle[aria-pressed="true"] > span::after{left:18px;background:var(--pxo-neon);'
  + 'box-shadow:0 0 10px var(--pxo-neon);}'
  + '.pxo-toggle:hover{color:var(--pxo-ink);}'
  // The swatch strip under the toggle.
  + '.pxo-preview .pxo-pv{width:26px;height:14px;}'

/* ----------------------------------------------------------------------------
 * States the views emit that previously had no matching rule: the active
 * toolbar chip and the idle variant of the status pill.
 * --------------------------------------------------------------------------*/
const STATES = '.pxo-chip{transition:color .12s steps(2),box-shadow .12s steps(2);}'
  + '.pxo-chip:hover{color:var(--pxo-neon);box-shadow:inset 0 0 0 1px var(--pxo-neon);}'
  + '.pxo-chip.is-active{background:var(--pxo-crt);color:var(--pxo-neon);'
  + 'box-shadow:inset 0 0 0 1px var(--pxo-neon),inset 0 0 14px rgba(92,255,158,.22),'
  + '0 0 12px var(--pxo-glow);}'
  + '.pxo-chip.is-active .dot{box-shadow:0 0 8px var(--pxo-neon);'
  + 'animation:pxo-blink 1s steps(2) infinite;}'
  + '.pxo-status-pill.is-idle{border-color:var(--pxo-faint);color:var(--pxo-dim);'
  + 'box-shadow:inset 0 0 12px rgba(143,161,191,.10);}'
  + '.pxo-status-pill.is-idle .dot{background:var(--pxo-faint);box-shadow:none;animation:none;}'
  // Chromatic-aberration title: two offset copies behind the real glyphs.
  + '.pxo-logo-main{position:relative;}'
  + '.pxo-logo-main::before,.pxo-logo-main::after{content:attr(data-text);'
  + 'position:absolute;left:0;top:0;pointer-events:none;}'
  + '.pxo-logo-main::before{color:rgba(255,92,171,.75);transform:translateX(-1.5px);}'
  + '.pxo-logo-main::after{color:rgba(92,224,255,.75);transform:translateX(1.5px);}'
  + '.pxo-logo-square{animation:pxo-logo-hum 4s ease-in-out infinite;}'

/* ----------------------------------------------------------------------------
 * Transitions and intensity.
 *
 * `data-transition` is set by index.tsx around desk entry/exit but nothing
 * consumed it, so both moves were instant cuts. Entry is a CRT power-on
 * (bloom + vertical unfold); exit collapses back. `data-intensity="calm"`
 * keeps every color but drops the ambient loops, which is what the setting
 * promised.
 * --------------------------------------------------------------------------*/
const MOTION = // Staggered desk arrival: each tile carries --pxo-i from the view layer.
  '.pxo-root[data-mode="top"] .pxo-desk{'
  + 'animation:pxo-desk-in .42s cubic-bezier(.16,1.05,.3,1) both;'
  + 'animation-delay:calc(var(--pxo-i,0) * 34ms);}'
  // Desk entry / exit.
  + '.pxo-root[data-transition="entering"] .pxo-board,'
  + '.pxo-root[data-transition="entering"] .pxo-bezel{'
  + 'animation:pxo-power-on .5s cubic-bezier(.16,1.05,.3,1) both;}'
  + '.pxo-root[data-transition="entering"] .pxo-stack-zone{'
  + 'animation:pxo-rise .5s cubic-bezier(.16,1.05,.3,1) both;animation-delay:.08s;}'
  // Returning to the grid replays the power-on as the desks arrive, so the
  // move reads as a CRT switching channels rather than a cut. It is never
  // applied to `.pxo-fill` itself: `pxo-power-off` uses `both`, so a stalled
  // phase there would leave the whole scene collapsed at scaleY(0).
  + '.pxo-root[data-mode="top"][data-transition="entering"] .pxo-grid{'
  + 'animation:pxo-power-on .42s cubic-bezier(.16,1.05,.3,1) both;}'
  // A full-screen flash on entry, so the cut has an impact frame.
  + '.pxo-root[data-transition="entering"] .pxo-vign{'
  + 'animation:pxo-flash .42s ease-out both;}'
  // Hover lift on the desk gets an easing curve instead of a 2-step jump.
  + '.pxo-desk{transition:transform .14s cubic-bezier(.2,.9,.25,1),'
  + 'box-shadow .14s ease-out;}'
  + '.pxo-desk:active{transform:translate(0,0) scale(.985);}'
  // Sticker: lift and straighten on hover, so the board feels physical.
  + '.pxo-sticker{transition:transform .16s cubic-bezier(.2,.9,.25,1),'
  + 'box-shadow .16s ease-out,filter .16s ease-out;}'
  + '.pxo-sticker:hover{animation-play-state:paused;'
  + 'transform:translateY(-4px) rotate(0deg) scale(1.03);filter:brightness(1.06);'
  + 'box-shadow:0 0 22px rgba(255,255,255,.18),6px 8px 0 rgba(0,0,0,.55),'
  + 'inset -2px -2px 0 rgba(0,0,0,.18),inset 2px 2px 0 rgba(255,255,255,.4);z-index:2;}'
  + '.pxo-slot{transition:box-shadow .14s ease-out;}'
  // Buttons pick up a curve too.
  + '.pxo-btn,.pxo-btn-new,.pxo-btn-set,.pxo-btn-leave,.pxo-ico{'
  + 'transition:color .12s steps(2),background .12s steps(2),'
  + 'box-shadow .14s ease-out,transform .1s ease-out;}'
  + '.pxo-btn-new:active,.pxo-btn-set:active,.pxo-btn-leave:active{transform:translateY(1px);}'
  // Modal arrival.
  + '.pxo-modal{animation:pxo-modal-in .26s cubic-bezier(.16,1.1,.3,1) both;}'
  + '.pxo-modal-bg{animation:pxo-fade .2s ease-out both;}'
  // ── CALM: keep the palette, drop the ambient motion.
  + '.pxo-root[data-intensity="calm"] .pxo-sky,'
  + '.pxo-root[data-intensity="calm"] .pxo-motes,'
  + '.pxo-root[data-intensity="calm"] .pxo-grid-floor,'
  + '.pxo-root[data-intensity="calm"] .pxo-grid-sky{animation:none;}'
  + '.pxo-root[data-intensity="calm"] .pxo-scan::after{display:none;}'
  + '.pxo-root[data-intensity="calm"] .pxo-sticker{animation:none;}'
  + '.pxo-root[data-intensity="calm"] .pxo-sticker .curl{animation:none;}'
  + '.pxo-root[data-intensity="calm"] .pxo-art-monitor.is-run::after{animation:none;}'
  // The monitor cat is ambient too: CALM freezes the blink rather than hiding
  // the face, so a running desk keeps its detail without motion.
  + '.pxo-root[data-intensity="calm"] .pxo-art-monitor .pxo-catface .eye{animation:none;}'
  // Standby screen: the wording still reads, it just stops pulsing.
  + '.pxo-root[data-intensity="calm"] .pxo-standby .ttl,'
  + '.pxo-root[data-intensity="calm"] .pxo-standby .cursor{animation:none;}'
  + '.pxo-root[data-intensity="calm"] .pxo-settings-hero::after{animation:none;}'
  + '.pxo-root[data-intensity="calm"] .pxo-logo-square{animation:none;}'
  // ── OVERDRIVE: push the ambient layers harder.
  + '.pxo-root[data-intensity="overdrive"] .pxo-sky{opacity:.72;}'
  + '.pxo-root[data-intensity="overdrive"] .pxo-grid-floor{opacity:.62;'
  + 'animation-duration:4s;}'
  + '.pxo-root[data-intensity="overdrive"] .pxo-vign{'
  + 'animation:pxo-breathe 6s ease-in-out infinite;}'
  // Respect the OS reduced-motion preference regardless of the plugin setting.
  + '@media (prefers-reduced-motion:reduce){'
  + '.pxo-root *{animation-duration:.001s!important;animation-iteration-count:1!important;'
  + 'transition-duration:.001s!important;}}'

/* ----------------------------------------------------------------------------
 * Pure-CSS keyframes: every motion is `steps()` so it reads as pixel-locked.
 * No timers on this side; the stylesheet is a static asset with a single owner.
 * --------------------------------------------------------------------------*/
const KEYFRAMES = '@keyframes pxo-blink{0%,49%{opacity:1}50%,100%{opacity:.25}}'
  + '@keyframes pxo-flicker{0%,100%{filter:brightness(1)}50%{filter:brightness(1.35)}}'
  // Standby title breathes very slightly, so a dark screen is not dead pixels.
  + '@keyframes pxo-standby-dim{0%,100%{opacity:.5}50%{opacity:.26}}'
  // Blink: the eye squashes to a slit for two frames near the end of the cycle,
  // so it stays open most of the time. Stepped, so the lid snaps.
  + '@keyframes pxo-cat-blink{0%,92%{transform:scaleY(1)}'
  + '94%,97%{transform:scaleY(.12)}100%{transform:scaleY(1)}}'
  // Sway keeps its stepped feel but adds a tiny vertical bob, so notes read as
  // paper hanging on tape rather than a rectangle rotating in place.
  + '@keyframes pxo-sway{0%{transform:rotate(0deg) translateY(0)}'
  + '33%{transform:rotate(.6deg) translateY(-1px)}'
  + '66%{transform:rotate(-.6deg) translateY(1px)}'
  + '100%{transform:rotate(0deg) translateY(0)}}'
  + '@keyframes pxo-curl{0%{width:13px;height:13px}50%{width:19px;height:19px}100%{width:13px;height:13px}}'
  + '@keyframes pxo-sweep{0%{top:-28vh}100%{top:128vh}}'
  // ── Backdrop motion.
  + '@keyframes pxo-drift-a{0%,100%{transform:translate(0,0) scale(1)}'
  + '33%{transform:translate(9%,5%) scale(1.13)}'
  + '66%{transform:translate(-6%,9%) scale(.94)}}'
  + '@keyframes pxo-drift-b{0%,100%{transform:translate(0,0) scale(1.05)}'
  + '40%{transform:translate(-11%,-6%) scale(.92)}'
  + '75%{transform:translate(7%,4%) scale(1.16)}}'
  // The floor grid scrolls exactly one cell, so the loop is seamless.
  + '@keyframes pxo-floor{0%{background-position:0 0,0 0}'
  + '100%{background-position:0 0,0 88px}}'
  + '@keyframes pxo-mote-a{0%{transform:translate3d(0,0,0)}'
  + '100%{transform:translate3d(-260px,260px,0)}}'
  + '@keyframes pxo-mote-b{0%{transform:translate3d(0,0,0)}'
  + '100%{transform:translate3d(420px,420px,0)}}'
  + '@keyframes pxo-mote-c{0%{transform:translate3d(0,0,0)}'
  + '100%{transform:translate3d(-640px,320px,0)}}'
  + '@keyframes pxo-breathe{0%,100%{opacity:1}50%{opacity:.82}}'
  // ── Entry / exit.
  + '@keyframes pxo-desk-in{0%{opacity:0;transform:translateY(14px) scale(.94)}'
  + '100%{opacity:1;transform:translateY(0) scale(1)}}'
  // CRT power-on: a bright horizontal line that unfolds vertically.
  + '@keyframes pxo-power-on{0%{opacity:0;transform:scaleY(.02);filter:brightness(2.6)}'
  + '45%{opacity:1;transform:scaleY(.06);filter:brightness(2.2)}'
  + '70%{transform:scaleY(1.04);filter:brightness(1.5)}'
  + '100%{opacity:1;transform:scaleY(1);filter:brightness(1)}}'
  + '@keyframes pxo-rise{0%{opacity:0;transform:translateY(22px)}'
  + '100%{opacity:1;transform:translateY(0)}}'
  + '@keyframes pxo-flash{0%{background-color:rgba(150,255,215,.28)}'
  + '100%{background-color:transparent}}'
  + '@keyframes pxo-modal-in{0%{opacity:0;transform:translateY(10px) scale(.96)}'
  + '100%{opacity:1;transform:translateY(0) scale(1)}}'
  + '@keyframes pxo-fade{0%{opacity:0}100%{opacity:1}}'
  + '@keyframes pxo-toast-in{0%{opacity:0;transform:translate(-50%,14px)}'
  + '100%{opacity:1;transform:translate(-50%,0)}}'
  + '@keyframes pxo-pulse{0%,100%{opacity:1;box-shadow:0 0 10px var(--pxo-neon)}'
  + '50%{opacity:.5;box-shadow:0 0 4px var(--pxo-neon)}}'
  + '@keyframes pxo-sheen{0%,100%{transform:translateX(0) rotate(18deg)}'
  + '50%{transform:translateX(320%) rotate(18deg)}}'
  + '@keyframes pxo-logo-hum{0%,100%{box-shadow:0 0 0 1px var(--pxo-edge),0 0 12px var(--pxo-glow)}'
  + '50%{box-shadow:0 0 0 1px var(--pxo-edge),0 0 22px var(--pxo-neon)}}'
  // Sticker hover preview: slide in from the sticker, slide out on exit.
  + '@keyframes pxo-preview-in{0%{opacity:0;transform:translateX(-6px)}'
  + '100%{opacity:1;transform:translateX(0)}}'
  + '@keyframes pxo-preview-out{0%{opacity:1;transform:translateX(0)}'
  + '100%{opacity:0;transform:translateX(-6px)}}'

/** The complete stylesheet text. */
export const CSS: string = [
  GEOMETRY, SIDEBAR, CONVERSATION, COMPOSER,
  ROOT, BACKDROP, CHROME, GRID, STATION, PLATE, EMPTY_CTA, CAPTION,
  DESK_CHROME, BEZEL, STANDBY, BOARD, STICKY, PREVIEW, STACK, DIALOGS,
  TOAST, SETTINGS, STATES, MOTION, LINKLOST,
  KEYFRAMES,
].join('\n')

/** Attribute marking this plugin's style tag, so the effect can remove exactly it. */
const STYLE_MARKER = 'data-pixel-office'

/**
 * Inject one style tag and return its disposer.
 * @param css - stylesheet text to insert.
 * @param variant - marker value, so the two sheets are told apart in devtools
 * and each disposer removes exactly its own tag.
 * @returns a disposer removing the injected tag.
 */
function insertSheet(css: string, variant: string): () => void {
  const tag = document.createElement('style')
  tag.setAttribute(STYLE_MARKER, variant)
  tag.textContent = css
  document.head.appendChild(tag)
  return () => { tag.remove() }
}

/**
 * Inject the always-present base sheet.
 *
 * Injected once for the plugin's whole lifetime, independently of the skin
 * toggle: it styles the master switch, which has to stay usable precisely when
 * the skin sheet is absent. Inserted before the skin sheet so equal-specificity
 * pixel rules win while the skin is on.
 * @returns a disposer removing the injected tag.
 */
export function insertBaseStyles(): () => void {
  return insertSheet(BASE_CSS, 'base')
}

/**
 * Inject the pixel skin stylesheet and return its disposer.
 *
 * A plugin-owned effect rather than a build-time side effect: the caller wires
 * it into the Cordis lifecycle so unloading the plugin — or switching the skin
 * off — removes the tag and restores the shipped theme.
 * @returns a disposer removing the injected tag.
 */
export function insertStyles(): () => void {
  return insertSheet(CSS, 'skin')
}
