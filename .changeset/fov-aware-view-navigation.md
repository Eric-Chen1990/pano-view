---
"@ericchen1990/pano-view": minor
---

Make imperative view navigation FOV-aware when `duration` is omitted: duration scales with angular distance and field of view. The default profile accelerates from rest, cruises at 0.8 viewport heights per second, then decelerates to a stop (`acceleration` 1.2, `deceleration` 0.8). Per-call `speed` / `flyOut` and a viewer `navigation` defaults prop override this, and `prefers-reduced-motion` jumps immediately.
