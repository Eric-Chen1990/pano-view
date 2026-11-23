import { SceneLoadSourceContext, useStandaloneSceneLoad } from "../scene-load-progress";
import { fitImageTexture, getTextureAnisotropy } from "../renderer-capabilities";
import { cameraInSourceSpace, useLevelRotation } from "../level-rotation";
import { useFrame, useThree } from "@react-three/fiber";
import { CompareHostContext, CompareSourceSideContext } from "../compare/view";
import { memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { BackSide, Frustum, Matrix4, PerspectiveCamera, Texture, type Box3, type Group } from "three";
import { resolveAssetUrl } from "../asset-url";
import { useLittlePlanetSource } from "../little-planet/host";
import { PanoBasicMaterial } from "../pano-filter/pano-basic-material";
import {
  publishSceneDetail,
  useSceneDetailReporter,
  viewTilesAreDrawable,
} from "../scene-detail";
import {
  mipmappedTextureBytes,
  TileTextureManager,
} from "../tile/texture-manager";
import { useSharedTileTextureManager } from "../tile/texture-manager-context";
import { configureTilePreviewTexture, useManagedTexture } from "../tile/texture-hooks";
import { usePreviewTexture } from "../preview-texture";
import { DEFAULT_PANORAMA_RADIUS } from "../panorama-radius";
import {
  parseSphereMultires,
  preferredSphereLevel,
  resolveSphereTemplateUrl,
  sphereTileAddresses,
  sphereTileBounds,
  sphereTileGeometry,
  sphereTileKey,
} from "./layout";
import type {
  SphereTileAddress,
  SphereTileMultiresConfig,
  SphereTileProps,
} from "./types";

type Layer = { level: number; addresses: SphereTileAddress[] };
type Candidate = { address: SphereTileAddress; bounds: Box3 };

function collectLayerAddresses(
  candidates: Candidate[],
  budget: number,
  includes: (bounds: Box3) => boolean,
) {
  const addresses: SphereTileAddress[] = [];
  let bytes = 0;
  for (const { address, bounds } of candidates) {
    if (!includes(bounds)) continue;
    bytes += mipmappedTextureBytes(address.width, address.height);
    if (bytes > budget) return null;
    addresses.push(address);
  }
  return { addresses, bytes };
}

export function selectSphereTileLayers({
  candidates,
  preferredLevel,
  budget,
  visibleFrustum,
  paddedFrustum,
  keepBase,
}: {
  candidates: Candidate[][];
  preferredLevel: number;
  budget: number;
  visibleFrustum: Frustum;
  paddedFrustum: Frustum;
  keepBase: boolean;
}): Layer[] {
  const layers: Layer[] = [];
  let residentBytes = 0;
  let baseBytes = 0;
  for (let level = 0; level <= preferredLevel; level++) {
    const layer = collectLayerAddresses(
      candidates[level]!,
      budget - residentBytes,
      (bounds) => (level === 0 && keepBase) || paddedFrustum.intersectsBox(bounds),
    );
    if (!layer) break;
    if (level === 0) baseBytes = layer.bytes;
    residentBytes += layer.bytes;
    layers.push({ level, addresses: layer.addresses });
  }

  const base = layers[0];
  if (!base) return layers;

  // Intermediate layers can consume the budget even when the base and every
  // visible tile at a sharper level fit together.
  const detailBudget = budget - baseBytes;
  for (let level = preferredLevel; level >= layers.length; level--) {
    const target = collectLayerAddresses(
      candidates[level]!,
      detailBudget,
      (bounds) => visibleFrustum.intersectsBox(bounds),
    );
    if (!target?.addresses.length) continue;
    const padding = collectLayerAddresses(
      candidates[level]!,
      detailBudget - target.bytes,
      (bounds) => paddedFrustum.intersectsBox(bounds) && !visibleFrustum.intersectsBox(bounds),
    );
    const addresses = padding
      ? target.addresses.concat(padding.addresses)
      : target.addresses;
    return [base, { level, addresses }];
  }
  return layers;
}

export function sphereTileViewShouldRefresh(input: {
  loadModeChanged: boolean;
  managerChanged: boolean;
  elapsedMs: number;
  viewUnchanged: boolean;
}): boolean {
  if (input.loadModeChanged || input.managerChanged) {
    return true;
  }
  if (input.elapsedMs < 100 || input.viewUnchanged) {
    return false;
  }
  return true;
}

function SpherePatch({
  address,
  texture,
  yawOffset,
  preview = false,
}: {
  address: SphereTileAddress;
  texture: Texture;
  yawOffset: number;
  preview?: boolean;
}) {
  const geometry = useMemo(
    () =>
      sphereTileGeometry(
        address,
        yawOffset,
        DEFAULT_PANORAMA_RADIUS + (preview ? 0.05 : 0),
      ),
    [address, yawOffset, preview],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      geometry={geometry}
      renderOrder={preview ? -1000 : -900 + address.level}
    >
      <PanoBasicMaterial
        map={texture}
        side={BackSide}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

const ManagedPatch = memo(function ManagedPatch({
  address,
  manager,
  resolveUrl,
  yawOffset,
  onPaintable,
}: {
  address: SphereTileAddress;
  manager: Pick<TileTextureManager<SphereTileAddress>, "acquire" | "getSnapshot">;
  resolveUrl: (address: SphereTileAddress) => string;
  yawOffset: number;
  onPaintable: (address: SphereTileAddress) => (() => void) | undefined;
}) {
  const url = resolveUrl(address);
  const snapshot = useManagedTexture(
    manager,
    `${url}\u0000${sphereTileKey(address)}`,
    url,
    address,
  );
  useEffect(() => {
    if (snapshot.texture) return onPaintable(address);
  }, [address, snapshot.texture, onPaintable]);
  return snapshot.texture ? (
    <SpherePatch
      address={address}
      texture={snapshot.texture}
      yawOffset={yawOffset}
    />
  ) : null;
});

function SphereTileSource({
  config,
  baseUrl,
  previewUrl,
  urlTemplate = "tiles/%l/%h_%v.webp",
  indexBase = 1,
  resolveTileUrl,
  yawOffset = 0,
  levelCorrection,
  maxTextureMemoryMb = 128,
  maxConcurrentLoads = 4,
  retryCount = 1,
  loadMode = "full",
  visible = true,
  onReady,
  onPreviewError,
  onLoadProgress,
  onTileError,
  onLevelChange,
}: Omit<SphereTileProps, "multires"> & { config: SphereTileMultiresConfig }) {
  const root = useThree();
  const { camera, gl } = root;
  const rotation = useLevelRotation(levelCorrection);
  const inverse = useMemo(() => rotation?.clone().invert() ?? null, [rotation]);
  const sourceCamera = useMemo(() => new PerspectiveCamera(), []);
  const compareHost = useContext(CompareHostContext);
  const compareSide = useContext(CompareSourceSideContext);
  const anisotropy = getTextureAnisotropy(gl);
  const effectivePreviewUrl = previewUrl ? resolveAssetUrl(baseUrl, previewUrl) : "";
  const { texture: preview, failure: previewFailure, showDetail } = usePreviewTexture(
    effectivePreviewUrl,
    configureTilePreviewTexture,
    onPreviewError,
    { showPreviewFirst: visible && !compareSide },
  );
  const callbacks = useRef({
    onReady,
    onLoadProgress,
    onTileError,
    onLevelChange,
  });
  callbacks.current = { onReady, onLoadProgress, onTileError, onLevelChange };
  const sharedManager = useSharedTileTextureManager();
  const ownedBudget =
    Math.max(
      1,
      Number.isFinite(maxTextureMemoryMb) ? maxTextureMemoryMb : 128,
    ) *
    1024 *
    1024;
  const ownedManager = useMemo(
    () =>
      new TileTextureManager<SphereTileAddress>({
        anisotropy,
        fitTexture: (texture) => fitImageTexture(gl, texture),
        maxBytes: ownedBudget,
        concurrency: Math.max(
          1,
          Math.floor(
            Number.isFinite(maxConcurrentLoads) ? maxConcurrentLoads : 4,
          ),
        ),
        retryCount: Math.max(
          0,
          Math.floor(Number.isFinite(retryCount) ? retryCount : 1),
        ),
        onProgress: (progress) => callbacks.current.onLoadProgress?.(progress),
        onError: (error) => callbacks.current.onTileError?.(error),
      }),
    [anisotropy, gl, ownedBudget, maxConcurrentLoads, retryCount],
  );
  const manager = sharedManager ?? ownedManager;
  const budget = manager.memoryBudgetBytes;
  const loadKey = useMemo(() => ({ manager, loadMode }), [manager, loadMode]);
  const load = useStandaloneSceneLoad(loadKey, visible);
  const sceneLoad = useContext(SceneLoadSourceContext);
  const readyRef = useRef(false);
  const ready = useCallback(() => {
    if (!readyRef.current) {
      readyRef.current = true;
      callbacks.current.onReady?.();
    }
  }, []);
  useEffect(() => {
    if (preview) {
      load.current?.ready();
      ready();
    }
  }, [load, preview, ready]);
  useEffect(() => {
    manager.resume();
    return () => {
      if (manager === ownedManager) {
        manager.dispose();
        return;
      }
      queueMicrotask(() => manager.releaseUnused());
    };
  }, [manager, ownedManager]);
  const resolveUrl = useMemo(
    () => (address: SphereTileAddress) =>
      resolveAssetUrl(
        baseUrl,
        resolveTileUrl
          ? resolveTileUrl(address)
          : resolveSphereTemplateUrl(urlTemplate, address, indexBase),
      ),
    [baseUrl, resolveTileUrl, urlTemplate, indexBase],
  );
  const candidates = useMemo(
    () =>
      config.levels.map((level, index) =>
        sphereTileAddresses(level, index, config.tileSize).map((address) => ({
          address,
          bounds: sphereTileBounds(address, yawOffset),
        })),
      ),
    [config, yawOffset],
  );
  const paintedBase = useRef(new Set<string>());
  const handedOffWithBase = useRef(false);
  const baseTileCount = candidates[0]!.length;
  const detailReporter = useSceneDetailReporter();
  // Scenes uses this readiness signal to replace an entire outgoing panorama.
  const requireFullCoverage = detailReporter !== null;
  const previewUnavailable = !effectivePreviewUrl || !!previewFailure;
  const useFullBase = requireFullCoverage && previewUnavailable && loadMode !== "preview";
  const introRoot = useRef<Group>(null);
  useLittlePlanetSource(visible && loadMode === "full" && !compareSide && sceneLoad !== null, loadKey, () =>
    preview || (useFullBase && paintedBase.current.size === baseTileCount)
      ? introRoot.current
      : null);
  const baseFits = useMemo(() => candidates[0]!.reduce((bytes, { address }) =>
    bytes + mipmappedTextureBytes(address.width, address.height), 0) <= budget, [budget, candidates]);
  useEffect(() => {
    if (!previewUnavailable) return;
    if (loadMode === "preview") {
      load.current?.fail(previewFailure?.error ?? new Error("Tiled panorama preview is missing"));
    } else if (useFullBase && !baseFits) {
      sceneLoad?.fail(new Error("The lowest-resolution panorama layer exceeds the tile texture budget"));
    } else if (useFullBase) {
      sceneLoad?.measure(0, baseTileCount);
    }
  }, [baseFits, baseTileCount, load, loadMode, previewFailure, previewUnavailable, sceneLoad, useFullBase]);
  const onPaintable = useCallback((address: SphereTileAddress) => {
    if (!showDetail) return;
    if (!requireFullCoverage) {
      load.current?.ready();
      ready();
      return;
    }
    if (address.level !== 0 || readyRef.current) return;
    const key = sphereTileKey(address);
    const painted = paintedBase.current;
    painted.add(key);
    if (useFullBase) sceneLoad?.measure(painted.size, baseTileCount);
    if (painted.size === baseTileCount) {
      handedOffWithBase.current = true;
      ready();
    }
    return () => { painted.delete(key); };
  }, [baseTileCount, load, ready, requireFullCoverage, sceneLoad, showDetail, useFullBase]);
  const previewAddress = useMemo(
    () => sphereTileAddresses({ width: 2, height: 1 }, 0, 2)[0]!,
    [],
  );
  const [layers, setLayers] = useState<Layer[]>([]);
  const detailReporterRef = useRef(detailReporter);
  detailReporterRef.current = detailReporter;
  const detailTokenRef = useRef("");
  const targetKeysRef = useRef<string[]>([]);
  const scratch = useMemo(
    () => ({
      camera: new PerspectiveCamera(),
      visibleFrustum: new Frustum(),
      paddedFrustum: new Frustum(),
      matrix: new Matrix4(),
      projection: new Matrix4(),
      quaternion: camera.quaternion.clone(),
      fov: NaN,
      width: 0,
      height: 0,
      dpr: 0,
      time: -Infinity,
      token: "",
      level: -1,
      loadMode: "",
      initialBaseOnly: false,
      manager: null as Pick<
        TileTextureManager<SphereTileAddress>,
        "acquire" | "getSnapshot"
      > | null,
    }),
    [camera, candidates],
  );
  useFrame(() => {
    const pane = compareSide && compareHost?.getPane(root.camera, root.size, gl.getPixelRatio(), compareSide);
    const worldCamera = pane ? pane.camera : root.camera;
    const size = pane ? pane.rect : root.size;
    if (!(worldCamera instanceof PerspectiveCamera)) return;
    const camera = cameraInSourceSpace(worldCamera, inverse, sourceCamera);
    const now = performance.now(),
      dpr = gl.getPixelRatio();
    const managerChanged = scratch.manager !== manager;
    const initialBaseOnly = useFullBase && baseFits && !readyRef.current;
    const loadModeChanged = scratch.loadMode !== loadMode || scratch.initialBaseOnly !== initialBaseOnly;
    const viewUnchanged =
      scratch.fov === camera.fov &&
      scratch.projection.equals(camera.projectionMatrix) &&
      scratch.width === size.width &&
      scratch.height === size.height &&
      scratch.dpr === dpr &&
      scratch.quaternion.angleTo(camera.quaternion) < 0.0001;
    if (
      sphereTileViewShouldRefresh({
        loadModeChanged,
        managerChanged,
        elapsedMs: now - scratch.time,
        viewUnchanged,
      })
    ) {
      const reset = managerChanged || loadModeChanged;
      scratch.time = now;
      scratch.fov = camera.fov;
      scratch.projection.copy(camera.projectionMatrix);
      scratch.width = size.width;
      scratch.height = size.height;
      scratch.dpr = dpr;
      scratch.quaternion.copy(camera.quaternion);
      scratch.manager = manager;
      scratch.loadMode = loadMode;
      scratch.initialBaseOnly = initialBaseOnly;
      scratch.camera.copy(camera, false);
      scratch.camera.updateMatrixWorld();
      scratch.matrix.multiplyMatrices(
        scratch.camera.projectionMatrix,
        scratch.camera.matrixWorldInverse,
      );
      scratch.visibleFrustum.setFromProjectionMatrix(
        scratch.matrix, scratch.camera.coordinateSystem, scratch.camera.reversedDepth,
      );
      scratch.camera.fov = Math.min(179, camera.fov + 8);
      scratch.camera.updateProjectionMatrix();
      scratch.matrix.multiplyMatrices(
        scratch.camera.projectionMatrix,
        scratch.camera.matrixWorldInverse,
      );
      scratch.paddedFrustum.setFromProjectionMatrix(
        scratch.matrix, scratch.camera.coordinateSystem, scratch.camera.reversedDepth,
      );
      const preferredLevel =
        loadMode === "preview"
          ? -1
          : loadMode === "base" || initialBaseOnly
            ? 0
            : preferredSphereLevel(
                config.levels,
                size.height,
                dpr,
                camera.fov,
                size.width,
              );
      const next = selectSphereTileLayers({
        candidates,
        preferredLevel,
        budget,
        visibleFrustum: scratch.visibleFrustum,
        paddedFrustum: scratch.paddedFrustum,
        // Keep complete coverage after a preview-free scene handoff.
        keepBase: initialBaseOnly || (handedOffWithBase.current && !preview),
      });
      const selectedLayer = next[next.length - 1];
      const level = selectedLayer?.level ?? -1;
      const targetLayer = loadMode === "full" ? selectedLayer : undefined;
      targetKeysRef.current = targetLayer
        ? targetLayer.addresses.map(
            (address) => `${resolveUrl(address)}\u0000${sphereTileKey(address)}`,
          )
        : [];
      if (level !== scratch.level) {
        scratch.level = level;
        if (level >= 0) callbacks.current.onLevelChange?.(level);
      }
      const token = next
        .map((layer) => layer.addresses.map(sphereTileKey).join(","))
        .join(";");
      if (token !== scratch.token || reset) {
        scratch.token = token;
        setLayers(next);
      }
    }
    if (previewUnavailable && showDetail && !readyRef.current) {
      const monitorSceneBase = initialBaseOnly && sceneLoad?.isLoading();
      if (monitorSceneBase || load.current?.isLoading()) {
        const addresses = monitorSceneBase
          ? candidates[0]!.map(({ address }) => address)
          : layers.flatMap((layer) => layer.addresses);
        const snapshots = addresses.map((address) =>
          manager.getSnapshot(`${resolveUrl(address)}\u0000${sphereTileKey(address)}`),
        );
        if (monitorSceneBase) {
          const failure = snapshots.find(({ status }) => status === "error");
          if (failure) sceneLoad?.fail(failure.error);
        } else if (snapshots[0] && snapshots.every(({ status }) => status === "error")) {
          load.current?.fail(snapshots[0].error);
        }
      }
    }
    publishSceneDetail(
      detailReporterRef.current,
      detailTokenRef,
      showDetail && loadMode === "full" &&
        viewTilesAreDrawable(
          targetKeysRef.current.map((key) => manager.getSnapshot(key).texture),
        ),
    );
  });
  return (
    <group ref={introRoot} quaternion={rotation ?? [0, 0, 0, 1]} visible={visible}>
      {preview ? (
        <SpherePatch
          address={previewAddress}
          texture={preview}
          yawOffset={yawOffset}
          preview
        />
      ) : null}
      <group visible={showDetail}>
        {loadMode !== "preview" && layers.flatMap((layer) =>
          layer.addresses.map((address) => (
            <ManagedPatch
              key={sphereTileKey(address)}
              address={address}
              manager={manager}
              resolveUrl={resolveUrl}
              yawOffset={yawOffset}
              onPaintable={onPaintable}
            />
          )),
        )}
      </group>
    </group>
  );
}

export function SphereTile({ multires, ...props }: SphereTileProps) {
  const token =
    typeof multires === "string" ? multires : JSON.stringify(multires);
  const config = useMemo(() => parseSphereMultires(multires), [token]);
  // A new source owns its readiness. Shared caches key textures by resource URL.
  const sourceKey = `${props.baseUrl}\u0000${token}\u0000${props.previewUrl}\u0000${props.urlTemplate ?? ""}\u0000${props.indexBase ?? 1}`;
  return <SphereTileSource key={sourceKey} {...props} config={config} />;
}
