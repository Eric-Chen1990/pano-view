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
| preview striporder | previewFaceOrder |

Given this XML:

~~~xml
<preview url="preview.jpg" striporder="lfrbud" />
<image>
  <cube
    url="tiles/%s/l%l/%v/l%l_%s_%v_%h.jpg"
    multires="512,1000,2000"
  />
</image>
~~~

pass the same values to Tile:

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
        previewFaceOrder={["l", "f", "r", "b", "u", "d"]}
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
- previewFaceOrder lists the atlas faces from top to bottom.
- Tile rows and columns are 1-based.
- The first multires value is tile size; the remaining values are ascending
  cube-face sizes.
- If a source layout cannot be expressed by urlTemplate, use resolveTileUrl.
  It also returns a path relative to baseUrl and takes precedence over the
  template.

## Common migration failures

| Symptom | First check |
| --- | --- |
| A face is missing or scrambled | Compare the generated URL with the XML template; verify row and column placeholder order. |
| The initial image is wrong | Use the cube-strip preview, not thumb.jpg, and set previewFaceOrder when necessary. |
| Requests omit the panorama folder | Keep relative urlTemplate and previewUrl values under baseUrl. |
| Tiles load but look blurred | Verify every multires value and inspect requests while moving or zooming. |

For props, placeholder syntax, and scene transitions, see the [Tile API
reference](../packages/react/README.md#tile).
