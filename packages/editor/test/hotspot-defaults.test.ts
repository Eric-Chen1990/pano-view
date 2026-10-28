import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ProjectHotspotDefinition } from "@ericchen1990/pano-view";
import {
  createHotspot,
  hotspotKinds,
  exportDocument,
  readDocument,
} from "../src/document";
import { Field, getField, setHotspotField } from "../src/fields";
import { fieldValue, hotspotFieldDefault } from "../src/hotspot-defaults";
import { HotspotInspector } from "../src/inspector";
import { translator } from "../src/i18n";
import { DocumentHistory } from "../src/history";

const position = { yaw: 10, pitch: 5 };
const noop = () => {};

test("all nine creation presets have localized unique names and ready-to-use tooltips", () => {
  for (const kind of hotspotKinds) {
    const first = createHotspot(kind, position, "media/resource", {
      t: translator("zh-CN"),
    });
    const second = createHotspot(kind, position, "media/resource", {
      t: translator("zh-CN"),
      hotspots: [first],
    });
    assert.equal(first.label, `${translator("zh-CN")(kind)} 1`);
    assert.equal(second.label, `${translator("zh-CN")(kind)} 2`);
    assert.equal(first.tooltip, kind === "text" ? undefined : first.label);
    assert.equal(first.tooltipTrigger, "always");
    assert.equal(first.tooltipPlacement, "top");
    assert.equal(first.tooltipOffset, 12);
    assert.equal(first.tooltipAppearance, undefined);
    assert.notEqual(first.id, second.id);
    if ("position" in first) assert.deepEqual(first.position, position);
    else assert.deepEqual(first.vertices, []);
  }
  const first = createHotspot("graphic", position);
  assert.equal(first.label, "Graphic 1");
  const third = { ...first, label: "Graphic 3" };
  assert.equal(
    createHotspot("graphic", position, "", { hotspots: [first, third] }).label,
    "Graphic 2"
  );
  assert.equal(
    createHotspot("graphic", position, "", { hotspots: [third] }).label,
    "Graphic 1"
  );
});

test("name changes and duplication keep customized or cleared tooltip content independent", () => {
  const original = createHotspot("graphic", position);
  const renamed = setHotspotField(original, "label", "A new name");
  assert.equal(renamed.tooltip, original.tooltip);
  const customized = setHotspotField(renamed, "tooltip.text", "Visitor text");
  assert.equal(customized.label, "A new name");
  const image = setHotspotField(
    customized,
    "tooltip.image",
    "media/tooltip.webp"
  );
  assert.deepEqual(image.tooltip, {
    text: "Visitor text",
    image: "media/tooltip.webp",
  });
  const cleared = setHotspotField(image, "tooltip.text", "");
  assert.deepEqual(cleared.tooltip, { text: "", image: "media/tooltip.webp" });
  const hidden = setHotspotField(cleared, "tooltip.image", "");
  const duplicate = { ...structuredClone(hidden), id: "copy" };
  assert.deepEqual(duplicate.tooltip, { text: "", image: "" });
  assert.deepEqual(original.tooltip, original.label);
});

test("defaults follow each viewer type and preserve explicit false, zero and empty text", () => {
  const graphic = createHotspot("graphic", position);
  const polygon = createHotspot("polygon", position);
  assert.equal(hotspotFieldDefault(graphic, "renderOrder"), 0);
  assert.equal(hotspotFieldDefault(polygon, "renderOrder"), 10);
  assert.equal(hotspotFieldDefault(graphic, "width"), 10);
  assert.equal(
    hotspotFieldDefault(createHotspot("video", position), "width"),
    16
  );
  assert.equal(
    hotspotFieldDefault(createHotspot("sequence", position), "loop"),
    true
  );
  assert.equal(
    hotspotFieldDefault(createHotspot("video", position), "muted"),
    true
  );
  assert.equal(
    hotspotFieldDefault(createHotspot("audio", position), "muted"),
    false
  );
  assert.equal(hotspotFieldDefault(graphic, "tooltipOffset"), 12);
  assert.equal(hotspotFieldDefault(graphic, "src"), undefined);
  assert.equal(
    hotspotFieldDefault(createHotspot("iframe", position), "sandbox"),
    undefined
  );
  assert.equal(fieldValue(false, true), false);
  assert.equal(fieldValue(0, 12), 0);
  assert.equal(fieldValue("", "default"), "");
  assert.equal(fieldValue(undefined, 12), 12);

  const overridden = setHotspotField(graphic, "scale", 2);
  const reset = setHotspotField(overridden, "scale", undefined);
  assert.equal("scale" in reset, false);
  assert.equal(
    fieldValue(getField(reset, "scale"), hotspotFieldDefault(reset, "scale")),
    1
  );
});

test("field rendering displays effective defaults without committing them", () => {
  const render = (
    type: "number" | "boolean" | undefined,
    value: unknown,
    defaultValue: unknown
  ) =>
    renderToStaticMarkup(
      createElement(Field, {
        spec: { name: "example", type, defaultValue },
        value,
        onChange: () => assert.fail("render must not commit defaults"),
        onBegin: noop,
        onEnd: noop,
        t: translator("en"),
      })
    );
  assert.match(render("number", undefined, 12), /value="12"/);
  assert.match(render("number", 0, 12), /value="0"/);
  assert.match(render(undefined, "", "fallback"), /value=""/);
  assert.match(render("boolean", undefined, true), /checked=""/);
  assert.doesNotMatch(render("boolean", false, true), /checked=/);
});

test("opening old hotspots presents translated defaults without changing project data or history", () => {
  const old: ProjectHotspotDefinition = {
    id: "legacy",
    type: "sequence",
    label: "Original",
    position,
    src: "media/sprite.webp",
    frameCount: 4,
  };
  const project = {
    schemaVersion: 1 as const,
    scenes: [
      {
        id: "scene",
        source: { viewerUrl: "pano/viewer.json" },
        hotspots: [old],
      },
    ],
  };
  const document = readDocument(project);
  const history = new DocumentHistory(document);
  const before = JSON.stringify(document);
  for (const locale of ["en", "zh-CN"] as const) {
    const html = renderToStaticMarkup(
      createElement(HotspotInspector, {
        hotspot: old,
        scenes: document.scenes,
        t: translator(locale),
        onChange: () => assert.fail("opening inspector must not commit"),
        onBegin: noop,
        onEnd: noop,
        onPick: noop,
        getViewPosition: () => position,
      })
    );
    assert.match(html, /value="always" selected=""/);
    assert.match(html, /value="top" selected=""/);
    assert.match(html, /value="12"/);
    assert.ok(html.includes(translator(locale)("Using default style")));
    assert.ok(html.includes(translator(locale)("Hotspot name")));
    assert.ok(html.includes(translator(locale)("On hover or focus")));
  }
  assert.equal(JSON.stringify(document), before);
  assert.equal(history.past.length, 0);
  assert.equal(old.tooltip, undefined);
  assert.equal(old.loop, undefined);
  assert.equal(old.tooltipTrigger, undefined);
  assert.deepEqual(
    JSON.parse(exportDocument(document)).scenes[0].hotspots[0],
    old
  );

  const edited = {
    ...document,
    scenes: [
      {
        ...document.scenes[0]!,
        hotspots: [setHotspotField(old, "tooltip.text", "")],
      },
    ],
  };
  history.commit(edited);
  assert.equal(history.undo().scenes[0]!.hotspots![0]!.tooltip, undefined);
  assert.equal(history.redo().scenes[0]!.hotspots![0]!.tooltip, "");
  assert.equal(
    readDocument(JSON.parse(exportDocument(edited))).scenes[0]!.hotspots![0]!
      .tooltip,
    ""
  );
});

test("enum defaults have concrete selections without duplicate reset options, while inheritance remains explicit", () => {
  const render = (spec: import("../src/fields").FieldSpec, value: unknown) => renderToStaticMarkup(createElement(Field, {
    spec, value, onChange: noop, onBegin: noop, onEnd: noop, t: translator("en"),
  }));
  const concrete = render({ name: "tooltipTrigger", defaultValue: "always", options: ["always", "hover", "click"] }, undefined);
  assert.match(concrete, /value="always" selected=""/);
  assert.doesNotMatch(concrete, /<option value=""|Use default|Reset:/);
  const override = render({ name: "tooltipOffset", type: "number", defaultValue: 12 }, 0);
  assert.match(override, /value="0"/);
  assert.match(override, /Reset: TooltipOffset|Reset:/);
  assert.match(render({ name: "cursor", options: ["pointer"] }, undefined), /Use viewer default/);
});

test("mode-dependent camera fields are disabled until their controlling mode applies", () => {
  const hotspot = { ...createHotspot("graphic", position), mode: "surface" as const, scaleMode: "fov" as const };
  const render = (value: ProjectHotspotDefinition) => renderToStaticMarkup(createElement(HotspotInspector, {
    hotspot: value, scenes: [], onChange: noop, onBegin: noop, onEnd: noop, onPick: noop, getViewPosition: () => position, t: translator("en"),
  }));
  const html = render(hotspot);
  const inputs = [...html.matchAll(/<input[^>]+>/g)].map((match) => match[0]);
  assert.ok(inputs.some((input) => input.includes('value="10"') && input.includes("disabled")));
  assert.ok(inputs.some((input) => input.includes('value="75"') && input.includes("disabled")));
  const active = render({ ...hotspot, mode: "billboard", scaleMode: "fixed" });
  assert.doesNotMatch(active, /<input[^>]*disabled[^>]*value="(?:10|75)"/);
});
