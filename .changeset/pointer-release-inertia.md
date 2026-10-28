---
"@ericchen1990/pano-view": patch
---

Discard stale drag velocity on release and stop inertia when touch or mouse input is cancelled or loses pointer capture. Keep fresh drag flicks and camera smoothing, while avoiding additional synthetic inertia on wheel and trackpad zoom.
