/** Capture entries synchronously: browsers clear the drag data after the event. */
export function droppedDirectoryFiles(data: DataTransfer): Promise<File[]> {
  const entries = Array.from(data.items, (item) => item.webkitGetAsEntry?.());
  if (!entries.some(Boolean)) return Promise.resolve(Array.from(data.files));

  async function read(entry: FileSystemEntry, parent = ""): Promise<File[]> {
    const path = parent + entry.name;
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) =>
        (entry as FileSystemFileEntry).file(resolve, reject),
      );
      Object.defineProperty(file, "webkitRelativePath", { value: path });
      return [file];
    }
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const children: FileSystemEntry[] = [];
    // Chromium returns directory entries in batches (often 100 at a time).
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
        reader.readEntries(resolve, reject),
      );
      if (!batch.length) break;
      children.push(...batch);
    }
    const files = await Promise.all(
      children.map((child) => read(child, path + "/")),
    );
    return files.flat();
  }
  return Promise.all(
    entries
      .filter((entry): entry is FileSystemEntry => Boolean(entry))
      .map((entry) => read(entry)),
  ).then((files) => files.flat());
}
