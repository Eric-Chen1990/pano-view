import type { HotspotKind } from "./document";

export type LocalMediaKind = "image" | "video" | "audio" | "svg";

export const mediaAccept: Record<LocalMediaKind, string> = {
  image: "image/*",
  video: "video/*",
  audio: "audio/*,.mp3,.wav,.ogg,.oga,.opus,.m4a,.m4b,.aac,.flac,.weba,.caf",
  svg: "image/svg+xml,.svg",
};

const mimeByExtension: Record<string, string> = {
  avif: "image/avif",
  bmp: "image/bmp",
  gif: "image/gif",
  ico: "image/x-icon",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
  m4v: "video/mp4",
  mov: "video/quicktime",
  mp4: "video/mp4",
  ogv: "video/ogg",
  webm: "video/webm",
  aac: "audio/aac",
  caf: "audio/x-caf",
  flac: "audio/flac",
  m4a: "audio/mp4",
  m4b: "audio/mp4",
  mp3: "audio/mpeg",
  oga: "audio/ogg",
  ogg: "audio/ogg",
  opus: "audio/opus",
  wav: "audio/wav",
  weba: "audio/webm",
};

type AssetPickerDetails = { title: string; mediaKind?: LocalMediaKind };

export function hotspotAssetPicker(field: string, type?: HotspotKind): AssetPickerDetails {
  switch (field) {
    case "graphic.src": return { title: "Choose SVG graphic", mediaKind: "svg" };
    case "tooltip.image": return { title: "Choose tooltip image", mediaKind: "image" };
    case "poster": return { title: "Choose hotspot video poster", mediaKind: "image" };
    case "icon": return { title: "Choose audio icon", mediaKind: "image" };
    case "playingIcon": return { title: "Choose audio playing icon", mediaKind: "image" };
    case "src":
      switch (type) {
        case "image": return { title: "Choose hotspot image", mediaKind: "image" };
        case "sequence": return { title: "Choose sprite sheet", mediaKind: "image" };
        case "video": return { title: "Choose hotspot video", mediaKind: "video" };
        case "audio": return { title: "Choose hotspot audio", mediaKind: "audio" };
        case "iframe": return { title: "Choose iframe document" };
      }
  }
  return { title: "Browse assets" };
}

export function popupAssetPicker(
  field: "src" | "poster",
  type: "image" | "video" | "audio",
): AssetPickerDetails {
  if (field === "poster") return { title: "Choose popup video poster", mediaKind: "image" };
  const titles = { image: "Choose popup image", video: "Choose popup video", audio: "Choose popup audio" };
  return { title: titles[type], mediaKind: type };
}

export function audioExtension(type: string) {
  switch (type.split(";")[0]) {
    case "audio/mp3":
    case "audio/mpeg": return "mp3";
    case "application/ogg":
    case "audio/ogg": return "ogg";
    case "audio/x-wav":
    case "audio/wave":
    case "audio/wav": return "wav";
    case "audio/mp4":
    case "audio/x-m4a": return "m4a";
    case "audio/caf":
    case "audio/x-caf": return "caf";
    case "audio/flac":
    case "audio/x-flac": return "flac";
    case "audio/webm": return "weba";
    case "audio/aac": return "aac";
    case "audio/opus": return "opus";
  }
}

function mediaType(file: File) {
  if (file.type === "application/ogg") return "audio/ogg";
  if (file.type && file.type !== "application/octet-stream") return file.type;
  const extension = file.name.match(/\.([a-z\d]+)$/i)?.[1]?.toLowerCase();
  return extension && Object.prototype.hasOwnProperty.call(mimeByExtension, extension)
    ? mimeByExtension[extension]
    : undefined;
}

function matchesMediaType(mime: string, kind: LocalMediaKind) {
  return kind === "svg" ? mime === "image/svg+xml" : mime.startsWith(`${kind}/`);
}

export function matchesLocalMedia(file: File, kind: LocalMediaKind) {
  const mime = mediaType(file);
  return file.size > 0 && mime !== undefined && matchesMediaType(mime, kind);
}

export function selectLocalMedia(files: readonly File[], kind: LocalMediaKind, directory = false): File {
  const file = files[0];
  if (directory || files.length !== 1 || !file) {
    throw new Error("Choose one file at a time.");
  }
  const mime = mediaType(file);
  const error = {
    image: "Choose an image file.",
    video: "Choose a video file, such as MP4 or WebM.",
    audio: "Choose an audio file, such as MP3 or WAV.",
    svg: "Choose an SVG image.",
  }[kind];
  if (!file.size || !mime || !matchesMediaType(mime, kind)) {
    throw new Error(error);
  }
  return mime === file.type ? file : new File([file], file.name, {
    type: mime, lastModified: file.lastModified,
  });
}
