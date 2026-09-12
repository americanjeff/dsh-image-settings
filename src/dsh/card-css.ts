/**
 * dsh-image-settings — the settings card's stylesheet (browser bundle).
 *
 * Rule-for-rule copies of the stock plugin-card modules (dsh-client-ui-settings-plugins
 * 0.1.5-rc.2: PluginCard.module.css + fields.module.css) re-prefixed `.dis_`,
 * plus the slider switch the host's own toggles use (SubagentModelSelectionCard:
 * a 36×20 track whose 16px thumb slides 16px, off = border-l3, on = brand).
 * The client-bundle purity gate forbids cross-plugin VALUE imports, so a
 * third-party card carries the same rules under its own prefix — the pattern
 * the stock cards' own tokens already assume: every color is a
 * `--dsw-alias-*` variable the web shell defines per theme, so the card
 * follows light/dark automatically.
 *
 * Injected once per page as a `<style>` tag (idempotent, tagged with the
 * plugin's data attributes for the shell's plugin-CSS bookkeeping).
 */

export const CARD_CSS = [
  /* ── PluginCard.module.css (card shell) ─────────────────────────────── */
  ".dis_card{border:0.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-3);border-radius:16px;list-style:none;transition:border-color .16s,background .16s}",
  ".dis_card:hover{border-color:var(--dsw-alias-label-dimmed)}",
  ".dis_cardOpen{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}",
  ".dis_header{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}",
  ".dis_header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}",
  ".dis_headText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}",
  ".dis_name{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}",
  ".dis_description{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.5}",
  ".dis_chevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}",
  ".dis_chevronOpen{transform:rotate(180deg)}",
  /* The stock pending Tag capsule (ui-primitives Tag: geometry + palette). */
  ".dis_pending{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;corner-shape:round;flex:none;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}",
  ".dis_body{border-top:0.5px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}",
  ".dis_readOnly{color:var(--dsw-alias-label-tertiary);margin:12px 0 0;font-size:12px;line-height:1.5}",
  ".dis_footer{border-top:0.5px solid var(--dsw-alias-border-l2);justify-content:flex-end;align-items:center;gap:8px;padding:12px 0 4px;display:flex}",
  ".dis_failed{min-width:0;color:var(--dsw-alias-label-error);flex:1;margin:0;font-size:12px;line-height:1.5}",
  ".dis_discard,.dis_save{appearance:none;font:inherit;cursor:pointer;border:1px solid transparent;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5}",
  ".dis_discard{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0}",
  ".dis_discard:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}",
  /* The stock save button is inverted mono (label on layer), not blue. */
  ".dis_save{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}",
  ".dis_discard:disabled,.dis_save:disabled{opacity:.4;cursor:default}",
  ".dis_discard:focus-visible,.dis_save:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}",
  /* ── fields.module.css (field rows) ─────────────────────────────────── */
  ".dis_field{flex-direction:column;gap:6px;padding:12px 0;display:flex}",
  ".dis_field+.dis_field{border-top:0.5px solid var(--dsw-alias-border-l2)}",
  ".dis_head{align-items:center;gap:8px;display:flex}",
  /* Field labels are medium (the official fields module); toggle-row labels are plain. */
  ".dis_label{min-width:0;color:var(--dsw-alias-label-primary);flex:1;font-size:13px;font-weight:500;line-height:1.5}",
  ".dis_labelPlain{font-weight:400}",
  ".dis_badges{align-items:center;gap:8px;display:inline-flex}",
  ".dis_badge{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}",
  ".dis_reset{font:inherit;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;padding:0;font-size:12px;line-height:1.5}",
  ".dis_reset:hover:not(:disabled){color:var(--dsw-alias-label-primary)}",
  ".dis_reset:disabled{cursor:default}",
  ".dis_input{border:0.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-3);height:34px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5;width:100%;box-sizing:border-box}",
  ".dis_input:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}",
  ".dis_input:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}",
  /* Invalid input keeps the base rule and adds the error border (both classes applied). */
  ".dis_inputInvalid{border-color:var(--dsw-alias-label-error)}",
  ".dis_invalid{color:var(--dsw-alias-label-error);margin:0;font-size:12px;line-height:1.5}",
  ".dis_hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:1.5}",
  /* ── slider switch (the host's own toggles) ─────────────────────────── */
  ".dis_switch{box-sizing:border-box;position:relative;flex:0 0 auto;width:36px;height:20px;padding:2px;border:0;border-radius:10px;background:var(--dsw-alias-border-l3);cursor:pointer}",
  ".dis_switchOn{background:var(--dsw-alias-brand-primary)}",
  ".dis_switch:disabled{cursor:default;opacity:0.5}",
  ".dis_switch:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}",
  ".dis_thumb{display:block;width:16px;height:16px;border-radius:50%;corner-shape:round;background:var(--dsw-alias-label-primary-foreground);transition:transform 120ms ease}",
  ".dis_switchOn .dis_thumb{transform:translateX(16px)}",
].join("");

const STYLE_TAG_ID = "dsh-image-settings/card.css";

/**
 * Inject the card's stylesheet once per page (idempotent; a second call finds
 * the existing tag and no-ops). No-op outside a DOM (node half, tests).
 */
export function injectCardStyles(): void {
  if (typeof document === "undefined") return;
  if (document.querySelector(`style[data-plugin-css="${STYLE_TAG_ID}"]`) !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-image-settings";
  tag.dataset.pluginCss = STYLE_TAG_ID;
  tag.textContent = CARD_CSS;
  document.head.appendChild(tag);
}
