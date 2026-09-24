/**
 * The plugin's settings `Config` (0.1.7: exported from the node half,
 * validated by the loader against the entry's `config:` block; the client
 * half's card edits it through `configForms`).
 *
 * Contents (all flat — no cross-field rules, so the schema below is the
 * whole write gate). The section has NO enable switch of its own — turning
 * the plugin's `read_image` view on or off is the host's built-in plugin
 * management's job (disabling the plugin deregisters the view); a redundant
 * `enabled` field used to live here and was removed:
 *   autoOpen:     bool   render the image without an expand step (default true)
 *   maxWidth:     px|null  image width cap, null = row width (default null)
 *   maxHeight:    px|null  image height cap (default 600)
 *   showEnvelope: bool   show the result's text envelope (default true)
 *
 * Read-side extraction ({@link sectionOf}, src/dsh/toolview.ts) is lenient
 * (per-field defaults, never throws) — the client half reads the
 * schema-resolved section through its bound form and applies the same
 * fill-in as a drift guard.
 */

import z from "@deepseek-ai/schemastery";
import { DEFAULT_IMAGE_SETTINGS } from "../types.js";

/**
 * A positive integer pixel measure, or an explicit `null` (no cap). Deliberately
 * WITHOUT a schema `.default()`: schemastery's nullable path consults a
 * field default BEFORE the union's `const(null)` arm, so a default here would
 * swallow an explicit `null` (the "no cap" state) back into the default cap.
 * Absent fields instead fall back to the composition base layer
 * ({@link DEFAULT_IMAGE_SETTINGS} via the schema defaults + the profile's
 * entry `config:`) — the standard layering: an absent key reverts to the
 * base, an explicit value (including `null`) stands.
 */
const pxOrNull = z.union([z.number().step(1).min(1), z.const(null)]);

/**
 * The write gate for the plugin's `Config` (0.1.7: the schema the loader
 * validates the entry's `config:` against; every field is `.volatile()`, so
 * a client save commits in place into the running fiber's refs and emits
 * `loader/volatile-update` — no re-apply).
 *
 * The boolean fields carry their {@link DEFAULT_IMAGE_SETTINGS} defaults
 * (an absent boolean resolves to the default); the px fields resolve a
 * partial section over the base entry rather than the schema (see
 * {@link pxOrNull}). The lenient read path (src/dsh/toolview.ts
 * `sectionOf`) performs the same fill-in client-side.
 */
export const ImageSettingsSchema = z.object({
  autoOpen: z.boolean().default(DEFAULT_IMAGE_SETTINGS.autoOpen).volatile(),
  maxWidth: pxOrNull.volatile(),
  maxHeight: pxOrNull.volatile(),
  showEnvelope: z.boolean().default(DEFAULT_IMAGE_SETTINGS.showEnvelope).volatile(),
});

/** The schema-resolved section shape (every field present). */
export type ImageSettingsSchemaOutput = ReturnType<typeof ImageSettingsSchema>;
