# Panorama hotspot terminology

- **Hotspot**: a rendered, optional interactive object placed in a panorama.
  Its collection, persistence, and business action are owned by the host.
- **Point Hotspot**: a hotspot anchored by exactly one `HotspotPosition`
  (`yaw` and `pitch`). Image, graphic, sequence, and video hotspots are point
  hotspots.
- **Image Hotspot**: a point hotspot whose visual content is a URL texture.
- **Graphic Hotspot**: a point hotspot rendered from a built-in shape, SVG URL,
  or safe SVG path data and viewBox.
- **Sequence Hotspot**: a point hotspot whose visual content is a sprite sheet
  with equally sized horizontal or vertical frames. It is not a list of image
  URLs.
- **Video Hotspot**: a point hotspot whose visual content is an HTML video
  element exposed as a Three.js video texture.
- **Polygon Hotspot**: a closed, simple local spherical area defined by at
  least three vertices. It can have fill and/or an outline. Valid polygons do
  not self-intersect, contain a pole, or span more than one hemisphere.
- **Polyline Hotspot**: an open spherical path defined by at least two
  vertices. It has an outline only and never reconnects its final vertex to
  its first.
- **Hotspot Anchor**: the shared internal placement and orientation mechanism
  for point hotspot visuals and interaction.
- **Surface placement**: positioned immediately inside the panorama shell.
  **Floating placement**: positioned nearer to the camera along the same
  panorama ray.
- **Billboard orientation**: a point visual faces the camera. **Surface
  orientation**: a point visual follows the local panorama normal.
- **FOV scale mode**: size follows zoom. **Fixed scale mode**: size compensates
  for FOV changes relative to a reference FOV.
- **Controlled hotspot**: its position, vertices, visibility, and media
  `playing` state are passed by the host and must be written back by the host
  after callbacks.
