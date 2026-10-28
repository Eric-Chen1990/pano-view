/** Resolve image URLs inside CSS cursor values without changing keywords or hotspot coordinates. */
export function mapCursorAssets(
  cursor: string,
  resolve: (path: string) => string,
): string {
  return cursor.replace(
    /url\(\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|((?:\\.|[^)\\])*?))\s*\)/gi,
    (
      _match,
      double: string | undefined,
      single: string | undefined,
      bare: string | undefined,
    ) => {
      const path = (double ?? single ?? bare ?? "").replace(
        /\\([\da-f]{1,6}\s?|.)/gi,
        (_escape, value: string) =>
          /^[\da-f]/i.test(value)
            ? String.fromCodePoint(
                Math.min(parseInt(value.trim(), 16), 0x10ffff),
              )
            : value,
      );
      return `url(${JSON.stringify(resolve(path))})`;
    },
  );
}

export function cursorImage(cursor: string | undefined): string | undefined {
  let image: string | undefined;
  if (cursor)
    mapCursorAssets(cursor, (path) => {
      image ??= path;
      return path;
    });
  return image;
}

export function imageCursor(path: string): string {
  return `url(${JSON.stringify(path)}) 0 0, pointer`;
}
