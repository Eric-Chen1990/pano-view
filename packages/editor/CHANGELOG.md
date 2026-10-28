# @ericchen1990/pano-editor

## 1.0.0

### Minor Changes

- 9c30a8f: Support click, pointer enter and pointer leave actions, host-owned custom actions with JSON parameters, unified cancellable events, and schema-driven editor forms with isolated preview callbacks. Preserve legacy click configuration and include all triggers in reference validation and exports.
- 426fba5: Add an embeddable panorama editor and a browser-only local-directory editor in the playground. Author scenes and all nine hotspot types, undo edits, preview tours and export portable project.json without uploading or persisting local files. Hosts can supply their own asset picker, saving and cancellable image conversion callbacks. Expose the viewer's shared hotspot resource resolver for editor rendering, and support optional audio format hints for blob and other extensionless audio URLs.

  Start the playground editor with a ready-made sample tour and downloadable sample files. Add or replace scene sources by dropping or selecting converted panorama directories, keeping their resources local and isolating filenames across imports.

  Distinguish online scene URLs from local folders in the import UI, explain resource and browser requirements, and reject local paths in online URL inputs.

  Nest hotspot lists under their scenes, replace the type toolbar with an Add hotspot picker, and expose per-hotspot edit and delete actions with undo support.

  Replace the scene actions section with drag handles for reordering and inline scene deletion. Confirm both scene and hotspot deletion, with named targets, keyboard support and undo. Preserve the mounted viewer when only scene order changes.

### Patch Changes

- Updated dependencies [9c30a8f]
- Updated dependencies [426fba5]
- Updated dependencies [91a4598]
- Updated dependencies [b9b2bfc]
  - @ericchen1990/pano-view@3.6.0
