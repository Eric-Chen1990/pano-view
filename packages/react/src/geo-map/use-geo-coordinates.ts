import { useEffect, useMemo, useState } from "react";
import { PANO_GEO_COORDINATE_SYSTEMS, type PanoGeoCoordinateSystem, type PanoGeoMapSpot, type PanoGeoPosition } from "../data/geo-map";
import { canConvert, coordinateSystem, type MapEngine, type PanoGeoMapSource } from "./engine";

type Conversion = { key: string; from: PanoGeoCoordinateSystem; point: PanoGeoPosition };

export function useGeoCoordinates(spots: readonly PanoGeoMapSpot[], source?: PanoGeoMapSource, engine?: MapEngine) {
  const system = source && coordinateSystem(source);
  const conversions = useMemo(() => {
    const result: Conversion[] = [];
    if (!source || !system) return result;
    for (const spot of spots) {
      if (spot.positions[system]) continue;
      for (const from of PANO_GEO_COORDINATE_SYSTEMS) {
        const point = spot.positions[from];
        if (point && canConvert(source, from)) {
          result.push({ key: conversionKey(from, point), from, point });
          break;
        }
      }
    }
    return result;
  }, [source, spots, system]);
  const [state, setState] = useState<{
    engine: MapEngine; positions: Map<string, PanoGeoPosition | undefined>; pending: boolean;
  }>();

  useEffect(() => {
    if (!engine?.convert || !conversions.length) return;
    let current = true;
    const matches = state?.engine === engine ? state.positions : new Map<string, PanoGeoPosition | undefined>();
    const missing = new Map(conversions.filter(({ key }) => !matches.has(key)).map((item) => [item.key, item]));
    if (!missing.size) return;
    const completed = new Map(matches);
    setState({ engine, positions: matches, pending: true });
    async function convert() {
      for (const from of PANO_GEO_COORDINATE_SYSTEMS) {
        const group = [...missing.values()].filter((item) => item.from === from);
        const batchSize = source?.kind === "baidu" ? 10 : 40;
        for (let offset = 0; offset < group.length && current; offset += batchSize) {
          const batch = group.slice(offset, offset + batchSize);
          const converted = await engine!.convert!(batch.map(({ point }) => point), from).catch(() => []);
          batch.forEach(({ key }, index) => completed.set(key, converted[index]));
        }
      }
      if (current) setState({ engine: engine!, positions: completed, pending: false });
    }
    void convert();
    return () => { current = false; };
    // Published results are a cache for the current map instance.
    // The request depends on inputs, never on its own result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversions, engine, source]);

  const resolved = useMemo(() => {
    const points = new Map<string, PanoGeoPosition>();
    if (!system) return points;
    const cache = state?.engine === engine ? state?.positions : undefined;
    for (const spot of spots) {
      const saved = spot.positions[system];
      const item = source && !saved ? PANO_GEO_COORDINATE_SYSTEMS.find((from) =>
        !!spot.positions[from] && canConvert(source, from)) : undefined;
      const point = saved ?? (item ? cache?.get(conversionKey(item, spot.positions[item]!)) : undefined);
      if (point) points.set(spot.id, point);
    }
    return points;
  }, [engine, source, spots, state, system]);
  const pending = !!engine?.convert && conversions.some(({ key }) => state?.engine !== engine || !state?.positions.has(key));
  return { resolved, pending };
}

function conversionKey(from: PanoGeoCoordinateSystem, point: PanoGeoPosition): string {
  return `${from}:${point.lat},${point.lng}`;
}
