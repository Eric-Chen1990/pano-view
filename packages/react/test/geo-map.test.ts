import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePanoProject } from "../src/data/project";
import { parsePanoGeoMap, resolvePanoGeoMapAssets } from "../src/data/geo-map";
import { canConvert, coordinateSystem } from "../src/geo-map/engine";

const ids = new Set(["entrance"]);
const spot = { id: "door", sceneId: "entrance", positions: { gcj02: { lat: 39.9, lng: 116.4 } }, icon: "door.svg", heading: -15 };

test("geo map coexists with a floor plan and resolves only authored icons", () => {
  const parsed = parsePanoProject({
    schemaVersion: 1,
    scenes: [{ id: "entrance", source: { viewerUrl: "./viewer.json" } }],
    map: { image: "floor.svg", spots: [] },
    geoMap: { spots: [spot], initialSourceId: "amap", sector: false },
  });
  assert.equal(parsed.map?.image, "floor.svg");
  assert.equal(parsed.geoMap?.spots[0].heading, 345);
  assert.equal(parsed.geoMap?.sector, false);
  const resolved = resolvePanoGeoMapAssets(parsed.geoMap!, "https://example.test/tour/", (path, context) => {
    assert.equal(path, "door.svg");
    assert.equal(context.sceneId, "entrance");
    assert.equal(context.hotspotId, "door");
    return context.defaultUrl;
  });
  assert.equal(resolved.spots[0].icon, "https://example.test/tour/door.svg");
  assert.deepEqual(resolved.spots[0].positions, spot.positions);
  assert.equal(parsed.geoMap?.spots[0].icon, "door.svg");
});

test("geo map rejects duplicate IDs, missing scenes and invalid coordinates", () => {
  assert.throws(() => parsePanoGeoMap({ spots: [spot, spot] }, ids), /duplicate spot ID/);
  assert.throws(() => parsePanoGeoMap({ spots: [{ ...spot, sceneId: "missing" }] }, ids), /scene does not exist/);
  assert.throws(() => parsePanoGeoMap({ spots: [{ ...spot, positions: {} }] }, ids), /at least one position/);
  for (const positions of [{ gcj02: { lat: 92, lng: 1 } }, { gcj02: { lat: 20, lng: Infinity } }, { gps: { lat: 2, lng: 1 } }])
    assert.throws(() => parsePanoGeoMap({ spots: [{ ...spot, positions }] }, ids), /valid latitude\/longitude/);
});

test("providers only attempt supported conversion directions", () => {
  const base = { id: "map", label: "Map" };
  const amap = { ...base, kind: "amap", apiKey: "test", serviceHost: "/_AMapService" } as const;
  const baidu = { ...base, kind: "baidu", ak: "test" } as const;
  const google = { ...base, kind: "google", apiKey: "test" } as const;
  assert.equal(coordinateSystem(amap), "gcj02");
  assert.equal(coordinateSystem(baidu), "bd09");
  assert.equal(coordinateSystem(google), "wgs84");
  assert.ok(canConvert(amap, "bd09"));
  assert.ok(canConvert(baidu, "gcj02"));
  assert.equal(canConvert(google, "gcj02"), false);
});
