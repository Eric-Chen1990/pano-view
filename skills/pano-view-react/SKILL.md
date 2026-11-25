---
name: pano-view-react
description: Integrate or troubleshoot @ericchen1990/pano-view in React or Next.js for 360 panoramas, cube or sphere tiles, 360 video, or tiled flat images. Use for viewer setup, source selection, runtime controls, rendering and asset-loading issues.
---

# Integrate the Pano View React SDK

- Check the host's package manager, resolved SDK and peer versions, and public exports and types. If the package is missing, use the host's package manager and check peers for the selected version. Verify APIs in the installed types or matching release docs before using examples from the default branch.
- Read [the quickstart](references/quickstart.md) for source selection, a copyable React component, stylesheet imports and the Next.js client boundary.
- Start with one source and a sized viewer. For a blank or blurry view, check the container and the actual preview and detail requests before changing rendering options. Check final URLs, HTTP status, redirects, CORS and media type. Preserve converter templates and on-disk index conventions. When debugging backend-specific behavior, read the actual backend with `getRendererBackend()` if the installed SDK exposes it.
- Use React `Scenes` for an in-memory list of image or tiled scenes. For persisted tours, follow `pano-view-project` if installed or use the public project guide linked in the quickstart. Keep host controls and app state in the owning React app.
- Verify the chosen source in the host browser. Exercise the requested interaction and any reported failure path. For video and WebXR changes, report which browsers or devices you exercised.
