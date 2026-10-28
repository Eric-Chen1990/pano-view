/** Cursor PNGs are kept small so browsers can display them consistently. */
export async function validateCursorImage(file: File): Promise<void> {
  const bytes = new Uint8Array(await file.slice(0, 24).arrayBuffer());
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (
    bytes.length < 24 ||
    signature.some((value, index) => bytes[index] !== value)
  )
    throw new Error("Choose a PNG cursor image up to 32 × 32 pixels.");
  const view = new DataView(bytes.buffer);
  const width = view.getUint32(16),
    height = view.getUint32(20);
  if (!width || !height || width > 32 || height > 32)
    throw new Error("Choose a PNG cursor image up to 32 × 32 pixels.");
}
