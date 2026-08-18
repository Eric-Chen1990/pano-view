---
"@ericchen1990/pano-view": patch
---

Stop point-hotspot planes from occluding other hotspots through empty texels. Transparent pixels no longer write depth or capture pointer hits, so graphic/image/text/sequence shapes no longer clip polygons behind their rectangular bounds.
