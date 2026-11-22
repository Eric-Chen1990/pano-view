import { useRef, useState, type KeyboardEvent } from "react";

const labels = {
  loading: "Loading source media…",
  loadError: "Could not load the source. Check its URL, format, and cross-origin permissions.",
  sampleError: "Could not read this pixel. Check cross-origin permissions or choose another point.",
  pick: "Sample a color. Use arrow keys to move and Enter to pick.",
  time: "Video frame time",
};

export type ChromaKeyColorSamplerProps = {
  src: string;
  kind: "image" | "video";
  crossOrigin?: "" | "anonymous" | "use-credentials";
  onPick: (color: string) => void;
  labels?: Partial<Record<keyof typeof labels, string>>;
  className?: string;
};

export function ChromaKeyColorSampler(props: ChromaKeyColorSamplerProps) {
  return <ColorSampler key={JSON.stringify([props.src, props.kind, props.crossOrigin])} {...props} />;
}

const center = { x: 0.5, y: 0.5 };
const clamp = (value: number) => Math.min(1, Math.max(0, value));

function ColorSampler({ src, kind, crossOrigin = "anonymous", onPick, labels: overrides, className }: ChromaKeyColorSamplerProps) {
  const messages = { ...labels, ...overrides };
  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<"loadError" | "sampleError">();
  const [position, setPosition] = useState(center);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  function sample(point: typeof center) {
    const video = videoRef.current;
    const source = video ?? imageRef.current;
    const width = video?.videoWidth ?? imageRef.current?.naturalWidth ?? 0;
    const height = video?.videoHeight ?? imageRef.current?.naturalHeight ?? 0;
    if (!ready || !source || !width || !height || video?.seeking) return;
    setPosition(point);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas 2D unavailable");
      const x = Math.min(width - 1, Math.floor(point.x * width));
      const y = Math.min(height - 1, Math.floor(point.y * height));
      context.drawImage(source, x, y, 1, 1, 0, 0, 1, 1);
      const data = context.getImageData(0, 0, 1, 1).data;
      if (!data[3]) throw new Error("Transparent pixel");
      const hex = Array.from(data.subarray(0, 3), value => value.toString(16).padStart(2, "0")).join("");
      setError(undefined);
      onPick(`#${hex.toUpperCase()}`);
    } catch {
      setError("sampleError");
    }
  }

  function move(event: KeyboardEvent<HTMLButtonElement>) {
    const step = event.shiftKey ? 0.1 : 0.02;
    const x = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
    const y = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
    if (!x && !y) return;
    event.preventDefault();
    setPosition(point => ({ x: clamp(point.x + x), y: clamp(point.y + y) }));
  }

  const mediaProps = {
    crossOrigin,
    src,
    onError: () => { setReady(false); setError("loadError"); },
    style: { display: "block", maxWidth: "100%", maxHeight: "min(40vh, 300px)", width: "auto", height: "auto" },
  };

  return (
    <div className={className}>
      <div style={{ position: "relative", display: "table", maxWidth: "100%", marginInline: "auto" }}>
        {kind === "video" ? (
          <video {...mediaProps} ref={videoRef} muted playsInline preload="auto"
            onLoadedMetadata={event => {
              const length = event.currentTarget.duration;
              setDuration(Number.isFinite(length) ? length : 0);
            }}
            onLoadedData={() => setReady(true)}
            onSeeked={event => {
              setTime(event.currentTarget.currentTime);
              setReady(true);
            }}
          />
        ) : <img {...mediaProps} ref={imageRef} alt="" onLoad={() => setReady(true)} />}
        {ready && (
          <button
            type="button"
            aria-label={messages.pick}
            style={{ position: "absolute", inset: 0, width: "100%", padding: 0, border: 0, background: "transparent", cursor: "crosshair" }}
            onKeyDown={move}
            onClick={event => {
              if (event.detail === 0) { sample(position); return; }
              const rect = event.currentTarget.getBoundingClientRect();
              sample({ x: clamp((event.clientX - rect.left) / rect.width), y: clamp((event.clientY - rect.top) / rect.height) });
            }}
          >
            <span aria-hidden="true" style={{
              position: "absolute", pointerEvents: "none", left: `${position.x * 100}%`, top: `${position.y * 100}%`,
              width: 12, height: 12, transform: "translate(-50%, -50%)", border: "2px solid white",
              boxShadow: "0 0 0 1px black", borderRadius: "50%",
            }} />
          </button>
        )}
      </div>
      {duration > 0 && error !== "loadError" && (
        <label style={{ display: "grid", gap: 4 }}>
          {messages.time}
          <input type="range" min={0} max={duration} step="any" value={time}
            onChange={event => {
              const video = videoRef.current;
              if (!video) return;
              const next = Math.min(event.currentTarget.valueAsNumber, Math.max(0, duration - 0.001));
              setTime(next);
              if (next === video.currentTime) return;
              video.currentTime = next;
            }}
          />
        </label>
      )}
      {error ? <p role="alert">{messages[error]}</p> : !ready ? <p role="status">{messages.loading}</p> : null}
    </div>
  );
}
