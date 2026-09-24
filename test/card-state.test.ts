import { describe, expect, it } from "vitest";
import {
  boolSpec,
  createDraft,
  dropEdit,
  draftValue,
  editOf,
  fieldOverridden,
  fieldState,
  isDirty,
  isNoOpEdit,
  overriddenPreview,
  planOps,
  pxSpec,
  stageEdit,
  stageReset,
  FIELD_SPECS,
  type CardDraft,
} from "../src/dsh/card-state.js";
import { DEFAULT_IMAGE_SETTINGS, type ImageSettingsSection } from "../src/types.js";

function section(overrides: Partial<ImageSettingsSection> = {}): ImageSettingsSection {
  return { ...DEFAULT_IMAGE_SETTINGS, ...overrides };
}

const px = pxSpec("maxWidth");
const pxH = pxSpec("maxHeight");
const boolA = boolSpec("autoOpen");

describe("px spec", () => {
  it("formats a stored px value; a no-cap value is the empty draft", () => {
    expect(px.format(600)).toBe("600");
    expect(px.format(null)).toBe("");
    expect(px.format(undefined)).toBe("");
    expect(px.format("nope")).toBe("");
  });

  it("parses drafts: empty is the explicit no-cap, positive whole numbers stand", () => {
    expect(px.parse("")).toEqual({ kind: "set", value: null });
    expect(px.parse("   ")).toEqual({ kind: "set", value: null });
    expect(px.parse("600")).toEqual({ kind: "set", value: 600 });
    expect(px.parse("007")).toEqual({ kind: "set", value: 7 });
  });

  it("refuses every draft the field does not accept", () => {
    expect(px.parse("0")).toBeUndefined();
    expect(px.parse("-5")).toBeUndefined();
    expect(px.parse("6.5")).toBeUndefined();
    expect(px.parse("1e3")).toBeUndefined();
    expect(px.parse("abc")).toBeUndefined();
  });
});

describe("bool spec", () => {
  it("formats booleans as the strings a switch stages, and parses only those", () => {
    expect(boolA.format(true)).toBe("true");
    expect(boolA.format(false)).toBe("false");
    expect(boolA.parse("true")).toEqual({ kind: "set", value: true });
    expect(boolA.parse("false")).toEqual({ kind: "set", value: false });
    expect(boolA.parse("1")).toBeUndefined();
    expect(boolA.parse("")).toBeUndefined();
  });
});

describe("FIELD_SPECS", () => {
  it("covers every field in the card's row order", () => {
    expect(FIELD_SPECS.map((s) => s.field)).toEqual(["autoOpen", "maxWidth", "maxHeight", "showEnvelope"]);
  });
});

describe("draft staging", () => {
  it("starts clean and keeps its revision fence", () => {
    const draft = createDraft(4);
    expect(isDirty(draft)).toBe(false);
    expect(draft.fence).toBe(4);
  });

  it("stages one edit per field; re-staging replaces and moves to the end", () => {
    let d: CardDraft = createDraft(1);
    d = stageEdit(d, { field: "maxWidth", text: "800", clear: false });
    d = stageEdit(d, { field: "autoOpen", text: "false", clear: false });
    d = stageEdit(d, { field: "maxWidth", text: "400", clear: false });
    expect(isDirty(d)).toBe(true);
    expect(d.edits.map((e) => e.field)).toEqual(["autoOpen", "maxWidth"]);
    expect(editOf(d, "maxWidth")).toEqual({ field: "maxWidth", text: "400", clear: false });
  });

  it("drops one edit, keeps the rest", () => {
    let d: CardDraft = createDraft(1);
    d = stageEdit(d, { field: "autoOpen", text: "false", clear: false });
    d = stageEdit(d, { field: "maxHeight", text: "100", clear: false });
    d = dropEdit(d, "autoOpen");
    expect(d.edits.map((e) => e.field)).toEqual(["maxHeight"]);
  });
});

describe("override marking (presence, not value)", () => {
  it("a user-layer entry marks the field overridden — even a null entry", () => {
    expect(fieldOverridden(null, "maxWidth")).toBe(false);
    expect(fieldOverridden({}, "maxWidth")).toBe(false);
    expect(fieldOverridden("str", "maxWidth")).toBe(false);
    expect(fieldOverridden([1], "maxWidth")).toBe(false);
    expect(fieldOverridden({ maxWidth: null }, "maxWidth")).toBe(true);
    expect(fieldOverridden({ maxWidth: null }, "maxHeight")).toBe(false);
  });

  it("the badge previews the save: a staged clear un-overrides, a staged edit over-rides", () => {
    expect(overriddenPreview(null, "maxHeight", { maxHeight: 800 })).toBe(true);
    expect(overriddenPreview(null, "maxHeight", {})).toBe(false);
    const clean = createDraft(1);
    expect(overriddenPreview(stageEdit(clean, { field: "maxHeight", text: "800", clear: false }), "maxHeight", {})).toBe(true);
    const overridden = createDraft(1);
    expect(
      overriddenPreview(stageEdit(overridden, { field: "maxHeight", text: "600", clear: true }), "maxHeight", {
        maxHeight: 800,
      }),
    ).toBe(false);
  });

  it("reset stages a clear (texted with the base) only when the user layer holds the field", () => {
    const withOverride = stageReset(createDraft(1), "maxHeight", pxH, { maxHeight: 800 }, section());
    expect(withOverride.edits).toEqual([{ field: "maxHeight", text: "600", clear: true }]);
    const without = stageReset(createDraft(1), "maxHeight", pxH, {}, section());
    expect(without.edits).toEqual([]);
    // Reset also drops a staged edit for the field.
    const staged = stageEdit(createDraft(1), { field: "maxHeight", text: "100", clear: false });
    const after = stageReset(staged, "maxHeight", pxH, { maxHeight: 800 }, section());
    expect(after.edits).toEqual([{ field: "maxHeight", text: "600", clear: true }]);
  });
});

describe("control display values", () => {
  const live = section({ maxWidth: null, maxHeight: 400, autoOpen: false });
  const base = section(); // the registered composition defaults
  const user = {};

  it("px controls show the staged text (even invalid text), a staged clear's base, else the live value", () => {
    expect(fieldState(null, px, live, base, user).text).toBe("");
    expect(fieldState(null, pxH, live, base, user).text).toBe("400");
    const text = stageEdit(createDraft(1), { field: "maxHeight", text: "100", clear: false });
    expect(fieldState(text, pxH, live, base, user).text).toBe("100");
    const clear = stageEdit(createDraft(1), { field: "maxHeight", text: "600", clear: true });
    expect(fieldState(clear, pxH, live, base, user).text).toBe("600"); // the default cap re-inherited
    expect(fieldState(clear, px, live, base, user).text).toBe(""); // base maxWidth is no-cap too
    const invalid = stageEdit(createDraft(1), { field: "maxHeight", text: "abc", clear: false });
    expect(fieldState(invalid, pxH, live, base, user).text).toBe("abc");
    expect(fieldState(invalid, pxH, live, base, user).invalid).toBe(true);
  });

  it("boolean controls show the staged toggle, a staged clear's base, else the live value", () => {
    expect(draftValue(null, boolA, live, base)).toBe(false);
    const on = stageEdit(createDraft(1), { field: "autoOpen", text: "true", clear: false });
    expect(draftValue(on, boolA, live, base)).toBe(true);
    const clear = stageEdit(createDraft(1), { field: "autoOpen", text: "true", clear: true });
    expect(draftValue(clear, boolA, live, base)).toBe(true); // base autoOpen is on
  });
});

describe("isNoOpEdit (the Undo gesture)", () => {
  const live = section(); // the defaults: autoOpen on, maxWidth no-cap, maxHeight 600
  const user = {};

  it("typing back to the displayed value of an inherited field is a no-op save", () => {
    expect(isNoOpEdit({ field: "maxHeight", text: "600", clear: false }, pxH, live, user)).toBe(true);
    expect(isNoOpEdit({ field: "maxHeight", text: "601", clear: false }, pxH, live, user)).toBe(false);
    expect(isNoOpEdit({ field: "maxWidth", text: "", clear: false }, px, live, user)).toBe(true); // no-cap = live
    expect(isNoOpEdit({ field: "autoOpen", text: "true", clear: false }, boolA, live, user)).toBe(true);
    expect(isNoOpEdit({ field: "autoOpen", text: "false", clear: false }, boolA, live, user)).toBe(false);
  });

  it("an override equal to the live value is NOT a no-op (the entry would stay)", () => {
    expect(isNoOpEdit({ field: "maxHeight", text: "600", clear: false }, pxH, live, { maxHeight: 600 })).toBe(false);
  });

  it("a clear is a no-op only when the field has no user-layer entry", () => {
    expect(isNoOpEdit({ field: "maxHeight", text: "", clear: true }, pxH, live, {})).toBe(true);
    expect(isNoOpEdit({ field: "maxHeight", text: "", clear: true }, pxH, live, { maxHeight: 800 })).toBe(false);
  });

  it("an invalid draft is never a no-op (the save is blocked, not cancelled)", () => {
    expect(isNoOpEdit({ field: "maxHeight", text: "abc", clear: false }, pxH, live, user)).toBe(false);
  });
});

describe("planOps", () => {
  it("plans staged edits in staging order; an empty draft plans nothing", () => {
    expect(planOps(createDraft(1), FIELD_SPECS)).toEqual({ ops: [], invalid: false });
  });

  it("maps edits to writes: text to set (empty = explicit no-cap), clear to unset", () => {
    let d: CardDraft = createDraft(7);
    d = stageEdit(d, { field: "showEnvelope", text: "false", clear: false });
    d = stageEdit(d, { field: "maxHeight", text: "", clear: false });
    d = stageEdit(d, { field: "maxWidth", text: "800", clear: false });
    d = stageEdit(d, { field: "autoOpen", text: "", clear: true });
    expect(planOps(d, FIELD_SPECS)).toEqual({
      ops: [
        { op: "set", path: ["showEnvelope"], value: false },
        { op: "set", path: ["maxHeight"], value: null },
        { op: "set", path: ["maxWidth"], value: 800 },
        { op: "unset", path: ["autoOpen"] },
      ],
      invalid: false,
    });
  });

  it("an unparseable px draft contributes no write and blocks the save", () => {
    let d: CardDraft = createDraft(1);
    d = stageEdit(d, { field: "showEnvelope", text: "false", clear: false });
    d = stageEdit(d, { field: "maxWidth", text: "abc", clear: false });
    const plan = planOps(d, FIELD_SPECS);
    expect(plan.invalid).toBe(true);
    expect(plan.ops).toEqual([{ op: "set", path: ["showEnvelope"], value: false }]);
  });
});
