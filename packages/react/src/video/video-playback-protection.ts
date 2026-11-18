export function exceedsVideoTextureLimit(
  { videoWidth, videoHeight }: Pick<HTMLVideoElement, "videoWidth" | "videoHeight">,
  maxTextureSize: number,
): boolean {
  return videoWidth > maxTextureSize || videoHeight > maxTextureSize;
}

export class VideoTextureSizeError extends Error {
  constructor(video: HTMLVideoElement, maxTextureSize: number) {
    super(`The ${video.videoWidth}×${video.videoHeight} video exceeds the device's ${maxTextureSize} pixel texture limit.`);
    this.name = "VideoTextureSizeError";
  }
}

export function canRecoverWithVideoVariant(error: unknown): boolean {
  if (error instanceof VideoTextureSizeError) return true;
  if (typeof error !== "object" || error === null) return false;
  // MEDIA_ERR_DECODE and MEDIA_ERR_SRC_NOT_SUPPORTED. MediaError is not an Error subclass.
  if ("code" in error && (error.code === 3 || error.code === 4)) return true;
  if ("name" in error && error.name === "NotSupportedError") return true;
  return "type" in error && error.type === "mediaError" && "fatal" in error && error.fatal === true;
}
