/**
 * dsh-image-settings — the plugin settings card's staged-edit model (pure,
 * framework-neutral).
 *
 * Mirrors the form contract the host's own plugin cards follow (dsh-client-ui-settings-plugins
 * `CardForm`): a card STAGES what the user types and writes it only when they
 * save. Each settings write is a durable, revision-fenced document mutation,
 * so a control that committed as it settled would turn one edit into a write
 * the user never asked for and could not preview; staged text makes what is on
 * screen exactly what a save would store. A field's PRESENCE in the raw user
 * layer — not a value comparison — is what marks it overridden: an override
 * equal to the composition default is still an override.
 *
 * Each field carries a {@link FieldSpec} — how its stored value renders as
 * control text and how control text parses back to a write:
 *   - a px-cap field: the empty draft is the explicit no-cap value `null`
 *     (distinct from a CLEAR, which removes the user-layer entry so the field
 *     re-inherits the composition base — whose maxHeight IS capped at 600);
 *     a positive whole number is that many pixels; anything else is not a
 *     value the field accepts (undefined — the save is blocked rather than
 *     the draft discarded or rewritten);
 *   - a boolean field: the strings "true" / "false" (what a switch stages).
 *
 * Like toolview.ts this module stays import-light (only ../types.js) and
 * dsh-import-free: the {@link FieldOp} shape is STRUCTURALLY the host's
 * SettingsPathOpView (set/unset over a path), so planOps's output feeds
 * SettingsScope.mutate directly without a type import dragging a host
 * package into the client bundle's closure.
 */

import type { ImageSettingsSection } from "../types.js";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The px-cap fields the card edits. */
export const PX_FIELDS = ["maxWidth", "maxHeight"] as const;
export type PxField = (typeof PX_FIELDS)[number];

/** The boolean fields the card edits. */
export const BOOL_FIELDS = ["autoOpen", "showEnvelope"] as const;
export type BoolField = (typeof BOOL_FIELDS)[number];

/** Any field the card edits. */
export type CardField = PxField | BoolField;

/** The write one field's staged text performs when the card is saved. */
export type FieldWrite = { kind: "set"; value: boolean | number | null } | { kind: "clear" };

/** How one section field converts between its stored value and its draft text. */
export interface FieldSpec {
  /** Field name inside the namespace section. */
  field: CardField;
  /** Render a stored value as draft text; the empty string when the section carries none. */
  format: (value: unknown) => string;
  /** The write this draft text stages, or undefined when the text is not a value this field accepts. */
  parse: (text: string) => FieldWrite | undefined;
}

/** A px-cap spec: empty = explicit no-cap, a positive whole number = that many pixels. */
export function pxSpec(field: PxField): FieldSpec {
  return {
    field,
    format: (value) => (typeof value === "number" ? String(value) : ""),
    parse: (text) => {
      const trimmed = text.trim();
      if (trimmed === "") return { kind: "set", value: null };
      if (!/^[0-9]+$/.test(trimmed)) return undefined;
      const value = Number(trimmed);
      return Number.isInteger(value) && value > 0 ? { kind: "set", value } : undefined;
    },
  };
}

/** A boolean spec: the "true" / "false" strings a switch stages. */
export function boolSpec(field: BoolField): FieldSpec {
  return {
    field,
    format: (value) => (value === true ? "true" : "false"),
    parse: (text) =>
      text === "true" ? { kind: "set", value: true } : text === "false" ? { kind: "set", value: false } : undefined,
  };
}

/**
 * The card's field specs, in the order the card renders them. The px fields
 * sit between the booleans — the same order the section's schema declares —
 * so the spec list doubles as the card's row order.
 */
export const FIELD_SPECS: readonly FieldSpec[] = [
  boolSpec("autoOpen"),
  pxSpec("maxWidth"),
  pxSpec("maxHeight"),
  boolSpec("showEnvelope"),
];

/** One staged edit: the control's raw text, or a clear (the Reset gesture). */
export interface StagedEdit {
  field: CardField;
  /** What the control renders; a clear stages the base text the save restores. */
  text: string;
  /** True = a clear: on save the field re-inherits the composition layer. */
  clear: boolean;
}

/**
 * A card's staged draft. `fence` is the namespace revision the draft read
 * when its first edit was staged — the fence one save submits: a document
 * that moved underneath the draft is refused by the Host rather than
 * overwritten. `edits` hold at most one edit per field, in staging order.
 */
export interface CardDraft {
  fence: number | undefined;
  edits: StagedEdit[];
}

/** Start a draft fenced at the revision the live snapshot carries. */
export function createDraft(fence: number | undefined): CardDraft {
  return { fence, edits: [] };
}

/** Whether the draft holds edits a save would write. */
export function isDirty(draft: CardDraft): boolean {
  return draft.edits.length > 0;
}

/** The staged edit for one field, if any. */
export function editOf(draft: CardDraft, field: CardField): StagedEdit | undefined {
  return draft.edits.find((edit) => edit.field === field);
}

/** Stage one edit, replacing any staged edit for the field (staging order moves to the end). */
export function stageEdit(draft: CardDraft, edit: StagedEdit): CardDraft {
  const edits = draft.edits.filter((e) => e.field !== edit.field);
  edits.push(edit);
  return { ...draft, edits };
}

/** Drop the staged edit for one field (the others survive). */
export function dropEdit(draft: CardDraft, field: CardField): CardDraft {
  return { ...draft, edits: draft.edits.filter((edit) => edit.field !== field) };
}

/**
 * The per-field Reset: drop the staged edit, then stage a clear ONLY when the
 * Host's user layer holds the field — the clear is what lets the field
 * re-inherit the composition layer on save. A field with no user-layer entry
 * needs no clear; dropping the staged edit already shows the inherited value.
 */
export function stageReset(
  draft: CardDraft,
  field: CardField,
  spec: FieldSpec,
  user: unknown,
  base: ImageSettingsSection,
): CardDraft {
  const without = dropEdit(draft, field);
  return fieldOverridden(user, field)
    ? stageEdit(without, { field, text: spec.format(base[field]), clear: true })
    : without;
}

/** A field's PRESENCE in the raw user layer marks it overridden. */
export function fieldOverridden(user: unknown, field: CardField): boolean {
  return isPlainObject(user) && field in user;
}

/**
 * Whether saving would leave a user-layer entry for this field. A staged edit
 * answers for itself (a staged clear would REMOVE the entry), so the badge
 * previews the save rather than reporting a state the pending edit
 * already contradicts.
 */
export function overriddenPreview(
  draft: CardDraft | null,
  field: CardField,
  user: unknown,
): boolean {
  const edit = draft === null ? undefined : editOf(draft, field);
  return edit === undefined ? fieldOverridden(user, field) : !edit.clear;
}

/**
 * The value a field's control renders: the parsed staged text when a non-clear
 * edit stands (falling back to the live value for text the field does not
 * accept — the invalid border + message carry the complaint), the composition
 * base when a clear stands (what a save would restore), the live value
 * otherwise.
 */
export function draftValue(
  draft: CardDraft | null,
  spec: FieldSpec,
  live: ImageSettingsSection,
  base: ImageSettingsSection,
): boolean | number | null {
  const edit = draft === null ? undefined : editOf(draft, spec.field);
  if (edit === undefined) return live[spec.field];
  if (edit.clear) return base[spec.field];
  const write = spec.parse(edit.text);
  return write !== undefined && write.kind === "set" ? write.value : live[spec.field];
}

/**
 * One field as the card's control renders it — the stock cards' CardFieldState
 * shape (text / overridden / invalid), read from the draft + the layers:
 *   - `text` is the draft the control shows (a staged edit's own text — even
 *     invalid text, so the user sees what they typed — or the formatted layer
 *     value when nothing is staged);
 *   - `overridden` previews the save (see {@link overriddenPreview});
 *   - `invalid` marks a staged draft the field does not accept — the save is
 *     refused while one stands.
 */
export function fieldState(
  draft: CardDraft | null,
  spec: FieldSpec,
  live: ImageSettingsSection,
  base: ImageSettingsSection,
  user: unknown,
): { text: string; overridden: boolean; invalid: boolean } {
  const edit = draft === null ? undefined : editOf(draft, spec.field);
  return {
    text: edit === undefined ? spec.format(live[spec.field]) : edit.text,
    overridden: overriddenPreview(draft, spec.field, user),
    invalid: edit !== undefined && !edit.clear && spec.parse(edit.text) === undefined,
  };
}

/**
 * Whether a staged edit would write nothing: its write equals the live value
 * and the field has no user-layer entry — staging it would create an override
 * indistinguishable from the inherited value, so the editor cancels the edit
 * (toggling back / typing back to the displayed value is the Undo gesture).
 */
export function isNoOpEdit(
  edit: StagedEdit,
  spec: FieldSpec,
  live: ImageSettingsSection,
  user: unknown,
): boolean {
  if (edit.clear) return !fieldOverridden(user, spec.field);
  const write = spec.parse(edit.text);
  return (
    write !== undefined &&
    write.kind === "set" &&
    write.value === live[spec.field] &&
    !fieldOverridden(user, spec.field)
  );
}

/** One path-addressed write, structurally the host's SettingsPathOpView. */
export type FieldOp =
  | { op: "set"; path: [string]; value: boolean | number | null }
  | { op: "unset"; path: [string] };

/** One save's plan: every staged edit as an ordered write, plus invalidity. */
export interface CardPlan {
  /** The ordered writes one save performs (a stale-fence refusal re-fences the next). */
  ops: FieldOp[];
  /** True when any staged draft is not a value its field accepts. */
  invalid: boolean;
}

/**
 * Every staged edit a save would write, in staging order. A draft the field
 * does not accept contributes NO write: the form is still dirty, and the save
 * refuses rather than dropping the edit.
 */
export function planOps(draft: CardDraft, specs: readonly FieldSpec[]): CardPlan {
  const byField = new Map(specs.map((s) => [s.field, s] as const));
  const ops: FieldOp[] = [];
  let invalid = false;
  for (const edit of draft.edits) {
    if (edit.clear) {
      ops.push({ op: "unset", path: [edit.field] });
      continue;
    }
    const spec = byField.get(edit.field);
    if (spec === undefined) continue;
    const write = spec.parse(edit.text);
    if (write === undefined) {
      invalid = true;
    } else {
      ops.push(write.kind === "set" ? { op: "set", path: [edit.field], value: write.value } : { op: "unset", path: [edit.field] });
    }
  }
  return { ops, invalid };
}
