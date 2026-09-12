/**
 * The plugin-owned `image-settings:` settings namespace.
 *
 * Contents (all flat — no cross-field rules, so the schema below is the
 * whole write gate):
 *   enabled:      bool   register the read_image view (default true)
 *   autoOpen:     bool   render the image without an expand step (default true)
 *   maxWidth:     px|null  image width cap, null = row width (default null)
 *   maxHeight:    px|null  image height cap (default 600)
 *   showEnvelope: bool   show the result's text envelope (default true)
 *
 * The schemastery schema is registered with the settings seam via
 * `installSection`, so an invalid section is refused where it is written.
 * Read-side extraction ({@link sectionOf}, src/dsh/toolview.ts) is lenient
 * (per-field defaults, never throws) — the client half reads the
 * schema-resolved section through its bound scope and applies the same
 * fill-in as a drift guard.
 */

import z from "@deepseek-ai/schemastery";
import { DEFAULT_IMAGE_SETTINGS } from "../types.js";

/**
 * A positive integer pixel measure, or an explicit `null` (no cap). Deliberately
 * WITHOUT a schema `.default()`: schemastery's nullable path consults a
 * field default BEFORE the union's `const(null)` arm, so a default here would
 * swallow an explicit `null` (the "no cap" state) back into the default cap.
 * Absent fields instead fall back to the seam's BASE entry
 * ({@link DEFAULT_IMAGE_SETTINGS}, registered in src/dsh/index.ts) — the
 * standard layering: an absent key reverts to the base, an explicit value
 * (including `null`) stands.
 */
const pxOrNull = z.union([z.number().step(1).min(1), z.const(null)]);

/**
 * The write gate for the `image-settings:` section. The boolean fields carry
 * their {@link DEFAULT_IMAGE_SETTINGS} defaults (an absent boolean resolves
 * to the default); the px fields resolve a partial section over the base
 * entry rather than the schema (see {@link pxOrNull}). The lenient read path
 * (src/dsh/toolview.ts `sectionOf`) performs the same fill-in client-side.
 */
export const ImageSettingsSchema = z.object({
  enabled: z.boolean().default(DEFAULT_IMAGE_SETTINGS.enabled),
  autoOpen: z.boolean().default(DEFAULT_IMAGE_SETTINGS.autoOpen),
  maxWidth: pxOrNull,
  maxHeight: pxOrNull,
  showEnvelope: z.boolean().default(DEFAULT_IMAGE_SETTINGS.showEnvelope),
});

/** The schema-resolved section shape (every field present). */
export type ImageSettingsSchemaOutput = ReturnType<typeof ImageSettingsSchema>;
