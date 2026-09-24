/**
 * dsh-image-settings — the plugin's settings card (browser bundle).
 *
 * One card registered into the host's `plugins.bundle.config` slot under
 * this bundle's package name (the plugin-manager's bundle detail page
 * renders it between the description and the rows; registration is gated
 * through `configForms.whileServed` on this plugin's own namespace
 * (`image-settings`), so the card shows wherever the section serves this
 * deployment and leaves no trace elsewhere).
 *
 * The card is styled to be a stock plugin card: the host's own
 * `PluginCard`/`ValueField` markup (ui-settings-plugins 0.1.5-rc.2) with the
 * slider switch the host's own toggles use, and the stock modules' rules
 * carried as `.dis_*`-prefixed CSS (card-css.ts) — the client-bundle purity
 * gate forbids cross-plugin VALUE imports, so a third-party card re-declares
 * the same rules under its own prefix, exactly as the host's modules ship
 * them. Colors are `--dsw-alias-*` theme variables, so light/dark follow the
 * shell. Copy rides this plugin's own locale namespace (card-locale.ts): the
 * entry's `locale:` option puts the framework-synthesized `t` seat on the
 * props, typed to the card's dictionary keys.
 *
 * The write path is the stock `CardForm`'s: edits STAGE locally (the controls
 * render exactly what a save would store) and one save performs them as a
 * single atomic namespace mutation fenced at the revision the draft read, so
 * a document that moved underneath the draft is refused rather than
 * overwritten. A per-field Reset stages a clear — on save the field
 * re-inherits the composition layer (the schema defaults) — and a draft the
 * field does not accept blocks the save instead of being dropped. A
 * successful save collapses the card after the mutation settles; a failed
 * save keeps it open, reports, and retains the drafts.
 *
 * The card renders nothing while its namespace is not ready: `loading`
 * answers once the first accepted section lands, and a profile without the
 * settings service keeps the whole surface absent (no disabled card a user
 * cannot act on). The card itself has no enable switch — turning the plugin
 * on or off is the host's built-in plugin management's job (disabling the
 * plugin removes the section, so the card goes with it).
 */

import { useEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { createSnapshotStore, type SnapshotStore } from "@deepseek-ai/dsh-client-store";
import type { InjectFace, PropsLocale, PropsRuntime } from "@deepseek-ai/dsh-client-ui-slots";
import type { ConfigForm } from "@deepseek-ai/dsh-client-ui-settings/client";
// The `plugins.bundle.config` SlotMap declaration (keyed on the bundle's
// package name) — type-only; the runtime slot is declared by the host's
// plugin-manager page.
import type {} from "@deepseek-ai/dsh-client-ui-plugin-manager/client";
// The LocaleNamespaceMap merge that puts `image-settings` on the map (types
// the `t` seat) — the module's augmentation applies as soon as it is in the
// program, so the empty type import is deliberate.
import type {} from "./card-locale.js";
import {
  type CardDraft,
  type CardField,
  type FieldSpec,
  type StagedEdit,
  FIELD_SPECS,
  createDraft,
  dropEdit,
  fieldState,
  isDirty,
  isNoOpEdit,
  planOps,
  stageEdit,
  stageReset,
} from "./card-state.js";
import { DEFAULT_IMAGE_SETTINGS, type ImageSettingsSection } from "../types.js";
import { sectionOf } from "./toolview.js";

/** The stock card form state every plugin card shares (re-declared locally:
 * the 0.1.7 settings domain dropped the shared card-form contract, and the
 * bundle purity gate keeps this bundle's types self-contained). */
interface CardShell {
  /** False while the namespace is not served to this client; the card renders nothing. */
  available: boolean;
  /** Whether the Host document accepts writes. */
  writable: boolean;
  /** Whether the form holds edits that a save would write. */
  dirty: boolean;
  /** Whether any staged draft is invalid, which blocks the save. */
  invalid: boolean;
  /** Whether a save is crossing the wire. */
  saving: boolean;
  /** Whether the last save did not land as staged; cleared by the next edit or save. */
  failed: boolean;
}

/** The write actions every plugin card's slot entry injects. */
interface CardActions {
  /** Stage draft text for one field. */
  edit: (field: string, text: string) => void;
  /** Stage a clear, so saving lets the field re-inherit the composition layer. */
  resetField: (field: string) => void;
  /** Write every staged edit, then re-seed from what the Host accepted. */
  save: () => void;
  /** Drop every staged edit. */
  discard: () => void;
}

/** One field's staged control state. */
interface CardFieldState {
  text: string;
  overridden: boolean;
  invalid: boolean;
}

/** What the image-settings card renders: the stock card shell + one control state per field. */
export interface ImageSettingsCardState extends CardShell {
  /** True while the document moved under the staged draft (the save will be refused). */
  drift: boolean;
  autoOpen: CardFieldState;
  maxWidth: CardFieldState;
  maxHeight: CardFieldState;
  showEnvelope: CardFieldState;
}

/** The registration-side face the card's slot entry injects. */
export interface ImageSettingsCardFace extends CardActions {
  hooks: {
    /** Card snapshot bound by the renderer as `useImageSettingsCard`. */
    imageSettingsCard: SnapshotStore<ImageSettingsCardState>;
  };
}

/** Props the renderer binds for the image-settings card (the stock card props pattern). */
export type ImageSettingsCardProps =
  PropsRuntime<"plugins.bundle.config"> &
  PropsLocale<"image-settings"> &
  InjectFace<ImageSettingsCardFace>;

/**
 * Bridges the `image-settings` scope onto the card's staged form — the stock
 * `CardForm` pattern: the form publishes through a snapshot store because
 * slot components read through a snapshot selector, while both the scope and
 * the local drafts change underneath; every projection is rebuilt from the
 * two together. A save is one atomic namespace mutation fenced at the
 * revision the draft read, so a document that moved underneath the draft is
 * refused rather than overwritten.
 */
export class CardController {
  private readonly scope: ConfigForm<ImageSettingsSection>;
  private readonly specs: readonly FieldSpec[];
  private readonly store: SnapshotStore<ImageSettingsCardState>;
  private draft: CardDraft | null = null;
  private saving = false;
  private failed = false;
  private readonly listeners = new Set<() => void>();

  constructor(scope: ConfigForm<ImageSettingsSection>, specs: readonly FieldSpec[] = FIELD_SPECS) {
    this.scope = scope;
    this.specs = specs;
    this.store = this.bind(() => this.state());
    scope.subscribe(() => this.publish());
  }

  /** Publish a projection of this form, rebuilt whenever the scope or a draft changes. */
  private bind(project: () => ImageSettingsCardState): SnapshotStore<ImageSettingsCardState> {
    const store = createSnapshotStore(project());
    this.listeners.add(() => {
      store.set(project());
    });
    return store;
  }

  /** The card's snapshot (the hooks seat of the inject face). */
  get snapshot(): SnapshotStore<ImageSettingsCardState> {
    return this.store;
  }

  /** Read the card-level state: what the Host serves, and what a save would do. */
  state(): ImageSettingsCardState {
    const snap = this.scope.getSnapshot();
    const ready = snap.status === "ready";
    const live = ready && snap.value !== undefined ? sectionOf(snap.value) : DEFAULT_IMAGE_SETTINGS;
    const base = sectionOf(snap.base ?? DEFAULT_IMAGE_SETTINGS);
    const d = this.draft;
    const field = (name: CardField): CardFieldState => {
      const spec = this.specs.find((s) => s.field === name);
      return spec === undefined ? { text: "", overridden: false, invalid: false } : fieldState(d, spec, live, base, snap.user);
    };
    return {
      available: ready,
      writable: snap.writable,
      dirty: d !== null && isDirty(d),
      invalid: d !== null && planOps(d, this.specs).invalid,
      saving: this.saving,
      failed: this.failed,
      drift: d !== null && d.fence !== undefined && snap.revision !== undefined && d.fence !== snap.revision,
      autoOpen: field("autoOpen"),
      maxWidth: field("maxWidth"),
      maxHeight: field("maxHeight"),
      showEnvelope: field("showEnvelope"),
    };
  }

  /** The face the card's slot registration injects. */
  inject(): ImageSettingsCardFace {
    return {
      hooks: { imageSettingsCard: this.store },
      edit: (field, text) => this.edit(field, text),
      resetField: (field) => this.resetField(field),
      save: () => {
        void this.save();
      },
      discard: () => this.discard(),
    };
  }

  /** Stage draft text for one field (a no-op edit is cancelled, not staged). */
  private edit(field: string, text: string): void {
    const spec = this.specs.find((s) => s.field === field);
    if (spec === undefined) return;
    const snap = this.scope.getSnapshot();
    const live = sectionOf(snap.value ?? DEFAULT_IMAGE_SETTINGS);
    const candidate: StagedEdit = { field: spec.field, text, clear: false };
    const current = this.draft ?? createDraft(snap.revision);
    // Typing back to the displayed value of a field with no user-layer entry
    // is a no-op save: cancel the staged edit rather than stage an override.
    this.draft = isNoOpEdit(candidate, spec, live, snap.user) ? dropEdit(current, spec.field) : stageEdit(current, candidate);
    this.failed = false;
    this.publish();
  }

  /** Stage a clear for one field, so saving lets it re-inherit the composition layer. */
  private resetField(field: string): void {
    const spec = this.specs.find((s) => s.field === field);
    if (spec === undefined) return;
    const snap = this.scope.getSnapshot();
    const base = sectionOf(snap.base ?? DEFAULT_IMAGE_SETTINGS);
    const current = this.draft ?? createDraft(snap.revision);
    this.draft = stageReset(current, spec.field, spec, snap.user, base);
    this.failed = false;
    this.publish();
  }

  /**
   * Write every staged edit as one atomic namespace mutation, then drop the
   * drafts once the Host's read-back settles. A save that did not land keeps
   * its drafts, so the user can correct them instead of retyping.
   */
  private async save(): Promise<void> {
    const draft = this.draft;
    if (draft === null || !isDirty(draft) || this.saving) return;
    const plan = planOps(draft, this.specs);
    if (plan.invalid) return;
    this.saving = true;
    this.failed = false;
    this.publish();
    try {
      if (draft.fence === undefined) {
        await this.scope.mutate(plan.ops);
      } else {
        await this.scope.mutate(plan.ops, draft.fence);
      }
      this.draft = null;
    } catch (error) {
      this.failed = true;
      console.warn("dsh-image-settings: settings save failed", error);
    } finally {
      this.saving = false;
      this.publish();
    }
  }

  /** Drop every staged edit. */
  private discard(): void {
    this.draft = null;
    this.failed = false;
    this.publish();
  }

  private publish(): void {
    for (const listener of [...this.listeners]) listener();
  }
}

/** IconChevronDownOutline14 (ui-primitives), inlined — the stock card's header chevron. */
function Chevron({ open }: { open: boolean }): ReactElement {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={open ? "dis_chevron dis_chevronOpen" : "dis_chevron"}
    >
      <path
        d="M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** The field row's head: label, the overridden badge + reset it earns, an optional row-end control. */
function Head(props: {
  id: string;
  label: string;
  labelPlain?: boolean;
  overridden: boolean;
  overriddenLabel: string;
  resetLabel: string;
  disabled: boolean;
  onReset: () => void;
  control?: ReactNode;
}): ReactElement {
  return (
    <div className="dis_head">
      <label className={props.labelPlain ? "dis_label dis_labelPlain" : "dis_label"} htmlFor={props.id}>
        {props.label}
      </label>
      {props.overridden ? (
        <span className="dis_badges">
          <span className="dis_badge">{props.overriddenLabel}</span>
          <button type="button" className="dis_reset" disabled={props.disabled} onClick={props.onReset}>
            {props.resetLabel}
          </button>
        </span>
      ) : null}
      {/* Row-end control (the toggle's slider switch): the growing label keeps it at the right edge. */}
      {props.control}
    </div>
  );
}

/** A staged value field (the stock `ValueField` markup, `.dis_` classes). */
function ValueField(props: {
  id: string;
  label: string;
  hint?: string;
  text: string;
  placeholder?: string;
  overridden: boolean;
  invalid: boolean;
  disabled: boolean;
  overriddenLabel: string;
  resetLabel: string;
  invalidLabel: string;
  onEdit: (text: string) => void;
  onReset: () => void;
}): ReactElement {
  return (
    <div className="dis_field">
      <Head
        id={props.id}
        label={props.label}
        overridden={props.overridden}
        overriddenLabel={props.overriddenLabel}
        resetLabel={props.resetLabel}
        disabled={props.disabled}
        onReset={props.onReset}
      />
      <input
        id={props.id}
        className={props.invalid ? "dis_input dis_inputInvalid" : "dis_input"}
        type="text"
        inputMode="numeric"
        aria-invalid={props.invalid ? true : undefined}
        value={props.text}
        placeholder={props.placeholder ?? ""}
        disabled={props.disabled}
        onChange={(event) => props.onEdit(event.target.value)}
      />
      {props.invalid || props.hint !== undefined ? (
        <p className={props.invalid ? "dis_invalid" : "dis_hint"}>{props.invalid ? props.invalidLabel : props.hint}</p>
      ) : null}
    </div>
  );
}

/** A staged boolean field (the host's own toggle shape: row label + slider switch). */
function ToggleField(props: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  overridden: boolean;
  disabled: boolean;
  overriddenLabel: string;
  resetLabel: string;
  onToggle: (value: boolean) => void;
  onReset: () => void;
}): ReactElement {
  return (
    <div className="dis_field">
      <Head
        id={props.id}
        label={props.label}
        labelPlain
        overridden={props.overridden}
        overriddenLabel={props.overriddenLabel}
        resetLabel={props.resetLabel}
        disabled={props.disabled}
        onReset={props.onReset}
        control={
          <button
            type="button"
            role="switch"
            aria-checked={props.checked}
            aria-label={props.label}
            className={props.checked ? "dis_switch dis_switchOn" : "dis_switch"}
            disabled={props.disabled}
            onClick={() => props.onToggle(!props.checked)}
          >
            <span className="dis_thumb" />
          </button>
        }
      />
      {props.hint !== undefined ? <p className="dis_hint">{props.hint}</p> : null}
    </div>
  );
}

/**
 * Render the image-settings card: locale copy, the card snapshot, and its
 * form actions — the stock card's own chrome (the host's `PluginCard` markup
 * with the stock field rows), the controller riding the inject face.
 *
 * @param props - locale copy, the card snapshot (via the bound selector), and its form actions.
 * @returns the card, or nothing while the namespace is not ready.
 */
export function ImageSettingsCard(props: ImageSettingsCardProps): ReactElement | null {
  const { t } = props;
  const state = props.useImageSettingsCard((snapshot) => snapshot);
  // Disclosure is card-local state (a reading gesture): which card a user has
  // open is not something the Host or the section has a stake in. Staged
  // edits outlive collapsing, so the header marks a card holding unsaved
  // edits; a save collapses the card once its mutation settles (the stock
  // PluginCard's own effect).
  const [open, setOpen] = useState(false);
  const saveStarted = useRef(false);
  useEffect(() => {
    if (state.saving) {
      saveStarted.current = true;
      return;
    }
    if (!saveStarted.current) return;
    saveStarted.current = false;
    if (!state.dirty && !state.failed) setOpen(false);
  }, [state.dirty, state.failed, state.saving]);
  if (!state.available) return null;
  const title = t("title");
  const blocked = !state.dirty || state.invalid || state.saving;
  const disabled = !state.writable;
  return (
    <li className={open ? "dis_card dis_cardOpen" : "dis_card"} data-dsh-image-settings="settings-card">
      <button
        type="button"
        className="dis_header"
        aria-expanded={open}
        aria-label={`${t(open ? "collapse" : "expand")}: ${title}`}
        onClick={() => setOpen(!open)}
      >
        <span className="dis_headText">
          <span className="dis_name">{title}</span>
          <span className="dis_description">{t("description")}</span>
        </span>
        {state.dirty ? <span className="dis_pending">{t("unsaved")}</span> : null}
        <Chevron open={open} />
      </button>
      {open ? (
        <div className="dis_body">
          {!state.writable ? (
            <p className="dis_readOnly" role="status">
              {t("readOnly")}
            </p>
          ) : null}
          <ToggleField
            id="image-settings-autoOpen"
            label={t("autoOpen")}
            checked={state.autoOpen.text === "true"}
            overridden={state.autoOpen.overridden}
            disabled={disabled}
            overriddenLabel={t("overridden")}
            resetLabel={t("reset")}
            onToggle={(value) => props.edit("autoOpen", value ? "true" : "false")}
            onReset={() => props.resetField("autoOpen")}
          />
          <ValueField
            id="image-settings-maxWidth"
            label={t("width")}
            placeholder={t("noCap")}
            overriddenLabel={t("overridden")}
            resetLabel={t("reset")}
            invalidLabel={t("invalidPx")}
            disabled={disabled}
            onEdit={(text) => props.edit("maxWidth", text)}
            onReset={() => props.resetField("maxWidth")}
            {...state.maxWidth}
          />
          <ValueField
            id="image-settings-maxHeight"
            label={t("height")}
            placeholder={t("noCap")}
            overriddenLabel={t("overridden")}
            resetLabel={t("reset")}
            invalidLabel={t("invalidPx")}
            disabled={disabled}
            onEdit={(text) => props.edit("maxHeight", text)}
            onReset={() => props.resetField("maxHeight")}
            {...state.maxHeight}
          />
          <ToggleField
            id="image-settings-showEnvelope"
            label={t("showEnvelope")}
            hint={t("showEnvelopeHint")}
            checked={state.showEnvelope.text === "true"}
            overridden={state.showEnvelope.overridden}
            disabled={disabled}
            overriddenLabel={t("overridden")}
            resetLabel={t("reset")}
            onToggle={(value) => props.edit("showEnvelope", value ? "true" : "false")}
            onReset={() => props.resetField("showEnvelope")}
          />
          <div className="dis_footer">
            {state.failed ? (
              <p className="dis_failed" role="status">
                {t("saveFailed")}
              </p>
            ) : state.drift ? (
              <p className="dis_failed" role="status">
                {t("drift")}
              </p>
            ) : null}
            <button type="button" className="dis_discard" disabled={!state.dirty || state.saving} onClick={props.discard}>
              {t("discard")}
            </button>
            <button type="button" className="dis_save" disabled={blocked} onClick={props.save}>
              {state.saving ? t("saving") : t("save")}
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
