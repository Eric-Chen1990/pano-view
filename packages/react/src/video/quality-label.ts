import { defaultPanoUiTranslate, type PanoUiTranslate } from "../ui-translation";
import type {
  PanoVideoHlsLevel,
  PanoVideoHlsQuality,
  PanoVideoHlsSelection,
  PanoVideoQualitySwitch,
  PanoVideoVariant,
} from "./types";

// Equirectangular masters are named from the encoded width. 3840×2048 is 4K;
// anything narrower keeps its real height, so 2026×1080 stays 1080p.
const PANORAMA_WIDTH_LABELS = [
  { minWidth: 7680, label: "8K" },
  { minWidth: 5760, label: "6K" },
  { minWidth: 5120, label: "5K" },
  { minWidth: 3840, label: "4K" },
] as const;

export type HlsQualityMenuItem = {
  id: string;
  label: string;
  active: boolean;
};

type QualityLabelInput = {
  variantId: string;
  variants: readonly PanoVideoVariant[];
  hlsQuality?: PanoVideoHlsQuality;
  qualitySwitch?: PanoVideoQualitySwitch;
};

export function formatVideoQualitySize(width: number, height: number): string {
  for (const { minWidth, label } of PANORAMA_WIDTH_LABELS) {
    if (width >= minWidth) return label;
  }
  return `${Math.round(height)}p`;
}

export function videoQualitySwitchStatus(
  state: PanoVideoQualitySwitch["state"],
): string {
  switch (state) {
    case "buffering":
      return "Switching…";
    case "awaiting-gesture":
      return "Tap to switch";
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

export function hlsLevelLabels(
  levels: readonly PanoVideoHlsLevel[],
): ReadonlyMap<number, string> {
  const groups = new Map<string, PanoVideoHlsLevel[]>();
  for (const level of levels) {
    const base = baseLabel(level);
    const group = groups.get(base);
    if (group) group.push(level);
    else groups.set(base, [level]);
  }
  const byIndex = new Map<number, string>();
  for (const [base, group] of groups) {
    const resolved = group.length === 1 ? [base] : disambiguate(group, base);
    group.forEach((level, index) => {
      byIndex.set(level.index, resolved[index]!);
    });
  }
  const labels = new Map<number, string>();
  for (const level of levels) {
    const label = byIndex.get(level.index);
    if (label !== undefined && !labels.has(level.index)) labels.set(level.index, label);
  }
  return labels;
}

export function hlsQualityMenuItems(
  quality: PanoVideoHlsQuality,
  qualitySwitch?: PanoVideoQualitySwitch,
  t: PanoUiTranslate = defaultPanoUiTranslate,
): HlsQualityMenuItem[] {
  const labels = hlsLevelLabels(quality.levels);
  const pending = pendingLevel(qualitySwitch);
  const selected = pending ?? quality.selectedLevel;
  const status = qualitySwitch ? t(videoQualitySwitchStatus(qualitySwitch.state)) : undefined;
  return [
    { id: "auto", level: "auto" as const, label: t("Auto") },
    ...quality.levels.map((level) => ({
      id: String(level.index),
      level: level.index,
      label: labels.get(level.index) ?? t("Quality"),
    })),
  ].map((item) => ({
    id: item.id,
    label: status && pending === item.level ? `${item.label} · ${status}` : item.label,
    active: selected === item.level,
  }));
}

export function videoQualityButtonLabel({
  variantId,
  variants,
  hlsQuality,
  qualitySwitch,
}: QualityLabelInput, t: PanoUiTranslate = defaultPanoUiTranslate): string {
  const explicitVariants = variants.length > 1;
  if (explicitVariants) {
    const target = qualitySwitch?.target;
    const id = target && "variantId" in target ? target.variantId : variantId;
    const name = variants.find((variant) => variant.id === id)?.label ?? t("Quality");
    return withStatus(name, qualitySwitch, t);
  }
  if (!hlsQuality) return t("Quality");
  const pending = pendingLevel(qualitySwitch);
  const selection = pending ?? hlsQuality.selectedLevel;
  // A switch to Auto has not landed on a rendition yet, so the target name
  // stays "Auto" until the status clears and the current frame can be shown.
  const name = selection === "auto"
    ? pending === "auto" ? t("Auto") : autoQualityLabel(hlsQuality, t("Auto"))
    : hlsLevelLabels(hlsQuality.levels).get(selection) ?? t("Quality");
  return withStatus(name, qualitySwitch, t);
}

function autoQualityLabel(quality: PanoVideoHlsQuality, auto: string): string {
  const decoded = sizeOf(quality.resolution?.width, quality.resolution?.height);
  const active = quality.activeLevel == null
    ? undefined
    : quality.levels.find((level) => level.index === quality.activeLevel);
  const size = decoded ?? (active ? sizeOf(active.width, active.height) : undefined);
  return size ? `${auto} · ${formatVideoQualitySize(size.width, size.height)}` : auto;
}

function withStatus(label: string, qualitySwitch: PanoVideoQualitySwitch | undefined, t: PanoUiTranslate): string {
  if (!qualitySwitch) return label;
  return `${label} · ${t(videoQualitySwitchStatus(qualitySwitch.state))}`;
}

function pendingLevel(
  qualitySwitch: PanoVideoQualitySwitch | undefined,
): PanoVideoHlsSelection | undefined {
  const target = qualitySwitch?.target;
  return target && "level" in target ? target.level : undefined;
}

function baseLabel(level: PanoVideoHlsLevel): string {
  const size = sizeOf(level.width, level.height);
  if (size) return formatVideoQualitySize(size.width, size.height);
  return bitrateLabel(level.bitrate) ?? levelIndexLabel(level.index);
}

function disambiguate(group: readonly PanoVideoHlsLevel[], base: string): string[] {
  let labels = group.map(() => base);
  const discriminators = [
    (level: PanoVideoHlsLevel) => bitrateLabel(level.bitrate),
    (level: PanoVideoHlsLevel) => {
      const size = sizeOf(level.width, level.height);
      return size ? `${size.width} × ${size.height}` : undefined;
    },
    (level: PanoVideoHlsLevel) => levelIndexLabel(level.index),
  ];
  for (const discriminator of discriminators) {
    if (unique(labels)) break;
    const next = labels.map((label, index) => {
      if (!collides(labels, label)) return label;
      const extra = discriminator(group[index]!);
      if (!extra || label.split(" · ").includes(extra)) return label;
      return `${label} · ${extra}`;
    });
    if (uniqueCount(next) > uniqueCount(labels)) labels = next;
  }
  return labels;
}

function bitrateLabel(bitrate: number): string | undefined {
  if (!(bitrate > 0)) return undefined;
  return `${Math.round(bitrate / 1000)} kbps`;
}

function levelIndexLabel(index: number): string {
  return `Level ${index}`;
}

function sizeOf(
  width: number | undefined,
  height: number | undefined,
): { width: number; height: number } | undefined {
  if (width == null || height == null || !(width > 0) || !(height > 0)) return undefined;
  return { width, height };
}

function collides(labels: readonly string[], label: string): boolean {
  let seen = 0;
  for (const item of labels) {
    if (item !== label) continue;
    seen += 1;
    if (seen > 1) return true;
  }
  return false;
}

function unique(labels: readonly string[]): boolean {
  return uniqueCount(labels) === labels.length;
}

function uniqueCount(labels: readonly string[]): number {
  return new Set(labels).size;
}
