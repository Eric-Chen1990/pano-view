---
"@ericchen1990/pano-view": patch
---

Apply `box-sizing: border-box` to `.pano-context-menu-item` so `width: 100%` plus item padding does not overflow the menu in hosts without a global CSS reset.
