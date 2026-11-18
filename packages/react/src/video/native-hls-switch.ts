import { probeMediaHasAudio } from "../controls/media-audio";
import { isAutoplayPolicyError } from "../media-activation-event";

const MAX_DRIFT = 0.1;
const SWITCH_TIMEOUT = 10_000;
const MIN_BUFFER = 0.25;
const SEEK_DRIFT = 0.4;
const SEEK_LEAD = 0.08;

function bufferedAt(video: HTMLVideoElement, time: number, ahead: number): boolean {
  for (let index = 0; index < video.buffered.length; index++) {
    if (video.buffered.start(index) <= time && video.buffered.end(index) >= Math.min(video.duration, time + ahead)) return true;
  }
  return false;
}

export function prepareNativeHlsSwitch(
  current: HTMLVideoElement,
  next: HTMLVideoElement,
  callbacks: {
    commit: () => void;
    awaitingGesture: () => void;
    fail: (error: unknown) => void;
  },
) {
  let running = true;
  let waitingForGesture = false;
  let playingCandidate = false;
  let committing = false;
  let animationFrame = 0;
  let lastSeek = -Infinity;
  let restoreAudio: (() => void) | undefined;
  let audioTimeout: ReturnType<typeof setTimeout> | undefined;
  const timeout = setTimeout(() => fail(new Error("The requested HLS quality could not be prepared in time.")), SWITCH_TIMEOUT);

  const stop = () => {
    if (!running) return;
    running = false;
    clearTimeout(timeout);
    clearTimeout(audioTimeout);
    cancelAnimationFrame(animationFrame);
    next.removeEventListener("error", onError);
    restoreAudio?.();
  };

  function fail(error: unknown) {
    if (!running) return;
    stop();
    callbacks.fail(error);
  }

  function onError() {
    fail(next.error ?? new Error("Unable to load the requested HLS quality."));
  }

  const aligned = () => {
    const isPlaying = !current.paused;
    const time = current.currentTime;
    return !current.seeking && !current.ended && !next.seeking && next.videoWidth > 0 &&
      next.readyState >= (isPlaying ? next.HAVE_FUTURE_DATA : next.HAVE_CURRENT_DATA) &&
      (!isPlaying || bufferedAt(next, time, MIN_BUFFER)) &&
      Math.abs(next.currentTime - time) <= MAX_DRIFT &&
      (probeMediaHasAudio(current) !== true || probeMediaHasAudio(next) !== false);
  };

  const commit = () => {
    const playing = !current.paused;
    const muted = current.muted;
    next.loop = current.loop;
    next.volume = current.volume;
    next.playbackRate = current.playbackRate;
    next.muted = muted;
    if (playing && !muted && probeMediaHasAudio(next) !== false) {
      // Briefly mute the old element while testing audible playback on the
      // prepared element. Restore its audio if WebKit rejects the handoff.
      current.muted = true;
      restoreAudio = () => { current.muted = muted; };
    }
    committing = true;

    const finish = () => {
      if (!running) return;
      restoreAudio = undefined;
      stop();
      callbacks.commit();
    };
    const retry = (error?: unknown) => {
      if (!running || !committing) return;
      clearTimeout(audioTimeout);
      restoreAudio?.();
      restoreAudio = undefined;
      committing = false;
      next.muted = true;
      if (isAutoplayPolicyError(error)) {
        waitingForGesture = true;
        callbacks.awaitingGesture();
        if (next.paused) prime(true);
      } else if (error) {
        fail(error);
      }
    };

    if (!playing) {
      next.pause();
      finish();
      return;
    }
    audioTimeout = setTimeout(() => retry(new Error("The target HLS quality did not start playing.")), 400);
    void next.play().then(() => {
      if (!running || !committing) return;
      if (current.paused || !aligned()) {
        retry();
        return;
      }
      finish();
    }, retry);
  };

  const prime = (keepGesturePrompt = false) => {
    if (!keepGesturePrompt) waitingForGesture = false;
    playingCandidate = true;
    void next.play().catch((error: unknown) => {
      if (!running) return;
      if (!isAutoplayPolicyError(error)) {
        fail(error);
        return;
      }
      waitingForGesture = true;
      callbacks.awaitingGesture();
    }).finally(() => { playingCandidate = false; });
  };

  const sync = (now: number) => {
    if (!running) return;
    animationFrame = requestAnimationFrame(sync);
    if (committing || playingCandidate || current.seeking || next.readyState < next.HAVE_METADATA) return;
    const playing = !current.paused;
    const drift = current.currentTime - next.currentTime;
    if (!waitingForGesture && aligned() && (current.paused || !next.paused)) {
      commit();
      return;
    }
    if (next.paused && !waitingForGesture && (playing || next.seeking)) {
      // Some native decoders leave a paused seek pending until playback starts.
      prime();
    }
    if (playingCandidate || (waitingForGesture && next.paused)) return;
    if (next.seeking && now - lastSeek < 1_500) return;
    if (!next.seeking && next.readyState < next.HAVE_CURRENT_DATA) return;
    if (!Number.isFinite(current.duration) || !Number.isFinite(next.duration) ||
        Math.abs(next.duration - current.duration) > 1 || current.ended) {
      fail(new Error("HLS quality switching requires aligned on-demand playlists."));
      return;
    }
    if ((next.seeking || Math.abs(drift) > (playing ? SEEK_DRIFT : MAX_DRIFT)) && now - lastSeek > 300) {
      const time = Math.min(next.duration, current.currentTime + (playing ? SEEK_LEAD : 0));
      if (lastSeek === -Infinity || !playing || bufferedAt(next, time, MIN_BUFFER) || now - lastSeek > 1_000) {
        lastSeek = now;
        next.currentTime = time;
        return;
      }
    }
    // Once the clocks are close, close the gap without another decoder flush.
    const rate = current.playbackRate * (
      playing && Math.abs(drift) > MAX_DRIFT / 2 ? (drift > 0 ? 1.15 : 0.85) : 1
    );
    if (next.playbackRate !== rate) {
      try {
        next.playbackRate = rate;
      } catch {
        // Some native engines limit playback rates before the handoff.
      }
    }
  };

  next.addEventListener("error", onError);
  animationFrame = requestAnimationFrame(sync);
  return {
    start: () => prime(),
    cancel: stop,
    confirm() {
      if (!running || !waitingForGesture || committing) return;
      if (aligned()) commit();
      else if (next.paused) {
        // The click must reach play() synchronously when WebKit requires it.
        prime();
      }
    },
  };
}
