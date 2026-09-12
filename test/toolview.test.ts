import { describe, expect, it } from "vitest";
import {
  imageAttachmentRefs,
  imageCaption,
  readImagePath,
  sectionOf,
  shouldRegisterReadImageView,
  textBlocksOf,
} from "../src/dsh/toolview.js";
import { DEFAULT_IMAGE_SETTINGS } from "../src/types.js";

describe("imageAttachmentRefs", () => {
  it("extracts image refs in content order", () => {
    const refA = { attachmentId: "sha256:a", name: "a.png", width: 10, height: 20 };
    const refB = { attachmentId: "sha256:b" };
    const content = [
      { type: "text", text: "envelope" },
      { type: "image", attachment: refA },
      { type: "reasoning", text: "not an image" },
      { type: "image", attachment: refB },
    ];
    expect(imageAttachmentRefs(content)).toEqual([refA, refB]);
  });

  it("skips blocks without a usable attachment ref", () => {
    const content = [
      { type: "image" }, // no attachment
      { type: "image", attachment: "nope" }, // non-object attachment
      { type: "image", attachment: {} }, // missing attachmentId
      { type: "image", attachment: { attachmentId: "" } }, // empty attachmentId
      { type: "image", attachment: { attachmentId: 42 } }, // non-string attachmentId
      "junk", // non-object block
      42, // non-object block
    ];
    expect(imageAttachmentRefs(content)).toEqual([]);
  });

  it("is lenient on non-array content", () => {
    expect(imageAttachmentRefs(undefined)).toEqual([]);
    expect(imageAttachmentRefs("nope")).toEqual([]);
    expect(imageAttachmentRefs({})).toEqual([]);
  });
});

describe("textBlocksOf", () => {
  it("joins text blocks with newlines, in order", () => {
    const content = [
      { type: "text", text: "<path>/x.png</path>" },
      { type: "image", attachment: { attachmentId: "sha256:a" } },
      { type: "text", text: "<type>image</type>" },
    ];
    expect(textBlocksOf(content)).toBe("<path>/x.png</path>\n<type>image</type>");
  });

  it("never joins reasoning blocks (they carry a text field too)", () => {
    const content = [{ type: "reasoning", text: "thinking" }, { type: "text", text: "out" }];
    expect(textBlocksOf(content)).toBe("out");
  });

  it("skips malformed blocks and is lenient on non-array content", () => {
    expect(textBlocksOf([{ type: "text" }, { type: "text", text: 42 }, "junk"])).toBe("");
    expect(textBlocksOf(undefined)).toBe("");
    expect(textBlocksOf(null)).toBe("");
  });
});

describe("imageCaption", () => {
  it("carries the name plus intrinsic dimensions", () => {
    expect(imageCaption({ attachmentId: "sha256:a", name: "screenshot.png", width: 120, height: 80 })).toBe(
      "screenshot.png · 120×80",
    );
  });

  it("falls back to 'image' and omits partial dimensions", () => {
    expect(imageCaption({ attachmentId: "sha256:a" })).toBe("image");
    // empty name + partial dimensions → plain fallback
    expect(imageCaption({ attachmentId: "sha256:a", name: "", width: 120 })).toBe("image");
    // absent name + complete dimensions → the fallback label still carries them
    expect(imageCaption({ attachmentId: "sha256:a", width: 120, height: 80 })).toBe("image · 120×80");
  });
});

describe("readImagePath", () => {
  it("reads file_path (and the path fallback) from raw JSON args", () => {
    expect(readImagePath(JSON.stringify({ file_path: "/x/a.png" }))).toBe("/x/a.png");
    expect(readImagePath(JSON.stringify({ path: "/x/b.png" }))).toBe("/x/b.png");
    // file_path wins when both are present
    expect(readImagePath(JSON.stringify({ file_path: "/x/a.png", path: "/x/b.png" }))).toBe("/x/a.png");
  });

  it("yields undefined on malformed or path-less args", () => {
    expect(readImagePath("")).toBeUndefined();
    expect(readImagePath("not json")).toBeUndefined();
    expect(readImagePath(JSON.stringify({ other: 1 }))).toBeUndefined();
    expect(readImagePath(JSON.stringify({ file_path: "" }))).toBeUndefined();
    expect(readImagePath(JSON.stringify({ file_path: 42 }))).toBeUndefined();
    expect(readImagePath(undefined)).toBeUndefined();
    expect(readImagePath(42)).toBeUndefined();
  });
});

describe("shouldRegisterReadImageView", () => {
  it("defaults ON for an absent or malformed section", () => {
    expect(shouldRegisterReadImageView(undefined)).toBe(true);
    expect(shouldRegisterReadImageView(null)).toBe(true);
    expect(shouldRegisterReadImageView({})).toBe(true);
    expect(shouldRegisterReadImageView({ enabled: "yes" })).toBe(true);
    expect(shouldRegisterReadImageView("image-settings")).toBe(true);
  });

  it("registers on explicit true and steps aside on explicit false only", () => {
    expect(shouldRegisterReadImageView({ enabled: true })).toBe(true);
    expect(shouldRegisterReadImageView({ enabled: false })).toBe(false);
  });
});

describe("sectionOf", () => {
  it("fills every default for an absent section", () => {
    expect(sectionOf(undefined)).toEqual(DEFAULT_IMAGE_SETTINGS);
    expect(sectionOf(null)).toEqual(DEFAULT_IMAGE_SETTINGS);
    expect(sectionOf({})).toEqual(DEFAULT_IMAGE_SETTINGS);
    expect(sectionOf("nope")).toEqual(DEFAULT_IMAGE_SETTINGS);
  });

  it("keeps valid fields, one at a time", () => {
    expect(sectionOf({ enabled: false })).toEqual({ ...DEFAULT_IMAGE_SETTINGS, enabled: false });
    expect(sectionOf({ autoOpen: false })).toEqual({ ...DEFAULT_IMAGE_SETTINGS, autoOpen: false });
    expect(sectionOf({ maxWidth: 800 })).toEqual({ ...DEFAULT_IMAGE_SETTINGS, maxWidth: 800 });
    expect(sectionOf({ maxHeight: 1200 })).toEqual({ ...DEFAULT_IMAGE_SETTINGS, maxHeight: 1200 });
    expect(sectionOf({ showEnvelope: false })).toEqual({ ...DEFAULT_IMAGE_SETTINGS, showEnvelope: false });
  });

  it("preserves an explicit null cap (no cap) — distinct from an absent one", () => {
    const d = DEFAULT_IMAGE_SETTINGS;
    expect(sectionOf({ maxWidth: null })).toEqual({ ...d, maxWidth: null });
    expect(sectionOf({ maxHeight: null })).toEqual({ ...d, maxHeight: null });
    // an absent maxHeight still resolves to the default cap
    expect(sectionOf({ maxWidth: null }).maxHeight).toBe(d.maxHeight);
  });

  it("falls back to the default per malformed px field (0, negative, fractional, non-number)", () => {
    for (const bad of [0, -5, 1.5, "600", ""]) {
      expect(sectionOf({ maxWidth: bad }).maxWidth).toBe(DEFAULT_IMAGE_SETTINGS.maxWidth);
      expect(sectionOf({ maxHeight: bad }).maxHeight).toBe(DEFAULT_IMAGE_SETTINGS.maxHeight);
    }
  });

  it("falls back to the default per malformed boolean field", () => {
    for (const bad of ["true", 0, 1, null]) {
      expect(sectionOf({ enabled: bad }).enabled).toBe(DEFAULT_IMAGE_SETTINGS.enabled);
      expect(sectionOf({ autoOpen: bad }).autoOpen).toBe(DEFAULT_IMAGE_SETTINGS.autoOpen);
      expect(sectionOf({ showEnvelope: bad }).showEnvelope).toBe(DEFAULT_IMAGE_SETTINGS.showEnvelope);
    }
  });
});
