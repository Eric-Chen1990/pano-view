---
"@ericchen1990/pano-view": minor
---

Improve AutoRotate startup: signed speed ramps for acceleration, deceleration, and reverse; yaw speed scales with FOV for consistent screen motion; and each start (including after interaction) eases FOV back to the initial view in parallel with the speed ramp, with an optional `fov` override or `false` to disable restore.
