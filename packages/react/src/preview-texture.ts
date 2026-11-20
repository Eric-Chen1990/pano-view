import { useFrame, useThree, type RootState } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Cache, DefaultLoadingManager, Texture } from "three";
import { fitImageTexture } from "./renderer-capabilities";

type Renderer = RootState["gl"];

const INITIAL_PREVIEW_TIMEOUT_MS = 1500;
const INITIAL_PREVIEW_DURATION_MS = 150;

export function usePreviewTexture(
  url: string | null,
  configure: (texture: Texture, renderer: Renderer) => void,
  onError?: (error: unknown) => void,
  {
    showPreviewFirst = false,
    discardPreview = false,
  }: { showPreviewFirst?: boolean; discardPreview?: boolean } = {},
) {
  const renderer = useThree((state) => state.gl);
  const [showDetail, setShowDetail] = useState(!showPreviewFirst);
  const sourceUrl = showDetail && discardPreview ? null : url;
  const [loaded, setLoaded] = useState<{
    url: string;
    renderer: Renderer;
    texture: Texture;
  }>();
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Start before passive effects enqueue the original image or the tile layers.
  useLayoutEffect(() => {
    if (!sourceUrl) {
      setLoaded(undefined);
      return;
    }
    const previewUrl = sourceUrl;
    const manager = DefaultLoadingManager;
    const requestUrl = manager.resolveURL(previewUrl);
    const cacheKey = `image:${requestUrl}`;
    const cached: HTMLImageElement | undefined = Cache.get(cacheKey);
    const cachedImage = cached?.complete && cached.naturalWidth ? cached : undefined;
    const image = cachedImage ?? new Image();
    let texture: Texture | undefined;
    let pending = true;
    let active = true;

    function finish() {
      pending = false;
      image.removeEventListener("load", handleLoad);
      image.removeEventListener("error", handleError);
      manager.itemEnd(requestUrl);
    }
    function handleLoad() {
      if (!active) return;
      Cache.add(cacheKey, image);
      texture = new Texture(image);
      fitImageTexture(renderer, texture);
      configure(texture, renderer);
      setLoaded({ url: previewUrl, renderer, texture });
      finish();
    }
    function handleError(error: Event) {
      manager.itemError(requestUrl);
      finish();
      setShowDetail(true);
      onErrorRef.current?.(error);
    }

    manager.itemStart(requestUrl);
    if (cachedImage) {
      queueMicrotask(handleLoad);
    } else {
      if (!requestUrl.startsWith("data:")) image.crossOrigin = "anonymous";
      image.fetchPriority = "high";
      image.addEventListener("load", handleLoad);
      image.addEventListener("error", handleError);
      image.src = requestUrl;
    }
    return () => {
      active = false;
      if (pending) {
        finish();
        if (!cachedImage) image.removeAttribute("src");
      }
      texture?.dispose();
    };
  }, [configure, renderer, sourceUrl]);

  const texture = loaded && loaded.url === sourceUrl && loaded.renderer === renderer
    ? loaded.texture
    : null;

  useEffect(() => {
    if (showDetail || !sourceUrl || texture) return;
    const timeout = window.setTimeout(() => setShowDetail(true), INITIAL_PREVIEW_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [showDetail, sourceUrl, texture]);

  const firstPreviewFrame = useRef<{ textureId: number; at: number } | null>(null);
  useFrame(({ frameloop, invalidate }) => {
    if (showDetail || !texture) return;
    const now = performance.now();
    // Count from the renderer's first opportunity to draw the committed preview.
    if (firstPreviewFrame.current?.textureId !== texture.id) {
      firstPreviewFrame.current = { textureId: texture.id, at: now };
    } else if (now - firstPreviewFrame.current.at >= INITIAL_PREVIEW_DURATION_MS) {
      setShowDetail(true);
      return;
    }
    if (frameloop === "demand") invalidate();
  });

  return { texture, showDetail: showDetail || !sourceUrl };
}
