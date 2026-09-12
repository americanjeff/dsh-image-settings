/**
 * Access to the dsh-settings install-seam symbols, host floor dsh 0.1.5
 * (peer ranges: `^0.1.5-rc.2`).
 *
 * The 0.1.2+ shape exclusively: the section install is a
 * `SettingsProvider.installSection` method reached through the scoped
 * `ctx.inject(["settings"], …)` the host requires (a bare `ctx.settings`
 * read is refused "without inject"), and the namespace methods take a plain
 * lowercase-hyphenated string (branded internally). The 0.1.1 free-function
 * shapes (`installSettingsSection`, `settingsNamespace`) are gone — the host
 * floor retired any detection branches that covered them, so there is no
 * compat layer here, only the seam reach.
 *
 * The structural (cast-heavy) call rather than a typed import is deliberate:
 * one build wires on the floor and above without a per-release type import
 * to break at link time (the modelspoke seam pattern, docs there §3).
 */

import type { SettingsNamespace } from "@deepseek-ai/dsh-settings";

/**
 * The settings namespace handle. The namespace methods take a plain
 * lowercase-hyphenated string and brand it internally; at runtime the
 * branded value IS the string, so the identity mapping is the handle.
 */
export const settingsNamespace: (name: string) => SettingsNamespace = (
  name: string,
): SettingsNamespace => name as unknown as SettingsNamespace;

/**
 * Install the settings consumer wiring for the `image-settings:` section:
 * the `SettingsProvider.installSection` method, reached through the scoped
 * `ctx.inject(["settings"], …)` the host requires. While a settings service
 * exists the section's namespace is registered with the composition entry
 * (the schema defaults) as the `base` layer; when the service is absent
 * (a profile without the settings service) the registration is a silent
 * no-op and the plugin keeps working exactly as composed.
 *
 * @param hooks - `setSource` (a `() => section` thunk swapped in while the
 *   service is attached) and `onChange` (re-derive on every committed
 *   settings change); `validate` is optional — this plugin's write gate is
 *   the schema itself, so no hook is passed.
 */
export function installSection(
  ctx: unknown,
  ns: SettingsNamespace,
  schema: unknown,
  entry: unknown,
  hooks: {
    setSource: (current: () => unknown) => void;
    onChange: () => void;
    validate?: (value: unknown) => void;
  },
): void {
  const inject = (ctx as { inject?: (ids: readonly string[], cb: (settingsCtx: unknown) => void) => void } | null)
    ?.inject;
  if (typeof inject === "function") {
    inject(["settings"], (settingsCtx: unknown) => {
      const provider = (settingsCtx as { settings?: { installSection?: unknown } } | null)?.settings;
      if (provider && typeof provider.installSection === "function") {
        (provider.installSection as (...args: unknown[]) => void)(ctx, ns, schema, entry, hooks);
      }
    });
    return;
  }
  throw new Error(
    "dsh-image-settings: no dsh-settings install seam (the loaded host does not provide ctx.inject(['settings']) — below the 0.1.5 floor)",
  );
}
