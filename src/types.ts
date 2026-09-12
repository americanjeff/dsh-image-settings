/**
 * dsh-image-settings — shared section type (zero imports).
 *
 * This module is imported by BOTH package faces: the host half
 * (src/dsh/settings.ts, whose schemastery schema resolves to it) and the
 * client bundle (via src/dsh/toolview.ts, which tsdown inlines into
 * dist/dsh/client.js). The client bundle may only carry what it inlines —
 * a host-only dependency (schemastery) inlined into the browser bundle is
 * exactly what the tsdown external table exists to prevent — so this file,
 * and every module the client face touches, stays import-light: this file
 * imports nothing, and toolview.ts imports only this one.
 */

/** The settings namespace this plugin owns (the section key in settings.yaml). */
export const NAMESPACE = "image-settings";

/**
 * The resolved `image-settings:` section — every field present after
 * `sectionOf` (src/dsh/toolview.ts) fills defaults for an absent section.
 */
export interface ImageSettingsSection {
  /**
   * Register the plugin's `read_image` tool view. Default ON — installing
   * the plugin IS the opt-in. An explicit `false` steps aside and the
   * host's own `read_image` row owns the call (no double render, no dead
   * view shadowing an upstream host fix).
   */
  enabled: boolean;
  /**
   * Auto-unroll: when true the image and its envelope render with no expand
   * step; when false the row starts collapsed behind an expand control.
   */
  autoOpen: boolean;
  /**
   * Image max width in px. `null` = no explicit cap — the image fills the
   * row's available width (natural size when small, never upscaled).
   */
  maxWidth: number | null;
  /**
   * Image max height in px. `null` = no cap.
   */
  maxHeight: number | null;
  /**
   * Render the settled tool result's text envelope (path, size, metadata)
   * beside the image.
   */
  showEnvelope: boolean;
}

/** The schema defaults — what a field reverts to once cleared. */
export const DEFAULT_IMAGE_SETTINGS: ImageSettingsSection = {
  enabled: true,
  autoOpen: true,
  maxWidth: null,
  maxHeight: 600,
  showEnvelope: true,
};
