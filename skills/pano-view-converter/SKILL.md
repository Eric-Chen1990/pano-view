---
name: pano-view-converter
description: Convert or restore local panorama and flat images with @ericchen1990/pano-converter, pano-convert, convertImage or restoreImage. Use for cube tiles, equirectangular tiles, Deep Zoom, viewer.json generation, and converter errors.
---

# Convert and restore images locally

- Check the installed converter's Node.js and platform requirements, exports, and `pano-convert --help`. Read [the quickstart](references/quickstart.md) for commands, projection choices and output consumers.
- Use a full 2:1 static panorama for `cubemap` or `equirectangular`, and use `planar` for flat images. Check FFmpeg's `v360` filter for cube conversion or restoration. Keep converter execution in Node.js or a local shell.
- Use a new or empty output directory for each operation. Keep the generated directory structure. After conversion, verify the descriptor and its referenced assets. For a static panorama tour, carry `viewer.json`, its preview and its tiles forward into the project workflow. Use the full manifest to restore the source layout.
- For host uploads, await each `onAsset` operation before the callback returns. Publish the full archival manifest only after conversion succeeds. Keep task, storage and cleanup ownership in the host.
- Verify with a representative local image. For restoration, check the reconstructed dimensions for the selected level. For viewer delivery, confirm the descriptor and a representative preview and tile load through the host viewer.
