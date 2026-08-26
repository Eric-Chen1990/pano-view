---
"@ericchen1990/pano-view": patch
---

Do not treat sticky user activation as autoplay permission. Optimistically activate when Web Audio is already running, but keep waiting for a real gesture only if this attempt requested video and autoplay policy still blocked it.
