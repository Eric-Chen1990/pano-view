import type { FieldSpec } from "./fields";

const descriptions: Record<string, { label: string; help: string }> = {
  visible: {
    label: "Show hotspot",
    help: "Controls whether visitors can see this hotspot.",
  },
  interactive: {
    label: "Enable interaction",
    help: "Allows pointer and keyboard interaction. Turning this off also disables hover and click tooltips.",
  },
  pointerEvents: {
    label: "Pointer interaction",
    help: "Receive mouse, touch and pen events, or pass them through to the panorama. Requires interaction to be enabled.",
  },
  renderOrder: {
    label: "Drawing order",
    help: "Higher numbers draw later. Depth and material settings can still affect overlap. Negative values and decimals are allowed.",
  },
  cursor: {
    label: "Hover cursor",
    help: "Choose a standard cursor or a local PNG image up to 32 × 32 pixels. The image is included in the project package.",
  },
  yaw: {
    label: "Horizontal angle (°)",
    help: "Horizontal angle in degrees. Positive values point right; negative values point left.",
  },
  pitch: {
    label: "Vertical angle (°)",
    help: "Vertical angle from -90° to 90°. Positive values point up; negative values point down.",
  },
  width: {
    label: "Angular width (°)",
    help: "Hotspot width in panorama degrees, greater than zero. This is not a pixel measurement.",
  },
  height: {
    label: "Angular height (°)",
    help: "Hotspot height in panorama degrees, greater than zero. This is not a pixel measurement.",
  },
  scale: {
    label: "Size multiplier",
    help: "Multiplies width and height. Use 1 for the original size; must be greater than zero.",
  },
  rotation: {
    label: "Rotation (°)",
    help: "Clockwise rotation in degrees around the hotspot center. Negative values rotate counterclockwise.",
  },
  opacity: {
    label: "Opacity",
    help: "A value from 0 (fully transparent) to 1 (fully opaque).",
  },
  distance: {
    label: "Camera distance",
    help: "World-space distance from the camera in floating mode. Must be greater than zero; the viewer may cap it to keep the hotspot inside the panorama.",
  },
  mode: {
    label: "Placement mode",
    help: "Attach the hotspot to the panorama surface, or float it inside the panorama facing the camera.",
  },
  scaleMode: {
    label: "Size when zooming",
    help: "Scale with panorama zoom, or keep a fixed screen size based on the reference field of view.",
  },
  referenceFov: {
    label: "Reference field of view (°)",
    help: "Reference vertical field of view for fixed screen size. Must be greater than zero; used only in fixed size mode.",
  },
  frameCount: {
    label: "Sprite frame count",
    help: "Number of frames in the sprite sheet. Enter a positive whole number within the safe integer range.",
  },
  fps: {
    label: "Frames per second",
    help: "Animation playback speed in frames per second. Must be greater than zero; decimals are allowed.",
  },
  frameDirection: {
    label: "Sprite layout",
    help: "Whether frames run horizontally across the sprite sheet or vertically down it.",
  },
  playing: {
    label: "Play initially",
    help: "Requests playback when this hotspot loads. Browsers may require a visitor gesture before playing media, especially with sound.",
  },
  loop: {
    label: "Loop playback",
    help: "Restarts playback after the media or animation reaches its end.",
  },
  muted: {
    label: "Mute sound",
    help: "Plays media without sound. The volume setting is retained.",
  },
  volume: {
    label: "Volume (0–1)",
    help: "Playback volume from 0 (silent) to 1 (full volume).",
  },
  playsInline: {
    label: "Play video inline",
    help: "Requests video playback inside the hotspot instead of a separate fullscreen player on supported mobile browsers.",
  },
  preload: {
    label: "Media preloading",
    help: "Choose whether to preload nothing, metadata only, or media data. The browser makes the final loading decision.",
  },
  crossOrigin: {
    label: "Cross-origin credentials",
    help: "Controls credentials for media from another origin. The resource server must allow the corresponding CORS requests.",
  },
  range: {
    label: "Look-away range (°)",
    help: "Controls how audio fades as you look away from the hotspot. 360 disables this directional attenuation.",
  },
  marker: {
    label: "Show audio marker",
    help: "Shows the audio hotspot icon. Hiding the icon does not stop audio playback.",
  },
  pauseWhenHidden: {
    label: "Pause when hidden",
    help: "Pauses audio while the hotspot is hidden.",
  },
  format: {
    label: "Audio format hints",
    help: "Optional format hints such as mp3 or ogg, one per line in source order. Useful for URLs without a file extension.",
  },
  fontFamily: {
    label: "Font family",
    help: "CSS font family or fallback list. Fonts must be available on the device or loaded by the host page.",
  },
  fontSize: {
    label: "Texture font size (px)",
    help: "Font size in canvas texture pixels, greater than zero. The on-screen size also depends on hotspot size and zoom.",
  },
  fontWeight: {
    label: "Font weight",
    help: "CSS font weight, such as normal, bold or a numeric weight supported by the font.",
  },
  fontStyle: { label: "Font style", help: "Draw text normally or in italic." },
  color: {
    label: "Text color",
    help: "Accepts CSS colors, including named colors, hex, rgb() and rgba().",
  },
  background: {
    label: "Background color",
    help: "Accepts CSS colors, including transparent.",
  },
  backgroundOpacity: {
    label: "Background opacity",
    help: "Background opacity from 0 (transparent) to 1 (opaque). Does not change the text opacity.",
  },
  padding: {
    label: "Text padding ratio",
    help: "Padding as a fraction of the texture’s shorter side. For example, 0.08 means 8%.",
  },
  lineHeight: {
    label: "Line height multiplier",
    help: "Line spacing relative to font size. For example, 1.25 means 1.25 times the font size; must be greater than zero.",
  },
  borderRadius: {
    label: "Text corner ratio",
    help: "Corner radius as a fraction of the texture’s shorter side. Rendering limits it to 0–0.5.",
  },
  align: {
    label: "Horizontal text alignment",
    help: "Align text to the left, center or right inside its hotspot.",
  },
  verticalAlign: {
    label: "Vertical text alignment",
    help: "Align text to the top, middle or bottom inside its hotspot.",
  },
  whiteSpace: {
    label: "Text wrapping",
    help: "Wrap text to fit the hotspot width, or keep each entered line unwrapped.",
  },
  fill: { label: "Fill color", help: "CSS color used to fill the shape." },
  fillOpacity: {
    label: "Fill opacity",
    help: "Shape fill opacity from 0 (transparent) to 1 (opaque).",
  },
  stroke: { label: "Outline color", help: "CSS color used for the outline." },
  strokeWidth: {
    label: "Outline width",
    help: "Outline width in CSS pixels for polygons and lines, or canvas texture pixels for text and graphics.",
  },
  strokeOpacity: {
    label: "Outline opacity",
    help: "Outline opacity from 0 (transparent) to 1 (opaque).",
  },
  strokeDashSize: {
    label: "Dash length (px)",
    help: "Length of each dash in CSS pixels. Positive values enable a dashed outline.",
  },
  strokeGapSize: {
    label: "Dash gap (px)",
    help: "Gap between dashes in CSS pixels. When unset, the dash length is used.",
  },
  title: {
    label: "Embedded page title",
    help: "Accessible name for the embedded page, used by screen readers.",
  },
  sandbox: {
    label: "Embedded page sandbox",
    help: "Space-separated iframe sandbox permissions, such as allow-scripts. Leave unset to use the viewer default.",
  },
  allow: {
    label: "Embedded feature permissions",
    help: "Iframe feature permissions, such as fullscreen. Availability also depends on the browser and host page.",
  },
  referrerPolicy: {
    label: "Referrer sharing",
    help: "Controls how much of the referring page URL is sent when loading the embedded page. Leave unset to use the viewer default.",
  },
  loading: {
    label: "Embedded page loading",
    help: "Load the embedded page immediately, or let the browser defer loading until it is near the viewport.",
  },
  pointerPolicy: {
    label: "Embedded page interaction",
    help: "Send pointer events to the hotspot for panorama actions, or to the embedded page so visitors can use its controls.",
  },
  tooltipTrigger: {
    label: "Show visitor tooltip",
    help: "Choose always visible, hover or focus, or click. Hover and click require hotspot interaction and pointer events.",
  },
  tooltipPlacement: {
    label: "Visitor tooltip position",
    help: "Screen direction of the tooltip relative to the hotspot.",
  },
  tooltipOffset: {
    label: "Visitor tooltip gap (px)",
    help: "Gap in CSS pixels between the hotspot edge and its tooltip.",
  },
  "tooltip.imageAlt": {
    label: "Tooltip image description",
    help: "Text describing the tooltip image for visitors using screen readers.",
  },
  tooltipAppearance: {
    label: "Visitor tooltip style (JSON)",
    help: "Advanced tooltip styling as JSON. Unset properties use the default theme; numeric lengths are generally CSS pixels.",
  },
  "graphic.kind": {
    label: "Shape type",
    help: "Choose a built-in shape, an SVG resource, or a custom SVG path.",
  },
  "graphic.cornerRadius": {
    label: "Rectangle corner ratio",
    help: "Relative rectangle corner radius. Rendering limits it to 0–0.5.",
  },
  "graphic.innerRadius": {
    label: "Ring inner radius ratio",
    help: "Inner radius relative to the outer radius. For example, 0.58 means 58%; the renderer keeps the inner edge inside the ring.",
  },
  "graphic.path": {
    label: "SVG path",
    help: "SVG path commands defining the custom shape. Coordinates are interpreted using the viewBox.",
  },
  "graphic.viewBox": {
    label: "SVG coordinate bounds",
    help: "Four JSON numbers: [x, y, width, height]. Width and height must be greater than zero.",
  },
};

const positive = new Set([
  "width",
  "height",
  "scale",
  "distance",
  "referenceFov",
  "frameCount",
  "fps",
  "fontSize",
  "lineHeight",
]);
const unitInterval = new Set([
  "opacity",
  "fillOpacity",
  "strokeOpacity",
  "backgroundOpacity",
  "volume",
]);
const optionLabels: Record<string, string> = {
  auto: "Receive pointer events",
  none: "Pass through to panorama",
  surface: "On panorama surface",
  billboard: "Floating, facing camera",
  fov: "Scale with zoom",
  fixed: "Fixed screen size",
  horizontal: "Across the image",
  vertical: "Down the image",
  hotspot: "Interact with hotspot",
  content: "Interact with embedded page",
  eager: "Load immediately",
  lazy: "Defer loading",
  normal: "Normal",
  italic: "Italic",
  nowrap: "Do not wrap",
  left: "Left",
  center: "Center",
  right: "Right",
  top: "Above",
  middle: "Middle",
  bottom: "Below",
  anonymous: "Without cross-origin credentials",
  "use-credentials": "Include credentials",
  circle: "Circle",
  triangle: "Triangle",
  diamond: "Diamond",
  star: "Star",
  arrow: "Arrow",
  rectangle: "Rectangle",
  ring: "Ring",
  svg: "SVG resource",
  path: "Custom SVG path",
};

/** Only hotspot inspectors opt into these authoring constraints. */
export function hotspotFieldSpec(spec: FieldSpec): FieldSpec {
  const name = spec.name.replace(/^position\./, "");
  const description =
    descriptions[name] ??
    (name.startsWith("graphic.") ? descriptions[name.slice(8)] : undefined);
  let number: FieldSpec["number"];
  if (spec.type === "number") {
    number = {};
    if (positive.has(name)) number.exclusiveMin = 0;
    if (unitInterval.has(name)) {
      number.min = 0;
      number.max = 1;
    }
    if (name === "pitch") {
      number.min = -90;
      number.max = 90;
    }
    if (name === "frameCount") {
      number.integer = true;
      number.required = true;
      number.min = 1;
      number.max = Number.MAX_SAFE_INTEGER;
    }
    if (["yaw", "pitch"].includes(name)) number.required = true;
  }
  let labels = optionLabels;
  if (name === "preload")
    labels = {
      none: "No preloading",
      metadata: "Metadata only",
      auto: "Preload media",
    };
  if (name === "whiteSpace")
    labels = { normal: "Wrap to fit", nowrap: "Do not wrap" };
  if (["align", "verticalAlign"].includes(name))
    labels = {
      left: "Left",
      center: "Center",
      right: "Right",
      top: "Top",
      middle: "Middle",
      bottom: "Bottom",
    };
  if (name === "referrerPolicy")
    labels = {
      "no-referrer": "Never send referrer",
      "no-referrer-when-downgrade": "Full URL except on HTTPS downgrade",
      origin: "Origin only",
      "origin-when-cross-origin":
        "Full URL on same origin; origin across sites",
      "same-origin": "Full URL on same origin only",
      "strict-origin": "Origin except on HTTPS downgrade",
      "strict-origin-when-cross-origin":
        "Full URL on same origin; safe origin across sites",
      "unsafe-url": "Always send full URL",
    };
  return {
    ...spec,
    ...description,
    number,
    optionLabels: { ...labels, ...spec.optionLabels },
  };
}
