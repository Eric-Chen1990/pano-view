import { addAfterEffect, useFrame, useThree, type RootState } from "@react-three/fiber";
import { createContext, useLayoutEffect, type RefObject } from "react";
import type { Object3D, Scene } from "three";
import { isWebGPURenderer } from "./renderer-capabilities";
import { createScreenshotFeedback, type PanoScreenshotFeedback } from "./screenshot-feedback";

export type PanoScreenshotMode = "panorama" | "hotspots" | "viewer";
export type PanoScreenshotFormat = "png" | "jpeg";

export type PanoScreenshotOptions = {
  /** Which layers to capture. Defaults to "panorama". */
  mode?: PanoScreenshotMode;
  /** Image encoding. Defaults to "png". */
  format?: PanoScreenshotFormat;
  /** Maximum output width in physical pixels. Preserves aspect ratio and never upscales. */
  outputWidth?: number;
  /** JPEG quality from 1 to 100. Defaults to 95. */
  quality?: number;
  /** In-view camera feedback. Use false for a silent capture without an animation. */
  feedback?: false | PanoScreenshotFeedback;
};

export const screenshotHotspot = { panoScreenshotHotspot: true };
type DomCapture = Awaited<ReturnType<typeof import("./screenshot-dom").loadScreenshotDom>>;

function normalizeOptions({
  mode = "panorama", format = "png", outputWidth, quality = 95, feedback,
}: PanoScreenshotOptions) {
  if (mode !== "panorama" && mode !== "hotspots" && mode !== "viewer") {
    throw new TypeError("Unknown panorama screenshot mode.");
  }
  if (format !== "png" && format !== "jpeg") throw new TypeError("Unknown screenshot format.");
  if (outputWidth !== undefined && (!Number.isSafeInteger(outputWidth) || outputWidth < 1)) {
    throw new RangeError("Screenshot outputWidth must be a positive integer.");
  }
  if (format === "jpeg" && (!Number.isInteger(quality) || quality < 1 || quality > 100)) {
    throw new RangeError("JPEG quality must be an integer from 1 to 100.");
  }
  const sound = feedback !== false && (feedback?.sound ?? true);
  const focus = feedback === false ? "none" : feedback?.focus ?? "none";
  if (typeof sound !== "boolean" || (focus !== "none" && focus !== "reticle" && focus !== "lens" && focus !== "both")) {
    throw new TypeError("Invalid screenshot feedback settings.");
  }
  return { mode, format, outputWidth, quality, sound, focus };
}

export function screenshotSize(width: number, height: number, outputWidth = width) {
  const scale = Math.min(1, outputWidth / width, 4096 / Math.max(width, height), Math.sqrt(8_294_400 / (width * height)));
  return [Math.max(1, Math.floor(width * scale)), Math.max(1, Math.floor(height * scale))] as const;
}

function encode(canvas: HTMLCanvasElement, format: PanoScreenshotFormat, quality: number) {
  const mime = format === "png" ? "image/png" : "image/jpeg";
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob?.size && blob.type === mime) resolve(blob);
      else reject(new DOMException(`Could not encode a ${format.toUpperCase()} screenshot.`, "EncodingError"));
    }, mime, format === "jpeg" ? quality / 100 : undefined);
  });
}

type Request = {
  options: ReturnType<typeof normalizeOptions>;
  validate: () => void;
  complete: (error: unknown, blob?: Blob) => void;
  signal: AbortSignal;
  captureDom?: DomCapture;
  ready: boolean;
  reading: boolean;
};

export function createScreenshotHost(root: RefObject<HTMLDivElement | null>) {
  let request: Request | null = null;
  let activeCanvas: HTMLCanvasElement | null = null;
  let contextLost = false;
  const feedback = createScreenshotFeedback();

  function cancel(message: string) {
    request?.complete(new DOMException(message, "AbortError"));
  }

  function read(canvas: HTMLCanvasElement, current: Request) {
    const element = root.current;
    if (canvas !== activeCanvas || !element?.contains(canvas) || !canvas.width || !canvas.height) {
      throw new DOMException("The viewer canvas is unavailable.", "InvalidStateError");
    }
    const { mode, format, outputWidth, quality, sound } = current.options;
    const snapshot = canvas.ownerDocument.createElement("canvas");
    [snapshot.width, snapshot.height] = screenshotSize(canvas.width, canvas.height, outputWidth);
    const ctx = snapshot.getContext("2d");
    if (!ctx) throw new DOMException("Could not create a screenshot canvas.", "EncodingError");
    ctx.drawImage(canvas, 0, 0, snapshot.width, snapshot.height);
    const result = current.captureDom && mode !== "panorama"
      ? current.captureDom(element, canvas, snapshot, mode, current.signal)
      : Promise.resolve(snapshot);
    if (sound) feedback.playShutter();
    void result.then((image) => {
      current.signal.throwIfAborted();
      return encode(image, format, quality);
    }).then((blob) => current.complete(null, blob), (error) => current.complete(error));
  }

  function take(canvas: HTMLCanvasElement, current: Request, draw?: () => void) {
    current.reading = true;
    try {
      current.validate();
      draw?.();
      read(canvas, current);
    } catch (error) {
      current.complete(error);
    }
  }

  return {
    bind(canvas: HTMLCanvasElement) {
      activeCanvas = canvas;
      contextLost = false;
      const lost = () => {
        if (activeCanvas !== canvas) return;
        contextLost = true;
        cancel("The viewer lost its rendering context.");
      };
      const restored = () => {
        if (activeCanvas === canvas) contextLost = false;
      };
      canvas.addEventListener("webglcontextlost", lost);
      canvas.addEventListener("webglcontextrestored", restored);
      return () => {
        canvas.removeEventListener("webglcontextlost", lost);
        canvas.removeEventListener("webglcontextrestored", restored);
        if (activeCanvas !== canvas) return;
        activeCanvas = null;
        cancel("The viewer canvas was removed.");
        feedback.dispose();
      };
    },
    cancel,
    async capture(options: PanoScreenshotOptions | undefined, validate: () => void) {
      const settings = normalizeOptions(options ?? {});
      validate();
      const element = root.current;
      if (request || !activeCanvas || contextLost || !element) {
        throw new DOMException(request ? "A screenshot is already in progress." : "The viewer canvas is unavailable.", "InvalidStateError");
      }
      if (settings.sound) feedback.prepareSound();
      return new Promise<Blob>((resolve, reject) => {
        const controller = new AbortController();
        const current: Request = {
          options: settings,
          validate,
          signal: controller.signal,
          ready: false,
          reading: false,
          complete(error, blob) {
            if (request !== current) return;
            request = null;
            clearTimeout(timer);
            controller.abort(error);
            if (blob) resolve(blob);
            else reject(error);
          },
        };
        const timer = setTimeout(() => {
          current.complete(new DOMException("The screenshot timed out.", "TimeoutError"));
        }, 10_000);
        request = current;
        const focus = feedback.focus(element, settings.focus, current.signal).catch(() => {});
        const dom = settings.mode === "panorama"
          ? undefined
          : import("./screenshot-dom").then(({ loadScreenshotDom }) => loadScreenshotDom());
        void Promise.all([focus, dom]).then(([, captureDom]) => {
          if (request !== current) return;
          current.captureDom = captureDom;
          current.ready = true;
        }, current.complete);
      });
    },
    beforeDraw(canvas: HTMLCanvasElement, scene: Scene, draw: () => void) {
      const current = request;
      if (!current?.ready || current.reading || current.options.mode !== "panorama") return;
      take(canvas, current, () => {
        const hotspots: Object3D[] = [];
        scene.traverseVisible((object) => {
          if (object.userData.panoScreenshotHotspot === true) hotspots.push(object);
        });
        for (const hotspot of hotspots) hotspot.visible = false;
        try {
          draw();
        } finally {
          for (const hotspot of hotspots) hotspot.visible = true;
        }
      });
    },
    afterDraw(canvas: HTMLCanvasElement) {
      const current = request;
      if (current?.ready && !current.reading && current.captureDom) take(canvas, current);
    },
    get awaitingDomFrame() {
      return !!request?.ready && !!request.captureDom && !request.reading;
    },
  };
}

export const ScreenshotContext = createContext<ReturnType<typeof createScreenshotHost> | null>(null);

/** Run after camera/scene updates and before Fiber's own main draw. */
export function ScreenshotFrame({ host, gpuDraw, isComparing }: {
  host: ReturnType<typeof createScreenshotHost>;
  gpuDraw?: (scene: Scene, camera: RootState["camera"]) => void;
  isComparing: () => boolean;
}) {
  const canvas = useThree((state) => state.gl.domElement);
  useLayoutEffect(() => host.bind(canvas), [canvas, host]);

  useFrame((state) => {
    if (state.gl.xr.isPresenting || isComparing()) return;
    const gpu = isWebGPURenderer(state.gl);
    if (state.internal.priority === (gpu ? 1 : 0)) {
      host.beforeDraw(canvas, state.scene, () => {
        if (gpuDraw) gpuDraw(state.scene, state.camera);
        else state.gl.render(state.scene, state.camera);
      });
    }
    if (host.awaitingDomFrame) {
      const unsubscribe = addAfterEffect(() => {
        unsubscribe();
        host.afterDraw(canvas);
      });
    }
  });
  return null;
}
