import assert from "node:assert/strict";
import { test } from "node:test";
import {
  commonFields,
  contentFields,
  parseFieldInput,
  pointFields,
  type FieldSpec,
} from "../src/fields";
import { hotspotFieldSpec } from "../src/hotspot-field-specs";
import { fieldValue } from "../src/hotspot-defaults";
import { translator } from "../src/i18n";

const numeric = (name: string) => hotspotFieldSpec({ name, type: "number" });

test("hotspot numeric rules follow the saved contract, preserving signed and decimal values", () => {
  for (const name of [
    "opacity",
    "fillOpacity",
    "strokeOpacity",
    "backgroundOpacity",
    "volume",
  ]) {
    for (const value of ["0", "0.25", "1"])
      assert.equal(parseFieldInput(numeric(name), value), Number(value));
    for (const value of ["-0.01", "1.01"])
      assert.throws(() => parseFieldInput(numeric(name), value));
  }
  for (const name of [
    "width",
    "height",
    "scale",
    "distance",
    "referenceFov",
    "fps",
    "fontSize",
    "lineHeight",
  ]) {
    assert.throws(() => parseFieldInput(numeric(name), "0"));
    assert.throws(() => parseFieldInput(numeric(name), "-1"));
    assert.equal(parseFieldInput(numeric(name), "0.001"), 0.001);
  }
  for (const name of [
    "renderOrder",
    "position.yaw",
    "rotation",
    "strokeWidth",
    "graphic.innerRadius",
    "range",
    "tooltipOffset",
  ]) {
    assert.equal(parseFieldInput(numeric(name), "-1.5"), -1.5);
    for (const value of ["NaN", "Infinity", "1e999", "-"])
      assert.throws(() => parseFieldInput(numeric(name), value));
  }
  for (const name of ["position.pitch", "pitch"]) {
    for (const value of ["-90", "0.5", "90"])
      assert.equal(parseFieldInput(numeric(name), value), Number(value));
    for (const value of ["-90.01", "90.01"])
      assert.throws(() => parseFieldInput(numeric(name), value));
  }
});

test("required coordinates and frame counts cannot be deleted, while optional values restore defaults", () => {
  for (const name of [
    "position.yaw",
    "position.pitch",
    "yaw",
    "pitch",
    "frameCount",
  ]) {
    assert.throws(() => parseFieldInput(numeric(name), ""));
  }
  for (const value of ["0", "-1", "2.5", "9007199254740992"])
    assert.throws(() => parseFieldInput(numeric("frameCount"), value));
  assert.equal(
    parseFieldInput(numeric("frameCount"), "9007199254740991"),
    Number.MAX_SAFE_INTEGER
  );
  assert.equal(parseFieldInput(numeric("frameCount"), "1"), 1);
  const cleared = parseFieldInput(numeric("opacity"), "");
  assert.equal(cleared, undefined);
  assert.equal(fieldValue(cleared, 1), 1);
  assert.equal(fieldValue(0, 1), 0);
  assert.throws(() => parseFieldInput(numeric("renderOrder"), "", true));
  assert.throws(() => parseFieldInput(numeric("frameCount"), "1e", true));
  assert.equal(hotspotFieldSpec({ name: "label" }).number, undefined);
});

test("referrer and existing enumerations reject unsupported values without restricting CSS and text", () => {
  const referrer = contentFields.iframe!.find(
    (spec) => spec.name === "referrerPolicy"
  )!;
  assert.equal(parseFieldInput(referrer, "strict-origin"), "strict-origin");
  assert.equal(parseFieldInput(referrer, ""), undefined);
  assert.throws(() => parseFieldInput(referrer, "unknown-policy"));
  const pointer = commonFields.find((spec) => spec.name === "pointerEvents")!;
  assert.equal(parseFieldInput(pointer, "none"), "none");
  assert.throws(() => parseFieldInput(pointer, "yes"));
  for (const [name, value] of [
    ["cursor", 'url("cursor.cur"), pointer'],
    ["background", "rgba(1,2,3,0.5)"],
    ["fontWeight", "bold"],
    ["sandbox", "allow-scripts allow-forms"],
  ]) {
    assert.equal(parseFieldInput({ name: name! }, value!), value);
  }
});

test("technical hotspot help and option labels have Chinese translations", () => {
  const t = translator("zh-CN");
  const specs: FieldSpec[] = [
    ...commonFields,
    ...pointFields,
    ...Object.values(contentFields).flat(),
    ...[
      "graphic.cornerRadius",
      "graphic.innerRadius",
      "graphic.viewBox",
      "tooltipAppearance",
      "tooltipOffset",
      "tooltip.imageAlt",
    ].map((name) => ({ name })),
  ];
  for (const input of specs) {
    const spec = hotspotFieldSpec(input);
    if (spec.help) assert.notEqual(t(spec.help), spec.help, input.name);
    if (spec.label && spec.help)
      assert.notEqual(t(spec.label), spec.label, input.name);
    for (const option of spec.options ?? []) {
      const label = spec.optionLabels?.[option];
      assert.ok(label, `${spec.name}/${option}`);
      assert.notEqual(t(label), label, `${spec.name}/${option}`);
    }
  }
});

test("the actual inspector wires numeric constraints and help into point, vertex and graphic fields", async () => {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { HotspotInspector } = await import("../src/inspector");
  const noop = () => {};
  const render = (
    hotspot: import("@ericchen1990/pano-view").ProjectHotspotDefinition
  ) =>
    renderToStaticMarkup(
      createElement(HotspotInspector, {
        hotspot,
        scenes: [],
        onChange: noop,
        onBegin: noop,
        onEnd: noop,
        onPick: noop,
        getViewPosition: () => ({ yaw: 0, pitch: 0 }),
        t: translator("en"),
      })
    );
  const point = render({
    id: "sprite",
    type: "sequence",
    src: "sprite.png",
    frameCount: 4,
    position: { yaw: 0, pitch: 0 },
  });
  assert.match(point, /aria-label="Field help: Drawing order"/);
  assert.match(point, /min="-90" max="90" step="any" required=""/);
  assert.match(point, /min="1" max="9007199254740991" step="1" required=""/);
  assert.match(point, /min="0" max="1" step="any"/);
  const path = render({
    id: "line",
    type: "polyline",
    vertices: [
      { yaw: 0, pitch: 0 },
      { yaw: 10, pitch: 10 },
    ],
  });
  assert.equal(
    (path.match(/min="-90" max="90" step="any" required=""/g) ?? []).length,
    2
  );
  const graphic = render({
    id: "shape",
    type: "graphic",
    position: { yaw: 0, pitch: 0 },
    graphic: { kind: "ring" },
  });
  assert.match(graphic, /aria-label="Field help: Ring inner radius ratio"/);
  assert.match(graphic, /Inner radius relative to the outer radius/);
});
