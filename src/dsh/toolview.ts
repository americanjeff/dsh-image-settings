/**
 * Pure helpers for the dsh client's `read_image` tool view.
 *
 * Framework-neutral on purpose: NO react import, no DOM, no node-only deps,
 * and NO `@deepseek-ai/*` type imports (the types below are duck-typed
 * subsets of the host contracts, so this module stays importable from a
 * bare node test environment, and the tsdown client build inlines it
 * without dragging host packages into the browser bundle). The client
 * bundle (src/dsh/client.tsx) imports these; the unit tests (test/*.ts)
 * import the module directly.
 *
 * The gap these helpers address: `read_image` logs its result as
 * `[text envelope, image block]` where the image block is
 * `{ type: 'image', attachment: <ImageAttachmentRef> }` — a content-addressed
 * REFERENCE (`attachmentId: "sha256:…"`, plus verified mediaType/width/height/
 * bytes), NOT base64. The dsh 0.1.5 host row renders that reference through
 * the stock attachment gallery (240px single / 64px tiles inside a
 * collapsed-by-default card). This view re-renders the reference as a
 * larger image and keeps it unrolled, loading the bytes through the
 * session-authorized `loadImage` loader the 0.1.5 tool-view owner already
 * carries — no sessions-service round trip.
 */

import { DEFAULT_IMAGE_SETTINGS, type ImageSettingsSection } from "../types.js";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A content-addressed image attachment reference as it rides in the settled
 * `read_image` result — a duck-typed subset of the host `ImageAttachmentRef`
 * carrying only the fields this view uses. `attachmentId` is the byte key;
 * everything else is verified metadata the host stamped at write time.
 * (The wire value IS the host's branded ref — the brand is type-level only
 * and JSON-round-trips away, so the cast at the `loadImage` call boundary
 * is sound.)
 */
export interface ReadImageAttachmentRef {
  /** Opaque storage identifier (e.g. `sha256:…`); never a path or URL. */
  attachmentId: string;
  /** Media type verified from the stored bytes. */
  mediaType?: string;
  /** Exact encoded byte length. */
  bytes?: number;
  /** Intrinsic encoded width in pixels. */
  width?: number;
  /** Intrinsic encoded height in pixels. */
  height?: number;
  /** Optional display name (local path information already stripped). */
  name?: string;
}

/**
 * The session-authorized image URL loader the 0.1.5 tool-view owner supplies
 * (`ToolCallOwnerProps.loadImage`): resolves a durable attachment to a
 * browser URL the view can point an `<img>` at; the optional `peek` returns
 * an already-resolved URL when the host has cached one (synchronous start).
 * Duck-typed (duck: the host brands the ref parameter; the wire value is
 * structurally identical) so this module stays import-light.
 */
export type ImageLoader = {
  (attachment: ReadImageAttachmentRef): Promise<string>;
  peek?(attachment: ReadImageAttachmentRef): string | undefined;
};

/**
 * Extract the image attachment references from a settled tool result's
 * content blocks. Lenient by the reader contract (never throws): non-array
 * content, non-object blocks, blocks whose `type` is not `'image'`, and
 * refs without a non-empty string `attachmentId` are all skipped. Input
 * order is preserved.
 *
 * @param content - the settled `ToolResultNode.content` block array (typed
 *   as `unknown[]` here so the module stays dsh-import-free; the real
 *   `ContentBlock[]` is assignable to it).
 * @returns the image refs in content order (possibly empty — a running call
 *   or a text-only result yields none).
 */
export function imageAttachmentRefs(content: readonly unknown[]): ReadImageAttachmentRef[] {
  const out: ReadImageAttachmentRef[] = [];
  if (!Array.isArray(content)) return out;
  for (const block of content) {
    if (!isPlainObject(block) || block.type !== "image") continue;
    const attachment = block.attachment;
    if (!isPlainObject(attachment)) continue;
    if (typeof attachment.attachmentId !== "string" || attachment.attachmentId === "") continue;
    out.push(attachment as unknown as ReadImageAttachmentRef);
  }
  return out;
}

/**
 * Join the text blocks of a content array into one string — the `read_image`
 * envelope is a single `{ type: 'text', text }` block, but this helper is
 * generic over any settled content that carries several. Only blocks tagged
 * `type: 'text'` are picked (a `reasoning` block also carries a `text` field
 * and must NOT join the envelope). Lenient: non-array content, non-object
 * blocks, and non-string `text` fields are skipped, never thrown.
 *
 * @returns the concatenated text blocks (`"\n"`-joined), or `""` when none.
 */
export function textBlocksOf(content: readonly unknown[]): string {
  const parts: string[] = [];
  if (!Array.isArray(content)) return "";
  for (const block of content) {
    if (isPlainObject(block) && block.type === "text" && typeof block.text === "string") {
      parts.push(block.text);
    }
  }
  return parts.join("\n");
}

/**
 * The one-line caption under a rendered tool image: the ref's display name
 * (or `image`), plus the intrinsic dimensions when the ref carries them.
 * The on-disk path already rides the envelope text above, so the caption is
 * metadata-only.
 *
 * @returns e.g. `screenshot.png · 120×80`, or `image` when the name is absent.
 */
export function imageCaption(ref: ReadImageAttachmentRef): string {
  const label = typeof ref.name === "string" && ref.name !== "" ? ref.name : "image";
  if (typeof ref.width === "number" && typeof ref.height === "number") {
    return `${label} · ${ref.width}×${ref.height}`;
  }
  return label;
}

/**
 * The settled (or running) call's file path from its raw JSON arguments.
 * `read_image` takes `file_path`; `path` is accepted as a fallback for
 * drift. Lenient: non-string raw args, malformed JSON, and a missing/empty
 * path all yield `undefined` (the header then omits the path chip).
 */
export function readImagePath(argsRaw: unknown): string | undefined {
  if (typeof argsRaw !== "string" || argsRaw === "") return undefined;
  try {
    const parsed = JSON.parse(argsRaw) as Record<string, unknown>;
    const p = parsed.file_path ?? parsed.path;
    return typeof p === "string" && p !== "" ? p : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The registration gating decision (owner rule): `enabled` gates the
 * `read_image` keyed tool view's REGISTRATION, not just the image — an
 * explicit `false` deregisters the keyed view entirely so the host's own
 * row owns the call (no double render, no dead view shadowing an upstream
 * fix). The DEFAULT is ON: an absent or malformed section renders. Only an
 * explicit `false` steps aside.
 *
 * @param section - the current resolved `image-settings:` section (or
 *   `undefined` before the first acceptance — treated as the default,
 *   render on).
 */
export function shouldRegisterReadImageView(section: unknown): boolean {
  return isPlainObject(section) ? (section.enabled as unknown) !== false : true;
}

/** A positive integer px measure, or `null` (an explicit "no cap"), or
 *  `undefined` when the value is absent or malformed (caller falls back to
 *  the default). */
function positiveNullablePx(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  return undefined;
}

/**
 * Resolve a raw section (possibly `undefined` before first acceptance, or
 * hand-edited YAML) to a complete {@link ImageSettingsSection}. Lenient by
 * the reader contract (never throws): a malformed field falls back to the
 * {@link DEFAULT_IMAGE_SETTINGS} default, one field at a time.
 */
export function sectionOf(raw: unknown): ImageSettingsSection {
  const section = isPlainObject(raw) ? raw : {};
  const maxWidth = positiveNullablePx(section.maxWidth);
  const maxHeight = positiveNullablePx(section.maxHeight);
  return {
    enabled: typeof section.enabled === "boolean" ? section.enabled : DEFAULT_IMAGE_SETTINGS.enabled,
    autoOpen: typeof section.autoOpen === "boolean" ? section.autoOpen : DEFAULT_IMAGE_SETTINGS.autoOpen,
    maxWidth: maxWidth === undefined ? DEFAULT_IMAGE_SETTINGS.maxWidth : maxWidth,
    maxHeight: maxHeight === undefined ? DEFAULT_IMAGE_SETTINGS.maxHeight : maxHeight,
    showEnvelope:
      typeof section.showEnvelope === "boolean"
        ? section.showEnvelope
        : DEFAULT_IMAGE_SETTINGS.showEnvelope,
  };
}
