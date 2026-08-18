---
"@ericchen1990/pano-view": major
---

Move the built-in HTML chrome to Tailwind CSS utility classes. Host apps must
install Tailwind CSS v4 and add an `@source` entry that scans
`@ericchen1990/pano-view`; otherwise video controls, captions, context menus,
tooltips, and accessibility-only chrome render without their default styling.
