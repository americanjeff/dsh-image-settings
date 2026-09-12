/**
 * Client build face: bundles src/dsh/client.tsx into dist/dsh/client.js —
 * the dsh clientBundle closure-factory shape (mirrors the in-repo
 * SRC packages/client/tsdown.client.ts without the workspace preset:
 * plain tsdown, no CSS pipeline — the view uses inline plain elements).
 *
 * The node half is pure tsc output (shared dist/, tsconfig.json), so
 * clean stays off.
 *
 * The bundle hands itself to the web shell's module loader —
 * `window.__ModuleLoader__.load({ id, factory: (require) => { …CJS… } })` —
 * and the injected `require` resolves externals through the loader's module
 * table. Only baseline table rows may be required (EXTERNALS below,
 * PLATFORM_MODULES from the web shell's platform.ts); anything else MUST
 * inline into the bundle — a require() the table cannot answer is a
 * guaranteed runtime throw. The bundle's own runtime requires stay within
 * this set (today: react + react/jsx-runtime only — every dsh import is
 * type-only and erased; toolview.ts + types.ts inline).
 */
import { isBuiltin } from "node:module";
import type { UserConfig } from "tsdown";

/** The row id the bundle registers under (== package name == Cordis row id). */
const ID = "dsh-image-settings";

/**
 * Baseline module-table rows a client bundle may require without declaring
 * them — PLATFORM_MODULES from the 0.1.5 web shell (PRELOADED_CLIENT_EXTERNALS
 * is empty in that release).
 */
const EXTERNALS = new Set([
  "react",
  "react/jsx-runtime",
  "react-dom",
  "react-dom/client",
  "@deepseek-ai/cordis",
  "@deepseek-ai/dsh-client-store",
  "@deepseek-ai/dsh-client-ui-slots",
  "@deepseek-ai/dsh-client-ui-primitives",
]);

export default [
  {
    name: "dsh-image-settings/client",
    entry: { client: "src/dsh/client.tsx" },
    outDir: "dist/dsh",
    format: "cjs",
    platform: "browser",
    dts: false,
    sourcemap: true,
    clean: false,
    deps: {
      neverBundle: (specifier: string) => EXTERNALS.has(specifier),
      alwaysBundle: (specifier: string) =>
        !isBuiltin(specifier) && !EXTERNALS.has(specifier),
    },
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
    },
    outputOptions: {
      entryFileNames: "client.js",
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
      footer: "return module.exports; } });",
      intro: "var module = { exports: {} }; var exports = module.exports;",
    },
  },
] satisfies UserConfig[];
