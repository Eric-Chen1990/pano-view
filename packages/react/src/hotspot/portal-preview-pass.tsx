import { useFrame } from "@react-three/fiber";
import { useContext, useEffect, useMemo } from "react";
import { WebGPURuntimeContext } from "../pano-renderer";
import { PanoramaViewContext } from "../panorama-view-runtime";
import { isPerspectiveCamera } from "../scene-transitions/overlay-utils";
import { type PortalHost, type PortalWindow } from "./portal-host";
import { PORTAL_PREVIEW_PIXELS, portalCameraRotation, portalReadyForZoomEntry, portalTargetSize, projectPortal, setPortalCameraProjection } from "./portal-projection";
import { createPortalTarget, renderPortalTarget } from "./portal-rendering";

export function PortalPreviewPass({ host, windows }: {
  host: PortalHost; windows: Map<string, PortalWindow>;
}) {
  const gpu = useContext(WebGPURuntimeContext)?.passes;
  const controls = useContext(PanoramaViewContext);
  const buffers = useMemo(() => [createPortalTarget(gpu), createPortalTarget(gpu)], [gpu]);
  useEffect(() => () => buffers.forEach((target) => target.dispose()), [buffers]);

  useFrame(({ gl, camera: source, size }) => {
    if (!windows.size) return;
    if (host.spatial || !isPerspectiveCamera(source) || size.width < 1 || size.height < 1) {
      for (const window of windows.values()) {
        window.requestDetail(false);
        window.show(null);
      }
      return;
    }

    source.updateWorldMatrix(true, false);
    const projected = Array.from(windows.values()).flatMap((window) => {
      const scene = host.scenes.get(window.targetId);
      const aperture = scene && window.visible() && projectPortal(window.mesh, source, window.outline);
      return scene && aperture ? [{ window, scene, aperture }] : [];
    });
    projected.sort((a, b) => b.aperture.area - a.aperture.area);
    const active = projected.slice(0, buffers.length);
    for (const window of windows.values()) {
      const selected = active.some((entry) => entry.window === window);
      window.requestDetail(selected);
      if (!selected || !window.ready()) window.show(null);
    }
    for (const [index, { window, scene, aperture }] of active.entries()) {
      const { camera } = window;
      const { width, height } = aperture.bounds;
      const target = buffers[index]!;
      const dpr = gl.getPixelRatio();
      // Quantize allocations while keeping the exact optical crop.
      const [bufferWidth, bufferHeight] = portalTargetSize(
        Math.ceil(width * size.width * dpr / 32) * 32,
        Math.ceil(height * size.height * dpr / 32) * 32, PORTAL_PREVIEW_PIXELS,
      );
      if (target.width !== bufferWidth || target.height !== bufferHeight) target.setSize(bufferWidth, bufferHeight);
      camera.copy(source, false);
      const destination = host.destinationView(scene);
      portalCameraRotation(source.quaternion, window.position, destination, camera.quaternion);
      setPortalCameraProjection(camera, destination.fov, size, aperture.bounds);
      camera.updateMatrixWorld(true);
      if (!window.ready()) continue;
      renderPortalTarget(gl, gpu, target, window.preview, camera);
      window.show(aperture, target.texture);
    }
    const entrance = projected.find(({ window, aperture }) => window.enterOnZoom && portalReadyForZoomEntry(aperture));
    if (entrance) {
      const input = controls?.current?.takePortalZoomInput();
      if (input) entrance.window.enterOnZoom?.(input);
    }
  });
  return null;
}
