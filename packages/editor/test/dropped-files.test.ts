import assert from "node:assert/strict";
import { test } from "node:test";
import { droppedDirectoryFiles } from "../src/dropped-files";

function directory(name: string, batches: FileSystemEntry[][]): FileSystemEntry {
  return {
    name,
    isDirectory: true,
    isFile: false,
    createReader: () => ({
      readEntries: (success: (entries: FileSystemEntry[]) => void) => success(batches.shift() ?? []),
    }),
  } as FileSystemDirectoryEntry;
}
function file(name: string): FileSystemEntry {
  return {
    name,
    isFile: true,
    isDirectory: false,
    file: (success: (value: File) => void) => success(new File([name], name)),
  } as FileSystemFileEntry;
}

test("dropped directories read every batch and retain nested paths and file contents", async () => {
  const root = directory("tour #1", [
    [file("viewer.json")],
    [directory("tiles", [[file("tile.webp")]])],
  ]);
  const files = await droppedDirectoryFiles({
    items: [{ webkitGetAsEntry: () => root }],
  } as unknown as DataTransfer);
  assert.deepEqual(files.map((entry) => entry.webkitRelativePath), ["tour #1/viewer.json", "tour #1/tiles/tile.webp"]);
  assert.equal(await files[1]!.text(), "tile.webp");
});

test("directory read failures reject instead of importing an incomplete scene", async () => {
  const root = {
    isFile: false,
    name: "unreadable",
    createReader: () => ({
      readEntries: (_: unknown, reject: (cause: Error) => void) => reject(new Error("Access denied")),
    }),
  } as unknown as FileSystemEntry;
  await assert.rejects(droppedDirectoryFiles({ items: [{ webkitGetAsEntry: () => root }] } as unknown as DataTransfer), /Access denied/);
});
