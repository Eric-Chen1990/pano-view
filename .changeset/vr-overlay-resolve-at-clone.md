---
"@ericchen1990/pano-view": patch
---

Resolve spatial overlay roots at clone time (and again after the body snapshot) so markers that mount during the async HTML capture are hidden from the dialog bitmap and still receive a foreground layer. This prevents host model markers from briefly appearing behind the live model canvas in VR.
