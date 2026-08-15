import { useFrame, useThree } from "@react-three/fiber";
import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Box3,
  ClampToEdgeWrapping,
  Frustum,
  LinearFilter,
  Matrix4,
  PlaneGeometry,
  PerspectiveCamera,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector3,
} from "three";
import {
  CUBE_FACES,
  CUBE_RADIUS,
  getFaceTransform,
  getPreferredLevel,
  getTileBoundingBox,
  getTileLocalLayout,
  makeTileAddress,
  previewAtlasVRange,
  tileKey,
} from "./face-layout";
import {
  buildDefaultTileUrlTemplate,
  parseMultires,
  resolveRelativeTileUrl,
  resolveTemplateUrl,
} from "./multires";
import { TileTextureManager } from "./texture-manager";
import { useSharedTileTextureManager } from "./texture-manager-context";
import type {
  CubeFaceCode,
  TextureEntrySnapshot,
  TileAddress,
  TileProps,
} from "./types";

const MAX_LOD_UPDATE_INTERVAL_MS = 100;
const FAST_ROTATION_THRESHOLD_RADIANS = Math.PI / 180;
const FAST_FOV_THRESHOLD_DEGREES = 0.5;
const VIEW_CHANGE_EPSILON = 0.0001;
const VISIBILITY_FOV_PADDING_DEGREES = 8;
const PREVIEW_RADIUS = CUBE_RADIUS + 0.05;
const SHARED_TILE_GEOMETRY = new PlaneGeometry(1, 1);

type TileLayer = {
  level: number;
  addresses: TileAddress[];
  renderOrder: number;
};

type TileCandidate = {
  address: TileAddress;
  bounds: Box3;
};

function usePreviewTexture(
  url: string | null,
  anisotropy: number,
  onError?: (error: unknown) => void,
) {
  const [texture, setTexture] = useState<Texture | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (!url) {
      setTexture(null);
      return;
    }

    let active = true;
    const loader = new TextureLoader();
    setTexture(null);
    loader.load(
      url,
      (loadedTexture) => {
        if (!active) {
          loadedTexture.dispose();
          return;
        }
        loadedTexture.colorSpace = SRGBColorSpace;
        loadedTexture.wrapS = ClampToEdgeWrapping;
        loadedTexture.wrapT = ClampToEdgeWrapping;
        loadedTexture.magFilter = LinearFilter;
        loadedTexture.minFilter = LinearFilter;
        loadedTexture.generateMipmaps = false;
        loadedTexture.anisotropy = Math.min(4, anisotropy);
        loadedTexture.needsUpdate = true;
        setTexture(loadedTexture);
      },
      undefined,
      (error) => {
        if (active) {
          setTexture(null);
          onErrorRef.current?.(error);
        }
      },
    );

    return () => {
      active = false;
    };
  }, [anisotropy, url]);

  useEffect(
    () => () => {
      texture?.dispose();
    },
    [texture],
  );

  return texture;
}

function PreviewFace({
  face,
  texture,
}: {
  face: CubeFaceCode;
  texture: Texture;
}) {
  const geometry = useMemo(() => {
    const nextGeometry = new PlaneGeometry(
      PREVIEW_RADIUS * 2,
      PREVIEW_RADIUS * 2,
    );
    const uv = nextGeometry.getAttribute("uv");
    const { offset, scale } = previewAtlasVRange(face);
    const inset = scale / 512;
    for (let index = 0; index < uv.count; index += 1) {
      const sourceV = uv.getY(index);
      uv.setY(
        index,
        offset + inset + sourceV * Math.max(0, scale - inset * 2),
      );
    }
    uv.needsUpdate = true;
    return nextGeometry;
  }, [face]);

  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry],
  );

  const transform = getFaceTransform(face, PREVIEW_RADIUS);
  return (
    <mesh
      geometry={geometry}
      position={transform.position}
      renderOrder={-100}
      rotation={transform.rotation}
    >
      <meshBasicMaterial
        depthTest={false}
        depthWrite={false}
        map={texture}
        toneMapped={false}
      />
    </mesh>
  );
}

function PreviewCube({ texture }: { texture: Texture }) {
  return CUBE_FACES.map((face) => (
    <PreviewFace key={face} face={face} texture={texture} />
  ));
}

function useManagedTexture(
  manager: TileTextureManager,
  key: string,
  url: string,
  address: TileAddress,
): TextureEntrySnapshot {
  const [managedState, setManagedState] = useState(() => ({
    manager,
    key,
    url,
    snapshot: manager.getSnapshot(key),
  }));

  const snapshot =
    managedState.manager === manager &&
    managedState.key === key &&
    managedState.url === url
      ? managedState.snapshot
      : manager.getSnapshot(key);

  useEffect(
    () =>
      manager.acquire(key, url, address, (nextSnapshot) => {
        setManagedState({
          manager,
          key,
          url,
          snapshot: nextSnapshot,
        });
      }),
    [key, manager, url],
  );

  return snapshot;
}

const TileMesh = memo(function TileMesh({
  address,
  manager,
  renderOrder,
  resolveUrl,
}: {
  address: TileAddress;
  manager: TileTextureManager;
  renderOrder: number;
  resolveUrl: (address: TileAddress) => string;
}) {
  const url = resolveUrl(address);
  // A viewer-scoped manager serves multiple scenes. The tile coordinate alone
  // is only unique within one cube panorama, so include the resolved resource
  // URL to prevent same-address tiles from different scenes sharing a texture.
  const cacheKey = `${url}\u0000${tileKey(address)}`;
  const snapshot = useManagedTexture(manager, cacheKey, url, address);
  const layout = getTileLocalLayout(address);
  const transform = getFaceTransform(address.face);

  if (!snapshot.texture) {
    return null;
  }

  return (
    <group position={transform.position} rotation={transform.rotation}>
      <mesh
        geometry={SHARED_TILE_GEOMETRY}
        position={[layout.x, layout.y, 0]}
        renderOrder={renderOrder}
        scale={[layout.width, layout.height, 1]}
      >
        <meshBasicMaterial
          depthTest={false}
          depthWrite={false}
          map={snapshot.texture}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
});

const TileLayerMeshes = memo(function TileLayerMeshes({
  layer,
  manager,
  resolveUrl,
}: {
  layer: TileLayer;
  manager: TileTextureManager;
  resolveUrl: (address: TileAddress) => string;
}) {
  return layer.addresses.map((address) => (
    <TileMesh
      key={tileKey(address)}
      address={address}
      manager={manager}
      renderOrder={layer.renderOrder}
      resolveUrl={resolveUrl}
    />
  ));
});

function buildTileCandidates(
  levels: number[],
  tileSize: number,
): TileCandidate[][] {
  return levels.map((faceSize, index) => {
    const level = index + 1;
    const cols = Math.ceil(faceSize / tileSize);
    const rows = Math.ceil(faceSize / tileSize);
    const candidates: TileCandidate[] = [];

    for (const face of CUBE_FACES) {
      for (let row = 1; row <= rows; row += 1) {
        for (let col = 1; col <= cols; col += 1) {
          const address = makeTileAddress(
            face,
            level,
            faceSize,
            tileSize,
            col,
            row,
          );
          candidates.push({
            address,
            bounds: getTileBoundingBox(address),
          });
        }
      }
    }

    return candidates;
  });
}

function visibleAddresses(
  candidates: TileCandidate[],
  frustum: Frustum,
): TileAddress[] {
  return candidates
    .filter((candidate) => frustum.intersectsBox(candidate.bounds))
    .map((candidate) => candidate.address);
}

function updateVisibilityFrustum(
  camera: PerspectiveCamera,
  projectionMatrix: Matrix4,
  frustum: Frustum,
) {
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  projectionMatrix.multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse,
  );
  frustum.setFromProjectionMatrix(projectionMatrix);
}

function addAddress(
  addressesByLevel: Map<number, Map<string, TileAddress>>,
  address: TileAddress,
) {
  let levelAddresses = addressesByLevel.get(address.level);
  if (!levelAddresses) {
    levelAddresses = new Map();
    addressesByLevel.set(address.level, levelAddresses);
  }
  levelAddresses.set(tileKey(address), address);
}

function parentAddresses(
  child: TileAddress,
  parentLevel: number,
  parentFaceSize: number,
  tileSize: number,
): TileAddress[] {
  const childLeft = ((child.col - 1) * child.tileSize) / child.faceSize;
  const childTop = ((child.row - 1) * child.tileSize) / child.faceSize;
  const childRight = childLeft + child.width / child.faceSize;
  const childBottom = childTop + child.height / child.faceSize;
  const cols = Math.ceil(parentFaceSize / tileSize);
  const rows = Math.ceil(parentFaceSize / tileSize);
  const firstCol = Math.max(
    1,
    Math.floor((childLeft * parentFaceSize) / tileSize) + 1,
  );
  const lastCol = Math.min(
    cols,
    Math.ceil((childRight * parentFaceSize) / tileSize),
  );
  const firstRow = Math.max(
    1,
    Math.floor((childTop * parentFaceSize) / tileSize) + 1,
  );
  const lastRow = Math.min(
    rows,
    Math.ceil((childBottom * parentFaceSize) / tileSize),
  );
  const addresses: TileAddress[] = [];

  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let col = firstCol; col <= lastCol; col += 1) {
      addresses.push(
        makeTileAddress(
          child.face,
          parentLevel,
          parentFaceSize,
          tileSize,
          col,
          row,
        ),
      );
    }
  }
  return addresses;
}

function centerFacingAddress(
  candidates: TileCandidate[],
  camera: PerspectiveCamera,
): TileAddress {
  const direction = camera.getWorldDirection(new Vector3());
  const center = new Vector3();
  let bestCandidate = candidates[0]!;
  let bestAlignment = -Infinity;

  for (const candidate of candidates) {
    candidate.bounds.getCenter(center).normalize();
    const alignment = center.dot(direction);
    if (alignment > bestAlignment) {
      bestCandidate = candidate;
      bestAlignment = alignment;
    }
  }

  return bestCandidate.address;
}

function buildLayers(
  targetLevel: number,
  levels: number[],
  tileSize: number,
  frustum: Frustum,
  camera: PerspectiveCamera,
  candidatesByLevel: TileCandidate[][],
): TileLayer[] {
  const addressesByLevel = new Map<number, Map<string, TileAddress>>();
  const targetCandidates = candidatesByLevel[targetLevel - 1]!;
  const targetAddresses = visibleAddresses(targetCandidates, frustum);

  // A stale camera matrix must not schedule an entire face. The center-facing
  // target and its parent chain provide a bounded fallback until the next pass.
  const visibleTargets =
    targetAddresses.length > 0
      ? targetAddresses
      : [centerFacingAddress(targetCandidates, camera)];

  for (const address of visibleTargets) {
    addAddress(addressesByLevel, address);
  }

  let children = visibleTargets;
  for (let parentLevel = targetLevel - 1; parentLevel >= 1; parentLevel -= 1) {
    const parentFaceSize = levels[parentLevel - 1]!;
    const parents = new Map<string, TileAddress>();
    for (const child of children) {
      for (const parent of parentAddresses(
        child,
        parentLevel,
        parentFaceSize,
        tileSize,
      )) {
        parents.set(tileKey(parent), parent);
        addAddress(addressesByLevel, parent);
      }
    }
    children = Array.from(parents.values());
  }

  return Array.from(addressesByLevel.entries())
    .sort(([firstLevel], [secondLevel]) => firstLevel - secondLevel)
    .map(([level, addresses]) => ({
      level,
      addresses: Array.from(addresses.values()),
      renderOrder: -100 + level * 10,
    }));
}

function layerToken(layers: TileLayer[]): string {
  return layers
    .map(
      (layer) =>
        `${layer.level}:${layer.addresses.map(tileKey).join(",")}`,
    )
    .join("|");
}

export function Tile({
  baseUrl,
  multires,
  previewUrl,
  urlTemplate,
  resolveTileUrl,
  maxTextureMemoryMb = 128,
  maxConcurrentLoads = 8,
  retryCount = 1,
  loadMode = "full",
  visible = true,
  onReady,
  onPreviewError,
  onLoadProgress,
  onTileError,
  onLevelChange,
}: TileProps) {
  const { camera, gl, size } = useThree();
  const multiresConfig = useMemo(() => parseMultires(multires), [multires]);
  const { levels, tileSize } = multiresConfig;
  const multiresToken = `${tileSize}:${levels.join(",")}`;
  const candidatesByLevel = useMemo(
    () => buildTileCandidates(levels, tileSize),
    [levels, tileSize],
  );
  const anisotropy = gl.capabilities.getMaxAnisotropy();
  const effectivePreviewUrl =
    previewUrl === undefined
      ? `${baseUrl.replace(/\/$/, "")}/previews/cube-vertical.webp`
      : previewUrl;
  const previewTexture = usePreviewTexture(
    effectivePreviewUrl,
    anisotropy,
    onPreviewError,
  );
  const sharedManager = useSharedTileTextureManager();
  const progressRef = useRef(onLoadProgress);
  const errorRef = useRef(onTileError);
  const levelChangeRef = useRef(onLevelChange);
  progressRef.current = onLoadProgress;
  errorRef.current = onTileError;
  levelChangeRef.current = onLevelChange;

  const ownedManager = useMemo(
    () =>
      new TileTextureManager({
        anisotropy,
        maxBytes: Math.max(1, maxTextureMemoryMb) * 1024 * 1024,
        concurrency: Math.max(1, Math.floor(maxConcurrentLoads)),
        retryCount: Math.max(0, Math.floor(retryCount)),
        onProgress: (progress) => progressRef.current?.(progress),
        onError: (event) => errorRef.current?.(event),
      }),
    [
      anisotropy,
      baseUrl,
      maxConcurrentLoads,
      maxTextureMemoryMb,
      multiresToken,
      retryCount,
      resolveTileUrl,
      urlTemplate,
    ],
  );
  const manager = sharedManager ?? ownedManager;
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

  const readyRef = useRef(false);
  useEffect(() => {
    readyRef.current = false;
  }, [effectivePreviewUrl]);
  useEffect(() => {
    if (!previewTexture || readyRef.current) {
      return;
    }
    readyRef.current = true;
    onReady?.();
  }, [onReady, previewTexture]);

  const template = urlTemplate ?? buildDefaultTileUrlTemplate();
  const resolveUrl = useMemo(
    () => (address: TileAddress) => {
      const relativePath = resolveTileUrl
        ? resolveTileUrl(address)
        : resolveTemplateUrl(template, address);
      return resolveRelativeTileUrl(baseUrl, relativePath);
    },
    [baseUrl, resolveTileUrl, template],
  );

  const [layers, setLayers] = useState<TileLayer[]>([]);
  const layerTokenRef = useRef("");
  const currentLevelRef = useRef(1);
  const lastUpdateAtRef = useRef(-Infinity);
  const visibilityDirtyRef = useRef(true);
  const lastVisibilityQuaternionRef = useRef(camera.quaternion.clone());
  const lastVisibilityFovRef = useRef(Number.NaN);
  const lastViewportRef = useRef({ width: 0, height: 0, dpr: 0 });
  const frustumRef = useRef(new Frustum());
  const projectionMatrixRef = useRef(new Matrix4());
  const visibilityCameraRef = useRef(new PerspectiveCamera());

  useEffect(() => {
    currentLevelRef.current = 1;
    layerTokenRef.current = "";
    visibilityDirtyRef.current = true;
    setLayers([]);
  }, [manager, multiresToken]);

  useEffect(() => {
    if (loadMode !== "preview") {
      return;
    }
    layerTokenRef.current = "";
    setLayers([]);
  }, [loadMode]);

  const commitLayers = (nextLayers: TileLayer[]) => {
    const nextToken = layerToken(nextLayers);
    if (nextToken !== layerTokenRef.current) {
      layerTokenRef.current = nextToken;
      setLayers(nextLayers);
    }
  };

  useFrame(() => {
    if (loadMode === "preview") {
      return;
    }
    if (!(camera instanceof PerspectiveCamera)) {
      return;
    }

    const now = performance.now();
    const pixelRatio = gl.getPixelRatio();
    const rotationDelta = lastVisibilityQuaternionRef.current.angleTo(
      camera.quaternion,
    );
    const fovDelta = Number.isFinite(lastVisibilityFovRef.current)
      ? Math.abs(camera.fov - lastVisibilityFovRef.current)
      : Infinity;
    const lastViewport = lastViewportRef.current;
    const viewportChanged =
      lastViewport.width !== size.width ||
      lastViewport.height !== size.height ||
      lastViewport.dpr !== pixelRatio;
    const viewChanged =
      visibilityDirtyRef.current ||
      viewportChanged ||
      rotationDelta > VIEW_CHANGE_EPSILON ||
      fovDelta > VIEW_CHANGE_EPSILON;
    const movingQuickly =
      rotationDelta >= FAST_ROTATION_THRESHOLD_RADIANS ||
      fovDelta >= FAST_FOV_THRESHOLD_DEGREES;

    if (!viewChanged) {
      return;
    }

    const needsImmediateUpdate =
      visibilityDirtyRef.current ||
      viewportChanged ||
      movingQuickly;
    if (
      !needsImmediateUpdate &&
      now - lastUpdateAtRef.current < MAX_LOD_UPDATE_INTERVAL_MS
    ) {
      return;
    }

    lastUpdateAtRef.current = now;

    const targetLevel = getPreferredLevel(
      levels,
      size.height,
      pixelRatio,
      camera.fov,
      currentLevelRef.current,
    );
    if (targetLevel !== currentLevelRef.current) {
      currentLevelRef.current = targetLevel;
      levelChangeRef.current?.(targetLevel);
    }

    const visibilityCamera = visibilityCameraRef.current;
    visibilityCamera.copy(camera, false);
    visibilityCamera.fov = Math.min(
      179,
      camera.fov + VISIBILITY_FOV_PADDING_DEGREES,
    );
    visibilityCamera.aspect = camera.aspect;
    updateVisibilityFrustum(
      visibilityCamera,
      projectionMatrixRef.current,
      frustumRef.current,
    );

    const nextLayers = buildLayers(
      targetLevel,
      levels,
      tileSize,
      frustumRef.current,
      camera,
      candidatesByLevel,
    );
    visibilityDirtyRef.current = false;
    lastVisibilityQuaternionRef.current.copy(camera.quaternion);
    lastVisibilityFovRef.current = camera.fov;
    lastViewportRef.current = {
      width: size.width,
      height: size.height,
      dpr: pixelRatio,
    };
    commitLayers(nextLayers);
  });

  return (
    <group visible={visible}>
      {previewTexture ? <PreviewCube texture={previewTexture} /> : null}
      {layers.map((layer) => (
        <TileLayerMeshes
          key={layer.level}
          layer={layer}
          manager={manager}
          resolveUrl={resolveUrl}
        />
      ))}
    </group>
  );
}
