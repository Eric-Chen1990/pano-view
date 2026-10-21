const INLINE_VIDEO_ATTRIBUTES = [
  ["playsinline", "true"],
  ["webkit-playsinline", "true"],
  ["x5-playsinline", "true"],
  ["x5-video-player-type", "h5-page"],
  ["x5-video-player-fullscreen", "false"],
] as const;

/**
 * Keep a texture `<video>` in the page on iOS Safari and X5 browsers
 * (WeChat, QQ, and older UC). X5's `h5-page` mode leaves the element in
 * the document so WebGL can sample its frames. Picture-in-picture and
 * remote playback stay disabled so those frames are not detached.
 *
 * `inline` follows `playsInline`. Turning it off removes only the
 * inline-player attributes, which is what lets iOS open its player.
 */
export function applyInlineVideoPlayback(
  video: HTMLVideoElement,
  inline: boolean,
): void {
  video.controls = false;
  video.playsInline = inline;
  video.disablePictureInPicture = true;
  video.disableRemotePlayback = true;
  video.setAttribute("disablepictureinpicture", "");
  video.setAttribute("disableremoteplayback", "");
  video.setAttribute("x-webkit-airplay", "deny");
  video.setAttribute(
    "controlsList",
    "nodownload nofullscreen noremoteplayback",
  );
  if (inline) {
    for (const [name, value] of INLINE_VIDEO_ATTRIBUTES) {
      video.setAttribute(name, value);
    }
    return;
  }
  for (const [name] of INLINE_VIDEO_ATTRIBUTES) {
    video.removeAttribute(name);
  }
}

/**
 * Mount a texture video inside the viewer. A 1px box at opacity 0 stays
 * connected to the decoder; `display: none` freezes the texture on several
 * mobile browsers, and an off-screen box can be paused.
 */
export function mountTextureVideo(
  video: HTMLVideoElement,
  canvas: HTMLElement,
): void {
  const parent = canvas.closest("[data-pano-viewer]") ?? canvas.parentElement;
  if (!parent) {
    return;
  }
  video.tabIndex = -1;
  video.setAttribute("aria-hidden", "true");
  video.setAttribute("data-pano-texture-video", "");
  video.style.position = "absolute";
  video.style.top = "0";
  video.style.left = "0";
  video.style.width = "1px";
  video.style.height = "1px";
  video.style.opacity = "0";
  video.style.pointerEvents = "none";
  if (video.parentElement !== parent) {
    parent.appendChild(video);
  }
}
