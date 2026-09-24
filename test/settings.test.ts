import { describe, expect, it } from "vitest";
import { ImageSettingsSchema } from "../src/dsh/settings.js";
import { DEFAULT_IMAGE_SETTINGS } from "../src/types.js";

/**
 * Unwrap a resolved value: `.volatile()` fields come back from the schema as
 * cosmokit live refs ({ get, [write] }) — the 0.1.7 hot-path shape the
 * loader hands to `apply`. The write gate itself (refusal below) is
 * unaffected: invalid values still throw where they are written.
 */
const plain = (value: unknown): unknown =>
  value !== null && typeof value === "object" && typeof (value as { get?: unknown }).get === "function"
    ? (value as { get: () => unknown }).get()
    : value;

describe("ImageSettingsSchema (the write gate)", () => {
  it("resolves an absent section to the boolean defaults (px keys stay open for the base entry)", () => {
    const section = ImageSettingsSchema();
    expect(plain(section.autoOpen)).toBe(DEFAULT_IMAGE_SETTINGS.autoOpen);
    expect(plain(section.showEnvelope)).toBe(DEFAULT_IMAGE_SETTINGS.showEnvelope);
  });

  it("resolves a partial section over the boolean defaults", () => {
    const section = ImageSettingsSchema({ maxWidth: 800 });
    expect(plain(section.autoOpen)).toBe(DEFAULT_IMAGE_SETTINGS.autoOpen);
    expect(plain(section.showEnvelope)).toBe(DEFAULT_IMAGE_SETTINGS.showEnvelope);
    expect(plain(section.maxWidth)).toBe(800);
  });

  it("accepts an explicit null cap (no cap)", () => {
    const section = ImageSettingsSchema({ maxWidth: null, maxHeight: null });
    expect(plain(section.maxWidth)).toBeNull();
    expect(plain(section.maxHeight)).toBeNull();
  });

  it("refuses wrong-typed fields where they are written", () => {
    expect(() => ImageSettingsSchema({ autoOpen: 1 })).toThrow();
    expect(() => ImageSettingsSchema({ showEnvelope: "no" })).toThrow();
  });

  it("refuses non-integer, non-positive px caps", () => {
    expect(() => ImageSettingsSchema({ maxWidth: 0 })).toThrow();
    expect(() => ImageSettingsSchema({ maxWidth: -5 })).toThrow();
    expect(() => ImageSettingsSchema({ maxWidth: 1.5 })).toThrow();
    expect(() => ImageSettingsSchema({ maxWidth: "600" })).toThrow();
    expect(() => ImageSettingsSchema({ maxHeight: "nope" })).toThrow();
  });
});
