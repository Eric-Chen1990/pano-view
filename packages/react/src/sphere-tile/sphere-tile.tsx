import { useFrame, useThree } from "@react-three/fiber";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackSide, Frustum, Matrix4, PerspectiveCamera, Texture } from "three";
import { resolveAssetUrl } from "../asset-url";
import { PanoBasicMaterial } from "../pano-filter/pano-basic-material";
import {
  publishSceneDetail,
  useSceneDetailReporter,
  viewTilesAreDrawable,
} from "../scene-detail";
import { TileTextureManager } from "../tile/texture-manager";
import { useSharedTileTextureManager } from "../tile/texture-manager-context";
import { useManagedTexture, usePreviewTexture } from "../tile/texture-hooks";
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
  ready,
}: {
  address: SphereTileAddress;
  manager: Pick<TileTextureManager<SphereTileAddress>, "acquire" | "getSnapshot">;
  resolveUrl: (address: SphereTileAddress) => string;
  yawOffset: number;
  ready: () => void;
}) {
  const url = resolveUrl(address);
  const snapshot = useManagedTexture(
    manager,
    `${url}\u0000${sphereTileKey(address)}`,
    url,
    address,
  );
  useEffect(() => {
    if (snapshot.texture) ready();
  }, [snapshot.texture, ready]);
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
  const { camera, gl, size } = useThree();
  const anisotropy = gl.capabilities.getMaxAnisotropy();
  const preview = usePreviewTexture(
    resolveAssetUrl(baseUrl, previewUrl),
    anisotropy,
    onPreviewError,
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
    [anisotropy, ownedBudget, maxConcurrentLoads, retryCount],
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
  const previewAddress = useMemo(
    () => sphereTileAddresses({ width: 2, height: 1 }, 0, 2)[0]!,
    [],
  );
  const [layers, setLayers] = useState<Layer[]>([]);
  const detailReporter = useSceneDetailReporter();
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
      scratch.frustum.setFromProjectionMatrix(scratch.matrix);
      let level =
        loadMode === "preview"
          ? -1
          : loadMode === "base"
            ? 0
            : preferredSphereLevel(config.levels, size.height, dpr, camera.fov);
      const next: Layer[] = [];
      let residentBytes = 0;
      for (let index = 0; index <= level; index++) {
        const addresses = candidates[index]!.filter(({ bounds }) =>
          scratch.frustum.intersectsBox(bounds),
        ).map(({ address }) => address);
        const bytes = addresses.reduce(
          (total, address) => total + address.width * address.height * 4,
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
      loadMode === "full" &&
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
      {loadMode !== "preview"
        ? layers.flatMap((layer) =>
            layer.addresses.map((address) => (
              <ManagedPatch
                key={sphereTileKey(address)}
                address={address}
                manager={manager}
                resolveUrl={resolveUrl}
                yawOffset={yawOffset}
                ready={ready}
              />
            )),
          )
        : null}
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
