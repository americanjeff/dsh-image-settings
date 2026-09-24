/**
 * dsh-image-settings — dsh client half (browser bundle).
 *
 * Claims the keyed `read_image` tool view slot and renders the settled
 * result's image refs larger than the stock attachment gallery (row width
 * instead of the 240px single / 64px tile) and — by default — auto-unrolled
 * (no expand step), the two traits the host's collapsed-card row does not
 * offer. Every size is live from the `image-settings:` section (a
 * settings.yaml edit re-renders rows without a page reload: the shared
 * describe mirror reloads on settings/document-updated and the bound
 * scope re-derives).
 *
 * The slot contract makes the claim a keyed replacement ("a key the shipped
 * composition already covers is replaced, not shared"), so while this view
 * stands, the host row does not render. The view has no on/off switch of its
 * own — turning it on or off is the host's built-in plugin management's job
 * (disabling the plugin here deregisters the view and hands the call back to
 * the host's own `read_image` row), which is why the `image-settings:`
 * section carries no `enabled` field.
 *
 * Image bytes ride the 0.1.5 tool-view owner's session-authorized
 * `loadImage` loader (durable ref → browser URL, host-owned lifecycle) —
 * no sessions-service round trip, no object-URL bookkeeping.
 *
 * The plugin also owns its settings card: one entry in the host's
 * `plugins.bundle.config` slot under this bundle's package name (the
 * plugin-manager's bundle detail page renders it between description and
 * rows), staged-edit save over the same config form the view reads through
 * (src/dsh/card.tsx). Registration is gated through
 * `configForms.whileServed` on this plugin's namespace, so the card shows
 * wherever the section serves this deployment and nowhere the Host does
 * not. The card is styled to be a stock plugin card — the
 * host's own PluginCard/ValueField markup + the stock modules' rules (as
 * `.dis_*` CSS, src/dsh/card-css.ts) — and its copy rides this plugin's own
 * locale namespace (src/dsh/card-locale.ts), registered with the
 * `locale:` slot option so the framework hands the card a typed `t`.
 */

import { useEffect, useState, useSyncExternalStore } from "react";
import type { CSSProperties } from "react";
import type { Context as ClientContext } from "@deepseek-ai/cordis";
import type { ConfigForm } from "@deepseek-ai/dsh-client-ui-settings/client";
// The module merge that puts `slots` on the cordis Context (the renderer
// owns the SlotRegistry service).
import type {} from "@deepseek-ai/dsh-client-ui-renderer/client";
// The module merge that puts `locale` on the cordis Context (the card's copy
// is registered through it).
import type {} from "@deepseek-ai/dsh-client-locale/client";
// The SlotMap declaration of `tool.call.toolview` + its owner props —
// type-only; the runtime identity comes from the shipped ui-tool row.
import type { ToolCallOwnerProps } from "@deepseek-ai/dsh-client-ui-tool/client";
// The SlotMap declaration of `plugins.bundle.config` (keyed on the bundle's
// package name) + its owner props — type-only; the runtime slot is declared
// by the host's plugin-manager page.
import type {} from "@deepseek-ai/dsh-client-ui-plugin-manager/client";
import { CardController, ImageSettingsCard } from "./card.js";
import { injectCardStyles } from "./card-css.js";
import { en, zh } from "./card-locale.js";
import {
  imageAttachmentRefs,
  imageCaption,
  readImagePath,
  sectionOf,
  textBlocksOf,
  type ImageLoader,
  type ReadImageAttachmentRef,
} from "./toolview.js";
import { NAMESPACE, type ImageSettingsSection } from "../types.js";

export const name = "dsh-image-settings";
// The profile entry id the 0.1.7 settings model keys by — this bundle's
// entry `id:` in dsh.cordis.yml, which equals the package name here.
const ENTRY_ID = name;
// Required services (cordis fiber inject): the slot registry (the renderer),
// the settings scope (the ui-settings base), and the locale runtime (the
// card's dictionary registration + the framework-synthesized `t` seat).
export const inject = ["slots", "configForms", "locale"];

/**
 * Wrap the owner's session-authorized loader in the duck-typed
 * {@link ImageLoader}. The host brands the loader's ref parameter
 * (`AttachmentId`); the wire value is structurally the duck-typed ref and
 * the brand is type-level only (it JSON-round-trips away), so the casts at
 * this one boundary are sound. Mirrors the host's own `Object.assign`
 * shape (loader + optional `peek`).
 */
function wrapLoader(loadImage: ToolCallOwnerProps["loadImage"]): ImageLoader {
  return Object.assign(
    (ref: ReadImageAttachmentRef) => loadImage(ref as never),
    loadImage.peek
      ? { peek: (ref: ReadImageAttachmentRef) => loadImage.peek!(ref as never) }
      : {},
  );
}

/** Row-level look (inline plain elements — no CSS pipeline in the bundle). */
const style: Record<string, CSSProperties> = {
  row: { margin: "2px 0", fontSize: 13, lineHeight: 1.4 },
  header: { display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" },
  title: { fontWeight: 600 },
  path: { fontSize: 12, opacity: 0.8, wordBreak: "break-all" },
  running: { fontSize: 12, opacity: 0.6, fontStyle: "italic" },
  failed: { fontSize: 12, opacity: 0.8, fontStyle: "italic" },
  toggle: {
    fontSize: 12,
    padding: "1px 8px",
    borderRadius: 10,
    border: "1px solid rgba(127,127,127,0.4)",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
  },
  envelope: {
    margin: "6px 0",
    padding: "6px 8px",
    fontSize: 12,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    background: "rgba(127,127,127,0.1)",
    borderRadius: 6,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  imageList: { display: "flex", flexWrap: "wrap", gap: 10, margin: "6px 0" },
  figure: { margin: 0 },
  caption: { fontSize: 11, opacity: 0.7, marginTop: 2 },
  imageStatus: { fontSize: 12, opacity: 0.7, fontStyle: "italic" },
};

/**
 * The image's box: standard replaced-element behavior — natural size when
 * small (never upscaled), capped by the section's `maxWidth` / `maxHeight`
 * (`maxWidth: null` = the row's available width, `maxHeight: null` = no cap).
 * Aspect kept (object-fit contain — a tool result has no crop-to-fit intent).
 */
function imgStyle(section: ImageSettingsSection): CSSProperties {
  return {
    display: "block",
    width: "auto",
    height: "auto",
    objectFit: "contain",
    borderRadius: 6,
    ...(section.maxWidth === null ? { maxWidth: "100%" } : { maxWidth: section.maxWidth }),
    ...(section.maxHeight === null ? {} : { maxHeight: section.maxHeight }),
  };
}

/**
 * One content-addressed image ref, loaded through the owner's
 * session-authorized loader (the host owns the returned URL's lifecycle —
 * the same posture the stock attachment gallery takes).
 */
function ReadImageFigure({
  image,
  loader,
  section,
}: {
  image: ReadImageAttachmentRef;
  loader: ImageLoader;
  section: ImageSettingsSection;
}) {
  const [url, setUrl] = useState<string | null>(() => loader.peek?.(image) ?? null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setFailed(false);
    loader(image)
      .then((u) => {
        if (live) setUrl(u);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
    // The loader wrapper is re-created every render, so the effect keys on
    // the ref identity + retry attempt, not the wrapper: a row re-render
    // (settings edit, sibling turn) must not re-fetch a loaded image.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image.attachmentId, attempt]);
  const caption = imageCaption(image);
  if (failed) {
    return (
      <div style={style.imageStatus}>
        {caption} — image unavailable{" "}
        <button type="button" style={style.toggle} onClick={() => setAttempt((a) => a + 1)}>
          retry
        </button>
      </div>
    );
  }
  if (url === null) {
    return <div style={style.imageStatus}>{caption} — loading…</div>;
  }
  return (
    <figure style={style.figure}>
      <img src={url} alt={caption} style={imgStyle(section)} />
      <figcaption style={style.caption}>{caption}</figcaption>
    </figure>
  );
}

/** Register the read_image view once the shell declares the slot. */
export function apply(ctx: ClientContext): void {
  // One config form per plugin activation. The shared describe mirror (owned
  // by the ui-settings base) reloads on the forwarded settings/document-updated
  // event, so this form re-derives for settings changes made anywhere — this
  // page, another tab, or an out-of-band process writing settings.yaml.
  const scope: ConfigForm<ImageSettingsSection> = ctx.configForms.get<ImageSettingsSection>(ENTRY_ID);
  // Capture stable callables once (useSyncExternalStore resubscribes when
  // the subscribe function identity changes).
  const subscribe = (listener: () => void) => scope.subscribe(listener);
  const getSnapshot = () => scope.getSnapshot();

  /** The live section (schema-resolved on the host; the lenient fill-in
   *  below is a drift guard for a section the host has not accepted yet). */
  const useSection = (): ImageSettingsSection => {
    const snapshot = useSyncExternalStore(subscribe, getSnapshot);
    return sectionOf(snapshot.value);
  };

  /** The claimed read_image row: standard row look + envelope + images. */
  const ReadImageView = (props: ToolCallOwnerProps) => {
    const section = useSection();
    const { block } = props;
    const [expanded, setExpanded] = useState(false);
    // The owner's loader, wrapped once per render in the duck-typed shape
    // the figure consumes (the cast lives in wrapLoader, in one place).
    const loader = wrapLoader(props.loadImage);
    // The settled (or running) call's path from its raw JSON arguments; the
    // 0.1.5 shapes: a settled node nests the call head under `call` (null
    // when window truncation dropped the call), a running node carries
    // `argsRaw` at the top level.
    const settled = "kind" in block ? block : null;
    const argsRaw = "kind" in block ? (block.call?.argsRaw ?? undefined) : block.argsRaw;
    const content = settled?.content ?? [];
    const images = imageAttachmentRefs(content);
    const envelope = settled === null ? "" : textBlocksOf(content);
    const path = readImagePath(argsRaw);
    const running = settled === null;
    const failed = settled !== null && settled.isError === true;
    const open = section.autoOpen || expanded;
    return (
      <div style={style.row} data-dsh-image-settings="row">
        <div style={style.header}>
          <span style={style.title}>read_image</span>
          {path !== undefined ? <code style={style.path}>{path}</code> : null}
          {running ? <span style={style.running}>reading…</span> : null}
          {failed ? <span style={style.failed}>failed</span> : null}
          {!running && !section.autoOpen ? (
            <button type="button" style={style.toggle} onClick={() => setExpanded((v) => !v)}>
              {open ? "Hide image" : "Show image"}
            </button>
          ) : null}
        </div>
        {open ? (
          <>
            {failed && section.showEnvelope && envelope !== "" ? <pre style={style.envelope}>{envelope}</pre> : null}
            {!failed && section.showEnvelope && envelope !== "" ? <pre style={style.envelope}>{envelope}</pre> : null}
            {images.length > 0 ? (
              <div style={style.imageList}>
                {images.map((image, index) => (
                  <ReadImageFigure
                    key={`${image.attachmentId}:${index}`}
                    image={image}
                    loader={loader}
                    section={section}
                  />
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    );
  };

  // The plugin's settings card (src/dsh/card.tsx), bound to the same form
  // the view reads through. `configForms.whileServed` keeps the registration
  // alive only while the Host serves the `image-settings` namespace (the
  // 0.1.7 successor of the configurable-plugins tab's served-namespace
  // dispatch), so a profile without the settings service never renders it
  // or its configuration section. The card's copy is
  // registered in the plugin's own locale namespace; the entry's `locale:`
  // option puts the framework-synthesized `t` seat (typed to those keys) on
  // the card's props.
  injectCardStyles();
  ctx.effect(
    () => ctx.locale.register(NAMESPACE, { en, zh }),
    "dsh-image-settings: settings card dictionary",
  );
  const cardController = new CardController(scope);
  ctx.effect(
    () =>
      ctx.configForms.whileServed([ENTRY_ID], () =>
        ctx.slots.inject("plugins.bundle.config", () =>
          ctx.slots.register(
            {
              name: "plugins.bundle.config",
              key: name,
              locale: NAMESPACE,
              registrant: name,
              inject: () => cardController.inject(),
            },
            ImageSettingsCard,
          ),
        ),
      ),
    "dsh-image-settings: settings card (while the Host serves the section)",
  );

  // The view registers unconditionally — on/off is the host's built-in
  // plugin management (disabling the plugin unmounts this client half, which
  // is how the view steps aside and the host's own `read_image` row takes
  // the call back).
  ctx.slots.inject("tool.call.toolview", () =>
    ctx.slots.register(
      { name: "tool.call.toolview", key: "read_image", registrant: "dsh-image-settings" },
      ReadImageView,
    ),
  );
}
