export type SceneTransitionPreset =
  | "none"
  | "crossfade"
  | "zoom"
  | "blackout"
  | "whiteFlash"
  | "slideRightToLeft"
  | "slideTopToBottom"
  | "slideDiagonal"
  | "circleOpen"
  | "verticalOpen"
  | "horizontalOpen"
  | "ellipticZoomOpen"
  | "pixelate"
  | "gridWipe"
  | "gridWipeUp"
  | "gridWipeRight"
  | "gridWipeDiagonal"
  | "gridWipeCenter"
  | "gridWipeChecker"
  | "dissolve"
  | "shatter"
  | "particles"
  | "glitch"
  | "swirl"
  | "clockWipe"
  | "ripple"
  | "zoomBlur"
  | "hexDissolve"
  | "filmBurn";

export type SceneTransition =
  | SceneTransitionPreset
  | {
      preset: SceneTransitionPreset;
      /** Overrides the preset default duration in seconds. */
      duration?: number;
    };

export type TransitionDefinition = {
  preset: SceneTransitionPreset;
  duration: number;
};

export type SnapshotTransitionPreset = Exclude<SceneTransitionPreset, "none" | "particles">;

const TRANSITION_DEFAULTS: Record<SceneTransitionPreset, {
  duration: number;
  krpanoBlend: string;
}> = {
  none: { duration: 0, krpanoBlend: "NOBLEND" },
  crossfade: { duration: 1, krpanoBlend: "BLEND(1.0, easeInCubic)" },
  zoom: { duration: 2, krpanoBlend: "ZOOMBLEND(2.0, 2.0, easeInOutSine)" },
  blackout: { duration: 2, krpanoBlend: "COLORBLEND(2.0, 0x000000, easeOutSine)" },
  whiteFlash: { duration: 1, krpanoBlend: "LIGHTBLEND(1.0, 0xFFFFFF, 2.0, linear)" },
  slideRightToLeft: { duration: 1, krpanoBlend: "SLIDEBLEND(1.0, 0.0, 0.2, linear)" },
  slideTopToBottom: { duration: 1, krpanoBlend: "SLIDEBLEND(1.0, 90.0, 0.01, linear)" },
  slideDiagonal: { duration: 1, krpanoBlend: "SLIDEBLEND(1.0, 135.0, 0.4, linear)" },
  circleOpen: { duration: 1, krpanoBlend: "OPENBLEND(1.0, 0.0, 0.2, 0.0, linear)" },
  verticalOpen: { duration: 0.7, krpanoBlend: "OPENBLEND(0.7, 1.0, 0.1, 0.0, linear)" },
  horizontalOpen: { duration: 1, krpanoBlend: "OPENBLEND(1.0, -1.0, 0.3, 0.0, linear)" },
  ellipticZoomOpen: { duration: 1, krpanoBlend: "OPENBLEND(1.0, -0.5, 0.3, 0.8, linear)" },
  pixelate: { duration: 1, krpanoBlend: "pano-view cinematic" },
  gridWipe: { duration: 1.2, krpanoBlend: "pano-view cinematic" },
  gridWipeUp: { duration: 1.2, krpanoBlend: "pano-view cinematic" },
  gridWipeRight: { duration: 1.2, krpanoBlend: "pano-view cinematic" },
  gridWipeDiagonal: { duration: 1.2, krpanoBlend: "pano-view cinematic" },
  gridWipeCenter: { duration: 1.2, krpanoBlend: "pano-view cinematic" },
  gridWipeChecker: { duration: 1.2, krpanoBlend: "pano-view cinematic" },
  dissolve: { duration: 1, krpanoBlend: "pano-view cinematic" },
  shatter: { duration: 1.2, krpanoBlend: "pano-view cinematic" },
  particles: { duration: 1.4, krpanoBlend: "pano-view cinematic" },
  glitch: { duration: 0.8, krpanoBlend: "pano-view cinematic" },
  swirl: { duration: 1.2, krpanoBlend: "pano-view cinematic" },
  clockWipe: { duration: 1, krpanoBlend: "pano-view cinematic" },
  ripple: { duration: 1.2, krpanoBlend: "pano-view cinematic" },
  zoomBlur: { duration: 1, krpanoBlend: "pano-view cinematic" },
  hexDissolve: { duration: 1.1, krpanoBlend: "pano-view cinematic" },
  filmBurn: { duration: 1.3, krpanoBlend: "pano-view cinematic" },
};

export function resolveTransition(transition: SceneTransition | undefined): TransitionDefinition {
  const preset = typeof transition === "string" ? transition : transition?.preset ?? "crossfade";
  return {
    preset,
    duration: Math.max(
      0,
      transition && typeof transition === "object" && Number.isFinite(transition.duration)
        ? transition.duration!
        : TRANSITION_DEFAULTS[preset].duration,
    ),
  };
}

export function isParticleTransition(preset: SceneTransitionPreset): preset is "particles" {
  return preset === "particles";
}

export function isSnapshotTransition(preset: SceneTransitionPreset): preset is SnapshotTransitionPreset {
  return preset !== "none" && preset !== "particles";
}
