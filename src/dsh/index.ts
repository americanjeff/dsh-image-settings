/**
 * dsh-image-settings — dsh plugin entry (Cordis bundle plugin).
 *
 * The node half is deliberately thin: it exports the `Config` schema (the
 * write gate for this entry's `config:` block, every field `.volatile()` so
 * a client save commits in place without a re-apply). The loader validates
 * the entry's config against it and serves the namespace to the client's
 * describe mirror. The `apply` is a no-op kept for the Cordis plugin
 * contract (the registry refuses an export object without an `apply` method).
 * Everything else — the larger, auto-unrolled `read_image` presentation —
 * lives in the browser bundle (src/dsh/client.tsx).
 *
 * No static `inject`: the plugin needs no host service.
 */

import { ImageSettingsSchema } from "./settings.js";

const name = "dsh-image-settings";
const Config = ImageSettingsSchema;
const inject: string[] = [];

/** No-op apply — the node half only serves the `Config` schema. */
export function apply(): void {}

export { Config, inject, name };
