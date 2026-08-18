export function isAbsoluteAssetUrl(url: string): boolean {
  return (
    url.startsWith("/") ||
    url.startsWith("//") ||
    /^[a-z][a-z0-9+.-]*:/i.test(url)
  );
}

export function resolveRelativeAssetUrl(
  baseUrl: string,
  relativePath: string,
): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const normalizedPath = relativePath.replace(/^\/+/, "");
  return normalizedBaseUrl
    ? `${normalizedBaseUrl}/${normalizedPath}`
    : normalizedPath;
}

export function resolveAssetUrl(baseUrl: string, path: string): string {
  return isAbsoluteAssetUrl(path) ? path : resolveRelativeAssetUrl(baseUrl, path);
}

export function resolveUrlAgainstFile(fileUrl: string, path: string): string {
  if (isAbsoluteAssetUrl(path)) {
    return path;
  }
  const slash = fileUrl.lastIndexOf("/");
  const directory = slash === -1 ? "" : fileUrl.slice(0, slash);
  return resolveRelativeAssetUrl(directory, path);
}
