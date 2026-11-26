---
"@ericchen1990/pano-view": minor
---

AutoRotate waits `resumeDelay` (default 3000ms) after user interaction or completed lookTo/moveTo/zoomTo before starting or resuming. Pass `resumeDelay={0}` for the previous immediate resume, or `false` to stop after user interaction until `enabled` is toggled again (navigation still resumes after the default delay). Completed navigations keep their FOV; user-driven resumes still restore FOV. Inside Scenes, FOV restore targets the current scene's initialView.fov. Legacy `controls.autoRotate` follows the same rules.
