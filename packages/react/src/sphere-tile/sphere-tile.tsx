import { fitImageTexture, getTextureAnisotropy } from "../renderer-capabilities";
import { useFrame, useThree } from "@react-three/fiber";
import { CompareHostContext, CompareSourceSideContext } from "../compare/view";
import { memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { BackSide, Frustum, Matrix4, PerspectiveCamera, Texture } from "three";
import { resolveAssetUrl } from "../asset-url";
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
  const compareHost = useContext(CompareHostContext);
  const compareSide = useContext(CompareSourceSideContext);
  const anisotropy = getTextureAnisotropy(gl);
  const { texture: preview, showDetail } = usePreviewTexture(
    resolveAssetUrl(baseUrl, previewUrl),
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
  const readyRef = useRef(false);
  const ready = useCallback(() => {
    if (!readyRef.current) {
      readyRef.current = true;
      callbacks.current.onReady?.();
    }
  }, []);
  useEffect(() => {
    if (preview) ready();
  }, [preview, ready]);
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
  const onPaintable = useCallback((address: SphereTileAddress) => {
    if (!showDetail) return;
    if (!requireFullCoverage) {
      ready();
      return;
    }
    if (address.level !== 0 || readyRef.current) return;
    const key = sphereTileKey(address);
    const painted = paintedBase.current;
    painted.add(key);
    if (painted.size === baseTileCount) {
      handedOffWithBase.current = true;
      ready();
    }
    return () => { painted.delete(key); };
  }, [baseTileCount, ready, requireFullCoverage, showDetail]);
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
      frustum: new Frustum(),
      matrix: new Matrix4(),
      quaternion: camera.quaternion.clone(),
      fov: NaN,
      width: 0,
      height: 0,
      dpr: 0,
      time: -Infinity,
      token: "",
      level: -1,
      loadMode: "",
      manager: null as Pick<
        TileTextureManager<SphereTileAddress>,
        "acquire" | "getSnapshot"
      > | null,
    }),
    [camera, candidates],
  );
  useFrame(() => {
    const pane = compareSide && compareHost?.getPane(root.camera, root.size, gl.getPixelRatio(), compareSide);
    const camera = pane ? pane.camera : root.camera;
    const size = pane ? pane.rect : root.size;
    if (!(camera instanceof PerspectiveCamera)) return;
    const now = performance.now(),
      dpr = gl.getPixelRatio();
    const managerChanged = scratch.manager !== manager;
    const loadModeChanged = scratch.loadMode !== loadMode;
    const viewUnchanged =
      scratch.fov === camera.fov &&
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
      scratch.width = size.width;
      scratch.height = size.height;
      scratch.dpr = dpr;
      scratch.quaternion.copy(camera.quaternion);
      scratch.manager = manager;
      scratch.loadMode = loadMode;
      scratch.camera.copy(camera, false);
      scratch.camera.fov = Math.min(179, camera.fov + 8);
      scratch.camera.updateProjectionMatrix();
      scratch.camera.updateMatrixWorld();
      scratch.matrix.multiplyMatrices(
        scratch.camera.projectionMatrix,
        scratch.camera.matrixWorldInverse,
      );
      scratch.frustum.setFromProjectionMatrix(
        scratch.matrix, scratch.camera.coordinateSystem, scratch.camera.reversedDepth,
      );
      let level =
        loadMode === "preview"
          ? -1
          : loadMode === "base"
            ? 0
            : preferredSphereLevel(
                config.levels,
                size.height,
                dpr,
                camera.fov,
                size.width,
              );
      const next: Layer[] = [];
      let residentBytes = 0;
      for (let index = 0; index <= level; index++) {
        // The incoming camera can jump at handoff. Retain the complete base until
        // the preview supplies coverage outside the original frustum.
        const keepBase = index === 0 && handedOffWithBase.current && !preview;
        const addresses = candidates[index]!.filter(({ bounds }) =>
          keepBase || scratch.frustum.intersectsBox(bounds),
        ).map(({ address }) => address);
        const bytes = addresses.reduce(
          (total, address) =>
            total + mipmappedTextureBytes(address.width, address.height),
          0,
        );
        if (residentBytes + bytes > budget) {
          level = index - 1;
          break;
        }
        residentBytes += bytes;
        next.push({ level: index, addresses });
      }
      const targetLayer = loadMode === "full" ? next[next.length - 1] : undefined;
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
    <group visible={visible}>
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
