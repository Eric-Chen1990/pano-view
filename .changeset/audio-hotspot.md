---
"@ericchen1990/pano-view": minor
---

Add `AudioHotspot` for directional panorama sound sources. Playback uses bundled Howler.js (hosts do not install `howler`); look-away `range` fades volume and stereo pan follows the camera. Hosts with exhaustive switches over `HotspotDefinition` need to handle `audio`.
