import { describe, expect, it } from "vitest";
import { ImageSettingsSchema } from "../src/dsh/settings.js";
import { DEFAULT_IMAGE_SETTINGS } from "../src/types.js";

describe("ImageSettingsSchema (the write gate)", () => {
  it("resolves an absent section to the boolean defaults (px keys stay open for the base entry)", () => {
    expect(ImageSettingsSchema()).toEqual({
      enabled: DEFAULT_IMAGE_SETTINGS.enabled,
      autoOpen: DEFAULT_IMAGE_SETTINGS.autoOpen,
      showEnvelope: DEFAULT_IMAGE_SETTINGS.showEnvelope,
    });
  });

  it("resolves a partial section over the boolean defaults", () => {
    expect(ImageSettingsSchema({ enabled: false, maxWidth: 800 })).toEqual({
      enabled: false,
      autoOpen: DEFAULT_IMAGE_SETTINGS.autoOpen,
      showEnvelope: DEFAULT_IMAGE_SETTINGS.showEnvelope,
      maxWidth: 800,
    });
  });

  it("accepts an explicit null cap (no cap)", () => {
    expect(ImageSettingsSchema({ maxWidth: null, maxHeight: null }).maxWidth).toBeNull();
    expect(ImageSettingsSchema({ maxWidth: null, maxHeight: null }).maxHeight).toBeNull();
  });

  it("refuses wrong-typed fields where they are written", () => {
    expect(() => ImageSettingsSchema({ enabled: "yes" })).toThrow();
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
