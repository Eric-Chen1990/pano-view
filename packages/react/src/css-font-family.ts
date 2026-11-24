/** Quote multi-word CSS font-family names for canvas `font` strings. */
export function cssFontFamily(family: string): string {
  return family
    .split(",")
    .map((part) => {
      const face = part.trim().replace(/^["']|["']$/g, "");
      if (!face) {
        return "";
      }
      if (/^[a-zA-Z-]+$/.test(face)) {
        return face;
      }
      return `"${face.replace(/"/g, '\\"')}"`;
    })
    .filter(Boolean)
    .join(", ");
}
