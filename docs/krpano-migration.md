# Reuse krpano-style cube tiles in React

[中文](./krpano-migration.zh-CN.md)

Pano View renders an existing krpano-style cube-tile pyramid inside a React
application. It supports the output format; it is not a krpano plugin, wrapper,
replacement, or affiliated project.

Open the [tile-enabled Playground](https://pano-view-playground.vercel.app/hotspots?utm_source=github&utm_medium=docs&utm_campaign=krpano-migration&utm_content=tile-demo)
to inspect a working scene.

## Map the XML values directly

Read the actual values from the krpano XML. Do not rely on Pano View's default
tile layout: a common krpano folder uses row before column in the filename,
while the default package template uses column before row.

| krpano XML | Tile prop |
| --- | --- |
| cube url | urlTemplate |
| cube multires | multires |
| preview url | previewUrl |
| preview striporder | previewFaceOrder (omit when `LFRBUD`) |

Given this XML:

~~~xml
<preview url="preview.jpg" />
<image>
  <cube
    url="tiles/%s/l%l/%v/l%l_%s_%v_%h.jpg"
    multires="512,1000,2000"
  />
</image>
~~~

pass the same values to Tile. krpano default `striporder` is `LFRBUD`, which
matches Tile's default `previewFaceOrder`, so the prop can be omitted:

~~~tsx
import { PanoViewer, Tile } from "@ericchen1990/pano-view";

export function MigratedPanorama() {
  return (
    <PanoViewer style={{ height: 560 }}>
      <Tile
        baseUrl="/panoramas/room"
        urlTemplate="tiles/%s/l%l/%v/l%l_%s_%v_%h.jpg"
        multires="512,1000,2000"
        previewUrl="preview.jpg"
      />
    </PanoViewer>
  );
}
~~~

## Resolve paths before changing rendering settings

The template and preview path are relative to baseUrl. Root-absolute and HTTP(S)
URLs are used as-is. Confirm one generated URL for each face and level in the
browser network panel before investigating projection, level-of-detail, or
WebGL behavior.

- The preview must be the 1×6 cube-strip image, not a thumbnail.
- previewFaceOrder lists the atlas faces from top to bottom. It defaults to
  `l`, `f`, `r`, `b`, `u`, `d`. Set it only when `striporder` differs.
- Tile rows and columns are 1-based.
- The first multires value is tile size; the remaining values are ascending
  cube-face sizes.
- If a source layout cannot be expressed by urlTemplate, use resolveTileUrl.
  It also returns a path relative to baseUrl and takes precedence over the
  template.

## Map hotspots in React, not XML

Pano View does not parse krpano hotspot actions. Each `<hotspot>` becomes a
React child beside Tile, or inside Scenes `renderHotspots`.

| krpano XML | Hotspot prop |
| --- | --- |
| name | id |
| url | ImageHotspot src |
| ath | position.yaw |
| atv | −position.pitch |
| type="poly" and point ath/atv | PolygonHotspot vertices |
| onclick="loadscene(...)" | onClick plus Scenes `activeSceneId` |

krpano `atv` is positive when looking down. Pano View `pitch` is positive when
looking up, so copy `ath` as `yaw` and negate `atv`.

Given this XML:

~~~xml
<hotspot
  name="to-garden"
  url="hotspots/arrow.png"
  ath="120"
  atv="8"
  onclick="loadscene(garden);"
/>
<hotspot
  name="exhibit"
  type="poly"
  fillcolor="0xDF6B42"
  fillalpha="0.32"
  bordercolor="0xF5FBFC"
  borderwidth="2"
>
  <point ath="16" atv="-8" />
  <point ath="31" atv="-7" />
  <point ath="27" atv="-19" />
  <point ath="19" atv="-16" />
</hotspot>
~~~

render the same positions as React hotspots:

~~~tsx
import {
  ImageHotspot,
  PanoViewer,
  PolygonHotspot,
  Tile,
} from "@ericchen1990/pano-view";

export function MigratedPanorama() {
  return (
    <PanoViewer style={{ height: 560 }}>
      <Tile
        baseUrl="/panoramas/room"
        urlTemplate="tiles/%s/l%l/%v/l%l_%s_%v_%h.jpg"
        multires="512,1000,2000"
        previewUrl="preview.jpg"
      />
      <ImageHotspot
        id="to-garden"
        ariaLabel="Go to garden"
        position={{ yaw: 120, pitch: -8 }}
        src="/panoramas/room/hotspots/arrow.png"
        onClick={() => setActiveSceneId("garden")}
      />
      <PolygonHotspot
        id="exhibit"
        vertices={[
          { yaw: 16, pitch: 8 },
          { yaw: 31, pitch: 7 },
          { yaw: 27, pitch: 19 },
          { yaw: 19, pitch: 16 },
        ]}
        fill="#df6b42"
        fillOpacity={0.32}
        stroke="#f5fbfc"
        strokeWidth={2}
      />
    </PanoViewer>
  );
}
~~~

- Hotspot `url` paths are ordinary assets, not tile templates. Resolve them
  against the scene folder the same way as other host images.
- `width` and `height` are angular degrees, not krpano pixel sizes.
- `distorted="true"` maps to `mode="surface"`. The default billboard mode
  matches undistorted hotspots.
- Sprite-strip animations map to SequenceHotspot.
- Action strings are not executed. Drive Scenes with React state instead of
  `loadscene`.

## Common migration failures

| Symptom | First check |
| --- | --- |
| A face is missing or scrambled | Compare the generated URL with the XML template; verify row and column placeholder order. |
| The initial image is wrong | Use the cube-strip preview, not thumb.jpg, and set previewFaceOrder when necessary. |
| Requests omit the panorama folder | Keep relative urlTemplate and previewUrl values under baseUrl. |
| Tiles load but look blurred | Verify every multires value and inspect requests while moving or zooming. |
| A hotspot sits too high or low | Negate `atv`: `pitch = -atv`. |
| A hotspot click does nothing | Map `onclick` to a React handler; `loadscene` is not executed. |

For Tile props, hotspots, and scene transitions, see the [API
reference](../packages/react/README.md#tile).
