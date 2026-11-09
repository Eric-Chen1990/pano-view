import assert from "node:assert/strict";
import { test } from "node:test";
import { scrollEdges } from "../src/spatial/scroll-edges";
function viewport() {
  return {
    scrollTop: 0,
    scrollLeft: 0,
    scrollHeight: 600,
    clientHeight: 200,
    scrollWidth: 300,
    clientWidth: 300,
    isConnected: true,
  } as HTMLElement;
}
const bounds = { x: 20, y: 100, width: 300, height: 200 };
test("scroll edges show only available directions and stay at viewport edges", () => {
  const target = viewport();
  let edges = scrollEdges(target, bounds, () => {});
  assert.deepEqual(
    edges.map((edge) => edge.icon),
    ["down"]
  );
  assert.equal(edges[0]!.y + edges[0]!.h, bounds.y + bounds.height - 6);
  const downId = edges[0]!.action.id;
  target.scrollTop = 100;
  edges = scrollEdges(target, bounds, () => {});
  assert.deepEqual(
    edges.map((edge) => edge.icon),
    ["up", "down"]
  );
  assert.equal(edges[0]!.y, bounds.y + 6);
  assert.equal(edges[1]!.action.id, downId);
  target.scrollTop = 400;
  assert.deepEqual(
    scrollEdges(target, bounds, () => {}).map((edge) => edge.icon),
    ["up"]
  );
  Object.assign(target, { scrollTop: 0, scrollHeight: 200 });
  assert.deepEqual(
    scrollEdges(target, bounds, () => {}),
    []
  );
});
test("gaze scroll keeps identity, updates the bound viewport and stops at its boundary", () => {
  const target = viewport(),
    other = viewport();
  let invalidations = 0;
  const down = scrollEdges(target, bounds, () => invalidations++)[0]!;
  assert.notEqual(
    down.action.id,
    scrollEdges(other, bounds, () => {})[0]!.action.id
  );
  down.action.update!(1);
  assert.equal(target.scrollTop, 40);
  assert.equal(other.scrollTop, 0);
  assert.equal(invalidations, 1);
  down.action.update!(10);
  assert.equal(target.scrollTop, 400);
  assert.equal(down.action.enabled!(), false);
  Object.defineProperty(target, "isConnected", { value: false });
  assert.equal(down.action.enabled!(), false);
});
