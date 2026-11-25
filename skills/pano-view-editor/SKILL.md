---
name: pano-view-editor
description: Embed @ericchen1990/pano-editor into a React host, edit panorama scenes and hotspots, or connect project saving, local folders, ZIP export, asset picking and panorama imports.
---

# Embed the Pano View editor

- Check the resolved editor, viewer peer and public types in the host. Read [the quickstart](references/quickstart.md) for the component, both stylesheet imports and the host callback contract.
- Use `defaultValue` for an editor-owned document, or `value` with `onChange` for a host-controlled document. Key the component by project ID when the host switches documents. Treat `onChange` as a draft and keep save and export validation at their respective boundaries.
- Choose a local directory session for existing files or supply host callbacks for durable saving, asset picking and raw image import. Local previews use temporary URLs. Keep relative resource paths for JSON exports and use the project ZIP when local resources need to travel with the document.
- For raw image import, connect `onImportPanorama` to the host's conversion service and forward its cancellation signal. Return the converted source only after its descriptor and assets are reachable. Use `pano-view-converter` if installed or the public converter guide linked in the quickstart for the Node.js side.
- Verify the requested editing flow with a real project, including save failure or import cancellation if applicable. Check exported JSON or the project package through the viewer when export is part of the task.
