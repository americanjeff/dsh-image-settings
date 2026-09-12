/**
 * dsh-image-settings — the settings card's locale dictionaries (shared by the
 * node and client builds: type-only import of the slots layer).
 *
 * The key union merges into the host's `LocaleNamespaceMap` below — the single
 * declaration that types the whole pipeline: `ctx.locale.register` checks the
 * dictionaries against it (a missing or extra key is a compile error), and the
 * slot entry's `locale:` option puts the framework-synthesized `t` seat on the
 * card's props typed to the same union. The dictionaries speak the stock
 * cards' own vocabulary (Save / Discard / Reset / "unsaved" pill) so the card
 * reads like a host card in either language.
 *
 * The `LocaleDictOf` import is load-bearing, not just for the dict types:
 * under NodeNext a module augmentation is only honored when the augmenting
 * file also imports the augmented module.
 */

import type { LocaleDictOf } from "@deepseek-ai/dsh-client-ui-slots";

export const IMAGE_SETTINGS_LOCALE_KEYS = {
  title: "title",
  description: "description",
  enabled: "enabled",
  autoOpen: "autoOpen",
  width: "width",
  height: "height",
  showEnvelope: "showEnvelope",
  showEnvelopeHint: "showEnvelopeHint",
  disabled: "disabled",
  noCap: "noCap",
  invalidPx: "invalidPx",
  overridden: "overridden",
  reset: "reset",
  save: "save",
  saving: "saving",
  saveFailed: "saveFailed",
  discard: "discard",
  unsaved: "unsaved",
  readOnly: "readOnly",
  drift: "drift",
  expand: "expand",
  collapse: "collapse",
} as const;

export type ImageSettingsLocaleKey =
  (typeof IMAGE_SETTINGS_LOCALE_KEYS)[keyof typeof IMAGE_SETTINGS_LOCALE_KEYS];

declare module "@deepseek-ai/dsh-client-ui-slots" {
  interface LocaleNamespaceMap {
    /** The image-settings card's copy (src/dsh/card-locale.ts). */
    "image-settings": ImageSettingsLocaleKey;
  }
}

export const en: LocaleDictOf<"image-settings"> = {
  title: "Image settings",
  description: "Control how images appear inline in the session.",
  enabled: "Enable plugin",
  autoOpen: "Auto-open images",
  width: "Width",
  height: "Height",
  showEnvelope: "Show text envelope",
  showEnvelopeHint: "Render the result's metadata (path, size, type) beside the image.",
  disabled: "Plugin disabled",
  noCap: "No cap",
  invalidPx: "Enter a positive whole number of pixels, or leave empty for no cap.",
  overridden: "custom",
  reset: "Reset",
  save: "Save",
  saving: "Saving…",
  saveFailed: "Save failed",
  discard: "Discard",
  unsaved: "unsaved",
  readOnly: "Settings are read-only in this deployment.",
  drift: "Settings changed while you were editing — the save will be refused. Discard to reload the current values.",
  expand: "Expand",
  collapse: "Collapse",
};

export const zh: LocaleDictOf<"image-settings"> = {
  title: "图像设置",
  description: "控制图像在会话中内联显示的方式。",
  enabled: "启用插件",
  autoOpen: "自动展开图像",
  width: "宽度",
  height: "高度",
  showEnvelope: "显示文本信封",
  showEnvelopeHint: "在图像旁渲染结果元数据（路径、尺寸、类型）。",
  disabled: "插件已禁用",
  noCap: "不限",
  invalidPx: "请输入正整数像素，或留空表示不限。",
  overridden: "已覆盖",
  reset: "重置",
  save: "保存",
  saving: "保存中…",
  saveFailed: "保存失败",
  discard: "放弃",
  unsaved: "未保存",
  readOnly: "当前部署中设置只读。",
  drift: "编辑期间设置已变更——保存将被拒绝。放弃以重新加载当前值。",
  expand: "展开",
  collapse: "收起",
};
