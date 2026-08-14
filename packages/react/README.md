# @pano-view/react

React components for panoramic viewing experiences.

## Install

```bash
npm install @pano-view/react
```

`react` and `react-dom` 18 or 19 are required peer dependencies.

## Usage

```tsx
import { PanoView } from "@pano-view/react";

export function Scene() {
  return <PanoView className="viewer-shell">Your panorama goes here.</PanoView>;
}
```

`PanoView` is currently an unstyled container placeholder. It accepts the same
props as a native `div` and will become the root API for future viewing tools.

## Support

Maintained by [Eric Chen](https://github.com/Eric-Chen1990). Please open an
[issue](https://github.com/Eric-Chen1990/pano-view/issues) for bugs and feature
requests.
