/**
 * dsh-image-settings — dsh plugin entry (Cordis bundle plugin).
 *
 * The node half is deliberately thin: install the `image-settings:`
 * settings namespace (write-gated by the schemastery schema, base layer =
 * the schema defaults) so the section exists in `settings.describe`, is
 * validated where written, and the client half can bind a reactive scope
 * over it. Everything else — the larger, auto-unrolled `read_image`
 * presentation — lives in the browser bundle (src/dsh/client.tsx).
 *
 * No static `inject`: the plugin needs no host service. The settings seam
 * is reached through `ctx.inject(["settings"], …)` (a child fiber that is a
 * silent no-op when the profile has no settings service — tui/headless),
 * so the row boots dormant in profiles that lack it.
 */

import type { Context } from "@deepseek-ai/cordis";
import { installSection, settingsNamespace } from "./compat.js";
import { ImageSettingsSchema } from "./settings.js";
import { DEFAULT_IMAGE_SETTINGS, NAMESPACE } from "../types.js";

const name = "dsh-image-settings";
const Config = ImageSettingsSchema;
const inject: string[] = [];

function apply(ctx: Context): void {
  const logger = ctx.logger("dsh-image-settings");
  let section: () => unknown = () => ({});
  installSection(ctx, settingsNamespace(NAMESPACE), ImageSettingsSchema, { ...DEFAULT_IMAGE_SETTINGS }, {
    setSource: (current) => {
      section = current;
    },
    onChange: () => {
      // The section feeds no host-side registration — the client half
      // observes it through its bound scope. Kept as a stable hook so a
      // future host-side reaction has a settled place to hook in.
      void section;
    },
  });
  logger.info("dsh-image-settings: image-settings section installed");
}

export { apply, Config, inject, name };
