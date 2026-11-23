export type { HotspotChromaKey } from "../../../shared/chroma-key";
export { PanoDataError } from "./data/errors";
export type { PanoDataErrorCode } from "./data/errors";
export { sceneFromViewerConfig, loadSceneFromJson } from "./data/viewer";
export type {
  AssetUrlContext,
  AssetUrlResolver,
  JsonRequestOptions,
  SceneFromViewerConfigOptions,
  LoadSceneFromJsonOptions,
} from "./data/viewer";
export { parsePanoProject, loadPanoProject } from "./data/project";
export type {
  PanoProjectDefinition,
  PanoProjectSceneDefinition,
  LoadedPanoProject,
  LoadedProjectScene,
  LoadPanoProjectOptions,
} from "./data/project";
export type { ProjectHotspotDefinition, ProjectHotspotAction, ProjectHotspotTrigger, ProjectCustomHotspotAction, JsonObject, JsonValue } from "./data/hotspots";
export type { PortalHotspotDefinition } from "./hotspot/definitions";
export type { PortalHotspotFrame, PortalHotspotShape } from "./hotspot/portal-geometry";
export { resolveHotspotAssets as resolveProjectHotspotAssets } from "./data/hotspots";
export type {
  ViewerConfig,
  ViewerDocument,
  CubemapViewerConfig,
  SphereViewerConfig,
} from "../../../shared/viewer-config";

export { resolveProjectPopupAssets } from "./data/popups";
export type { ProjectPopupDefinition, ProjectPopupBlock, PopupAssetUrlContext, PopupAssetUrlResolver } from "./data/popups";

export { parsePanoMap, resolvePanoMapAssets } from "./data/map";
export type {
  PanoMapDefinition,
  PanoMapSpotDefinition,
  PanoMapSectorDefinition,
  PanoMapSectorGradient,
  PanoMapGradientStop,
  PanoMapControlsDefinition,
  PanoMapLength,
  PanoMapPresentation,
  PanoMapPanelPresentation,
  PanoMapDialogPresentation,
  PanoDragMotion,
} from "./data/map";

export { toLeveledPanoPosition, toSourcePanoPosition, type PanoLevelCorrection } from "./level-correction";
export type { PanoViewLimits } from "./view-limits";

export { hotspotAction, setHotspotAction, projectHotspotTriggers } from "./data/hotspots";

export { parsePanoGeoMap, resolvePanoGeoMapAssets, PANO_GEO_COORDINATE_SYSTEMS } from "./data/geo-map";
export type { PanoGeoMapDefinition, PanoGeoMapSpot, PanoGeoPosition, PanoGeoCoordinateSystem } from "./data/geo-map";
