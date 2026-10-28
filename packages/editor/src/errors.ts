export function errorMessage(error: unknown): string {
  const messages: string[] = [];
  const seen = new Set<unknown>();
  let current = error;
  while (current !== undefined && !seen.has(current)) {
    seen.add(current);
    const message =
      current instanceof Error ? current.message : String(current);
    if (!messages.includes(message)) messages.push(message);
    current =
      current instanceof Error
        ? (current as Error & { cause?: unknown }).cause
        : undefined;
  }
  return messages.join(": ");
}
