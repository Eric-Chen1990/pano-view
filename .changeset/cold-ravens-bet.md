---
"@ericchen1990/pano-view": minor
---

Add view-relative vertical following to `WebVRSceneMenu`, with a new `followPitch` option enabled by default. Navigation smoothly follows head pitch, pauses during intentional aiming, and resumes after looking away. Prevent automatic recovery from locking at the reticle or triggering gaze actions, and keep complete controls inside both eye frustums, including when looking toward the floor.

Open compact, flat and arc scene menus at the current heading and pitch, keep them anchored while browsing, and reanchor navigation when closing. Use `followPitch={false}` to retain horizontal-only following or `follow={false}` for fixed navigation.
