# Pano View

React components for building panoramic viewing experiences.

This repository is a `pnpm` workspace with the publishable `@pano-view/react`
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

Before the first public release, confirm that you own the `@pano-view` npm
scope, then authenticate and publish from the package directory:

```bash
npm login
cd packages/react
npm publish --access public
```

The package is currently an early placeholder API. Review its version, README,
and package contents before every release.

## Maintainer and support

Maintained by [Eric Chen](https://github.com/Eric-Chen1990). Please report
bugs and feature requests through the
[GitHub issue tracker](https://github.com/Eric-Chen1990/pano-view/issues).
