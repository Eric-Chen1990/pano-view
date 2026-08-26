---
"@ericchen1990/pano-view": patch
---

Do not treat sticky user activation as autoplay permission. Optimistically activate when Web Audio is already running, but keep waiting for a real gesture if this attempt requested unmuted video and it stayed blocked.
