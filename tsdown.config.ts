/**
 * Standalone build config for the Pixel Office client plugin.
 *
 * This repository lives OUTSIDE deepseek-harness, so it cannot reuse that
 * repository's `clientBundle` preset: the preset locates a package manifest by
 * globbing `packages/*` from the harness root and throws for any name it does
 * not find there. The four artifact contracts a dynamic client bundle must
 * satisfy are therefore restated here.
 *
 * 1. The browser half is CJS wrapped in the loader handoff. The shell fetches
 *    `lib/client.js` outside any module graph and executes it; the banner/footer
 *    hand a factory to `window.__ModuleLoader__.load`, and the factory resolves
 *    externals through the injected `require` (the loader module table).
 * 2. Baseline externals stay imports; everything else inlines. React, Cordis,
 *    ui-slots, and ui-primitives are seeded by the shell into the frozen module
 *    table — bundling a private copy would give this plugin a second React and
 *    break hooks. Any other dependency must be inlined, because a `require()`
 *    the table cannot answer throws at load.
 * 3. `process.env.NODE_ENV` and `import.meta.env` are substituted. The browser
 *    has neither; a surviving reference is a ReferenceError at factory time.
 * 4. The node half is a separate ESM artifact. The host Loader imports
 *    `lib/index.js` to read the row; it never sees the browser bundle.
 */
import { defineConfig } from 'tsdown'

/**
 * Specifiers the web shell seeds into the module table. Kept in sync with
 * `packages/client/web/src/platform.ts` in deepseek-harness; a name missing
 * here is silently duplicated into this bundle instead of shared.
 */
const PLATFORM_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
]

/** Dynamic rows whose factories the parser preloads before shell boot. */
const PRELOADED_CLIENT_EXTERNALS = [
  '@deepseek-ai/dsh-client-runtime/client',
]

const EXTERNALS = new Set([...PLATFORM_MODULES, ...PRELOADED_CLIENT_EXTERNALS])

const NODE_ENV = process.env.NODE_ENV ?? 'production'

export default defineConfig([
  // Node half: the row the host Loader imports.
  {
    name: 'dsh-client-pixel-office',
    entry: ['lib/types/index.js'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
  },
  // Browser half: the artifact served at /plugins/<id>/client.js.
  {
    name: 'dsh-client-pixel-office/client',
    entry: { client: 'lib/types/client/index.js' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2024',
    dts: false,
    sourcemap: true,
    clean: false,
    // `external` is a TOP-LEVEL option. Nesting it under a `deps` key makes
    // tsdown ignore the whole object, which silently inlines React and gives
    // the page a second React instance — every hook then throws. Anything not
    // listed here is inlined, which is what a browser plugin bundle wants.
    external: [...EXTERNALS],
    define: {
      'process.env.NODE_ENV': JSON.stringify(NODE_ENV),
      'import.meta.env.MODE': JSON.stringify(NODE_ENV),
      'import.meta.env': JSON.stringify({ MODE: NODE_ENV }),
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "dsh-client-pixel-office", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
