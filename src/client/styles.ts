/**
 * The Pixel Office stylesheet, as text injected through a lifecycle effect.
 *
 * Plain text rather than a CSS Module because this repository builds with a
 * standalone tsdown config and has no CSS pipeline. The scene's own chrome
 * resolves every color through a theme token, so the whole office follows the
 * Appearance preference with no JS theme subscription. Object colors (desk
 * wood, sticky-note paper, name-plate plastic) stay literal in both schemes:
 * they are physical objects, not surfaces.
 * @module dsh-client-pixel-office/styles
 */

/**
 * Geometry of the monitor cutout the real conversation is constrained into,
 * plus the planning board beside it. Dialogs anchored to the board read the
 * `--pxo-b*` values so they can never cover the conversation.
 */
const GEOMETRY = ':root{'
  + '--pxo-sx:52vw;--pxo-sy:12vh;--pxo-sw:44vw;--pxo-sh:62vh;'
  + '--pxo-bx:2.5vw;--pxo-bw:calc(var(--pxo-sx) - 7vw);'
  + '--pxo-font:"Courier New",ui-monospace,monospace;'
  + '--pxo-ink:var(--dsw-alias-label-primary);'
  + '--pxo-dim:var(--dsw-alias-label-caption);'
  + '--pxo-bg:var(--dsw-alias-bg-base);'
  + '--pxo-bg2:var(--dsw-alias-bg-layer-2);'
  + '--pxo-line:var(--dsw-alias-border-l1);'
  + '--pxo-neon:var(--dsw-alias-state-business-primary);'
  + '--pxo-bd:var(--dsw-specific-pxo-bevel-dark);'
  + '--pxo-bl:var(--dsw-specific-pxo-bevel-light);'
  + '--pxo-scan:var(--dsw-specific-pxo-scan);'
  + '}'

/**
 * Sidebar removal, and the reason it is a clip rather than `display:none`.
 *
 * The settings panel is rendered by the settings plugin into the
 * `sidebar.settings` seat, which sits nested inside the sidebar's own wrapper
 * element rather than as a direct child of the slot anchor. `display:none` on
 * any ancestor deletes that whole subtree unconditionally — no descendant rule
 * can revive it — which takes the nav rail, every shipped section, and the
 * panel the trigger opens. The trigger then appears dead: React opens the
 * panel, and it renders into nothing.
 *
 * Clipping to a 0x0 fixed box removes the sidebar's normal-flow chrome while
 * the subtree stays alive, and the panel's own `position:fixed` overlay takes
 * the viewport as its containing block, so it is exempt from this clip.
 *
 * The z-index sits above the desk-mode conversation (40) and monitor bezel
 * (45), and deliberately BELOW the 1100 that portaled dropdown lists use:
 * those render into `document.body` and are designed to layer above a dialog,
 * so a higher value here buries every settings dropdown behind the panel.
 */
const SIDEBAR = '[data-slot="sidebar"]{'
  + 'display:block!important;position:fixed!important;left:0!important;top:0!important;'
  + 'width:0!important;height:0!important;overflow:hidden!important;'
  + 'pointer-events:none!important;z-index:500;}'
  // The anchor is inert; the escaping dialog and its wrapper restore
  // interactivity. Addressed structurally because the panel's own class name
  // is a build hash.
  + '[data-slot="sidebar"] div:has(> [role="dialog"]),'
  + '[data-slot="sidebar"] [role="dialog"]{pointer-events:auto!important;}'

/** Confine the real conversation to the monitor screen in desk mode. */
const CONVERSATION = 'body:has(.pxo-root[data-mode="top"]) [data-slot="conversation"]{visibility:hidden!important;}'
  + 'body:has(.pxo-root[data-mode="desk"]) [data-slot="details"]{display:none!important;}'
  + 'body:has(.pxo-root[data-mode="desk"]) [data-slot="conversation"]{'
  + 'display:block!important;position:fixed!important;'
  + 'left:var(--pxo-sx)!important;top:var(--pxo-sy)!important;'
  + 'width:var(--pxo-sw)!important;height:var(--pxo-sh)!important;'
  + 'z-index:40;overflow:hidden;background:var(--dsw-alias-bg-base);color:var(--pxo-ink);}'
  + 'body:has(.pxo-root[data-mode="desk"]) [data-slot="conversation"] > *{width:100%!important;height:100%!important;}'
  + 'body:has(.pxo-root[data-mode="desk"]) [data-slot="conversation"] *{border-radius:0!important;font-family:var(--pxo-font)!important;}'
  // Safety net for hard-coded light surfaces the token layer cannot reach.
  + 'body:has(.pxo-root[data-mode="desk"]) [data-slot="conversation"] pre,'
  + 'body:has(.pxo-root[data-mode="desk"]) [data-slot="conversation"] code,'
  + 'body:has(.pxo-root[data-mode="desk"]) [data-slot="conversation"] table,'
  + 'body:has(.pxo-root[data-mode="desk"]) [data-slot="conversation"] th,'
  + 'body:has(.pxo-root[data-mode="desk"]) [data-slot="conversation"] td{'
  + 'background:var(--dsw-alias-markdown-code-block)!important;color:var(--pxo-ink)!important;}'

/**
 * The composer is two stacked layers: the textarea is deliberately transparent
 * and contributes only the caret and native selection, while a sibling backdrop
 * paints every visible glyph. Giving the textarea a color makes the draft
 * illegible (two offset copies, or black-on-dark). Restate the transparent
 * design and let the backdrop's `--dsw-alias-label-primary` carry the ink.
 * Single-layer fields (search, rename) do paint their own glyphs.
 */
const COMPOSER = 'body:has(.pxo-root[data-mode="desk"]) [data-slot="conversation"] textarea{'
  + 'background:transparent!important;color:transparent!important;'
  + '-webkit-text-fill-color:transparent!important;caret-color:var(--pxo-neon)!important;}'
  + 'body:has(.pxo-root[data-mode="desk"]) [data-slot="conversation"] textarea::placeholder{'
  + 'color:var(--dsw-alias-label-caption)!important;-webkit-text-fill-color:var(--dsw-alias-label-caption)!important;}'
  + 'body:has(.pxo-root[data-mode="desk"]) [data-slot="conversation"] '
  + 'input:not([type="range"]):not([type="checkbox"]):not([type="radio"]){'
  + 'background:var(--dsw-specific-input-major)!important;color:var(--pxo-ink)!important;'
  + '-webkit-text-fill-color:var(--pxo-ink)!important;caret-color:var(--pxo-neon)!important;}'
  + 'body:has(.pxo-root[data-mode="desk"]) [data-slot="conversation"] input::placeholder{'
  + 'color:var(--dsw-alias-label-caption)!important;-webkit-text-fill-color:var(--dsw-alias-label-caption)!important;}'

/** Pixel skin over the shipped settings panel and its portaled dropdowns. */
const SETTINGS_SKIN = '[data-slot="sidebar"] [role="dialog"]{'
  + 'font-family:var(--pxo-font)!important;border-radius:0!important;'
  + 'box-shadow:0 0 0 4px var(--pxo-bd),0 0 0 10px var(--dsw-specific-pxo-monitor-frame),'
  + '10px 10px 0 rgba(0,0,0,.35)!important;}'
  + '[data-slot="sidebar"] [role="dialog"] *{border-radius:0!important;font-family:var(--pxo-font)!important;}'
  + '[data-slot="sidebar"] [role="dialog"] button{letter-spacing:1px;}'
  + 'body [role="menu"]{font-family:var(--pxo-font)!important;border-radius:0!important;}'
  + 'body [role="menu"] *{border-radius:0!important;font-family:var(--pxo-font)!important;}'

/** The top-down desk grid. */
const TOP_VIEW = '.pxo-root{font-family:var(--pxo-font);pointer-events:none;}'
  + '.pxo-root *{box-sizing:border-box;border-radius:0!important;image-rendering:pixelated;font-family:var(--pxo-font);}'
  + '.pxo-fill{position:fixed;inset:0;pointer-events:auto;background:var(--pxo-bg);'
  + 'background-image:linear-gradient(var(--pxo-line) 1px,transparent 1px),'
  + 'linear-gradient(90deg,var(--pxo-line) 1px,transparent 1px);background-size:32px 32px;overflow:auto;}'
  + '.pxo-scan{position:fixed;inset:0;pointer-events:none;'
  + 'background:repeating-linear-gradient(0deg,var(--pxo-scan) 0 2px,transparent 2px 4px);'
  + 'mix-blend-mode:multiply;z-index:55;}'
  + '.pxo-hud{position:fixed;top:12px;right:16px;display:flex;gap:8px;pointer-events:auto;z-index:60;}'
  + '.pxo-btn{pointer-events:auto;cursor:pointer;background:var(--pxo-bg2);color:var(--pxo-ink);border:0;'
  + 'padding:8px 12px;font-size:12px;letter-spacing:1px;font-weight:700;'
  + 'box-shadow:inset -3px -3px 0 var(--pxo-bd),inset 3px 3px 0 var(--pxo-bl);text-transform:uppercase;}'
  + '.pxo-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--pxo-neon);}'
  + '.pxo-btn:active{box-shadow:inset 3px 3px 0 var(--pxo-bd),inset -3px -3px 0 var(--pxo-bl);}'
  + '.pxo-btn.danger:hover{color:var(--dsw-alias-state-error-primary);}'
  + '.pxo-title{position:fixed;top:14px;left:20px;color:var(--pxo-neon);font-size:13px;'
  + 'letter-spacing:3px;font-weight:700;text-shadow:2px 2px 0 var(--pxo-bd);pointer-events:none;z-index:58;}'
  + '.pxo-title small{display:block;color:var(--pxo-dim);letter-spacing:1px;font-size:10px;margin-top:4px;text-shadow:none;}'
  + '.pxo-grid{display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr);'
  + 'gap:24px;padding:72px 32px 32px;min-height:100%;}'
  + '.pxo-desk{position:relative;background:var(--pxo-bg2);'
  + 'box-shadow:inset -4px -4px 0 var(--pxo-bd),inset 4px 4px 0 var(--pxo-bl);padding:12px;'
  + 'display:flex;flex-direction:column;align-items:center;cursor:pointer;'
  + 'transition:transform .08s steps(2);touch-action:none;}'
  + '.pxo-desk:hover{transform:translate(-2px,-2px);}'
  + '.pxo-desk[data-drag="1"]{opacity:.35;}'
  + '.pxo-desk[data-over="1"]{box-shadow:inset -4px -4px 0 var(--pxo-bd),inset 4px 4px 0 var(--pxo-neon);}'
  + '.pxo-plate{width:88%;text-align:center;background:#e8e2cf;color:#1a1f33;font-size:11px;'
  + 'font-weight:700;letter-spacing:1px;padding:5px 4px;'
  + 'box-shadow:inset -2px -2px 0 #9d977f,inset 2px 2px 0 #fffdf3,0 3px 0 #3b3222;'
  + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
  + '.pxo-plate.empty{background:var(--dsw-specific-pxo-idle);color:var(--pxo-dim);'
  + 'box-shadow:inset -2px -2px 0 var(--pxo-bd),inset 2px 2px 0 var(--pxo-bl);}'
  + '.pxo-tian{position:relative;width:74%;aspect-ratio:1.3;margin-top:14px;background:#8a5a33;'
  + 'box-shadow:inset -4px -4px 0 #5d3a1e,inset 4px 4px 0 #b57f4d;}'
  + '.pxo-tian::before,.pxo-tian::after{content:"";position:absolute;background:#5d3a1e;}'
  + '.pxo-tian::before{left:50%;top:0;bottom:0;width:4px;margin-left:-2px;}'
  + '.pxo-tian::after{top:50%;left:0;right:0;height:4px;margin-top:-2px;}'
  + '.pxo-pc{position:absolute;left:50%;top:48%;transform:translate(-50%,-60%);width:50%;z-index:2;}'
  + '.pxo-pc-screen{width:100%;aspect-ratio:1.3;background:var(--dsw-specific-pxo-screen-off);'
  + 'box-shadow:inset -3px -3px 0 var(--pxo-bd),inset 3px 3px 0 var(--dsw-specific-pxo-monitor-frame),'
  + '0 0 0 3px var(--dsw-specific-pxo-monitor-frame);display:flex;align-items:flex-end;gap:3px;padding:5px;}'
  + '.pxo-pc-screen.on{background:var(--dsw-specific-pxo-screen-on);'
  + 'box-shadow:0 0 0 3px var(--dsw-specific-pxo-monitor-frame),inset 0 0 14px var(--dsw-specific-pxo-glow);'
  + 'animation:pxo-flicker .5s steps(2) infinite;}'
  + '.pxo-bar{flex:1;background:var(--pxo-neon);animation:pxo-bounce .7s steps(4) infinite;}'
  + '.pxo-pc-stand{width:26%;height:7px;margin:0 auto;background:var(--dsw-specific-pxo-monitor-frame);}'
  + '.pxo-pc-base{width:56%;height:4px;margin:0 auto;background:var(--dsw-specific-pxo-chair-dark);}'
  + '.pxo-chair{position:absolute;bottom:6px;left:50%;transform:translateX(-50%);width:34px;}'
  + '.pxo-chair-back{width:26px;height:15px;margin:0 auto;background:var(--dsw-specific-pxo-chair);'
  + 'box-shadow:inset -2px -2px 0 var(--dsw-specific-pxo-chair-dark);}'
  + '.pxo-chair-seat{width:34px;height:8px;background:var(--dsw-specific-pxo-chair-seat);'
  + 'box-shadow:inset -2px -2px 0 var(--dsw-specific-pxo-chair-dark);}'
  + '.pxo-chair-leg{width:4px;height:9px;margin:0 auto;background:var(--dsw-specific-pxo-chair-dark);}'
  + '.pxo-badge{position:absolute;top:8px;right:8px;font-size:9px;padding:2px 5px;font-weight:700;letter-spacing:1px;}'
  + '.pxo-badge.run{background:var(--pxo-neon);color:var(--dsw-alias-label-primary-foreground);'
  + 'animation:pxo-blink 1s steps(2) infinite;}'
  + '.pxo-badge.idle{background:var(--dsw-specific-pxo-idle);color:var(--pxo-dim);}'
  + '.pxo-deskfoot{margin-top:auto;display:flex;gap:6px;padding-top:10px;}'
  + '.pxo-mini{font-size:9px;padding:4px 7px;letter-spacing:1px;}'
  + '.pxo-empty-hint{color:var(--pxo-dim);font-size:10px;letter-spacing:1px;margin-top:auto;padding-top:10px;}'

/** The desk front view: masking bands, monitor bezel, planning board, note stack. */
const DESK_VIEW = '.pxo-band{position:fixed;pointer-events:auto;background:var(--pxo-bg);'
  + 'background-image:repeating-linear-gradient(0deg,var(--pxo-scan) 0 2px,transparent 2px 4px),'
  + 'linear-gradient(var(--pxo-line) 1px,transparent 1px),'
  + 'linear-gradient(90deg,var(--pxo-line) 1px,transparent 1px);'
  + 'background-size:100% 4px,32px 32px,32px 32px;z-index:20;}'
  + '.pxo-band.t{left:0;top:0;width:100vw;height:var(--pxo-sy);}'
  + '.pxo-band.b{left:0;top:calc(var(--pxo-sy) + var(--pxo-sh));width:100vw;bottom:0;}'
  + '.pxo-band.l{left:0;top:var(--pxo-sy);width:var(--pxo-sx);height:var(--pxo-sh);}'
  + '.pxo-band.r{left:calc(var(--pxo-sx) + var(--pxo-sw));top:var(--pxo-sy);right:0;height:var(--pxo-sh);}'
  + '.pxo-bezel{position:fixed;left:var(--pxo-sx);top:var(--pxo-sy);width:var(--pxo-sw);height:var(--pxo-sh);'
  + 'pointer-events:none;z-index:45;'
  + 'box-shadow:0 0 0 12px var(--dsw-specific-pxo-monitor-frame),0 0 0 30px var(--pxo-bg2),0 0 0 34px var(--pxo-bd);}'
  + '.pxo-bezel::after{content:"";position:absolute;left:24%;right:24%;bottom:-52px;height:16px;'
  + 'background:var(--dsw-specific-pxo-monitor-frame);box-shadow:inset -3px -3px 0 var(--pxo-bg2);}'
  + '.pxo-bezel::before{content:"\\25cf PWR";position:absolute;right:2px;bottom:-26px;font-size:8px;'
  + 'color:var(--pxo-neon);letter-spacing:1px;}'
  + '.pxo-board{position:fixed;left:var(--pxo-bx);top:var(--pxo-sy);width:var(--pxo-bw);height:var(--pxo-sh);'
  + 'pointer-events:auto;background:var(--dsw-specific-pxo-board);'
  + 'box-shadow:inset -6px -6px 0 rgba(0,0,0,.28),inset 6px 6px 0 rgba(255,255,255,.18),'
  + '0 0 0 10px #6b4a24,0 0 0 14px #3d2a13;padding:16px;display:flex;flex-direction:column;z-index:30;}'
  + '.pxo-board-hd{color:var(--dsw-specific-pxo-board-ink);font-size:11px;letter-spacing:2px;font-weight:700;'
  + 'margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;}'
  + '.pxo-board-hd span{color:var(--dsw-specific-pxo-board-dim);font-size:9px;letter-spacing:1px;}'
  + '.pxo-slots{flex:1;display:grid;gap:8px;min-height:0;}'
  + '.pxo-slot{position:relative;box-shadow:inset 0 0 0 2px rgba(255,255,255,.05);}'
  + '.pxo-slot[data-over="1"]{box-shadow:inset 0 0 0 3px var(--pxo-neon);}'
  + '.pxo-sticker{position:absolute;inset:0;padding:7px;color:#1a1f33;font-size:10px;line-height:1.35;'
  + 'font-weight:700;cursor:pointer;overflow:hidden;word-break:break-word;'
  + 'box-shadow:3px 3px 0 rgba(0,0,0,.35);animation:pxo-sway 2.6s steps(3) infinite;'
  + 'transform-origin:top center;touch-action:none;}'
  + '.pxo-sticker[data-drag="1"]{opacity:.3;}'
  + '.pxo-sticker::after{content:"";position:absolute;right:0;bottom:0;background:rgba(0,0,0,.18);'
  + 'clip-path:polygon(100% 0,0 100%,100% 100%);animation:pxo-curl 1.8s steps(3) infinite;}'
  + '.pxo-sticker.run{outline:3px solid #0f8b6b;outline-offset:-3px;}'
  + '.pxo-dot{position:absolute;top:4px;right:5px;width:7px;height:7px;background:rgba(0,0,0,.35);}'
  + '.pxo-dot.run{background:#0f8b6b;animation:pxo-blink .8s steps(2) infinite;}'
  + '.pxo-stack{position:fixed;left:var(--pxo-bx);top:calc(var(--pxo-sy) + var(--pxo-sh) + 22px);'
  + 'width:92px;pointer-events:auto;cursor:grab;z-index:30;touch-action:none;}'
  + '.pxo-stack-l{height:11px;box-shadow:3px 3px 0 rgba(0,0,0,.4);}'
  + '.pxo-stack-top{height:52px;display:flex;align-items:center;justify-content:center;font-size:9px;'
  + 'color:#1a1f33;font-weight:700;letter-spacing:1px;text-align:center;box-shadow:3px 3px 0 rgba(0,0,0,.4);}'
  + '.pxo-stack-cap{color:var(--pxo-dim);font-size:9px;letter-spacing:1px;margin-top:7px;text-align:center;}'
  + '.pxo-ghost{position:fixed;z-index:80;pointer-events:none;padding:7px;font-size:10px;font-weight:700;'
  + 'color:#1a1f33;box-shadow:4px 4px 0 rgba(0,0,0,.5);opacity:.92;overflow:hidden;}'

/**
 * Dialogs. The `board` variant is pinned to the planning-board rect instead of
 * the viewport: a full-viewport centered dialog lands on top of the monitor
 * cutout, where the real conversation covers it.
 */
const DIALOGS = '.pxo-modal-bg{position:fixed;inset:0;z-index:90;pointer-events:auto;'
  + 'background:var(--dsw-alias-bg-mask-1);display:flex;align-items:center;justify-content:center;}'
  + '.pxo-modal{width:400px;max-width:88vw;background:var(--pxo-bg2);'
  + 'box-shadow:inset -4px -4px 0 var(--pxo-bd),inset 4px 4px 0 var(--pxo-bl),0 0 0 4px var(--pxo-bd);padding:20px;}'
  + '.pxo-modal-bg.board{inset:auto;left:var(--pxo-bx);top:var(--pxo-sy);width:var(--pxo-bw);height:var(--pxo-sh);'
  + 'background:var(--dsw-specific-pxo-board-mask);}'
  + '.pxo-modal-bg.board .pxo-modal{width:min(340px,calc(100% - 28px));max-width:none;padding:16px;'
  + 'box-shadow:inset -4px -4px 0 var(--pxo-bd),inset 4px 4px 0 var(--pxo-bl),0 0 0 4px var(--pxo-bd),'
  + '6px 6px 0 rgba(0,0,0,.45);}'
  + '.pxo-modal-bg.board .pxo-modal h3{font-size:12px;}'
  + '.pxo-modal-bg.board .pxo-modal p{margin-bottom:12px;}'
  + '.pxo-modal h3{margin:0 0 6px;color:var(--pxo-neon);font-size:13px;letter-spacing:2px;}'
  + '.pxo-modal p{margin:0 0 14px;color:var(--pxo-dim);font-size:10px;letter-spacing:1px;line-height:1.6;}'
  + '.pxo-input{width:100%;background:var(--dsw-specific-input-major);color:var(--pxo-ink);border:0;padding:10px;'
  + 'font-size:12px;box-shadow:inset 2px 2px 0 var(--pxo-bd),inset -2px -2px 0 var(--pxo-bl);outline:none;}'
  + '.pxo-input:focus{box-shadow:inset 2px 2px 0 var(--pxo-bd),inset -2px -2px 0 var(--pxo-neon);}'
  + '.pxo-input::placeholder{color:var(--pxo-dim);}'
  + '.pxo-row{display:flex;gap:8px;justify-content:flex-end;margin-top:16px;}'
  + '.pxo-range{width:100%;accent-color:var(--pxo-neon);}'
  + '.pxo-set-row{display:flex;justify-content:space-between;align-items:center;color:var(--pxo-ink);'
  + 'font-size:11px;letter-spacing:1px;margin-bottom:8px;}'
  + '.pxo-preview{display:flex;gap:4px;margin-top:10px;flex-wrap:wrap;}'
  + '.pxo-pv{background:#f7e04a;box-shadow:2px 2px 0 rgba(0,0,0,.4);}'
  + '.pxo-note{color:var(--pxo-dim);font-size:10px;letter-spacing:1px;line-height:1.7;margin:14px 0 0;}'

/**
 * Pure-CSS keyframes. `steps()` everywhere keeps motion quantized to the pixel
 * aesthetic, and CSS animation avoids timers entirely, so nothing here needs a
 * lifecycle disposer beyond the stylesheet itself.
 */
const KEYFRAMES = '@keyframes pxo-blink{0%,49%{opacity:1}50%,100%{opacity:.25}}'
  + '@keyframes pxo-flicker{0%,100%{filter:brightness(1)}50%{filter:brightness(1.28)}}'
  + '@keyframes pxo-bounce{0%{height:20%}25%{height:70%}50%{height:38%}75%{height:92%}100%{height:20%}}'
  + '@keyframes pxo-sway{0%{transform:rotate(0deg)}33%{transform:rotate(.55deg)}'
  + '66%{transform:rotate(-.55deg)}100%{transform:rotate(0deg)}}'
  + '@keyframes pxo-curl{0%{width:13px;height:13px}50%{width:19px;height:19px}100%{width:13px;height:13px}}'

/** The complete stylesheet text. */
export const CSS: string = [
  GEOMETRY, SIDEBAR, CONVERSATION, COMPOSER, SETTINGS_SKIN,
  TOP_VIEW, DESK_VIEW, DIALOGS, KEYFRAMES,
].join('\n')

/** Attribute marking this plugin's style tag, so the effect can remove exactly it. */
const STYLE_MARKER = 'data-pixel-office'

/**
 * Inject the stylesheet and return its disposer.
 *
 * A plugin-owned effect rather than a build-time side effect: the caller wires
 * it into the Cordis lifecycle so unloading the plugin removes the tag and
 * restores the shipped theme.
 * @returns a disposer removing the injected tag.
 */
export function insertStyles(): () => void {
  const tag = document.createElement('style')
  tag.setAttribute(STYLE_MARKER, '')
  tag.textContent = CSS
  document.head.appendChild(tag)
  return () => { tag.remove() }
}
