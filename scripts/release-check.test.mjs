import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { checkRelease, readNpmPackage } from "./release-check.mjs";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "pano-release-check-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, ".changeset"));
  await mkdir(join(root, "apps"));
  await writeFile(join(root, ".changeset/config.json"), JSON.stringify({ access: "public", ignore: [] }));
  for (const folder of ["view", "editor", "converter"]) {
    const directory = join(root, "packages", folder);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "package.json"), JSON.stringify({
      name: `@ericchen1990/pano-${folder}`,
      version: "1.1.0",
      repository: { url: "git+https://github.com/Eric-Chen1990/pano-view.git" },
    }));
    await writeFile(join(directory, "CHANGELOG.md"), "## 1.1.0\n\n### Minor Changes\n\n- Feature\n");
  }
  return root;
}
const metadata = (published = false) => async (name) => ({
  name, versions: { "1.0.0": {}, ...(published ? { "1.1.0": {} } : {}) },
  "dist-tags": { latest: published ? "1.1.0" : "1.0.0" },
});

test("plans all unpublished packages and skips already published versions on retry", async (t) => {
  const root = await fixture(t);
  assert.equal((await checkRelease(root, metadata())).length, 3);
  assert.equal((await checkRelease(root, metadata(true))).length, 0);
  const remaining = await checkRelease(root, (name) => metadata(name.endsWith("view"))(name));
  assert.equal(remaining.length, 2);
  assert.ok(remaining.every(({ name }) => !name.endsWith("view")));
});
test("blocks pending changesets and missing changelogs", async (t) => {
  const root = await fixture(t);
  await writeFile(join(root, ".changeset/pending.md"), "---\n---\n");
  await assert.rejects(checkRelease(root, metadata()), /Pending changesets/);
  await rm(join(root, ".changeset/pending.md"));
  await writeFile(join(root, "packages/view/CHANGELOG.md"), "## 1.0.0\n");
  await assert.rejects(checkRelease(root, metadata()), /Missing generated changelog/);
});
test("blocks unknown public workspace packages and prerelease mode", async (t) => {
  const root = await fixture(t);
  await writeFile(join(root, ".changeset/pre.json"), "{}");
  await assert.rejects(checkRelease(root, metadata()), /stable releases only/);
  await rm(join(root, ".changeset/pre.json"));
  await mkdir(join(root, "apps/unexpected"));
  await writeFile(join(root, "apps/unexpected/package.json"), '{"name":"unexpected"}');
  await assert.rejects(checkRelease(root, metadata()), /Unexpected public package/);
});
test("blocks backwards latest updates, malformed metadata and registry failures", async (t) => {
  const root = await fixture(t);
  await assert.rejects(checkRelease(root, async (name) => ({
    name, versions: {}, "dist-tags": { latest: "2.0.0" },
  })), /latest backwards/);
  await assert.rejects(checkRelease(root, async (name) => ({ name })), /Invalid npm versions/);
  await assert.rejects(checkRelease(root, async () => { throw new Error("network unavailable"); }), /network unavailable/);
});
test("HTTP errors never become an unpublished release plan", async (t) => {
  for (const status of [401, 403, 404, 429, 503]) {
    t.mock.method(globalThis, "fetch", async () => new Response(null, { status }));
    await assert.rejects(readNpmPackage("@ericchen1990/pano-view"), new RegExp(`HTTP ${status}`));
    t.mock.restoreAll();
  }
});
