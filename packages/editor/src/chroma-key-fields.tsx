import { useState } from "react";
import { ChromaKeyColorSampler } from "@ericchen1990/pano-view/ui";
import type { HotspotChromaKey, ImageHotspotDefinition, VideoHotspotDefinition } from "@ericchen1990/pano-view";
import { DEFAULT_CHROMA_KEY, isChromaKeyColor } from "../../../shared/chroma-key";
import type { Translate } from "./i18n";

export function ChromaKeyFields({ hotspot, onChange, onBegin, onEnd, resolveMediaUrl, t }: {
  hotspot: ImageHotspotDefinition | VideoHotspotDefinition;
  onChange: (value: HotspotChromaKey | undefined) => void;
  onBegin: () => void;
  onEnd: () => void;
  resolveMediaUrl?: (path: string) => string;
  t: Translate;
}) {
  const key = hotspot.chromaKey;
  const [hex, setHex] = useState<string>();
  const [sampler, setSampler] = useState<{ source: string; url?: string }>();
  const source = sampler?.source === hotspot.src ? sampler : undefined;
  const update = (changes: Partial<HotspotChromaKey>) => {
    if (key) onChange({ ...key, ...changes });
  };

  return (
    <fieldset className="pne-chroma-key">
      <legend>{t("Chroma key")}</legend>
      <label className="pne-check">
        <input type="checkbox" checked={Boolean(key)} onChange={event => {
          setSampler(undefined);
          setHex(undefined);
          onEnd();
          onChange(event.currentTarget.checked ? { color: DEFAULT_CHROMA_KEY.color } : undefined);
        }} />
        {t("Enable chroma key")}
      </label>
      {key && (
        <div className="pne-fields">
          <div className="pne-chroma-color">
            <label>
              {t("Key color")}
              <input type="color" value={key.color} onFocus={onBegin} onBlur={onEnd}
                onChange={event => { setHex(undefined); update({ color: event.currentTarget.value.toUpperCase() }); }} />
            </label>
            <label>
              HEX
              <input type="text" value={hex ?? key.color} spellCheck={false} maxLength={7}
                aria-invalid={hex !== undefined && !isChromaKeyColor(hex)}
                onFocus={onBegin} onBlur={() => { setHex(undefined); onEnd(); }}
                onChange={event => {
                  const value = event.currentTarget.value;
                  setHex(value);
                  if (isChromaKeyColor(value)) update({ color: value.toUpperCase() });
                }} />
            </label>
          </div>
          {(["threshold", "smoothing"] as const).map(name => {
            const amount = key[name] ?? DEFAULT_CHROMA_KEY[name];
            return <label key={name}>
              {t(name === "threshold" ? "Key threshold" : "Edge smoothing")} <span aria-hidden="true">{amount.toFixed(2)}</span>
              <input type="range" min={0} max={1} step={0.01} value={amount}
                onFocus={onBegin} onBlur={onEnd} onPointerDown={onBegin} onPointerUp={onEnd} onPointerCancel={onEnd}
                onKeyDown={onBegin} onKeyUp={onEnd}
                onChange={event => update({ [name]: event.currentTarget.valueAsNumber })} />
            </label>;
          })}
          <button type="button" className="pne-subtle" aria-expanded={Boolean(source)} disabled={!hotspot.src}
            onClick={() => {
              if (source) { setSampler(undefined); return; }
              try {
                setSampler({ source: hotspot.src, url: resolveMediaUrl?.(hotspot.src) ?? hotspot.src });
              } catch {
                setSampler({ source: hotspot.src });
              }
            }}>
            {t(source ? "Close color sampler" : "Sample from source")}
          </button>
          {source?.url ? (
            <ChromaKeyColorSampler kind={hotspot.type} src={source.url}
              crossOrigin={hotspot.type === "video" ? hotspot.crossOrigin : undefined}
              labels={{
                loading: t("Loading source media…"),
                loadError: t("Could not load the source. Check its URL, format, and cross-origin permissions."),
                sampleError: t("Could not read this pixel. Check cross-origin permissions or choose another point."),
                pick: t("Sample a color. Use arrow keys to move and Enter to pick."),
                time: t("Video frame time"),
              }}
              onPick={color => { onEnd(); setHex(undefined); update({ color }); }}
            />
          ) : source && <p role="alert">{t("Could not load the source. Check its URL, format, and cross-origin permissions.")}</p>}
        </div>
      )}
    </fieldset>
  );
}
