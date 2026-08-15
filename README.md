# Pano View

Composable React components for building single-image sphere and six-face
multiresolution panoramic viewing experiences.

`@ericchen1990/pano-view` is a lightweight React alternative for projects that
need to display equirectangular panoramas or krpano-style cube-tile output in a
custom application. Its default tile URL layout is compatible with common
krpano multires exports, so an existing krpano tile pyramid can be reused
without a viewer runtime or XML configuration.

Try the components in the [live playground](https://pano-view-playground.vercel.app/).

This repository is a `pnpm` workspace with the publishable `@ericchen1990/pano-view`
package and a local Vite playground.

## Local development

```bash
pnpm install
pnpm dev
```

The playground will open through Vite and imports the component package source
directly, so component changes are visible without rebuilding the package.

## Validation

```bash
pnpm build
pnpm typecheck
pnpm pack:check
```

## Publishing

Before the first public release, confirm that you own the `@ericchen1990` npm
scope, then authenticate and publish from the package directory:

```bash
npm login
cd packages/react
npm publish --access public
```

The package exports `PanoView`, `Sphere`, `Tile`, and five point/area hotspot
renderers: `ImageHotspot`, `GraphicHotspot`, `SequenceHotspot`, `VideoHotspot`,
and `PolygonHotspot`. `PolylineHotspot` is available for open paths. See the
[`@ericchen1990/pano-view` README](./packages/react/README.md) for the public API,
krpano-compatible tile layout, controls, hotspot coordinates, accessibility,
and Next.js usage. Domain terms are defined in [CONTEXT.md](./CONTEXT.md).

## Maintainer and support

Maintained by [Eric Chen](https://github.com/Eric-Chen1990). Please report
bugs and feature requests through the
[GitHub issue tracker](https://github.com/Eric-Chen1990/pano-view/issues).
