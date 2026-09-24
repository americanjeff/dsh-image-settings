# Changelog

## [0.1.1] - 2026-09-23

- Removed the card's "Enable plugin" toggle: the plugin's `read_image` view is now turned on or off only from the host's plugin management.
- Migration: `enabled:` under `image-settings:` is now inert and can be dropped; if you had set `enabled: false`, disable dsh-image-settings in the host's plugin management instead.

## [0.1.0] - 2026-09-12

- First release: `read_image` results render inline in dsh web sessions at the row's available width (auto-unrolled by default), tunable live from the Image settings card (`image-settings:` section of `settings.yaml`): width/height caps, auto-open, text envelope.
